/**
 * case2 挂载生命周期：进页加载、命令 POST、串行轮询、截图机。
 * 卸载时 abort 并停表；不把 timer 放进 reducer。
 *
 * 进页：串行门闩
 * 1) GET control-file（诊断适配服务/控制文件，不因历史 status 改相）
 * 2) POST init 空闲写回
 * 3) 仅当 init 成功后，再 GET data-files?phase=initial
 * StrictMode 双 effect：用 generation + AbortController 丢弃陈旧结果，避免双发 Initial。
 *
 * adapterError 且仍为 initial：每 5s 探活 control，成功后写回 init、清 error 并补拉 Initial；不设总时长上限。
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import { toPng } from "html-to-image";
import { Case2ApiError, createCase2Api, type Case2Api } from "../api/case2Api";
import type { Case2RuntimeConfig } from "../metrics/heatmapConfig";
import { CASE2_CALIBRATED_NOT_READY_MAX_ATTEMPTS } from "../metrics/heatmapConfig";
import type { ControlSnapshot } from "../types";
import {
  canReset,
  canStart,
  case2Reducer,
  createInitialCase2State,
  shouldFetchCalibrated,
  shouldKeepPollingForWaitClear,
  shouldLatchCompleteScreenshot,
  shouldResetCommandAfterCommandCompletion,
  shouldStartScreenshot,
  statusFeedbackText,
  shouldShowCalibrated,
  type Case2State,
} from "../state/case2Reducer";

/** initial + adapterError 时的适配探活间隔；不封顶，直到恢复或离开 case2。 */
export const ADAPTER_RECOVERY_PROBE_MS = 5000;

export type Case2Controller = {
  state: Case2State;
  statusText: string;
  startEnabled: boolean;
  resetEnabled: boolean;
  showCalibrated: boolean;
  onStart: () => void;
  onReset: () => void;
};

type Options = {
  config: Case2RuntimeConfig;
  /** 截图目标：1920×1080 Stage 内层节点。 */
  stageElementRef: React.RefObject<HTMLElement>;
  api?: Case2Api;
};

/** 模块级 generation：StrictMode setup→cleanup→setup 时丢弃陈旧进页结果。 */
let entryLoadGeneration = 0;

function case2Log(event: string, data?: Record<string, unknown>): void {
  if (data === undefined) {
    console.info(`[case2] ${event}`);
    return;
  }
  console.info(`[case2] ${event}`, data);
}

function case2Warn(event: string, data?: Record<string, unknown>): void {
  if (data === undefined) {
    console.warn(`[case2] ${event}`);
    return;
  }
  console.warn(`[case2] ${event}`, data);
}

function case2Error(event: string, data?: Record<string, unknown>): void {
  if (data === undefined) {
    console.error(`[case2] ${event}`);
    return;
  }
  console.error(`[case2] ${event}`, data);
}

function controlSummary(control: ControlSnapshot) {
  return {
    command: control.command,
    status: control.status,
    save_picture_flag: control.save_picture_flag,
  };
}

function controlGateSummary(
  state: Case2State,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ui: state.case2UiState,
    screenshotPhase: state.screenshotPhase,
    canReset: canReset(state),
    lastCommand: state.lastControl?.command ?? null,
    lastStatus: state.lastControl?.status ?? null,
    savePictureFlag: state.lastControl?.save_picture_flag ?? null,
    ...extra,
  };
}

function apiErrorFields(err: unknown): Record<string, unknown> {
  if (err instanceof Case2ApiError) {
    return {
      code: err.code,
      httpStatus: err.httpStatus,
      endpoint: "/api/case2/control-file",
      reason: err.message,
    };
  }
  return { reason: err instanceof Error ? err.message : String(err) };
}

function isStartCompleteAwaitingScreenshot(state: Case2State): boolean {
  return (
    state.case2UiState === "completed" &&
    state.calibratedData !== null &&
    state.lastControl?.command === "start" &&
    state.lastControl.status === "case complete"
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
 * case2 唯一业务控制器。切 Tab 卸载本 hook 即停止轮询。
 */
export function useCase2Controller(options: Options): Case2Controller {
  const { config, stageElementRef } = options;
  const apiRef = useRef(options.api ?? createCase2Api());
  const [state, dispatchBase] = useReducer(
    case2Reducer,
    undefined,
    createInitialCase2State,
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  /** dispatch 后立即同步 stateRef，避免轮询异步路径读到过期相。 */
  const dispatch = useCallback((action: Parameters<typeof case2Reducer>[1]) => {
    stateRef.current = case2Reducer(stateRef.current, action);
    dispatchBase(action);
  }, []);

  const pollTimerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pollingRef = useRef(false);
  const screenshotBusyRef = useRef(false);
  const adapterProbeTimerRef = useRef<number | null>(null);
  const adapterProbeAbortRef = useRef<AbortController | null>(null);
  const adapterProbingRef = useRef(false);
  const completionIdleResetAbortRef = useRef<AbortController | null>(null);
  const completionIdleResetPostedRef = useRef(false);
  const completionInitSkipLoggedRef = useRef(false);
  const calibratedFailAttemptsRef = useRef(0);

  const stopPolling = useCallback(() => {
    pollingRef.current = false;
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const stopAdapterProbe = useCallback(() => {
    adapterProbingRef.current = false;
    if (adapterProbeTimerRef.current !== null) {
      window.clearTimeout(adapterProbeTimerRef.current);
      adapterProbeTimerRef.current = null;
    }
    adapterProbeAbortRef.current?.abort();
    adapterProbeAbortRef.current = null;
  }, []);

  const stopCompletionIdleReset = useCallback(() => {
    completionIdleResetAbortRef.current?.abort();
    completionIdleResetAbortRef.current = null;
  }, []);

  const postEntryInit = useCallback(
    async (api: Case2Api, signal: AbortSignal): Promise<ControlSnapshot> => {
      return api.postControl({ command: "init" }, signal);
    },
    [],
  );

  const runAdapterRecoveryProbe = useCallback(async () => {
    const snap = stateRef.current;
    if (!snap.adapterError || snap.case2UiState !== "initial") {
      stopAdapterProbe();
      return;
    }

    const api = apiRef.current;
    const ac = new AbortController();
    adapterProbeAbortRef.current = ac;
    try {
      const control = await api.getControl(ac.signal);
      if (ac.signal.aborted) return;
      if (
        stateRef.current.case2UiState !== "initial" ||
        !stateRef.current.adapterError
      ) {
        return;
      }

      case2Log("adapter_probe.ok", {
        note: "adapter recovered; historical status ignored before init reset",
        ...controlSummary(control),
      });
      const resetControl = await postEntryInit(api, ac.signal);
      if (ac.signal.aborted) return;
      dispatch({ type: "DIAGNOSTIC_CONTROL_OK", control: resetControl });
      case2Log("adapter_probe.init_reset_ok", controlSummary(resetControl));

      if (!stateRef.current.initialData) {
        try {
          const metrics = await api.getDataFiles("initial", ac.signal);
          if (ac.signal.aborted) return;
          dispatch({ type: "INITIAL_DATA_OK", metrics });
          case2Log("adapter_probe.initial_ok", {
            nx: metrics.rss.heatmap[0]?.length ?? 0,
            ny: metrics.rss.heatmap.length,
            kpiN: metrics.rss.kpi.length,
          });
        } catch (err) {
          if (isAbortError(err)) return;
          const message = err instanceof Error ? err.message : String(err);
          console.warn("[case2] adapter probe initial data failed", err);
          dispatch({ type: "INITIAL_DATA_FAIL", message });
          case2Log("adapter_probe.initial_fail", { message });
        }
      }
      stopAdapterProbe();
    } catch (err) {
      if (isAbortError(err)) return;
      case2Log("adapter_probe.fail", {
        reason: err instanceof Error ? err.message : String(err),
      });
    } finally {
      if (adapterProbeAbortRef.current === ac) {
        adapterProbeAbortRef.current = null;
      }
    }
  }, [dispatch, postEntryInit, stopAdapterProbe]);

  const scheduleAdapterProbeLoop = useCallback(() => {
    if (adapterProbingRef.current) return;
    adapterProbingRef.current = true;
    case2Log("adapter_probe.start", {
      intervalMs: ADAPTER_RECOVERY_PROBE_MS,
    });

    const loop = async () => {
      if (!adapterProbingRef.current) return;
      await runAdapterRecoveryProbe();
      if (!adapterProbingRef.current) return;
      const snap = stateRef.current;
      if (!snap.adapterError || snap.case2UiState !== "initial") {
        adapterProbingRef.current = false;
        return;
      }
      adapterProbeTimerRef.current = window.setTimeout(() => {
        void loop();
      }, ADAPTER_RECOVERY_PROBE_MS);
    };

    // 首次也等满间隔，避免与刚失败的进页诊断连打
    adapterProbeTimerRef.current = window.setTimeout(() => {
      void loop();
    }, ADAPTER_RECOVERY_PROBE_MS);
  }, [runAdapterRecoveryProbe]);

  const runScreenshotTask = useCallback(async () => {
    if (screenshotBusyRef.current) return;
    screenshotBusyRef.current = true;
    const api = apiRef.current;
    let attempts = 0;
    let base64: string | null = stateRef.current.screenshotBase64;
    const taskStartedAt = performance.now();

    const maxAttempts = 3;
    try {
      while (attempts < maxAttempts) {
        attempts += 1;
        if (attempts === 1) {
          dispatch({ type: "SCREENSHOT_ENTER_SAVING" });
          case2Log("screenshot.triggered", {
            attempt: attempts,
            flag: 1,
          });
        } else {
          dispatch({ type: "SCREENSHOT_ATTEMPT_FAIL" });
          case2Log("screenshot.retry", { attempt: attempts });
        }

        const attemptStartedAt = performance.now();
        let toPngMs: number | undefined;
        let uploadMs: number | undefined;

        try {
          if (!base64) {
            const node = stageElementRef.current;
            if (!node) throw new Error("stage element missing");
            // 等待字体/图片：给一帧机会
            await new Promise((r) => requestAnimationFrame(() => r(null)));
            const toPngStartedAt = performance.now();
            const dataUrl = await toPng(node, {
              width: 1920,
              height: 1080,
              // 逻辑舞台仍 1920×1080；2× 像素密度缓解 Retina 观感发糊
              pixelRatio: 2,
              style: {
                transform: "none",
                width: "1920px",
                height: "1080px",
              },
              filter: (el) => {
                if (!(el instanceof HTMLElement)) return true;
                return !el.classList.contains("review-dock");
              },
            });
            toPngMs = Math.round(performance.now() - toPngStartedAt);
            base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
            dispatch({ type: "SCREENSHOT_SET_BASE64", base64 });
          }

          const uploadStartedAt = performance.now();
          await api.postScreenshot(base64);
          uploadMs = Math.round(performance.now() - uploadStartedAt);
          const stillCalibrating = stateRef.current.case2UiState === "calibrating";
          dispatch({ type: "SCREENSHOT_UPLOAD_OK" });
          case2Log("screenshot.ok", {
            attempt: attempts,
            stayInCalibrating: stillCalibrating,
            toPngMs,
            uploadMs,
            totalMs: Math.round(performance.now() - taskStartedAt),
            screenshotBusy: true,
            ...controlGateSummary(stateRef.current),
          });
          return;
        } catch (err) {
          console.warn("[case2] screenshot attempt failed", attempts, err);
          case2Log("screenshot.attempt_failed", {
            attempt: attempts,
            toPngMs,
            uploadMs,
            durationMs: Math.round(performance.now() - attemptStartedAt),
            reason: err instanceof Error ? err.message : String(err),
          });
          // 响应不确定：查 flag；已清零视为 Node 成功
          try {
            const snap = await api.getControl();
            if (snap.save_picture_flag === 0) {
              const stillCalibrating = stateRef.current.case2UiState === "calibrating";
              dispatch({ type: "SCREENSHOT_UPLOAD_OK" });
              case2Log("screenshot.ok_via_flag_probe", {
                attempt: attempts,
                stayInCalibrating: stillCalibrating,
                screenshotBusy: true,
                ...controlGateSummary(stateRef.current),
              });
              return;
            }
          } catch {
            // ignore probe errors; count as attempt failure
          }
          // 生成失败则丢掉 base64，下次重生成；上传失败保留
          if (!base64) {
            // already null
          }
        }
      }

      // 3 次仍失败：经 Node 清零并接受丢图
      try {
        await api.postControl({ save_picture_flag: 0 });
      } catch (err) {
        console.warn("[case2] failed to clear save_picture_flag after drop", err);
      }
      dispatch({ type: "SCREENSHOT_DROPPED" });
      case2Log("screenshot.dropped_after_retries", {
        attempts: maxAttempts,
        totalMs: Math.round(performance.now() - taskStartedAt),
      });
    } finally {
      screenshotBusyRef.current = false;
    }
  }, [dispatch, stageElementRef]);

  const pollOnce = useCallback(async () => {
    const api = apiRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const control = await api.getControl(controller.signal);
      const before = stateRef.current;
      const prevStatus = before.lastControl?.status;
      const prevFlag = before.screenshotLastFlag;

      const startNow = shouldStartScreenshot(before, control);
      const latchComplete = shouldLatchCompleteScreenshot(before, control);
      if (startNow) {
        case2Log("poll.flag_rise", {
          boundary: "success",
          from: prevFlag,
          to: control.save_picture_flag,
          status: control.status,
        });
        void runScreenshotTask();
      } else if (latchComplete) {
        dispatch({ type: "SCREENSHOT_LATCH_PENDING" });
        case2Log("poll.flag_rise", {
          boundary: "complete",
          from: prevFlag,
          to: control.save_picture_flag,
          status: control.status,
        });
      } else if (
        before.screenshotPhase === "waitClear" &&
        control.save_picture_flag === 0
      ) {
        dispatch({ type: "SCREENSHOT_FLAG_CLEARED" });
        case2Log("poll.flag_cleared", controlSummary(control));
      }

      // complete 认领依赖「本拍前」已 seen（status 单值，不会与 success 同拍）
      const mayFetch = shouldFetchCalibrated(before, control);
      if (prevStatus !== control.status) {
        case2Log("poll.status_edge", {
          from: prevStatus ?? null,
          to: control.status,
          ui: before.case2UiState,
          seenExecuteSuccess: before.seenExecuteSuccess,
          ...controlSummary(control),
        });
      }
      dispatch({ type: "CONTROL_POLL_OK", control });

      if (mayFetch) {
        case2Log("calibrated.fetch_begin", controlSummary(control));
        try {
          const metrics = await api.getDataFiles("calibrated", controller.signal);
          calibratedFailAttemptsRef.current = 0;
          dispatch({ type: "CALIBRATED_OK", metrics });
          case2Log("calibrated.ok", {
            nx: metrics.rss.heatmap[0]?.length ?? 0,
            ny: metrics.rss.heatmap.length,
            kpiN: metrics.rss.kpi.length,
            screenshotBusy: screenshotBusyRef.current,
            ...controlGateSummary(stateRef.current),
          });
          if (stateRef.current.screenshotPhase === "pending") {
            await waitForNextRender();
            if (controller.signal.aborted) return;
            if (stateRef.current.screenshotPhase === "pending") {
              case2Log("screenshot.complete_boundary_capture", {
                ...controlGateSummary(stateRef.current),
              });
              void runScreenshotTask();
            }
          }
          if (shouldKeepPollingForWaitClear(stateRef.current)) {
            case2Log("poll.keep_for_waitClear", controlGateSummary(stateRef.current));
            return;
          }
          stopPolling();
          return;
        } catch (err) {
          if (isAbortError(err)) return;
          const message = err instanceof Error ? err.message : String(err);
          calibratedFailAttemptsRef.current += 1;
          const attempts = calibratedFailAttemptsRef.current;
          case2Warn("最终 Calibrated 批次未就绪，继续等待", {
            attempts,
            maxAttempts: CASE2_CALIBRATED_NOT_READY_MAX_ATTEMPTS,
            message,
          });
          if (attempts >= CASE2_CALIBRATED_NOT_READY_MAX_ATTEMPTS) {
            case2Error(
              `启动测试结果不完整：case complete 后 Calibrated 六文件连续${CASE2_CALIBRATED_NOT_READY_MAX_ATTEMPTS}次未通过门槛，已退出测试中并撤权`,
              {
                attempts,
                maxAttempts: CASE2_CALIBRATED_NOT_READY_MAX_ATTEMPTS,
                message,
              },
            );
            dispatch({ type: "CALIBRATED_FAIL_EXHAUSTED", message });
            calibratedFailAttemptsRef.current = 0;
            screenshotBusyRef.current = false;
            try {
              const resetControl = await postEntryInit(api, controller.signal);
              if (!controller.signal.aborted) {
                dispatch({ type: "DIAGNOSTIC_CONTROL_OK", control: resetControl });
                case2Log("completion.init_reset_ok", {
                  reason: "result-incomplete",
                  ...controlSummary(resetControl),
                });
              }
            } catch (initErr) {
              if (!isAbortError(initErr) && !controller.signal.aborted) {
                case2Error("结果不完整撤权失败：POST init 未成功", {
                  reason:
                    initErr instanceof Error ? initErr.message : String(initErr),
                });
                dispatch({ type: "CONTROL_POLL_FAIL" });
              }
            }
            case2Log("poll.stop", { ui: "failed-start", reason: "result-incomplete" });
            stopPolling();
            return;
          }
          dispatch({ type: "CALIBRATED_FAIL", message });
          case2Log("calibrated.fail", { message, attempts });
          // 未耗尽：保持 calibrating，继续轮询
        }
      }

      const snap = stateRef.current;
      const ui = snap.case2UiState;
      if (shouldKeepPollingForWaitClear(snap)) {
        return;
      }
      if (
        ui === "failed-start" ||
        ui === "failed-reinit" ||
        ui === "completed" ||
        (ui === "initial" && before.case2UiState === "resetting")
      ) {
        case2Log("poll.stop", { ui });
        stopPolling();
      }
    } catch (err) {
      if (isAbortError(err)) return;
      console.warn("[case2] control poll failed", err);
      dispatch({ type: "CONTROL_POLL_FAIL" });
      case2Log("poll.fail", {
        reason: err instanceof Error ? err.message : String(err),
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [dispatch, postEntryInit, runScreenshotTask, stopPolling]);

  const schedulePollLoop = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    case2Log("poll.start", { pollMs: config.pollMs });

    const loop = async () => {
      if (!pollingRef.current) return;
      await pollOnce();
      if (!pollingRef.current) return;
      const snap = stateRef.current;
      const ui = snap.case2UiState;
      if (
        ui !== "calibrating" &&
        ui !== "resetting" &&
        !shouldKeepPollingForWaitClear(snap)
      ) {
        pollingRef.current = false;
        return;
      }
      pollTimerRef.current = window.setTimeout(() => {
        void loop();
      }, config.pollMs);
    };
    void loop();
  }, [config.pollMs, pollOnce]);

  // 进页：先 control 诊断（适配服务探活），成功后再拉 Initial；带 generation 去重
  useEffect(() => {
    const api = apiRef.current;
    const ac = new AbortController();
    const generation = ++entryLoadGeneration;
    case2Log("entry.begin", { generation });

    void (async () => {
      // 1) 诊断适配服务 / 控制文件；随后清回 init。任一步失败则不拉 Initial
      try {
        const control = await api.getControl(ac.signal);
        if (generation !== entryLoadGeneration || ac.signal.aborted) {
          case2Log("entry.stale_after_control", { generation });
          return;
        }
        case2Log("entry.control_ok", {
          generation,
          note: "adapter/control readable; historical status ignored before init reset",
          ...controlSummary(control),
        });
        const resetControl = await postEntryInit(api, ac.signal);
        if (generation !== entryLoadGeneration || ac.signal.aborted) {
          case2Log("entry.stale_after_init_reset", { generation });
          return;
        }
        dispatch({ type: "DIAGNOSTIC_CONTROL_OK", control: resetControl });
        case2Log("entry.init_reset_ok", {
          generation,
          ...controlSummary(resetControl),
        });
      } catch (err) {
        if (isAbortError(err) || generation !== entryLoadGeneration) {
          case2Log("entry.control_aborted_or_stale", { generation });
          return;
        }
        console.warn("[case2] diagnostic control/init reset failed", err);
        dispatch({ type: "DIAGNOSTIC_CONTROL_FAIL" });
        case2Log("entry.control_fail", {
          generation,
          reason: err instanceof Error ? err.message : String(err),
          note: "skip initial data load",
        });
        return;
      }

      // 2) 仅 init 写回成功后拉 Initial 基线
      try {
        const metrics = await api.getDataFiles("initial", ac.signal);
        if (generation !== entryLoadGeneration || ac.signal.aborted) {
          case2Log("entry.stale_after_initial", { generation });
          return;
        }
        dispatch({ type: "INITIAL_DATA_OK", metrics });
        case2Log("entry.initial_ok", {
          generation,
          nx: metrics.rss.heatmap[0]?.length ?? 0,
          ny: metrics.rss.heatmap.length,
          kpiN: metrics.rss.kpi.length,
        });
      } catch (err) {
        if (isAbortError(err) || generation !== entryLoadGeneration) {
          case2Log("entry.initial_aborted_or_stale", { generation });
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        console.warn("[case2] initial data failed", err);
        dispatch({ type: "INITIAL_DATA_FAIL", message });
        case2Log("entry.initial_fail", { generation, message });
      }
    })();

    return () => {
      ac.abort();
      stopPolling();
      stopAdapterProbe();
      stopCompletionIdleReset();
      case2Log("entry.cleanup", { generation });
    };
  }, [dispatch, postEntryInit, stopAdapterProbe, stopCompletionIdleReset, stopPolling]);

  // initial + adapterError：5s 探活，不封顶；恢复后清 error 并补 Initial
  useEffect(() => {
    if (state.adapterError && state.case2UiState === "initial") {
      scheduleAdapterProbeLoop();
      return () => {
        stopAdapterProbe();
      };
    }
    stopAdapterProbe();
    return undefined;
  }, [
    scheduleAdapterProbeLoop,
    state.adapterError,
    state.case2UiState,
    stopAdapterProbe,
  ]);

  useEffect(() => {
    if (completionIdleResetPostedRef.current) {
      return undefined;
    }

    const screenshotBusy = screenshotBusyRef.current;
    const readyForInit = shouldResetCommandAfterCommandCompletion(state);
    if (screenshotBusy || !readyForInit) {
      if (
        isStartCompleteAwaitingScreenshot(state) &&
        (screenshotBusy || state.screenshotPhase !== "idle") &&
        !completionInitSkipLoggedRef.current
      ) {
        completionInitSkipLoggedRef.current = true;
        case2Log("completion.init_reset_skip", {
          reason: screenshotBusy ? "screenshot-busy" : "screenshot-phase",
          screenshotBusy,
          ...controlGateSummary(state),
        });
      }
      return undefined;
    }

    completionIdleResetPostedRef.current = true;
    const completedControl = state.lastControl;
    if (!completedControl) return undefined;
    const ac = new AbortController();
    completionIdleResetAbortRef.current = ac;
    case2Log("completion.init_reset_begin", controlSummary(completedControl));

    void (async () => {
      try {
        const control = await postEntryInit(apiRef.current, ac.signal);
        if (ac.signal.aborted) return;
        dispatch({ type: "DIAGNOSTIC_CONTROL_OK", control });
        case2Log("completion.init_reset_ok", controlSummary(control));
      } catch (err) {
        if (isAbortError(err)) return;
        console.warn("[case2] completion init reset failed", err);
        dispatch({ type: "CONTROL_POLL_FAIL" });
        case2Log("completion.init_reset_fail", {
          reason: err instanceof Error ? err.message : String(err),
        });
      } finally {
        if (completionIdleResetAbortRef.current === ac) {
          completionIdleResetAbortRef.current = null;
        }
      }
    })();

    return undefined;
  }, [
    dispatch,
    postEntryInit,
    state.calibratedData,
    state.case2UiState,
    state.lastControl,
    state.screenshotPhase,
  ]);

  const onStart = useCallback(() => {
    const snap = stateRef.current;
    if (!canStart(snap)) return;
    completionIdleResetPostedRef.current = false;
    completionInitSkipLoggedRef.current = false;
    stopCompletionIdleReset();
    calibratedFailAttemptsRef.current = 0;
    dispatch({ type: "START_CLICK" });
    case2Log("command.start_click");
    void (async () => {
      try {
        const control = await apiRef.current.postControl({
          case: "case2",
          command: "start",
          dt_type: "with dt",
        });
        dispatch({ type: "START_POST_OK", control });
        case2Log("command.start_ok", controlSummary(control));
        schedulePollLoop();
      } catch (err) {
        console.warn("[case2] start POST failed", err);
        dispatch({ type: "START_POST_FAIL" });
        case2Log("command.start_fail", {
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }, [dispatch, schedulePollLoop, stopCompletionIdleReset]);

  const onReset = useCallback(() => {
    const snap = stateRef.current;
    if (!canReset(snap)) {
      case2Log("command.reset_click_ignored", {
        screenshotBusy: screenshotBusyRef.current,
        completionInitPosted: completionIdleResetPostedRef.current,
        ...controlGateSummary(snap),
      });
      return;
    }
    case2Log("command.reset_click", {
      screenshotBusy: screenshotBusyRef.current,
      completionInitPosted: completionIdleResetPostedRef.current,
      ...controlGateSummary(snap),
    });
    completionIdleResetPostedRef.current = false;
    completionInitSkipLoggedRef.current = false;
    dispatch({ type: "RESET_CLICK" });
    void (async () => {
      try {
        const control = await apiRef.current.postControl({ command: "reinit" });
        dispatch({ type: "RESET_POST_OK", control });
        case2Log("command.reset_ok", controlSummary(control));
        schedulePollLoop();
      } catch (err) {
        console.warn("[case2] reset POST failed", err);
        dispatch({ type: "RESET_POST_FAIL" });
        case2Log("command.reset_fail", {
          screenshotBusy: screenshotBusyRef.current,
          ...apiErrorFields(err),
          ...controlGateSummary(stateRef.current),
        });
      }
    })();
  }, [dispatch, schedulePollLoop]);

  return {
    state,
    statusText: statusFeedbackText(state),
    startEnabled: canStart(state),
    resetEnabled: canReset(state),
    showCalibrated: shouldShowCalibrated(state),
    onStart,
    onReset,
  };
}
