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
  sideStatusBadge,
  sideStatusBadgeIsError,
} from "../state/case3Reducer";
import type {
  ActiveAction,
  Case3Side,
  ControlSnapshot,
} from "../types";

export type Case3BusyChange = (busy: boolean) => void;

export type MapRendererHandle = {
  resetView(): void;
  prepareCapture(): Promise<void>;
};

type ScreenshotPhase = "idle" | "pending" | "saving" | "waitClear";

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

function case3Warn(event: string, data?: Record<string, unknown>): void {
  if (data === undefined) {
    console.warn(`[case3] ${event}`);
    return;
  }
  console.warn(`[case3] ${event}`, data);
}

function case3Error(event: string, data?: Record<string, unknown>): void {
  if (data === undefined) {
    console.error(`[case3] ${event}`);
    return;
  }
  console.error(`[case3] ${event}`, data);
}

/** 控制快照日志只保留状态摘要，避免输出未知字段和大对象。 */
function controlSummary(control: ControlSnapshot) {
  return {
    case: control.case,
    command: control.command,
    dtType: control.dt_type,
    status: control.status,
    savePictureFlag: control.save_picture_flag,
  };
}

/** 实时点按关键里程碑采样；最终点由 base route 长度补充识别。 */
function shouldLogLiveProgress(count: number, routePoints: number): boolean {
  return (
    count === 1 ||
    count === 2 ||
    count % 5 === 0 ||
    (routePoints > 0 && count === routePoints)
  );
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

/** 控制快照必须仍属于当前动作，其他 Case/侧/轮次的终态不得被认领。 */
function controlMatchesAction(
  control: ControlSnapshot,
  action: ActiveAction,
): boolean {
  return (
    control.case === "case3" &&
    control.command === action.kind &&
    control.dt_type === dtTypeFor(action.side)
  );
}

function stripDataUrl(base64: string): string {
  const idx = base64.indexOf("base64,");
  return idx >= 0 ? base64.slice(idx + 7) : base64;
}

/**
 * 让 reducer 的 completed 结果至少完成一次浏览器渲染机会，再撤销控制权。
 */
function waitForNextRender(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    window.setTimeout(resolve, 0);
  });
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
  const lastStatusRef = useRef<string | null>(null);
  const lastProgressRef = useRef<{ generation: number; count: number } | null>(
    null,
  );
  const lastFinalDiagnosticRef = useRef<string | null>(null);
  const lastControlMismatchRef = useRef<string | null>(null);
  const probeStartedLoggedRef = useRef(false);
  const screenshotBusyRef = useRef(false);
  const pendingCompleteSideRef = useRef<Case3Side | null>(null);
  const busyRef = useRef(false);
  const lifecycleGenerationRef = useRef(0);
  const actionAbortRef = useRef<AbortController | null>(null);
  const screenshotAbortRef = useRef<AbortController | null>(null);
  const onBusyChangeRef = useRef(onBusyChange);
  onBusyChangeRef.current = onBusyChange;

  const setBusy = useCallback((busy: boolean) => {
    if (busyRef.current === busy) return;
    busyRef.current = busy;
    onBusyChangeRef.current?.(busy);
  }, []);

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
      screenshotPhaseRef.current === "pending" ||
      screenshotPhaseRef.current === "saving" ||
      screenshotPhaseRef.current === "waitClear"
    ) {
      return;
    }
    const side = pendingCompleteSideRef.current;
    pendingCompleteSideRef.current = null;
    const lifecycleGeneration = lifecycleGenerationRef.current;
    const signal = actionAbortRef.current?.signal;
    const generation = stateRef.current.generation;
    case3Log("completion.init_begin", {
      kind: "start",
      side,
      generation,
    });
    try {
      const control = await apiRef.current.postControl(
        { command: "init" },
        signal,
      );
      case3Log("completion.init_ok", {
        kind: "start",
        side,
        generation,
        ...controlSummary(control),
      });
    } catch (err) {
      if (
        isAbortError(err) ||
        lifecycleGeneration !== lifecycleGenerationRef.current
      ) {
        return;
      }
      case3Error("completion.init_fail", {
        kind: "start",
        side,
        generation,
        endpoint: "/api/case3/control-file",
        code: err instanceof Case3ApiError ? err.code : undefined,
        reason: err instanceof Error ? err.message : String(err),
      });
      dispatch({ type: "ADAPTER_ERROR", value: true });
    }
    if (lifecycleGeneration !== lifecycleGenerationRef.current) return;
    dispatch({ type: "ROUND_CLOSE_COMPLETE" });
    actionAbortRef.current = null;
    setBusy(false);
    case3Log("poll.stop", {
      kind: "start",
      side,
      generation,
      reason: "start-complete",
    });
    stopPolling();
  }, [dispatch, setBusy, stopPolling]);

  /**
   * 截图机：截图请求已登记且 completed 结果完成渲染后才执行；最多 3 次。
   */
  const runScreenshotTask = useCallback(async () => {
    if (screenshotBusyRef.current) return;
    screenshotBusyRef.current = true;
    screenshotPhaseRef.current = "saving";
    setBusy(true);

    const api = apiRef.current;
    const lifecycleGeneration = lifecycleGenerationRef.current;
    const action = stateRef.current.activeAction;
    const side = action?.side ?? pendingCompleteSideRef.current;
    const generation = action?.generation ?? stateRef.current.generation;
    const ac = new AbortController();
    screenshotAbortRef.current?.abort();
    screenshotAbortRef.current = ac;
    let attempt = 0;
    let base64 = screenshotBase64Ref.current;
    const taskStartedAt = performance.now();
    const isStale = () =>
      ac.signal.aborted ||
      lifecycleGeneration !== lifecycleGenerationRef.current;

    try {
      while (attempt < CASE3_SCREENSHOT_MAX_ATTEMPTS) {
        attempt += 1;
        const attemptStartedAt = performance.now();
        let failurePhase: "generate" | "upload" = base64
          ? "upload"
          : "generate";
        let toPngMs: number | undefined;
        let uploadMs: number | undefined;
        try {
          if (!base64) {
            failurePhase = "generate";
            const stage = stageElementRef.current;
            if (!stage) throw new Error("stage missing");
            case3Log("screenshot.capture_begin", {
              side,
              generation,
              attempt,
              width: CASE3_STAGE_WIDTH,
              height: CASE3_STAGE_HEIGHT,
              pixelRatio: CASE3_SCREENSHOT_PIXEL_RATIO,
            });
            await mapRendererRefs?.without.current?.prepareCapture();
            await mapRendererRefs?.with.current?.prepareCapture();
            if (isStale()) return;
            const toPngStartedAt = performance.now();
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
            toPngMs = Math.round(performance.now() - toPngStartedAt);
            if (isStale()) return;
            base64 = stripDataUrl(png);
            screenshotBase64Ref.current = base64;
            case3Log("screenshot.capture_ok", {
              side,
              generation,
              attempt,
              toPngMs,
            });
          }
          failurePhase = "upload";
          const uploadStartedAt = performance.now();
          const saved = await api.postScreenshot(base64, ac.signal);
          uploadMs = Math.round(performance.now() - uploadStartedAt);
          if (isStale()) return;
          screenshotPhaseRef.current = stateRef.current.activeAction
            ? "waitClear"
            : "idle";
          case3Log("screenshot.upload_ok", {
            side,
            generation,
            attempt,
            path: saved.path,
            seq: saved.seq,
            toPngMs,
            uploadMs,
            totalMs: Math.round(performance.now() - taskStartedAt),
          });
          if (
            !stateRef.current.activeAction &&
            pendingCompleteSideRef.current
          ) {
            screenshotPhaseRef.current = "idle";
            await maybeFinishAfterScreenshot();
          }
          return;
        } catch (err) {
          if (isAbortError(err)) return;
          if (isStale()) return;
          case3Warn("screenshot.retry", {
            side,
            generation,
            attempt,
            phase: failurePhase,
            endpoint:
              failurePhase === "upload"
                ? "/api/case3/screenshot"
                : "browser:stage-capture",
            toPngMs,
            uploadMs,
            durationMs: Math.round(performance.now() - attemptStartedAt),
            reason: err instanceof Error ? err.message : String(err),
            code: err instanceof Case3ApiError ? err.code : undefined,
          });
          if (failurePhase === "upload") {
            try {
              const control = await api.getControl(ac.signal);
              if (isStale()) return;
              const expectedSide =
                stateRef.current.activeAction?.side ??
                pendingCompleteSideRef.current;
              const ownershipLost =
                control.case !== "case3" ||
                control.command !== "start" ||
                (expectedSide !== null &&
                  expectedSide !== undefined &&
                  control.dt_type !== dtTypeFor(expectedSide));
              if (control.save_picture_flag === 0 || ownershipLost) {
                case3Log("screenshot.upload_confirmed", {
                  side,
                  generation,
                  attempt,
                  source:
                    control.save_picture_flag === 0
                      ? "flag-cleared"
                      : "ownership-lost",
                });
                screenshotPhaseRef.current = "idle";
                await maybeFinishAfterScreenshot();
                return;
              }
            } catch (confirmErr) {
              if (isAbortError(confirmErr) || isStale()) return;
              case3Warn("screenshot.confirm_fail", {
                side,
                generation,
                endpoint: "/api/case3/control-file",
                reason:
                  confirmErr instanceof Error
                    ? confirmErr.message
                    : String(confirmErr),
              });
            }
          }
          if (attempt >= CASE3_SCREENSHOT_MAX_ATTEMPTS) {
            try {
              await api.postControl(
                { save_picture_flag: 0 },
                ac.signal,
              );
            } catch (clearErr) {
              if (isAbortError(clearErr) || isStale()) return;
              case3Error("screenshot.clear_flag_fail", {
                side,
                generation,
                endpoint: "/api/case3/control-file",
                reason:
                  clearErr instanceof Error
                    ? clearErr.message
                    : String(clearErr),
              });
            }
            case3Error("screenshot.dropped", {
              side,
              generation,
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
      if (screenshotAbortRef.current === ac) {
        screenshotAbortRef.current = null;
      }
    }
  }, [mapRendererRefs, maybeFinishAfterScreenshot, setBusy, stageElementRef]);

  /**
   * 单次业务轮询。
   */
  const pollOnce = useCallback(async () => {
    const action = stateRef.current.activeAction;
    const closingScreenshot =
      action === null &&
      pendingCompleteSideRef.current !== null &&
      screenshotPhaseRef.current === "waitClear";
    if (!action && !closingScreenshot) return;
    const generation = action?.generation ?? stateRef.current.generation;
    const api = apiRef.current;
    const ac = new AbortController();
    pollAbortRef.current = ac;

    try {
      const control = await api.getControl(ac.signal);
      if (ac.signal.aborted) {
        return;
      }
      if (!action) {
        if (control.save_picture_flag === 0) {
          screenshotPhaseRef.current = "idle";
          await maybeFinishAfterScreenshot();
        }
        return;
      }
      if (stateRef.current.activeAction?.generation !== generation) return;
      if (!controlMatchesAction(control, action)) {
        const mismatchKey = [
          generation,
          control.case,
          control.command,
          control.dt_type,
          control.status,
        ].join(":");
        if (lastControlMismatchRef.current !== mismatchKey) {
          lastControlMismatchRef.current = mismatchKey;
          case3Warn("poll.control_context_mismatch", {
            generation,
            kind: action.kind,
            side: action.side,
            expectedCase: "case3",
            expectedCommand: action.kind,
            expectedDtType: dtTypeFor(action.side),
            actualCase: control.case,
            actualCommand: control.command,
            actualDtType: control.dt_type,
            status: control.status,
          });
        }
        return;
      }
      lastControlMismatchRef.current = null;

      const flag = control.save_picture_flag === 1 ? 1 : 0;
      if (
        action.kind === "start" &&
        screenshotPhaseRef.current === "idle" &&
        lastFlagRef.current === 0 &&
        flag === 1
      ) {
        // 这里只登记截图请求。真正生成 PNG 必须等待最终 side 通过门槛并完成 completed 渲染。
        screenshotPhaseRef.current = "pending";
        case3Log("screenshot.requested", {
          generation,
          side: action.side,
          status: control.status,
          savePictureFlag: flag,
        });
      }
      if (screenshotPhaseRef.current === "pending" && flag === 0) {
        screenshotPhaseRef.current = "idle";
        case3Warn("screenshot.request_cleared_before_capture", {
          generation,
          side: action.side,
        });
      }
      if (screenshotPhaseRef.current === "waitClear" && flag === 0) {
        screenshotPhaseRef.current = "idle";
        case3Log("screenshot.flag_cleared", {
          generation,
          side: action.side,
        });
        void maybeFinishAfterScreenshot();
      }
      lastFlagRef.current = flag;

      const status = control.status;
      const statusChanged = lastStatusRef.current !== status;
      if (statusChanged) {
        case3Log("poll.status_edge", {
          generation,
          kind: action.kind,
          side: action.side,
          from: lastStatusRef.current,
          to: status,
          seenExecuteSuccess: action.seenExecuteSuccess,
          savePictureFlag: flag,
        });
        lastStatusRef.current = status;
      }
      if (status === "execute success") {
        if (!stateRef.current.activeAction?.seenExecuteSuccess) {
          dispatch({ type: "SEEN_EXECUTE_SUCCESS" });
        }
      } else if (status === "execute fail") {
        case3Error("round.execute_fail", {
          generation,
          kind: action.kind,
          side: action.side,
        });
        dispatch({ type: "EXECUTE_FAIL" });
        screenshotAbortRef.current?.abort();
        screenshotAbortRef.current = null;
        screenshotPhaseRef.current = "idle";
        pendingCompleteSideRef.current = null;
        actionAbortRef.current?.abort();
        actionAbortRef.current = null;
        setBusy(false);
        case3Log("poll.stop", {
          generation,
          kind: action.kind,
          side: action.side,
          reason: "execute-fail",
        });
        stopPolling();
        return;
      }

      const seen =
        Boolean(stateRef.current.activeAction?.seenExecuteSuccess) ||
        status === "execute success";

      if (action.kind === "start" && seen) {
        if (status === "case complete") {
          if (statusChanged) {
            case3Log("side.final_fetch_begin", {
              generation,
              side: action.side,
            });
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
              const diagnosticKey = [
                generation,
                "local-gate",
                snapshot.pendingTail,
                snapshot.points.length,
                snapshot.completeCount,
                snapshot.costPct,
              ].join(":");
              if (lastFinalDiagnosticRef.current !== diagnosticKey) {
                lastFinalDiagnosticRef.current = diagnosticKey;
                case3Warn("side.final_not_ready", {
                  generation,
                  side: action.side,
                  source: "local-gate",
                  pendingTail: snapshot.pendingTail,
                  points: snapshot.points.length,
                  completeCount: snapshot.completeCount,
                  costPct: snapshot.costPct,
                });
              }
            } else {
              case3Log("side.final_ready", {
                generation,
                side: action.side,
                points: snapshot.points.length,
                completeCount: snapshot.completeCount,
                pendingTail: snapshot.pendingTail,
                costPct: snapshot.costPct,
              });
              dispatch({
                type: "START_COMPLETE",
                side: action.side,
                snapshot,
              });
              pendingCompleteSideRef.current = action.side;
              await waitForNextRender();
              case3Log("round.completed_rendered", {
                generation,
                side: action.side,
                pairValid: stateRef.current.pairValid,
                withoutPoints:
                  stateRef.current.results.without?.points.length ?? 0,
                withPoints: stateRef.current.results.with?.points.length ?? 0,
              });
              if (screenshotPhaseRef.current === "pending") {
                await runScreenshotTask();
              } else if (
                screenshotPhaseRef.current !== "saving" &&
                screenshotPhaseRef.current !== "waitClear"
              ) {
                await maybeFinishAfterScreenshot();
              }
              return;
            }
          } catch (err) {
            if (isAbortError(err)) return;
            if (
              err instanceof Case3ApiError &&
              err.code === "RESULT_NOT_READY"
            ) {
              const diagnosticKey = `${generation}:http:${err.code}`;
              if (lastFinalDiagnosticRef.current !== diagnosticKey) {
                lastFinalDiagnosticRef.current = diagnosticKey;
                case3Warn("side.final_not_ready", {
                  generation,
                  side: action.side,
                  source: "http",
                  endpoint: `/api/case3/side?side=${action.side}`,
                  code: err.code,
                });
              }
            } else {
              case3Warn("side.final_fail", {
                generation,
                side: action.side,
                endpoint: `/api/case3/side?side=${action.side}`,
                code: err instanceof Case3ApiError ? err.code : undefined,
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
            const progressCount = snapshot.completeCount;
            const previousProgress = lastProgressRef.current;
            if (
              previousProgress?.generation !== generation ||
              previousProgress.count !== progressCount
            ) {
              lastProgressRef.current = {
                generation,
                count: progressCount,
              };
              if (
                shouldLogLiveProgress(
                  progressCount,
                  stateRef.current.baseRoute.length,
                )
              ) {
                case3Log("side.live_progress", {
                  generation,
                  side: action.side,
                  points: snapshot.points.length,
                  completeCount: snapshot.completeCount,
                  lastPointNo: snapshot.points.at(-1)?.no ?? null,
                  pendingTail: snapshot.pendingTail,
                  costPct: snapshot.costPct,
                });
              }
            }
          } catch (err) {
            if (isAbortError(err)) return;
            case3Warn("side.live_fail", {
              generation,
              side: action.side,
              endpoint: `/api/case3/side?side=${action.side}`,
              code: err instanceof Case3ApiError ? err.code : undefined,
              reason: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      if (action.kind === "reinit" && seen && status === "reinit complete") {
        dispatch({ type: "REINIT_COMPLETE", side: action.side });
        const retainedSide: Case3Side =
          action.side === "without" ? "with" : "without";
        case3Log("reinit.ui_applied", {
          generation,
          side: action.side,
          retainedSide,
          retainedPoints:
            stateRef.current.results[retainedSide]?.points.length ?? 0,
        });
        const lifecycleGeneration = lifecycleGenerationRef.current;
        case3Log("completion.init_begin", {
          generation,
          kind: "reinit",
          side: action.side,
        });
        try {
          const resetControl = await api.postControl(
            { command: "init" },
            actionAbortRef.current?.signal,
          );
          case3Log("completion.init_ok", {
            generation,
            kind: "reinit",
            side: action.side,
            ...controlSummary(resetControl),
          });
        } catch (err) {
          if (
            isAbortError(err) ||
            lifecycleGeneration !== lifecycleGenerationRef.current
          ) {
            return;
          }
          case3Error("completion.init_fail", {
            generation,
            kind: "reinit",
            side: action.side,
            endpoint: "/api/case3/control-file",
            code: err instanceof Case3ApiError ? err.code : undefined,
            reason: err instanceof Error ? err.message : String(err),
          });
          dispatch({ type: "ADAPTER_ERROR", value: true });
        }
        if (lifecycleGeneration !== lifecycleGenerationRef.current) return;
        dispatch({ type: "ROUND_CLOSE_COMPLETE" });
        actionAbortRef.current = null;
        setBusy(false);
        case3Log("poll.stop", {
          generation,
          kind: "reinit",
          side: action.side,
          reason: "reinit-complete",
        });
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
        case3Warn("poll.unknown_status", {
          generation,
          kind: action.kind,
          status,
          side: action.side,
        });
      }
    } catch (err) {
      if (isAbortError(err)) return;
      case3Warn("poll.fail", {
        generation,
        kind: action?.kind,
        side: action?.side ?? pendingCompleteSideRef.current,
        endpoint: "/api/case3/control-file",
        code: err instanceof Case3ApiError ? err.code : undefined,
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
    const lifecycleGeneration = lifecycleGenerationRef.current;
    const action = stateRef.current.activeAction;
    if (action) {
      case3Log("poll.start", {
        generation: action.generation,
        kind: action.kind,
        side: action.side,
        pollMs: config.pollMs,
      });
    }
    const hasPollingWork = () =>
      stateRef.current.activeAction !== null ||
      (pendingCompleteSideRef.current !== null &&
        screenshotPhaseRef.current === "waitClear");
    const tick = async () => {
      if (
        lifecycleGeneration !== lifecycleGenerationRef.current ||
        !hasPollingWork()
      ) {
        return;
      }
      await pollOnce();
      if (
        lifecycleGeneration !== lifecycleGenerationRef.current ||
        !hasPollingWork()
      ) {
        return;
      }
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
      source: "entry" | "probe",
    ): Promise<"ok" | "transport" | "init-data"> => {
      const api = apiRef.current;
      let phase: "get-control" | "post-init" | "get-init-data" =
        "get-control";
      try {
        dispatch({ type: "INIT_LOADING" });
        const initialControl = await api.getControl(signal);
        if (generation !== entryLoadGeneration || signal.aborted) {
          return "transport";
        }
        case3Log("entry.control_ok", {
          generation,
          source,
          ...controlSummary(initialControl),
        });
        phase = "post-init";
        const resetControl = await api.postControl(
          { command: "init" },
          signal,
        );
        if (generation !== entryLoadGeneration || signal.aborted) {
          return "transport";
        }
        case3Log("entry.init_reset_ok", {
          generation,
          source,
          ...controlSummary(resetControl),
        });
        phase = "get-init-data";
        const initData = await api.getInitData(signal);
        if (generation !== entryLoadGeneration || signal.aborted) {
          return "transport";
        }
        dispatch({
          type: "INIT_READY",
          baseRoute: initData.baseRoute,
          baseline: initData.baseline,
        });
        case3Log("entry.init_data_ok", {
          generation,
          source,
          routePoints: initData.baseRoute.length,
          baselineSuccess: initData.baseline.success,
          baselineTotal: initData.baseline.total,
        });
        return "ok";
      } catch (err) {
        if (isAbortError(err) || generation !== entryLoadGeneration) {
          return "transport";
        }
        if (
          phase === "get-init-data" &&
          err instanceof Case3ApiError &&
          (err.code === "INIT_DATA_INVALID" ||
            err.code === "DATA_FILE_MISSING" ||
            err.code === "CASE3_INVALID_RESPONSE")
        ) {
          case3Error("entry.init_data_fail", {
            generation,
            source,
            endpoint: "/api/case3/init-data",
            code: err.code,
            reason: err.message,
          });
          dispatch({ type: "INIT_ERROR" });
          return "init-data";
        }
        const code = err instanceof Case3ApiError ? err.code : "TRANSPORT";
        if (source === "entry") {
          const endpoint =
            phase === "get-init-data"
              ? "/api/case3/init-data"
              : "/api/case3/control-file";
          case3Error("entry.control_fail", {
            generation,
            phase,
            endpoint,
            code,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
        dispatch({ type: "ADAPTER_ERROR", value: true });
        return "transport";
      }
    },
    [dispatch],
  );

  useEffect(() => {
    lifecycleGenerationRef.current += 1;
    const generation = ++entryLoadGeneration;
    const ac = new AbortController();
    case3Log("entry.begin", { generation });
    dispatch({ type: "MOUNT_RESET" });
    setBusy(false);
    screenshotPhaseRef.current = "idle";
    lastFlagRef.current = 0;
    lastStatusRef.current = null;
    lastProgressRef.current = null;
    lastFinalDiagnosticRef.current = null;
    lastControlMismatchRef.current = null;
    probeStartedLoggedRef.current = false;
    screenshotBase64Ref.current = null;
    pendingCompleteSideRef.current = null;

    const scheduleProbe = () => {
      stopProbe();
      if (!probeStartedLoggedRef.current) {
        probeStartedLoggedRef.current = true;
        case3Log("adapter_probe.start", {
          generation,
          intervalMs: CASE3_ADAPTER_RECOVERY_PROBE_MS,
        });
      }
      probeTimerRef.current = window.setTimeout(async () => {
        if (generation !== entryLoadGeneration) return;
        try {
          await apiRef.current.getControl(ac.signal);
        } catch {
          scheduleProbe();
          return;
        }
        if (generation !== entryLoadGeneration || ac.signal.aborted) return;
        const result = await runHandshake(generation, ac.signal, "probe");
        if (result === "ok") {
          case3Log("adapter_probe.recovered", { generation });
        }
        if (result === "transport") scheduleProbe();
      }, CASE3_ADAPTER_RECOVERY_PROBE_MS);
    };

    void (async () => {
      const result = await runHandshake(generation, ac.signal, "entry");
      if (generation !== entryLoadGeneration) return;
      if (result === "transport") scheduleProbe();
    })();

    return () => {
      lifecycleGenerationRef.current += 1;
      ac.abort();
      actionAbortRef.current?.abort();
      actionAbortRef.current = null;
      screenshotAbortRef.current?.abort();
      screenshotAbortRef.current = null;
      screenshotBusyRef.current = false;
      screenshotPhaseRef.current = "idle";
      pendingCompleteSideRef.current = null;
      stopPolling();
      stopProbe();
      entryLoadGeneration += 1;
      setBusy(false);
      case3Log("entry.cleanup", { generation });
    };
  }, [dispatch, runHandshake, setBusy, stopPolling, stopProbe]);

  const beginAction = useCallback(
    async (kind: "start" | "reinit", side: Case3Side) => {
      if (stateRef.current.activeAction || stateRef.current.roundClosing) return;
      const generation = stateRef.current.generation + 1;
      const lifecycleGeneration = lifecycleGenerationRef.current;
      const actionAbort = new AbortController();
      actionAbortRef.current?.abort();
      actionAbortRef.current = actionAbort;
      dispatch({ type: "ACTION_BEGIN", kind, side, generation });
      case3Log(`command.${kind}_click`, {
        generation,
        kind,
        side,
      });
      setBusy(true);
      stopProbe();
      lastFlagRef.current = 0;
      lastStatusRef.current = null;
      lastProgressRef.current = null;
      lastFinalDiagnosticRef.current = null;
      lastControlMismatchRef.current = null;
      screenshotPhaseRef.current = "idle";
      screenshotBase64Ref.current = null;

      try {
        const control = await apiRef.current.postControl(
          {
            case: "case3",
            command: kind,
            dt_type: dtTypeFor(side),
          },
          actionAbort.signal,
        );
        lastStatusRef.current = control.status;
        case3Log(`command.${kind}_ok`, {
          generation,
          kind,
          side,
          ...controlSummary(control),
        });
      } catch (err) {
        if (
          isAbortError(err) ||
          actionAbort.signal.aborted ||
          lifecycleGeneration !== lifecycleGenerationRef.current
        ) {
          return;
        }
        actionAbortRef.current = null;
        if (err instanceof Case3ApiError && err.code === "CONTROL_BUSY") {
          case3Warn("command.control_busy", {
            generation,
            kind,
            side,
            endpoint: "/api/case3/control-file",
            code: err.code,
          });
          dispatch({ type: "CLEAR_ACTIVE" });
          if (kind === "reinit") {
            dispatch({ type: "MARK_FAILED_RETRY", kind, side });
          }
          setBusy(false);
          return;
        }
        case3Error(`command.${kind}_fail`, {
          generation,
          kind,
          side,
          endpoint: "/api/case3/control-file",
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

      if (
        actionAbort.signal.aborted ||
        lifecycleGeneration !== lifecycleGenerationRef.current ||
        stateRef.current.generation !== generation
      ) {
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
      case3Log("pagehide.init_begin", {
        generation: stateRef.current.generation,
      });
      void apiRef.current
        .postControl({ command: "init" }, undefined, {
          keepalive: true,
        })
        .catch((err) => {
          case3Warn("pagehide.init_fail", {
            generation: stateRef.current.generation,
            code: err instanceof Case3ApiError ? err.code : undefined,
            reason: err instanceof Error ? err.message : String(err),
          });
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
    withoutBadge: sideStatusBadge(state, "without"),
    withBadge: sideStatusBadge(state, "with"),
    badgeError: sideStatusBadgeIsError(state),
    onStartWithout,
    onStartWith,
    onReinitWithout,
    onReinitWith,
  };
}

export type Case3Controller = ReturnType<typeof useCase3Controller>;
