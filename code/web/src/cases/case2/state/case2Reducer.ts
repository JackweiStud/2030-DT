/**
 * case2 业务相 reducer（纯函数，便于单测）。
 * 定时器 / AbortController / Canvas 不进本状态。
 */

import type {
  Case2UiState,
  ControlSnapshot,
  MetricsBundle,
  ScreenshotPhase,
} from "../types";

export type Case2State = {
  case2UiState: Case2UiState;
  adapterError: boolean;
  seenExecuteSuccess: boolean;
  initialData: MetricsBundle | null;
  initialError: string | null;
  calibratedData: MetricsBundle | null;
  lastControl: ControlSnapshot | null;
  /** 点击前相，供 POST 失败回退。 */
  phaseBeforeCommand: Case2UiState | null;
  /** case complete 后六文件连续不过关耗尽：failed-start + 专用徽标。 */
  resultIncomplete: boolean;
  screenshotPhase: ScreenshotPhase;
  screenshotAttempts: number;
  screenshotLastFlag: 0 | 1;
  screenshotBase64: string | null;
};

export type Case2Action =
  | { type: "MOUNT_RESET" }
  | { type: "INITIAL_DATA_OK"; metrics: MetricsBundle }
  | { type: "INITIAL_DATA_FAIL"; message: string }
  | { type: "DIAGNOSTIC_CONTROL_OK"; control: ControlSnapshot }
  | { type: "DIAGNOSTIC_CONTROL_FAIL" }
  | { type: "START_CLICK" }
  | { type: "START_POST_OK"; control: ControlSnapshot }
  | { type: "START_POST_FAIL" }
  | { type: "RESET_CLICK" }
  | { type: "RESET_POST_OK"; control: ControlSnapshot }
  | { type: "RESET_POST_FAIL" }
  | { type: "CONTROL_POLL_OK"; control: ControlSnapshot }
  | { type: "CONTROL_POLL_FAIL" }
  | { type: "CALIBRATED_OK"; metrics: MetricsBundle }
  | { type: "CALIBRATED_FAIL"; message: string }
  | { type: "CALIBRATED_FAIL_EXHAUSTED"; message: string }
  | { type: "SCREENSHOT_LATCH_PENDING" }
  | { type: "SCREENSHOT_ENTER_SAVING" }
  | { type: "SCREENSHOT_SET_BASE64"; base64: string }
  | { type: "SCREENSHOT_ATTEMPT_FAIL" }
  | { type: "SCREENSHOT_UPLOAD_OK" }
  | { type: "SCREENSHOT_FLAG_CLEARED" }
  | { type: "SCREENSHOT_DROPPED" }
  | { type: "LOG_UNKNOWN_STATUS"; status: string };

export function createInitialCase2State(): Case2State {
  return {
    case2UiState: "initial",
    adapterError: false,
    seenExecuteSuccess: false,
    initialData: null,
    initialError: null,
    calibratedData: null,
    lastControl: null,
    phaseBeforeCommand: null,
    resultIncomplete: false,
    screenshotPhase: "idle",
    screenshotAttempts: 0,
    screenshotLastFlag: 0,
    screenshotBase64: null,
  };
}

const KNOWN_STATUS = new Set([
  "",
  "execute success",
  "execute fail",
  "case complete",
  "reinit complete",
]);

/** 启动是否可点（不含 adapterError，由选择器叠加）。 */
export function canStart(state: Case2State): boolean {
  if (state.adapterError) return false;
  if (!state.initialData || state.initialError) return false;
  const s = state.case2UiState;
  return s === "initial" || s === "failed-start";
}

/**
 * 重置是否可点。
 * 启动完成路径必须截图 idle 且控制文件已写回 init（与适配层开轮条件对齐）。
 * failed-reinit 仍可点：同动作 execute fail 允许重试。
 */
export function canReset(state: Case2State): boolean {
  if (state.adapterError) return false;
  const s = state.case2UiState;
  if (s === "failed-reinit") return true;
  if (s !== "completed") return false;
  return (
    state.screenshotPhase === "idle" &&
    state.lastControl?.command === "init" &&
    state.lastControl.status === ""
  );
}

/** 与 Case3「case3初始化数据异常」对齐：Initial 六文件失败，不是连接异常。 */
export const CASE2_INIT_DATA_ERROR_BADGE = "case2初始化数据异常";

/** StatusFeedback 主文案；adapterError 优先于 Initial 文件失败。 */
export function statusFeedbackText(state: Case2State): string {
  if (state.adapterError) return "case2文件服务器连接异常";
  if (state.initialError) return CASE2_INIT_DATA_ERROR_BADGE;
  if (state.resultIncomplete && state.case2UiState === "failed-start") {
    return "结果不完整已自动回退";
  }
  switch (state.case2UiState) {
    case "initial":
      return "等待启动测试";
    case "calibrating":
      return "测试运行中";
    case "completed":
      return "已完成";
    case "resetting":
      return "重置中";
    case "failed-start":
    case "failed-reinit":
      return "执行命令失败";
    default:
      return "等待启动测试";
  }
}

export function shouldShowCalibrated(state: Case2State): boolean {
  return (
    (state.case2UiState === "completed" || state.case2UiState === "resetting") &&
    state.calibratedData !== null
  );
}

/**
 * 轮询快照推进业务相。
 * 截图 0→1：左边界（success）由控制器立刻开拍；右边界（complete）先 latch pending，再拉六文件。
 */
function reduceControlPoll(
  state: Case2State,
  control: ControlSnapshot,
): Case2State {
  const waiting =
    state.case2UiState === "calibrating" || state.case2UiState === "resetting";
  if (!waiting) {
    return { ...state, adapterError: false, lastControl: control };
  }

  let next: Case2State = {
    ...state,
    adapterError: false,
    lastControl: control,
  };

  const status = control.status;
  if (!KNOWN_STATUS.has(status)) {
    console.warn("[case2] unknown control status, keep waiting:", status);
    return next;
  }

  if (status === "execute success") {
    return { ...next, seenExecuteSuccess: true };
  }

  if (status === "execute fail") {
    if (state.case2UiState === "calibrating") {
      return {
        ...next,
        case2UiState: "failed-start",
        resultIncomplete: false,
        seenExecuteSuccess: false,
        calibratedData: null,
        screenshotPhase: "idle",
        screenshotAttempts: 0,
        screenshotBase64: null,
        screenshotLastFlag: 0,
      };
    }
    return {
      ...next,
      case2UiState: "failed-reinit",
      resultIncomplete: false,
      seenExecuteSuccess: false,
      calibratedData: null,
      screenshotPhase: "idle",
      screenshotAttempts: 0,
      screenshotBase64: null,
      screenshotLastFlag: 0,
    };
  }

  if (status === "case complete") {
    if (state.case2UiState !== "calibrating") return next;
    if (!state.seenExecuteSuccess) {
      console.warn(
        "[case2] case complete ignored: execute success not seen yet",
      );
      return next;
    }
    // 保持 calibrating，由控制器去拉六文件；成功后再 CALIBRATED_OK
    return next;
  }

  if (status === "reinit complete") {
    if (state.case2UiState !== "resetting") return next;
    if (!state.seenExecuteSuccess) {
      console.warn(
        "[case2] reinit complete ignored: execute success not seen yet",
      );
      return next;
    }
    return {
      ...next,
      case2UiState: "initial",
      seenExecuteSuccess: false,
      calibratedData: null,
      screenshotPhase: "idle",
      screenshotAttempts: 0,
      screenshotBase64: null,
      screenshotLastFlag: 0,
    };
  }

  return next;
}

export function case2Reducer(state: Case2State, action: Case2Action): Case2State {
  switch (action.type) {
    case "MOUNT_RESET":
      return createInitialCase2State();

    case "INITIAL_DATA_OK":
      return {
        ...state,
        initialData: action.metrics,
        initialError: null,
      };

    case "INITIAL_DATA_FAIL":
      return {
        ...state,
        initialData: null,
        initialError: action.message,
      };

    case "DIAGNOSTIC_CONTROL_OK":
      return {
        ...state,
        lastControl: action.control,
        // 进页诊断不因历史 status 改相；成功则清掉进页时的连接错误
        adapterError: false,
      };

    case "DIAGNOSTIC_CONTROL_FAIL":
      return { ...state, adapterError: true };

    case "START_CLICK":
      return {
        ...state,
        phaseBeforeCommand: state.case2UiState,
        case2UiState: "calibrating",
        resultIncomplete: false,
        seenExecuteSuccess: false,
        calibratedData: null,
        screenshotPhase: "idle",
        screenshotAttempts: 0,
        screenshotBase64: null,
        screenshotLastFlag: 0,
      };

    case "START_POST_OK":
      return {
        ...state,
        lastControl: action.control,
        phaseBeforeCommand: null,
        adapterError: false,
      };

    case "START_POST_FAIL":
      return {
        ...state,
        case2UiState: state.phaseBeforeCommand ?? "initial",
        phaseBeforeCommand: null,
        adapterError: true,
        seenExecuteSuccess: false,
      };

    case "RESET_CLICK":
      return {
        ...state,
        phaseBeforeCommand: state.case2UiState,
        case2UiState: "resetting",
        seenExecuteSuccess: false,
        // 必须暂留 calibratedData
        screenshotPhase: "idle",
        screenshotAttempts: 0,
        screenshotBase64: null,
      };

    case "RESET_POST_OK":
      return {
        ...state,
        lastControl: action.control,
        phaseBeforeCommand: null,
        adapterError: false,
      };

    case "RESET_POST_FAIL":
      return {
        ...state,
        case2UiState: state.phaseBeforeCommand ?? "completed",
        phaseBeforeCommand: null,
        adapterError: true,
        seenExecuteSuccess: false,
      };

    case "CONTROL_POLL_OK":
      return reduceControlPoll(state, action.control);

    case "CONTROL_POLL_FAIL":
      return { ...state, adapterError: true };

    case "CALIBRATED_OK":
      return {
        ...state,
        case2UiState: "completed",
        resultIncomplete: false,
        calibratedData: action.metrics,
        seenExecuteSuccess: false,
      };

    case "CALIBRATED_FAIL":
      console.warn("[case2] calibrated batch failed, stay calibrating:", action.message);
      return state;

    case "CALIBRATED_FAIL_EXHAUSTED":
      console.error(
        "[case2] calibrated batch failed exhausted:",
        action.message,
      );
      return {
        ...state,
        case2UiState: "failed-start",
        resultIncomplete: true,
        seenExecuteSuccess: false,
        calibratedData: null,
        screenshotPhase: "idle",
        screenshotAttempts: 0,
        screenshotBase64: null,
        screenshotLastFlag: 0,
      };

    case "SCREENSHOT_LATCH_PENDING":
      return {
        ...state,
        screenshotPhase: "pending",
        screenshotLastFlag: 1,
      };

    case "SCREENSHOT_ENTER_SAVING":
      return {
        ...state,
        screenshotPhase: "saving",
        screenshotAttempts: 1,
        screenshotLastFlag: 1,
        screenshotBase64: null,
      };

    case "SCREENSHOT_SET_BASE64":
      return { ...state, screenshotBase64: action.base64 };

    case "SCREENSHOT_ATTEMPT_FAIL":
      return {
        ...state,
        screenshotAttempts: state.screenshotAttempts + 1,
      };

    case "SCREENSHOT_UPLOAD_OK":
      // POST 成功（或 GET 已确认 flag=0）视为本拍已观察到清零：立刻 idle + lastFlag=0，
      // 才能认随后 complete 的新 0→1。success 期间不得靠 waitClear 拖到下一轮 poll。
      return {
        ...state,
        screenshotPhase: "idle",
        screenshotAttempts: 0,
        screenshotBase64: null,
        screenshotLastFlag: 0,
      };

    case "SCREENSHOT_FLAG_CLEARED":
      return {
        ...state,
        screenshotPhase: "idle",
        screenshotLastFlag: 0,
      };

    case "SCREENSHOT_DROPPED":
      console.warn("[case2] SCREENSHOT_DROPPED_AFTER_RETRIES");
      return {
        ...state,
        screenshotPhase: "idle",
        screenshotAttempts: 0,
        screenshotBase64: null,
        screenshotLastFlag: 0,
      };

    case "LOG_UNKNOWN_STATUS":
      console.warn("[case2] unknown status:", action.status);
      return state;

    default:
      return state;
  }
}

/** 是否应认 case complete 并去拉六文件。 */
export function shouldFetchCalibrated(
  state: Case2State,
  control: ControlSnapshot,
): boolean {
  return (
    state.case2UiState === "calibrating" &&
    state.seenExecuteSuccess &&
    control.status === "case complete"
  );
}

/** Start 等待内，flag 0→1 是否落在客户窗口 [execute success, case complete]。 */
export function isScreenshotCaptureWindow(
  state: Case2State,
  control: ControlSnapshot,
): boolean {
  if (control.status === "execute success") return true;
  return control.status === "case complete" && state.seenExecuteSuccess;
}

function isScreenshotFlagRise(
  state: Case2State,
  control: ControlSnapshot,
): boolean {
  if (state.case2UiState !== "calibrating") return false;
  if (state.screenshotPhase !== "idle") return false;
  if (state.screenshotLastFlag !== 0 || control.save_picture_flag !== 1) {
    return false;
  }
  return isScreenshotCaptureWindow(state, control);
}

/** success 左边界：立刻 toPng。 */
export function shouldStartScreenshot(
  state: Case2State,
  control: ControlSnapshot,
): boolean {
  return (
    isScreenshotFlagRise(state, control) &&
    control.status === "execute success"
  );
}

/** complete 右边界（含同拍）：先 latch，拉六文件并渲染后再拍。 */
export function shouldLatchCompleteScreenshot(
  state: Case2State,
  control: ControlSnapshot,
): boolean {
  return (
    isScreenshotFlagRise(state, control) &&
    control.status === "case complete"
  );
}

/** 启动/重置轮完整收尾后，是否可以把控制文件写回 init 空闲态。 */
export function shouldResetCommandAfterCommandCompletion(state: Case2State): boolean {
  const startComplete =
    state.case2UiState === "completed" &&
    state.calibratedData !== null &&
    state.lastControl?.command === "start" &&
    state.lastControl.status === "case complete" &&
    state.screenshotPhase === "idle";

  const reinitComplete =
    state.case2UiState === "initial" &&
    state.calibratedData === null &&
    state.lastControl?.command === "reinit" &&
    state.lastControl.status === "reinit complete";

  return startComplete || reinitComplete;
}

/** completed 后仍 waitClear/pending 时必须继续轮询。 */
export function shouldKeepPollingForWaitClear(state: Case2State): boolean {
  return (
    state.case2UiState === "completed" &&
    (state.screenshotPhase === "waitClear" ||
      state.screenshotPhase === "pending")
  );
}
