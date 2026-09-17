/**
 * Case4 业务控制器：握手、Start/ReInit、四路串行轮询、完成门槛和截图协调。
 * 不负责文件解析；共享目录由 Node 适配服务经 REST 提供。
 * timer / AbortController / html-to-image 副作用留在本 hook 与子模块。
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import { Case4ApiError, createCase4Api, type Case4Api } from "../api/case4Api";
import {
  CASE4_ADAPTER_RECOVERY_PROBE_MS,
  CASE4_FINAL_NOT_READY_MAX_ATTEMPTS,
  type Case4RuntimeConfig,
} from "../config/case4RuntimeConfig";
import { case4Error, case4Log, case4Warn, controlSummary } from "../log/case4Log";
import { isFinalResultReady } from "../metrics/case4Metrics";
import { selectCase4Presentation } from "../presentation/selectCase4Presentation";
import {
  canReinit,
  canStart,
  case4Reducer,
  createInitialCase4State,
  CASE4_POLL_FAIL_RETRY_THRESHOLD,
  type Case4State,
} from "../state/case4Reducer";
import type { ActionKind, ControlSnapshot } from "../types";
import { runCase4Handshake } from "./case4Handshake";
import {
  controlMatchesAction,
  createSerialPoll,
  isInitIdle,
  isReinitProgress,
  isStartProgress,
  type SerialPollHandle,
} from "./case4Polling";
import {
  runCase4Screenshot,
  waitForPaintDefault,
  type MapCaptureHandle,
  type ScreenshotPhase,
} from "./case4Screenshot";

export type Case4BusyChange = (busy: boolean) => void;

export type MapRendererHandle = MapCaptureHandle;

type Options = {
  config: Case4RuntimeConfig;
  stageElementRef: React.RefObject<HTMLElement>;
  mapRendererRef?: React.RefObject<MapRendererHandle | null>;
  onBusyChange?: Case4BusyChange;
  api?: Case4Api;
  waitForPaint?: () => Promise<void>;
};

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

function shouldLogProgress(count: number): boolean {
  return count === 1 || count === 2 || count % 5 === 0;
}

/**
 * Case4 根业务 hook。
 */
export function useCase4Controller(options: Options) {
  const {
    config,
    stageElementRef,
    mapRendererRef,
    onBusyChange,
    waitForPaint = waitForPaintDefault,
  } = options;
  const [state, dispatch] = useReducer(
    case4Reducer,
    undefined,
    createInitialCase4State,
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const apiRef = useRef(options.api ?? createCase4Api());
  if (options.api) apiRef.current = options.api;

  const lifecycleRef = useRef(0);
  const busyOwnedRef = useRef(false);
  const screenshotPhaseRef = useRef<ScreenshotPhase>("idle");
  const screenshotAbortRef = useRef<AbortController | null>(null);
  const lastFlagRef = useRef(0);
  const lastStatusRef = useRef<string | null>(null);
  const lastMismatchRef = useRef<string | null>(null);
  const lastNotReadyRef = useRef<string | null>(null);
  const pollFailStreakRef = useRef(0);
  const lastTrajCountRef = useRef(0);
  const lastThrpCountRef = useRef({ without: 0, with: 0 });
  const probeTimerRef = useRef<number | null>(null);
  const controlPollRef = useRef<SerialPollHandle | null>(null);
  const trajPollRef = useRef<SerialPollHandle | null>(null);
  const thrpWithoutPollRef = useRef<SerialPollHandle | null>(null);
  const thrpWithPollRef = useRef<SerialPollHandle | null>(null);
  const resultPollRef = useRef<SerialPollHandle | null>(null);
  const actionAbortRef = useRef<AbortController | null>(null);
  const closingRef = useRef(false);

  const setBusy = useCallback(
    (value: boolean) => {
      busyOwnedRef.current = value;
      onBusyChange?.(value);
    },
    [onBusyChange],
  );

  const stopLivePolls = useCallback(() => {
    trajPollRef.current?.stop();
    thrpWithoutPollRef.current?.stop();
    thrpWithPollRef.current?.stop();
  }, []);

  const stopResultPoll = useCallback(() => {
    resultPollRef.current?.stop();
  }, []);

  const stopControlPoll = useCallback(() => {
    controlPollRef.current?.stop();
  }, []);

  const stopAllPolls = useCallback(() => {
    stopLivePolls();
    stopResultPoll();
    stopControlPoll();
  }, [stopControlPoll, stopLivePolls, stopResultPoll]);

  const abortScreenshot = useCallback(() => {
    screenshotAbortRef.current?.abort();
    screenshotAbortRef.current = null;
    screenshotPhaseRef.current = "idle";
  }, []);

  const stopProbe = useCallback(() => {
    if (probeTimerRef.current != null) {
      window.clearTimeout(probeTimerRef.current);
      probeTimerRef.current = null;
    }
  }, []);

  const finishRound = useCallback(
    (ui: Case4State["ui"], adapterError = false) => {
      closingRef.current = false;
      stopAllPolls();
      abortScreenshot();
      if (adapterError) dispatch({ type: "ADAPTER_ERROR", value: true });
      dispatch({ type: "ROUND_CLOSE_COMPLETE", ui });
      actionAbortRef.current = null;
      setBusy(false);
    },
    [abortScreenshot, setBusy, stopAllPolls],
  );

  const postInitAndFinish = useCallback(
    async (ui: Case4State["ui"]) => {
      const lifecycle = lifecycleRef.current;
      const generation = stateRef.current.generation;
      const signal = actionAbortRef.current?.signal;
      case4Log("completion.init_begin", { roundGeneration: generation });
      try {
        const control = await apiRef.current.postControl(
          { command: "init" },
          signal,
        );
        if (lifecycle !== lifecycleRef.current) return;
        case4Log("completion.init_ok", {
          roundGeneration: generation,
          ...controlSummary(control),
        });
        finishRound(ui, false);
      } catch (err) {
        if (isAbortError(err) || lifecycle !== lifecycleRef.current) return;
        case4Error("completion.init_fail", {
          roundGeneration: generation,
          code: err instanceof Case4ApiError ? err.code : undefined,
          reason: err instanceof Error ? err.message : String(err),
        });
        finishRound(ui, true);
      }
    },
    [finishRound],
  );

  const runPendingScreenshotThenInit = useCallback(async () => {
    const lifecycle = lifecycleRef.current;
    const generation = stateRef.current.generation;
    if (screenshotPhaseRef.current !== "pending") {
      await postInitAndFinish("completed");
      return;
    }
    screenshotPhaseRef.current = "saving";
    const ac = new AbortController();
    screenshotAbortRef.current = ac;
    const stage = stageElementRef.current;
    if (!stage) {
      case4Warn("screenshot.no_stage", { roundGeneration: generation });
      screenshotPhaseRef.current = "idle";
      await postInitAndFinish("completed");
      return;
    }
    const outcome = await runCase4Screenshot({
      api: apiRef.current,
      stage,
      mapRef: mapRendererRef?.current ?? null,
      signal: ac.signal,
      generation,
      waitForPaint,
    });
    if (lifecycle !== lifecycleRef.current) return;
    screenshotPhaseRef.current = "idle";
    if (outcome.kind === "aborted") return;
    if (outcome.kind === "clear-fail") {
      finishRound("completed", true);
      return;
    }
    await postInitAndFinish("completed");
  }, [
    finishRound,
    mapRendererRef,
    postInitAndFinish,
    stageElementRef,
    waitForPaint,
  ]);

  const startResultPoll = useCallback(() => {
    resultPollRef.current?.stop();
    const handle = createSerialPoll({
      intervalMs: config.pollMs,
      async tick(signal) {
        const cur = stateRef.current;
        if (cur.ui !== "finalizing" || cur.finalSubmitted) return;
        const generation = cur.generation;
        case4Log("result.fetch_begin", { roundGeneration: generation });
        const nextFailCount = cur.resultFailCount + 1;
        try {
          const snapshot = await apiRef.current.getResult(signal);
          if (stateRef.current.generation !== generation || signal.aborted) {
            return;
          }
          const gate = isFinalResultReady(snapshot);
          if (!gate.ok) {
            dispatch({ type: "RESULT_NOT_READY" });
            const key = gate.reason;
            if (lastNotReadyRef.current !== key) {
              lastNotReadyRef.current = key;
              case4Warn("result.not_ready", {
                roundGeneration: generation,
                reason: key,
                source: "local-gate",
              });
            }
          } else {
            case4Log("result.ready", {
              roundGeneration: generation,
              points: snapshot.trajectory.points.length,
            });
            dispatch({
              type: "RESULT_SUBMITTED",
              trajectory: snapshot.trajectory,
              throughput: snapshot.throughput,
              statistics: snapshot.statistics,
            });
            stopResultPoll();
            closingRef.current = true;
            await runPendingScreenshotThenInit();
            return;
          }
        } catch (err) {
          if (isAbortError(err) || signal.aborted) return;
          dispatch({ type: "RESULT_NOT_READY" });
          case4Warn("result.fail", {
            roundGeneration: generation,
            code: err instanceof Case4ApiError ? err.code : undefined,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
        // 用本拍起始 count+1，不读 dispatch 后尚未提交的旧 stateRef。
        if (nextFailCount >= CASE4_FINAL_NOT_READY_MAX_ATTEMPTS) {
          case4Error("result.exhausted", { roundGeneration: generation });
          closingRef.current = true;
          dispatch({ type: "RESULT_EXHAUSTED" });
          abortScreenshot();
          stopResultPoll();
          await postInitAndFinish("failed-start");
        }
      },
    });
    resultPollRef.current = handle;
    handle.start();
  }, [
    abortScreenshot,
    config.pollMs,
    postInitAndFinish,
    runPendingScreenshotThenInit,
    stopResultPoll,
  ]);

  const startLivePolls = useCallback(() => {
    if (trajPollRef.current?.running) return;
    trajPollRef.current = createSerialPoll({
      intervalMs: config.pollMs,
      async tick(signal) {
        const cur = stateRef.current;
        if (cur.ui !== "running" || !cur.activeAction?.seenExecuteSuccess) {
          return;
        }
        try {
          const snap = await apiRef.current.getTrajectory(signal);
          if (signal.aborted || stateRef.current.generation !== cur.generation) {
            return;
          }
          dispatch({ type: "LIVE_TRAJECTORY", snapshot: snap });
          const count = snap.completeCount;
          if (count !== lastTrajCountRef.current && shouldLogProgress(count)) {
            lastTrajCountRef.current = count;
            case4Log("trajectory.live_progress", {
              roundGeneration: cur.generation,
              count,
            });
          }
        } catch (err) {
          if (isAbortError(err) || signal.aborted) return;
          dispatch({
            type: "LIVE_HINT",
            hint: "轨迹暂时不可读，保留上次结果",
          });
        }
      },
    });
    const makeThrp = (side: "without" | "with") =>
      createSerialPoll({
        intervalMs: config.pollMs,
        async tick(signal) {
          const cur = stateRef.current;
          if (cur.ui !== "running" || !cur.activeAction?.seenExecuteSuccess) {
            return;
          }
          try {
            const snap = await apiRef.current.getThroughput(side, signal);
            if (
              signal.aborted ||
              stateRef.current.generation !== cur.generation
            ) {
              return;
            }
            dispatch({ type: "LIVE_THRP", side, snapshot: snap });
            const count = snap.samples.length;
            if (
              count !== lastThrpCountRef.current[side] &&
              shouldLogProgress(count)
            ) {
              lastThrpCountRef.current[side] = count;
              case4Log("thrp.live_progress", {
                roundGeneration: cur.generation,
                side,
                count,
              });
            }
          } catch (err) {
            if (isAbortError(err) || signal.aborted) return;
            dispatch({
              type: "LIVE_HINT",
              hint:
                side === "without"
                  ? "无DT吞吐暂时不可读，保留上次结果"
                  : "有DT吞吐暂时不可读，保留上次结果",
            });
          }
        },
      });
    thrpWithoutPollRef.current = makeThrp("without");
    thrpWithPollRef.current = makeThrp("with");
    trajPollRef.current.start();
    thrpWithoutPollRef.current.start();
    thrpWithPollRef.current.start();
  }, [config.pollMs]);

  const onControlTick = useCallback(
    async (control: ControlSnapshot) => {
      const action = stateRef.current.activeAction;
      if (!action) return;
      if (!controlMatchesAction(control, action.kind)) {
        const key = [
          action.generation,
          control.case,
          control.command,
          control.dt_type,
          control.status,
        ].join(":");
        if (lastMismatchRef.current !== key) {
          lastMismatchRef.current = key;
          case4Warn("poll.control_context_mismatch", {
            roundGeneration: action.generation,
            ...controlSummary(control),
          });
        }
        return;
      }
      lastMismatchRef.current = null;

      const flag = control.save_picture_flag === 1 ? 1 : 0;
      const status = control.status;
      // 只在本轮已见 execute success（含同拍 success）后认 0→1；未见 success 的 complete 不截图。
      const seenSuccess =
        action.seenExecuteSuccess || status === "execute success";
      const inCaptureWindow =
        action.kind === "start" &&
        seenSuccess &&
        stateRef.current.ui !== "completed";
      if (
        action.kind === "start" &&
        screenshotPhaseRef.current === "idle" &&
        lastFlagRef.current === 0 &&
        flag === 1 &&
        inCaptureWindow
      ) {
        lastFlagRef.current = 1;
        screenshotPhaseRef.current = "pending";
        case4Log("screenshot.requested", {
          roundGeneration: action.generation,
          savePictureFlag: flag,
          status,
        });
      } else if (flag === 0 && screenshotPhaseRef.current === "idle") {
        lastFlagRef.current = 0;
      }

      if (lastStatusRef.current !== status) {
        case4Log("poll.status_edge", {
          roundGeneration: action.generation,
          from: lastStatusRef.current,
          to: status,
          seenExecuteSuccess: action.seenExecuteSuccess,
        });
        lastStatusRef.current = status;
      }

      if (status === "execute success") {
        if (!stateRef.current.activeAction?.seenExecuteSuccess) {
          dispatch({ type: "SEEN_EXECUTE_SUCCESS" });
          if (action.kind === "start") startLivePolls();
        }
        return;
      }
      if (status === "execute fail") {
        case4Error("round.execute_fail", {
          roundGeneration: action.generation,
          kind: action.kind,
        });
        abortScreenshot();
        stopAllPolls();
        dispatch({ type: "EXECUTE_FAIL" });
        setBusy(false);
        return;
      }
      const seen =
        Boolean(stateRef.current.activeAction?.seenExecuteSuccess) ||
        status === "execute success";
      if (action.kind === "start" && seen && status === "case complete") {
        if (stateRef.current.finalSubmitted || closingRef.current) return;
        if (
          stateRef.current.ui === "finalizing" ||
          stateRef.current.ui === "failed-start"
        ) {
          return;
        }
        dispatch({ type: "ENTER_FINALIZING" });
        stopLivePolls();
        startResultPoll();
        return;
      }
      if (
        action.kind === "reinit" &&
        seen &&
        status === "reinit complete"
      ) {
        case4Log("reinit.ui_applied", { roundGeneration: action.generation });
        dispatch({ type: "REINIT_UI_APPLIED" });
        stopControlPoll();
        await postInitAndFinish("initial");
      }
    },
    [
      abortScreenshot,
      postInitAndFinish,
      setBusy,
      startLivePolls,
      startResultPoll,
      stopAllPolls,
      stopControlPoll,
      stopLivePolls,
    ],
  );

  const startControlPoll = useCallback(() => {
    controlPollRef.current?.stop();
    pollFailStreakRef.current = 0;
    const handle = createSerialPoll({
      intervalMs: config.pollMs,
      async tick(signal) {
        try {
          const control = await apiRef.current.getControl(signal);
          if (signal.aborted) return;
          pollFailStreakRef.current = 0;
          if (stateRef.current.adapterError) {
            dispatch({ type: "ADAPTER_ERROR", value: false });
          }
          await onControlTick(control);
        } catch (err) {
          if (isAbortError(err) || signal.aborted) return;
          pollFailStreakRef.current += 1;
          if (
            pollFailStreakRef.current >= CASE4_POLL_FAIL_RETRY_THRESHOLD &&
            !stateRef.current.adapterError
          ) {
            dispatch({ type: "ADAPTER_ERROR", value: true });
          }
        }
      },
    });
    controlPollRef.current = handle;
    handle.start();
  }, [config.pollMs, onControlTick]);

  const confirmUncertainPost = useCallback(
    async (kind: ActionKind, signal: AbortSignal): Promise<boolean> => {
      try {
        const control = await apiRef.current.getControl(signal);
        if (!controlMatchesAction(control, kind)) {
          return !isInitIdle(control) && controlMatchesAction(control, kind);
        }
        const ok =
          kind === "start"
            ? isStartProgress(control.status)
            : isReinitProgress(control.status);
        return ok;
      } catch {
        return false;
      }
    },
    [],
  );

  const runCommand = useCallback(
    async (kind: ActionKind) => {
      const cur = stateRef.current;
      if (kind === "start" && !canStart(cur)) return;
      if (kind === "reinit" && !canReinit(cur)) return;
      const restoreUi = cur.ui;
      const generation = cur.generation + 1;
      lastFlagRef.current = 0;
      lastStatusRef.current = null;
      lastTrajCountRef.current = 0;
      lastThrpCountRef.current = { without: 0, with: 0 };
      screenshotPhaseRef.current = "idle";
      closingRef.current = false;
      abortScreenshot();
      stopAllPolls();
      actionAbortRef.current?.abort();
      const ac = new AbortController();
      actionAbortRef.current = ac;
      dispatch({ type: "ACTION_BEGIN", kind, generation });
      setBusy(true);
      case4Log(`command.${kind}_click`, { roundGeneration: generation });
      try {
        await apiRef.current.postControl(
          { case: "case4", command: kind, dt_type: "all" },
          ac.signal,
        );
        case4Log(`command.${kind}_ok`, { roundGeneration: generation });
        startControlPoll();
      } catch (err) {
        if (isAbortError(err)) return;
        if (err instanceof Case4ApiError && err.code === "CONTROL_BUSY") {
          case4Warn("command.control_busy", { roundGeneration: generation });
          dispatch({
            type: "CLEAR_ACTIVE",
            ui: kind === "reinit" ? "failed-reinit" : restoreUi,
          });
          setBusy(false);
          return;
        }
        const uncertain =
          !(err instanceof Case4ApiError) ||
          err.code === "REQUEST_TIMEOUT" ||
          err.httpStatus === 0;
        if (uncertain) {
          const ok = await confirmUncertainPost(kind, ac.signal);
          if (ok) {
            case4Log(`command.${kind}_ok`, {
              roundGeneration: generation,
              source: "control-confirm",
            });
            startControlPoll();
            return;
          }
        }
        case4Error(`command.${kind}_fail`, {
          roundGeneration: generation,
          code: err instanceof Case4ApiError ? err.code : undefined,
          reason: err instanceof Error ? err.message : String(err),
        });
        dispatch({ type: "ACTION_POST_FAILED", restoreUi });
        setBusy(false);
      }
    },
    [
      abortScreenshot,
      confirmUncertainPost,
      setBusy,
      startControlPoll,
      stopAllPolls,
    ],
  );

  const onStart = useCallback(() => {
    void runCommand("start");
  }, [runCommand]);

  const onReinit = useCallback(() => {
    void runCommand("reinit");
  }, [runCommand]);

  useEffect(() => {
    const lifecycle = ++lifecycleRef.current;
    const entryGeneration = lifecycle;
    const ac = new AbortController();
    case4Log("entry.begin", { entryGeneration });
    dispatch({ type: "MOUNT_RESET" });
    dispatch({ type: "INIT_LOADING" });

    const run = async () => {
      const result = await runCase4Handshake(
        apiRef.current,
        ac.signal,
        entryGeneration,
      );
      if (lifecycle !== lifecycleRef.current) return;
      if (result.ok) {
        dispatch({ type: "INIT_READY", baseRoute: result.baseRoute });
        return;
      }
      if (result.kind === "init-data") {
        dispatch({ type: "INIT_ERROR" });
        return;
      }
      dispatch({ type: "ADAPTER_ERROR", value: true });
      const probe = async () => {
        if (lifecycle !== lifecycleRef.current) return;
        try {
          await apiRef.current.getControl(ac.signal);
          if (lifecycle !== lifecycleRef.current) return;
          case4Log("adapter_probe.recovered", { entryGeneration });
          dispatch({ type: "INIT_LOADING" });
          const again = await runCase4Handshake(
            apiRef.current,
            ac.signal,
            entryGeneration,
          );
          if (lifecycle !== lifecycleRef.current) return;
          if (again.ok) {
            dispatch({ type: "INIT_READY", baseRoute: again.baseRoute });
          } else if (again.kind === "init-data") {
            dispatch({ type: "INIT_ERROR" });
          } else {
            scheduleProbe();
          }
        } catch {
          scheduleProbe();
        }
      };
      const scheduleProbe = () => {
        case4Log("adapter_probe.start", { entryGeneration });
        probeTimerRef.current = window.setTimeout(() => {
          void probe();
        }, CASE4_ADAPTER_RECOVERY_PROBE_MS);
      };
      scheduleProbe();
    };
    void run();

    const onPageHide = () => {
      void apiRef.current.postControl(
        { command: "init" },
        undefined,
        { keepalive: true },
      );
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      lifecycleRef.current += 1;
      ac.abort();
      stopProbe();
      stopAllPolls();
      abortScreenshot();
      actionAbortRef.current?.abort();
      window.removeEventListener("pagehide", onPageHide);
      case4Log("entry.cleanup", { entryGeneration });
      if (busyOwnedRef.current) {
        busyOwnedRef.current = false;
        onBusyChange?.(false);
      }
    };
  }, [abortScreenshot, onBusyChange, stopAllPolls, stopProbe]);

  const view = selectCase4Presentation(state);
  return {
    state,
    ...view,
    onStart,
    onReinit,
  };
}

export type Case4Controller = ReturnType<typeof useCase4Controller>;
