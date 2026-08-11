/**
 * Case3 业务控制器：
 * 负责初始化握手、Start/ReInit、串行轮询、完成门槛和截图协调。
 * 不负责文件解析；共享目录数据由 Node 适配服务归一后通过 REST 提供。
 * timer / AbortController / html-to-image 副作用留在本 hook。
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import { toPng } from "html-to-image";
import { createCase3Api, Case3ApiError, type Case3Api } from "../api/case3Api";
import {
  CASE3_ADAPTER_RECOVERY_PROBE_MS,
  CASE3_SCREENSHOT_MAX_ATTEMPTS,
  CASE3_SCREENSHOT_PIXEL_RATIO,
  CASE3_STAGE_HEIGHT,
  CASE3_STAGE_WIDTH,
  type Case3RuntimeConfig,
} from "../config/case3RuntimeConfig";
import { isFinalSideReady } from "../metrics/case3Metrics";
import {
  canReinit,
  canStartWith,
  canStartWithout,
  case3Reducer,
  createInitialCase3State,
  deriveVisibleState,
  isActionBusy,
  statusBadgeText,
} from "../state/case3Reducer";
import type { Case3Side } from "../types";

export type Case3BusyChange = (busy: boolean) => void;

export type MapRendererHandle = {
  resetView(): void;
  prepareCapture(): Promise<void>;
};

type ScreenshotPhase = "idle" | "saving" | "waitClear";

type Options = {
  config: Case3RuntimeConfig;
  stageElementRef: React.RefObject<HTMLElement>;
  mapRendererRefs?: {
    without: React.RefObject<MapRendererHandle | null>;
    with: React.RefObject<MapRendererHandle | null>;
  };
  api?: Case3Api;
  onBusyChange?: Case3BusyChange;
};

let entryLoadGeneration = 0;

function case3Log(event: string, data?: Record<string, unknown>): void {
  if (data === undefined) {
    console.info(`[case3] ${event}`);
    return;
  }
  console.info(`[case3] ${event}`, data);
}

function isAbortError(err: unknown): boolean {
  return (
    (err as { name?: string } | null)?.name === "AbortError" ||
    (typeof DOMException !== "undefined" &&
      err instanceof DOMException &&
      err.name === "AbortError")
  );
}

function dtTypeFor(side: Case3Side): "without dt" | "with dt" {
  return side === "without" ? "without dt" : "with dt";
}

function stripDataUrl(base64: string): string {
  const idx = base64.indexOf("base64,");
  return idx >= 0 ? base64.slice(idx + 7) : base64;
}

/**
 * Case3 唯一业务控制器。切 Tab 卸载即停止轮询与探测。
 */
export function useCase3Controller(options: Options) {
  const { config, stageElementRef, mapRendererRefs, onBusyChange } = options;
  const apiRef = useRef(options.api ?? createCase3Api());
  const [state, dispatchBase] = useReducer(
    case3Reducer,
    undefined,
    createInitialCase3State,
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback((action: Parameters<typeof case3Reducer>[1]) => {
    stateRef.current = case3Reducer(stateRef.current, action);
    dispatchBase(action);
  }, []);

  const pollTimerRef = useRef<number | null>(null);
  const probeTimerRef = useRef<number | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);
  const screenshotPhaseRef = useRef<ScreenshotPhase>("idle");
  const screenshotBase64Ref = useRef<string | null>(null);
  const lastFlagRef = useRef(0);
  const screenshotBusyRef = useRef(false);
  const pendingCompleteSideRef = useRef<Case3Side | null>(null);
  const busyRef = useRef(false);

  const setBusy = useCallback(
    (busy: boolean) => {
      if (busyRef.current === busy) return;
      busyRef.current = busy;
      onBusyChange?.(busy);
    },
    [onBusyChange],
  );

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current != null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
  }, []);

  const stopProbe = useCallback(() => {
    if (probeTimerRef.current != null) {
      window.clearTimeout(probeTimerRef.current);
      probeTimerRef.current = null;
    }
  }, []);

  const maybeFinishAfterScreenshot = useCallback(async () => {
    if (pendingCompleteSideRef.current == null) return;
    if (
      screenshotPhaseRef.current === "saving" ||
      screenshotPhaseRef.current === "waitClear"
    ) {
      return;
    }
    const side = pendingCompleteSideRef.current;
    pendingCompleteSideRef.current = null;
    try {
      await apiRef.current.postControl({ command: "init" });
    } catch (err) {
      case3Log("completion.init_fail", {
        side,
        reason: err instanceof Error ? err.message : String(err),
      });
      dispatch({ type: "ADAPTER_ERROR", value: true });
    }
    setBusy(false);
    stopPolling();
  }, [dispatch, setBusy, stopPolling]);

  /**
   * 截图机：仅 Start 等待态观察 flag 0→1；最多 3 次。
   */
  const runScreenshotTask = useCallback(async () => {
    if (screenshotBusyRef.current) return;
    screenshotBusyRef.current = true;
    screenshotPhaseRef.current = "saving";
    setBusy(true);

    const api = apiRef.current;
    let attempt = 0;
    let base64 = screenshotBase64Ref.current;

    try {
      while (attempt < CASE3_SCREENSHOT_MAX_ATTEMPTS) {
        attempt += 1;
        let failurePhase: "generate" | "upload" = base64
          ? "upload"
          : "generate";
        try {
          if (!base64) {
            failurePhase = "generate";
            const stage = stageElementRef.current;
            if (!stage) throw new Error("stage missing");
            await mapRendererRefs?.without.current?.prepareCapture();
            await mapRendererRefs?.with.current?.prepareCapture();
            const png = await toPng(stage, {
              width: CASE3_STAGE_WIDTH,
              height: CASE3_STAGE_HEIGHT,
              pixelRatio: CASE3_SCREENSHOT_PIXEL_RATIO,
              style: { transform: "none" },
              filter: (node) => {
                if (!(node instanceof HTMLElement)) return true;
                return !node.classList.contains("review-dock");
              },
            });
            base64 = stripDataUrl(png);
            screenshotBase64Ref.current = base64;
          }
          failurePhase = "upload";
          await api.postScreenshot(base64);
          screenshotPhaseRef.current = stateRef.current.activeAction
            ? "waitClear"
            : "idle";
          if (
            !stateRef.current.activeAction &&
            pendingCompleteSideRef.current
          ) {
            screenshotPhaseRef.current = "idle";
            await maybeFinishAfterScreenshot();
          }
          case3Log("screenshot.ok", { attempt });
          return;
        } catch (err) {
          if (isAbortError(err)) return;
          case3Log("screenshot.attempt_fail", {
            attempt,
            reason: err instanceof Error ? err.message : String(err),
            code: err instanceof Case3ApiError ? err.code : undefined,
          });
          if (
            err instanceof Case3ApiError &&
            err.code === "SCREENSHOT_NOT_REQUESTED"
          ) {
            try {
              const control = await api.getControl();
              if (control.save_picture_flag === 0) {
                screenshotPhaseRef.current = "idle";
                await maybeFinishAfterScreenshot();
                return;
              }
            } catch {
              /* continue */
            }
          }
          if (attempt >= CASE3_SCREENSHOT_MAX_ATTEMPTS) {
            try {
              await api.postControl({ save_picture_flag: 0 });
            } catch (clearErr) {
              case3Log("screenshot.clear_flag_fail", {
                reason:
                  clearErr instanceof Error
                    ? clearErr.message
                    : String(clearErr),
              });
            }
            console.error("[case3] SCREENSHOT_DROPPED_AFTER_RETRIES", {
              attempts: attempt,
            });
            screenshotPhaseRef.current = "idle";
            await maybeFinishAfterScreenshot();
            return;
          }
          if (failurePhase === "generate") {
            base64 = null;
            screenshotBase64Ref.current = null;
          }
        }
      }
    } finally {
      screenshotBusyRef.current = false;
    }
  }, [mapRendererRefs, maybeFinishAfterScreenshot, setBusy, stageElementRef]);

  /**
   * 单次业务轮询。
   */
  const pollOnce = useCallback(async () => {
    const action = stateRef.current.activeAction;
    if (!action) return;
    const generation = action.generation;
    const api = apiRef.current;
    const ac = new AbortController();
    pollAbortRef.current = ac;

    try {
      const control = await api.getControl(ac.signal);
      if (
        stateRef.current.activeAction?.generation !== generation ||
        ac.signal.aborted
      ) {
        return;
      }

      const flag = control.save_picture_flag === 1 ? 1 : 0;
      if (
        action.kind === "start" &&
        screenshotPhaseRef.current === "idle" &&
        lastFlagRef.current === 0 &&
        flag === 1
      ) {
        void runScreenshotTask();
      }
      if (screenshotPhaseRef.current === "waitClear" && flag === 0) {
        screenshotPhaseRef.current = "idle";
        void maybeFinishAfterScreenshot();
      }
      lastFlagRef.current = flag;

      const status = control.status;
      if (status === "execute success") {
        if (!stateRef.current.activeAction?.seenExecuteSuccess) {
          dispatch({ type: "SEEN_EXECUTE_SUCCESS" });
        }
      } else if (status === "execute fail") {
        dispatch({ type: "EXECUTE_FAIL" });
        setBusy(false);
        stopPolling();
        return;
      }

      const seen =
        Boolean(stateRef.current.activeAction?.seenExecuteSuccess) ||
        status === "execute success";

      if (action.kind === "start" && seen) {
        if (status === "case complete") {
          if (flag === 1 && screenshotPhaseRef.current === "idle") {
            void runScreenshotTask();
          }
          try {
            const snapshot = await api.getSide(action.side, ac.signal);
            if (
              stateRef.current.activeAction?.generation !== generation ||
              ac.signal.aborted
            ) {
              return;
            }
            if (!isFinalSideReady(snapshot)) {
              case3Log("CASE3_RESULT_NOT_READY", {
                side: action.side,
                pendingTail: snapshot.pendingTail,
                points: snapshot.points.length,
                completeCount: snapshot.completeCount,
                costPct: snapshot.costPct,
              });
            } else {
              dispatch({
                type: "START_COMPLETE",
                side: action.side,
                snapshot,
              });
              pendingCompleteSideRef.current = action.side;
              await Promise.resolve();
              if (
                screenshotPhaseRef.current !== "saving" &&
                screenshotPhaseRef.current !== "waitClear"
              ) {
                await maybeFinishAfterScreenshot();
              }
              stopPolling();
              return;
            }
          } catch (err) {
            if (isAbortError(err)) return;
            if (
              err instanceof Case3ApiError &&
              err.code === "RESULT_NOT_READY"
            ) {
              case3Log("CASE3_RESULT_NOT_READY", {
                side: action.side,
                http: true,
              });
            } else {
              case3Log("final_side_fail", {
                side: action.side,
                reason: err instanceof Error ? err.message : String(err),
              });
            }
          }
        } else {
          try {
            const snapshot = await api.getSide(action.side, ac.signal);
            if (
              stateRef.current.activeAction?.generation !== generation ||
              ac.signal.aborted
            ) {
              return;
            }
            dispatch({
              type: "LIVE_SNAPSHOT",
              side: action.side,
              snapshot,
            });
          } catch (err) {
            if (isAbortError(err)) return;
            case3Log("live_side_fail", {
              side: action.side,
              code: err instanceof Case3ApiError ? err.code : undefined,
              reason: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      if (action.kind === "reinit" && seen && status === "reinit complete") {
        dispatch({ type: "REINIT_COMPLETE", side: action.side });
        try {
          await api.postControl({ command: "init" });
        } catch (err) {
          case3Log("reinit.init_fail", {
            reason: err instanceof Error ? err.message : String(err),
          });
          dispatch({ type: "ADAPTER_ERROR", value: true });
        }
        setBusy(false);
        stopPolling();
        return;
      }

      if (
        status !== "" &&
        status !== "execute success" &&
        status !== "execute fail" &&
        status !== "case complete" &&
        status !== "reinit complete"
      ) {
        case3Log("unknown_status", { status, side: action.side });
      }
    } catch (err) {
      if (isAbortError(err)) return;
      case3Log("poll_fail", {
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }, [
    dispatch,
    maybeFinishAfterScreenshot,
    runScreenshotTask,
    setBusy,
    stopPolling,
  ]);

  const schedulePollLoop = useCallback(() => {
    stopPolling();
    const tick = async () => {
      if (!stateRef.current.activeAction) return;
      await pollOnce();
      if (!stateRef.current.activeAction) return;
      pollTimerRef.current = window.setTimeout(tick, config.pollMs);
    };
    void tick();
  }, [config.pollMs, pollOnce, stopPolling]);

  /**
   * 完整初始化握手：GET control → POST init → GET init-data。
   */
  const runHandshake = useCallback(
    async (
      generation: number,
      signal: AbortSignal,
    ): Promise<"ok" | "transport" | "init-data"> => {
      const api = apiRef.current;
      try {
        dispatch({ type: "INIT_LOADING" });
        await api.getControl(signal);
        if (generation !== entryLoadGeneration || signal.aborted) {
          return "transport";
        }
        await api.postControl({ command: "init" }, signal);
        if (generation !== entryLoadGeneration || signal.aborted) {
          return "transport";
        }
        const initData = await api.getInitData(signal);
        if (generation !== entryLoadGeneration || signal.aborted) {
          return "transport";
        }
        dispatch({
          type: "INIT_READY",
          baseRoute: initData.baseRoute,
          baseline: initData.baseline,
        });
        return "ok";
      } catch (err) {
        if (isAbortError(err) || generation !== entryLoadGeneration) {
          return "transport";
        }
        if (
          err instanceof Case3ApiError &&
          (err.code === "INIT_DATA_INVALID" ||
            err.code === "DATA_FILE_MISSING" ||
            err.code === "CASE3_INVALID_RESPONSE")
        ) {
          console.error("case3 init-data failed", {
            endpoint: "/api/case3/init-data",
            code: err.code,
            reason: err.message,
          });
          dispatch({ type: "INIT_ERROR" });
          return "init-data";
        }
        const code = err instanceof Case3ApiError ? err.code : "TRANSPORT";
        console.error("[case3] adapter unreachable", {
          endpoint: "/api/case3/control-file",
          code,
          reason: err instanceof Error ? err.message : String(err),
        });
        dispatch({ type: "ADAPTER_ERROR", value: true });
        return "transport";
      }
    },
    [dispatch],
  );

  useEffect(() => {
    const generation = ++entryLoadGeneration;
    const ac = new AbortController();
    dispatch({ type: "MOUNT_RESET" });
    setBusy(false);
    screenshotPhaseRef.current = "idle";
    lastFlagRef.current = 0;
    screenshotBase64Ref.current = null;
    pendingCompleteSideRef.current = null;

    const scheduleProbe = () => {
      stopProbe();
      probeTimerRef.current = window.setTimeout(async () => {
        if (generation !== entryLoadGeneration) return;
        try {
          await apiRef.current.getControl(ac.signal);
        } catch {
          scheduleProbe();
          return;
        }
        if (generation !== entryLoadGeneration || ac.signal.aborted) return;
        const result = await runHandshake(generation, ac.signal);
        if (result === "transport") scheduleProbe();
      }, CASE3_ADAPTER_RECOVERY_PROBE_MS);
    };

    void (async () => {
      const result = await runHandshake(generation, ac.signal);
      if (generation !== entryLoadGeneration) return;
      if (result === "transport") scheduleProbe();
    })();

    return () => {
      ac.abort();
      stopPolling();
      stopProbe();
      entryLoadGeneration += 1;
      setBusy(false);
    };
  }, [dispatch, runHandshake, setBusy, stopPolling, stopProbe]);

  const beginAction = useCallback(
    async (kind: "start" | "reinit", side: Case3Side) => {
      if (stateRef.current.activeAction) return;
      const generation = stateRef.current.generation + 1;
      dispatch({ type: "ACTION_BEGIN", kind, side, generation });
      setBusy(true);
      stopProbe();
      lastFlagRef.current = 0;
      screenshotPhaseRef.current = "idle";
      screenshotBase64Ref.current = null;

      try {
        await apiRef.current.postControl({
          case: "case3",
          command: kind,
          dt_type: dtTypeFor(side),
        });
      } catch (err) {
        if (err instanceof Case3ApiError && err.code === "CONTROL_BUSY") {
          case3Log("CONTROL_BUSY", { kind, side });
          dispatch({ type: "CLEAR_ACTIVE" });
          if (kind === "reinit") {
            dispatch({ type: "MARK_FAILED_RETRY", kind, side });
          }
          setBusy(false);
          return;
        }
        case3Log("action_post_fail", {
          kind,
          side,
          code: err instanceof Case3ApiError ? err.code : undefined,
          reason: err instanceof Error ? err.message : String(err),
        });
        dispatch({ type: "ACTION_POST_FAILED" });
        if (kind === "reinit") {
          dispatch({ type: "MARK_FAILED_RETRY", kind, side });
        }
        setBusy(false);
        return;
      }

      schedulePollLoop();
    },
    [dispatch, schedulePollLoop, setBusy, stopProbe],
  );

  const onStartWithout = useCallback(() => {
    if (!canStartWithout(stateRef.current)) return;
    void beginAction("start", "without");
  }, [beginAction]);

  const onStartWith = useCallback(() => {
    if (!canStartWith(stateRef.current)) return;
    void beginAction("start", "with");
  }, [beginAction]);

  const onReinitWithout = useCallback(() => {
    if (!canReinit(stateRef.current, "without")) return;
    void beginAction("reinit", "without");
  }, [beginAction]);

  const onReinitWith = useCallback(() => {
    if (!canReinit(stateRef.current, "with")) return;
    void beginAction("reinit", "with");
  }, [beginAction]);

  useEffect(() => {
    const onHide = () => {
      void apiRef.current.postControl({ command: "init" }, undefined, {
        keepalive: true,
      });
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  const visible = deriveVisibleState(state);

  return {
    state,
    visible,
    busy: isActionBusy(state),
    startWithoutEnabled: canStartWithout(state),
    startWithEnabled: canStartWith(state),
    reinitWithoutEnabled: canReinit(state, "without"),
    reinitWithEnabled: canReinit(state, "with"),
    withoutBadge: statusBadgeText(visible, "without"),
    withBadge: statusBadgeText(visible, "with"),
    onStartWithout,
    onStartWith,
    onReinitWithout,
    onReinitWith,
  };
}

export type Case3Controller = ReturnType<typeof useCase3Controller>;
