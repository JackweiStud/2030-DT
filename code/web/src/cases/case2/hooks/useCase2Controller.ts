/**
 * case2 挂载生命周期：进页加载、命令 POST、串行轮询、截图机。
 * 卸载时 abort 并停表；不把 timer 放进 reducer。
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import { toPng } from "html-to-image";
import { createCase2Api, type Case2Api } from "../api/case2Api";
import type { Case2RuntimeConfig } from "../metrics/heatmapConfig";
import {
  canReset,
  canStart,
  case2Reducer,
  createInitialCase2State,
  shouldFetchCalibrated,
  shouldStartScreenshot,
  statusFeedbackText,
  shouldShowCalibrated,
  type Case2State,
} from "../state/case2Reducer";

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

/**
 * case2 唯一业务控制器。切 Tab 卸载本 hook 即停止轮询。
 */
export function useCase2Controller(options: Options): Case2Controller {
  const { config, stageElementRef } = options;
  const apiRef = useRef(options.api ?? createCase2Api({ apiBase: config.apiBase }));
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

  const stopPolling = useCallback(() => {
    pollingRef.current = false;
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const runScreenshotTask = useCallback(async () => {
    if (screenshotBusyRef.current) return;
    screenshotBusyRef.current = true;
    const api = apiRef.current;
    let attempts = 0;
    let base64: string | null = stateRef.current.screenshotBase64;

    const maxAttempts = 3;
    try {
      while (attempts < maxAttempts) {
        attempts += 1;
        if (attempts === 1) {
          dispatch({ type: "SCREENSHOT_ENTER_SAVING" });
        } else {
          dispatch({ type: "SCREENSHOT_ATTEMPT_FAIL" });
        }

        try {
          if (!base64) {
            const node = stageElementRef.current;
            if (!node) throw new Error("stage element missing");
            // 等待字体/图片：给一帧机会
            await new Promise((r) => requestAnimationFrame(() => r(null)));
            const dataUrl = await toPng(node, {
              width: 1920,
              height: 1080,
              pixelRatio: 1,
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
            base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
            dispatch({ type: "SCREENSHOT_SET_BASE64", base64 });
          }

          await api.postScreenshot(base64);
          const stillCalibrating = stateRef.current.case2UiState === "calibrating";
          dispatch({
            type: "SCREENSHOT_UPLOAD_OK",
            stayInCalibrating: stillCalibrating,
          });
          return;
        } catch (err) {
          console.warn("[case2] screenshot attempt failed", attempts, err);
          // 响应不确定：查 flag；已清零视为 Node 成功
          try {
            const snap = await api.getControl();
            if (snap.save_picture_flag === 0) {
              const stillCalibrating = stateRef.current.case2UiState === "calibrating";
              dispatch({
                type: "SCREENSHOT_UPLOAD_OK",
                stayInCalibrating: stillCalibrating,
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
    } finally {
      screenshotBusyRef.current = false;
    }
  }, [stageElementRef]);

  const pollOnce = useCallback(async () => {
    const api = apiRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const control = await api.getControl(controller.signal);
      const before = stateRef.current;

      // 同拍顺序：先 flag 0→1 开截图，再认 complete
      if (shouldStartScreenshot(before, control)) {
        void runScreenshotTask();
      } else if (
        before.screenshotPhase === "waitClear" &&
        control.save_picture_flag === 0
      ) {
        dispatch({ type: "SCREENSHOT_FLAG_CLEARED" });
      }

      // complete 认领依赖「本拍前」已 seen（status 单值，不会与 success 同拍）
      const mayFetch = shouldFetchCalibrated(before, control);
      dispatch({ type: "CONTROL_POLL_OK", control });

      if (mayFetch) {
        try {
          const metrics = await api.getDataFiles("calibrated", controller.signal);
          dispatch({ type: "CALIBRATED_OK", metrics });
          stopPolling();
          return;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          dispatch({ type: "CALIBRATED_FAIL", message });
          // 保持 calibrating，继续轮询
        }
      }

      const ui = stateRef.current.case2UiState;
      if (
        ui === "failed-start" ||
        ui === "failed-reinit" ||
        ui === "completed" ||
        (ui === "initial" && before.case2UiState === "resetting")
      ) {
        stopPolling();
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.warn("[case2] control poll failed", err);
      dispatch({ type: "CONTROL_POLL_FAIL" });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [runScreenshotTask, stopPolling]);

  const schedulePollLoop = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = true;

    const loop = async () => {
      if (!pollingRef.current) return;
      await pollOnce();
      if (!pollingRef.current) return;
      const ui = stateRef.current.case2UiState;
      if (ui !== "calibrating" && ui !== "resetting") {
        pollingRef.current = false;
        return;
      }
      pollTimerRef.current = window.setTimeout(() => {
        void loop();
      }, config.pollMs);
    };
    void loop();
  }, [config.pollMs, pollOnce]);

  // 进页：Initial + 一次性 control 诊断
  useEffect(() => {
    const api = apiRef.current;
    const ac = new AbortController();
    void (async () => {
      try {
        const metrics = await api.getDataFiles("initial", ac.signal);
        dispatch({ type: "INITIAL_DATA_OK", metrics });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn("[case2] initial data failed", err);
        dispatch({ type: "INITIAL_DATA_FAIL", message });
      }
      try {
        const control = await api.getControl(ac.signal);
        dispatch({ type: "DIAGNOSTIC_CONTROL_OK", control });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.warn("[case2] diagnostic control failed", err);
        dispatch({ type: "DIAGNOSTIC_CONTROL_FAIL" });
      }
    })();
    return () => {
      ac.abort();
      stopPolling();
    };
  }, [stopPolling]);

  const onStart = useCallback(() => {
    const snap = stateRef.current;
    if (!canStart(snap)) return;
    dispatch({ type: "START_CLICK" });
    void (async () => {
      try {
        const control = await apiRef.current.postControl({
          case: "case2",
          command: "start",
          dt_type: "with dt",
        });
        dispatch({ type: "START_POST_OK", control });
        schedulePollLoop();
      } catch (err) {
        console.warn("[case2] start POST failed", err);
        dispatch({ type: "START_POST_FAIL" });
      }
    })();
  }, [schedulePollLoop]);

  const onReset = useCallback(() => {
    const snap = stateRef.current;
    if (!canReset(snap)) return;
    dispatch({ type: "RESET_CLICK" });
    void (async () => {
      try {
        const control = await apiRef.current.postControl({ command: "reinit" });
        dispatch({ type: "RESET_POST_OK", control });
        schedulePollLoop();
      } catch (err) {
        console.warn("[case2] reset POST failed", err);
        dispatch({ type: "RESET_POST_FAIL" });
      }
    })();
  }, [schedulePollLoop]);

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
