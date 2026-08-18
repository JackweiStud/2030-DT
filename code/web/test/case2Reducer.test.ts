/**
 * case2 reducer 主路径与旁路行为单测。
 */

import { describe, expect, it } from "vitest";
import {
  canReset,
  canStart,
  case2Reducer,
  CASE2_INIT_DATA_ERROR_BADGE,
  createInitialCase2State,
  shouldFetchCalibrated,
  shouldLatchCompleteScreenshot,
  shouldResetCommandAfterCommandCompletion,
  shouldStartScreenshot,
  shouldKeepPollingForWaitClear,
  statusFeedbackText,
  statusRetryHint,
  CASE2_ADAPTER_ERROR_BADGE,
  CASE2_ADAPTER_RETRY_HINT,
  CASE2_POLL_FAIL_RETRY_THRESHOLD,
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
    expect(statusFeedbackText(s)).toBe(CASE2_ADAPTER_ERROR_BADGE);
    expect(canStart(s)).toBe(false);
  });

  it("COMMAND_CONTROL_BUSY 回滚点击前相且不置 adapterError", () => {
    let s = createInitialCase2State();
    s = case2Reducer(s, { type: "INITIAL_DATA_OK", metrics: metrics() });
    s = case2Reducer(s, { type: "START_CLICK" });
    s = case2Reducer(s, { type: "COMMAND_CONTROL_BUSY" });
    expect(s.case2UiState).toBe("initial");
    expect(s.phaseBeforeCommand).toBeNull();
    expect(s.adapterError).toBe(false);
    expect(s.seenExecuteSuccess).toBe(false);
    expect(statusFeedbackText(s)).toBe("等待启动测试");
    expect(canStart(s)).toBe(true);

    s = case2Reducer(s, { type: "START_CLICK" });
    s = case2Reducer(s, {
      type: "START_POST_OK",
      control: control({ command: "start", status: "" }),
    });
    s = case2Reducer(s, {
      type: "CALIBRATED_OK",
      metrics: metrics(),
    });
    s = case2Reducer(s, {
      type: "DIAGNOSTIC_CONTROL_OK",
      control: control({ command: "init", status: "", dt_type: "" }),
    });
    expect(s.case2UiState).toBe("completed");
    expect(s.calibratedData).not.toBeNull();
    s = case2Reducer(s, { type: "RESET_CLICK" });
    const kept = s.calibratedData;
    s = case2Reducer(s, { type: "COMMAND_CONTROL_BUSY" });
    expect(s.case2UiState).toBe("completed");
    expect(s.adapterError).toBe(false);
    expect(s.calibratedData).toBe(kept);
    expect(canReset(s)).toBe(true);
  });

  it("Initial 六文件失败显示初始化数据异常，不是连接异常或执行失败", () => {
    let s = createInitialCase2State();
    s = case2Reducer(s, {
      type: "INITIAL_DATA_FAIL",
      message: "heatmap_init_rss.txt is missing",
    });
    expect(s.initialError).toBe("heatmap_init_rss.txt is missing");
    expect(statusFeedbackText(s)).toBe(CASE2_INIT_DATA_ERROR_BADGE);
    expect(canStart(s)).toBe(false);
    expect(s.adapterError).toBe(false);
    expect(s.case2UiState).toBe("initial");

    s = { ...s, adapterError: true };
    expect(statusFeedbackText(s)).toBe(CASE2_ADAPTER_ERROR_BADGE);

    s = case2Reducer(
      { ...s, adapterError: false },
      { type: "INITIAL_DATA_OK", metrics: metrics() },
    );
    expect(s.initialError).toBeNull();
    expect(statusFeedbackText(s)).toBe("等待启动测试");
    expect(canStart(s)).toBe(true);
  });

  it("success 左边界 0→1 立刻截图；同一高电平不重复", () => {
    let s = createInitialCase2State();
    s = case2Reducer(s, { type: "START_CLICK" });
    expect(
      shouldStartScreenshot(s, control({ save_picture_flag: 1, status: "execute success" })),
    ).toBe(true);
    expect(
      shouldLatchCompleteScreenshot(s, control({ save_picture_flag: 1, status: "execute success" })),
    ).toBe(false);
    s = case2Reducer(s, { type: "SCREENSHOT_ENTER_SAVING" });
    expect(
      shouldStartScreenshot(s, control({ save_picture_flag: 1, status: "execute success" })),
    ).toBe(false);
  });

  it("窗口外 flag=1 不截、不消费边沿；进入 success 后仍可截", () => {
    let s = createInitialCase2State();
    s = case2Reducer(s, { type: "START_CLICK" });
    const emptyFlag = control({ save_picture_flag: 1, status: "" });
    expect(shouldStartScreenshot(s, emptyFlag)).toBe(false);
    expect(shouldLatchCompleteScreenshot(s, emptyFlag)).toBe(false);
    expect(s.screenshotLastFlag).toBe(0);

    const completeWithoutSeen = control({
      save_picture_flag: 1,
      status: "case complete",
    });
    expect(shouldStartScreenshot(s, completeWithoutSeen)).toBe(false);
    expect(shouldLatchCompleteScreenshot(s, completeWithoutSeen)).toBe(false);

    s = case2Reducer(s, {
      type: "CONTROL_POLL_OK",
      control: control({ status: "execute success", save_picture_flag: 1 }),
    });
    expect(s.seenExecuteSuccess).toBe(true);
    expect(s.screenshotLastFlag).toBe(0);
    expect(
      shouldStartScreenshot(s, control({ save_picture_flag: 1, status: "execute success" })),
    ).toBe(true);
  });

  it("complete 右边界 0→1 只 latch pending，渲染前不立刻拍", () => {
    let s = createInitialCase2State();
    s = case2Reducer(s, { type: "START_CLICK" });
    s = case2Reducer(s, {
      type: "CONTROL_POLL_OK",
      control: control({ status: "execute success" }),
    });
    const completeFlag = control({
      status: "case complete",
      save_picture_flag: 1,
    });
    expect(shouldStartScreenshot(s, completeFlag)).toBe(false);
    expect(shouldLatchCompleteScreenshot(s, completeFlag)).toBe(true);

    s = case2Reducer(s, { type: "SCREENSHOT_LATCH_PENDING" });
    expect(s.screenshotPhase).toBe("pending");
    expect(s.screenshotLastFlag).toBe(1);
    expect(shouldLatchCompleteScreenshot(s, completeFlag)).toBe(false);

    s = {
      ...s,
      case2UiState: "completed",
      calibratedData: metrics(),
      lastControl: completeFlag,
    };
    expect(canReset(s)).toBe(false);
    expect(shouldResetCommandAfterCommandCompletion(s)).toBe(false);
    expect(shouldKeepPollingForWaitClear(s)).toBe(true);
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

    s = { ...s, screenshotPhase: "pending" };
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

  it("success 上传成功立刻 lastFlag=0 且 idle，可认 complete 右边界 0→1，且不 POST init", () => {
    let s = createInitialCase2State();
    s = case2Reducer(s, { type: "START_CLICK" });
    s = case2Reducer(s, {
      type: "CONTROL_POLL_OK",
      control: control({ status: "execute success" }),
    });
    s = case2Reducer(s, { type: "SCREENSHOT_ENTER_SAVING" });
    s = case2Reducer(s, { type: "SCREENSHOT_UPLOAD_OK" });
    expect(s.screenshotPhase).toBe("idle");
    expect(s.screenshotLastFlag).toBe(0);
    expect(s.case2UiState).toBe("calibrating");
    expect(shouldResetCommandAfterCommandCompletion(s)).toBe(false);

    const completeFlag = control({
      status: "case complete",
      save_picture_flag: 1,
    });
    expect(shouldStartScreenshot(s, completeFlag)).toBe(false);
    expect(shouldLatchCompleteScreenshot(s, completeFlag)).toBe(true);
  });

  it("completed + waitClear 必须继续轮询；flag 清零后才 idle", () => {
    let s = createInitialCase2State();
    s = case2Reducer(s, { type: "START_CLICK" });
    s = {
      ...s,
      case2UiState: "completed",
      calibratedData: metrics(),
      lastControl: control({ command: "start", status: "case complete", save_picture_flag: 1 }),
      screenshotPhase: "waitClear",
      screenshotLastFlag: 1,
    };
    expect(shouldKeepPollingForWaitClear(s)).toBe(true);
    expect(shouldResetCommandAfterCommandCompletion(s)).toBe(false);
    expect(canReset(s)).toBe(false);

    s = case2Reducer(s, { type: "SCREENSHOT_FLAG_CLEARED" });
    expect(s.screenshotPhase).toBe("idle");
    expect(s.screenshotLastFlag).toBe(0);
    expect(shouldKeepPollingForWaitClear(s)).toBe(false);
    expect(shouldResetCommandAfterCommandCompletion(s)).toBe(true);
    expect(canReset(s)).toBe(false);
  });

  it("忙态 poll 失败保留测试运行中；连续 3 次才亮重试中", () => {
    let s = createInitialCase2State();
    s = case2Reducer(s, { type: "INITIAL_DATA_OK", metrics: metrics() });
    s = case2Reducer(s, { type: "START_CLICK" });
    s = case2Reducer(s, { type: "CONTROL_POLL_FAIL" });
    expect(s.adapterError).toBe(true);
    expect(s.pollFailStreak).toBe(1);
    expect(statusFeedbackText(s)).toBe("测试运行中");
    expect(statusRetryHint(s)).toBeNull();

    s = case2Reducer(s, { type: "CONTROL_POLL_FAIL" });
    expect(statusRetryHint(s)).toBeNull();
    s = case2Reducer(s, { type: "CONTROL_POLL_FAIL" });
    expect(s.pollFailStreak).toBe(CASE2_POLL_FAIL_RETRY_THRESHOLD);
    expect(statusFeedbackText(s)).toBe("测试运行中");
    expect(statusRetryHint(s)).toBe(CASE2_ADAPTER_RETRY_HINT);

    s = case2Reducer(s, {
      type: "CONTROL_POLL_OK",
      control: control({ status: "execute success" }),
    });
    expect(s.adapterError).toBe(false);
    expect(s.pollFailStreak).toBe(0);
    expect(s.case2UiState).toBe("calibrating");
    expect(statusFeedbackText(s)).toBe("测试运行中");
    expect(statusRetryHint(s)).toBeNull();
  });

  it("空闲态 adapterError 仍显示连接异常", () => {
    let s = createInitialCase2State();
    s = { ...s, adapterError: true };
    expect(statusFeedbackText(s)).toBe(CASE2_ADAPTER_ERROR_BADGE);
    expect(statusRetryHint(s)).toBeNull();
  });
});
