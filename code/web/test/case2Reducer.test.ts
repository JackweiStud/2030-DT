/**
 * case2 reducer 主路径与旁路行为单测。
 */

import { describe, expect, it } from "vitest";
import {
  canReset,
  canStart,
  case2Reducer,
  createInitialCase2State,
  shouldFetchCalibrated,
  shouldResetCommandAfterCommandCompletion,
  shouldStartScreenshot,
  statusFeedbackText,
  shouldShowCalibrated,
} from "../src/cases/case2/state/case2Reducer";
import type { ControlSnapshot, MetricsBundle } from "../src/cases/case2/types";

function metrics(): MetricsBundle {
  return {
    rss: { heatmap: [[1]], kpi: [1, 2] },
    effective_path_num: { heatmap: [[1]], kpi: [1] },
    first_path_delay: { heatmap: [[1]], kpi: [3] },
  };
}

function control(partial: Partial<ControlSnapshot>): ControlSnapshot {
  return {
    case: "case2",
    command: "start",
    dt_type: "with dt",
    status: "",
    save_picture_flag: 0,
    ...partial,
  };
}

describe("case2Reducer", () => {
  it("新挂载为 initial，不续接历史 complete", () => {
    const s = createInitialCase2State();
    expect(s.case2UiState).toBe("initial");
    const afterDiag = case2Reducer(s, {
      type: "DIAGNOSTIC_CONTROL_OK",
      control: control({ status: "case complete" }),
    });
    expect(afterDiag.case2UiState).toBe("initial");
    expect(shouldShowCalibrated(afterDiag)).toBe(false);
  });

  it("initial -> calibrating -> completed 主路径", () => {
    let s = createInitialCase2State();
    s = case2Reducer(s, { type: "INITIAL_DATA_OK", metrics: metrics() });
    expect(canStart(s)).toBe(true);
    s = case2Reducer(s, { type: "START_CLICK" });
    expect(s.case2UiState).toBe("calibrating");
    expect(s.calibratedData).toBeNull();
    s = case2Reducer(s, {
      type: "START_POST_OK",
      control: control({ status: "" }),
    });
    s = case2Reducer(s, {
      type: "CONTROL_POLL_OK",
      control: control({ status: "execute success" }),
    });
    expect(s.seenExecuteSuccess).toBe(true);
    expect(s.case2UiState).toBe("calibrating");

    const completeCtrl = control({ status: "case complete" });
    expect(shouldFetchCalibrated(s, completeCtrl)).toBe(true);
    s = case2Reducer(s, { type: "CONTROL_POLL_OK", control: completeCtrl });
    s = case2Reducer(s, { type: "CALIBRATED_OK", metrics: metrics() });
    expect(s.case2UiState).toBe("completed");
    expect(shouldResetCommandAfterCommandCompletion(s)).toBe(true);
    expect(canStart(s)).toBe(false);
    expect(canReset(s)).toBe(false);

    s = case2Reducer(s, {
      type: "DIAGNOSTIC_CONTROL_OK",
      control: control({ command: "init", status: "", dt_type: "" }),
    });
    expect(canReset(s)).toBe(true);
  });

  it("未见 success 的 case complete 不拉数", () => {
    let s = createInitialCase2State();
    s = case2Reducer(s, { type: "START_CLICK" });
    const ctrl = control({ status: "case complete" });
    expect(shouldFetchCalibrated(s, ctrl)).toBe(false);
  });

  it("failed-start 只可再启动", () => {
    let s = createInitialCase2State();
    s = case2Reducer(s, { type: "INITIAL_DATA_OK", metrics: metrics() });
    s = case2Reducer(s, { type: "START_CLICK" });
    s = case2Reducer(s, {
      type: "CONTROL_POLL_OK",
      control: control({ status: "execute fail" }),
    });
    expect(s.case2UiState).toBe("failed-start");
    expect(statusFeedbackText(s)).toBe("执行命令失败");
    expect(canStart(s)).toBe(true);
    expect(canReset(s)).toBe(false);
  });

  it("failed-reinit 只可再重置，并清空 Calibrated", () => {
    let s = createInitialCase2State();
    s = {
      ...s,
      case2UiState: "completed",
      calibratedData: metrics(),
      initialData: metrics(),
    };
    s = case2Reducer(s, { type: "RESET_CLICK" });
    expect(s.calibratedData).not.toBeNull();
    s = case2Reducer(s, {
      type: "CONTROL_POLL_OK",
      control: control({ status: "execute fail", command: "reinit" }),
    });
    expect(s.case2UiState).toBe("failed-reinit");
    expect(s.calibratedData).toBeNull();
    expect(canStart(s)).toBe(false);
    expect(canReset(s)).toBe(true);
  });

  it("resetting 暂留旧画面，reinit complete 后清空", () => {
    let s = createInitialCase2State();
    s = {
      ...s,
      case2UiState: "completed",
      calibratedData: metrics(),
      initialData: metrics(),
    };
    s = case2Reducer(s, { type: "RESET_CLICK" });
    expect(s.case2UiState).toBe("resetting");
    expect(shouldShowCalibrated(s)).toBe(true);
    s = case2Reducer(s, {
      type: "CONTROL_POLL_OK",
      control: control({ status: "execute success", command: "reinit" }),
    });
    s = case2Reducer(s, {
      type: "CONTROL_POLL_OK",
      control: control({ status: "reinit complete", command: "reinit" }),
    });
    expect(s.case2UiState).toBe("initial");
    expect(s.calibratedData).toBeNull();
  });

  it("POST 失败回退点击前相并置 adapterError", () => {
    let s = createInitialCase2State();
    s = case2Reducer(s, { type: "INITIAL_DATA_OK", metrics: metrics() });
    s = case2Reducer(s, { type: "START_CLICK" });
    s = case2Reducer(s, { type: "START_POST_FAIL" });
    expect(s.case2UiState).toBe("initial");
    expect(s.adapterError).toBe(true);
    expect(statusFeedbackText(s)).toBe("case2文件服务器连接异常");
    expect(canStart(s)).toBe(false);
  });

  it("同拍 flag 上升沿在 idle 时触发截图", () => {
    let s = createInitialCase2State();
    s = case2Reducer(s, { type: "START_CLICK" });
    expect(
      shouldStartScreenshot(s, control({ save_picture_flag: 1, status: "execute success" })),
    ).toBe(true);
    s = case2Reducer(s, { type: "SCREENSHOT_ENTER_SAVING" });
    expect(
      shouldStartScreenshot(s, control({ save_picture_flag: 1 })),
    ).toBe(false);
  });

  it("六文件失败保持 calibrating；耗尽后结果不完整已自动回退", () => {
    let s = createInitialCase2State();
    s = case2Reducer(s, { type: "INITIAL_DATA_OK", metrics: metrics() });
    s = case2Reducer(s, { type: "START_CLICK" });
    s = case2Reducer(s, {
      type: "CONTROL_POLL_OK",
      control: control({ status: "execute success" }),
    });
    const next = case2Reducer(s, {
      type: "CALIBRATED_FAIL",
      message: "batch incomplete",
    });
    expect(next.case2UiState).toBe("calibrating");

    const exhausted = case2Reducer(s, {
      type: "CALIBRATED_FAIL_EXHAUSTED",
      message: "batch incomplete",
    });
    expect(exhausted.case2UiState).toBe("failed-start");
    expect(exhausted.resultIncomplete).toBe(true);
    expect(statusFeedbackText(exhausted)).toBe("结果不完整已自动回退");
    expect(canStart(exhausted)).toBe(true);
  });

  it("截图 3 次失败后 DROPPED 回 idle", () => {
    let s = createInitialCase2State();
    s = case2Reducer(s, { type: "START_CLICK" });
    s = case2Reducer(s, { type: "SCREENSHOT_ENTER_SAVING" });
    s = case2Reducer(s, { type: "SCREENSHOT_DROPPED" });
    expect(s.screenshotPhase).toBe("idle");
    expect(s.screenshotAttempts).toBe(0);
  });

  it("启动轮空闲写回必须等待 Calibrated 与截图状态收尾", () => {
    let s = createInitialCase2State();
    s = case2Reducer(s, { type: "START_CLICK" });
    s = case2Reducer(s, {
      type: "CONTROL_POLL_OK",
      control: control({ status: "case complete" }),
    });
    expect(shouldResetCommandAfterCommandCompletion(s)).toBe(false);

    s = {
      ...s,
      case2UiState: "completed",
      calibratedData: metrics(),
      lastControl: control({ status: "case complete" }),
      screenshotPhase: "saving",
    };
    expect(shouldResetCommandAfterCommandCompletion(s)).toBe(false);

    s = { ...s, screenshotPhase: "idle" };
    expect(shouldResetCommandAfterCommandCompletion(s)).toBe(true);

    s = {
      ...s,
      lastControl: control({ command: "init", status: "" }),
    };
    expect(shouldResetCommandAfterCommandCompletion(s)).toBe(false);
  });

  it("重置完成回 initial 后可以写回 init 空闲态", () => {
    let s = createInitialCase2State();
    s = {
      ...s,
      case2UiState: "completed",
      calibratedData: metrics(),
      initialData: metrics(),
    };
    s = case2Reducer(s, { type: "RESET_CLICK" });
    s = case2Reducer(s, {
      type: "CONTROL_POLL_OK",
      control: control({ status: "execute success", command: "reinit" }),
    });
    s = case2Reducer(s, {
      type: "CONTROL_POLL_OK",
      control: control({ status: "reinit complete", command: "reinit" }),
    });
    expect(s.case2UiState).toBe("initial");
    expect(s.calibratedData).toBeNull();
    expect(shouldResetCommandAfterCommandCompletion(s)).toBe(true);
  });

  it("completed 且截图未 idle 时不可重置", () => {
    let s = createInitialCase2State();
    s = {
      ...s,
      case2UiState: "completed",
      calibratedData: metrics(),
      lastControl: control({ command: "start", status: "case complete" }),
      screenshotPhase: "saving",
    };
    expect(canReset(s)).toBe(false);

    s = { ...s, screenshotPhase: "waitClear" };
    expect(canReset(s)).toBe(false);

    s = { ...s, screenshotPhase: "idle" };
    expect(canReset(s)).toBe(false);
  });

  it("completed 且控制文件已写回 init 后可重置", () => {
    const s = {
      ...createInitialCase2State(),
      case2UiState: "completed" as const,
      calibratedData: metrics(),
      screenshotPhase: "idle" as const,
      lastControl: control({ command: "init", status: "", dt_type: "" }),
    };
    expect(canReset(s)).toBe(true);
  });
});
