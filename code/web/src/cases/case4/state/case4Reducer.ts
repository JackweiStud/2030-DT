/**
 * Case4 纯 reducer：本轮 UI 相、live/result、activeAction。
 * 不持有 timer / AbortController / DOM；可见按钮由 presentation 派生。
 */

import type {
  ActionKind,
  ActiveAction,
  BasePoint,
  Case4UiState,
  Statistics,
  ThroughputSide,
  ThroughputSnapshot,
  TrajectorySnapshot,
} from "../types";

export type Case4State = {
  initStatus: "loading" | "ready" | "error";
  ui: Case4UiState;
  adapterError: boolean;
  liveReadHint: string | null;
  baseRoute: BasePoint[];
  liveTrajectory: TrajectorySnapshot | null;
  liveThrp: {
    without: ThroughputSnapshot | null;
    with: ThroughputSnapshot | null;
  };
  result: {
    trajectory: TrajectorySnapshot;
    throughput: { without: ThroughputSnapshot; with: ThroughputSnapshot };
    statistics: Statistics;
  } | null;
  activeAction: ActiveAction | null;
  generation: number;
  finalSubmitted: boolean;
  resultFailCount: number;
};

export type Case4Action =
  | { type: "MOUNT_RESET" }
  | { type: "INIT_LOADING" }
  | { type: "INIT_READY"; baseRoute: BasePoint[] }
  | { type: "INIT_ERROR" }
  | { type: "ADAPTER_ERROR"; value: boolean }
  | { type: "LIVE_HINT"; hint: string | null }
  | { type: "ACTION_BEGIN"; kind: ActionKind; generation: number }
  | { type: "ACTION_POST_FAILED"; restoreUi: Case4UiState }
  | { type: "CLEAR_ACTIVE"; ui: Case4UiState }
  | { type: "SEEN_EXECUTE_SUCCESS" }
  | { type: "LIVE_TRAJECTORY"; snapshot: TrajectorySnapshot }
  | { type: "LIVE_THRP"; side: ThroughputSide; snapshot: ThroughputSnapshot }
  | { type: "ENTER_FINALIZING" }
  | { type: "RESULT_NOT_READY" }
  | {
      type: "RESULT_SUBMITTED";
      trajectory: TrajectorySnapshot;
      throughput: { without: ThroughputSnapshot; with: ThroughputSnapshot };
      statistics: Statistics;
    }
  | { type: "RESULT_EXHAUSTED" }
  | { type: "EXECUTE_FAIL" }
  | { type: "REINIT_UI_APPLIED" }
  | { type: "ROUND_CLOSE_COMPLETE"; ui: Case4UiState };

export const CASE4_POLL_FAIL_RETRY_THRESHOLD = 3;

/**
 * 构造初始状态。刷新/挂载不恢复历史结果。
 */
export function createInitialCase4State(): Case4State {
  return {
    initStatus: "loading",
    ui: "initial",
    adapterError: false,
    liveReadHint: null,
    baseRoute: [],
    liveTrajectory: null,
    liveThrp: { without: null, with: null },
    result: null,
    activeAction: null,
    generation: 0,
    finalSubmitted: false,
    resultFailCount: 0,
  };
}

function clearRoundData(state: Case4State): Case4State {
  return {
    ...state,
    liveTrajectory: null,
    liveThrp: { without: null, with: null },
    result: null,
    finalSubmitted: false,
    resultFailCount: 0,
    liveReadHint: null,
  };
}

/**
 * Case4 业务状态归约。
 */
export function case4Reducer(
  state: Case4State,
  action: Case4Action,
): Case4State {
  switch (action.type) {
    case "MOUNT_RESET":
      return createInitialCase4State();

    case "INIT_LOADING":
      return {
        ...state,
        initStatus: "loading",
        adapterError: false,
      };

    case "INIT_READY":
      return {
        ...state,
        initStatus: "ready",
        baseRoute: action.baseRoute,
        adapterError: false,
      };

    case "INIT_ERROR":
      return {
        ...state,
        initStatus: "error",
        adapterError: false,
      };

    case "ADAPTER_ERROR":
      return { ...state, adapterError: action.value };

    case "LIVE_HINT":
      return { ...state, liveReadHint: action.hint };

    case "ACTION_BEGIN": {
      const next = clearRoundData(state);
      return {
        ...next,
        adapterError: false,
        generation: action.generation,
        ui: action.kind === "start" ? "running" : "resetting",
        activeAction: {
          kind: action.kind,
          seenExecuteSuccess: false,
          generation: action.generation,
        },
      };
    }

    case "ACTION_POST_FAILED":
      return {
        ...state,
        activeAction: null,
        ui: action.restoreUi,
        adapterError: true,
      };

    case "CLEAR_ACTIVE":
      return {
        ...state,
        activeAction: null,
        ui: action.ui,
      };

    case "SEEN_EXECUTE_SUCCESS":
      if (!state.activeAction) return state;
      return {
        ...state,
        activeAction: {
          ...state.activeAction,
          seenExecuteSuccess: true,
        },
      };

    case "LIVE_TRAJECTORY":
      return { ...state, liveTrajectory: action.snapshot, liveReadHint: null };

    case "LIVE_THRP":
      return {
        ...state,
        liveThrp: { ...state.liveThrp, [action.side]: action.snapshot },
        liveReadHint: null,
      };

    case "ENTER_FINALIZING":
      return { ...state, ui: "finalizing" };

    case "RESULT_NOT_READY":
      return { ...state, resultFailCount: state.resultFailCount + 1 };

    case "RESULT_SUBMITTED":
      return {
        ...state,
        ui: "completed",
        finalSubmitted: true,
        result: {
          trajectory: action.trajectory,
          throughput: action.throughput,
          statistics: action.statistics,
        },
        liveTrajectory: null,
        liveThrp: { without: null, with: null },
        liveReadHint: null,
      };

    case "RESULT_EXHAUSTED":
      return {
        ...state,
        ui: "failed-start",
        liveTrajectory: null,
        liveThrp: { without: null, with: null },
        result: null,
        finalSubmitted: false,
        liveReadHint: "result-exhausted",
      };

    case "EXECUTE_FAIL":
      return {
        ...clearRoundData(state),
        ui:
          state.activeAction?.kind === "reinit"
            ? "failed-reinit"
            : "failed-start",
        activeAction: null,
      };

    case "REINIT_UI_APPLIED":
      return {
        ...clearRoundData(state),
        ui: "resetting",
      };

    case "ROUND_CLOSE_COMPLETE":
      return {
        ...state,
        activeAction: null,
        ui: action.ui,
      };

    default:
      return state;
  }
}

export function isRoundBusy(state: Case4State): boolean {
  return state.activeAction !== null;
}

export function canStart(state: Case4State): boolean {
  if (state.initStatus !== "ready") return false;
  if (state.adapterError) return false;
  if (state.baseRoute.length < 1) return false;
  if (state.activeAction) return false;
  if (
    state.ui === "running" ||
    state.ui === "finalizing" ||
    state.ui === "resetting" ||
    state.ui === "completed"
  ) {
    return false;
  }
  if (state.ui === "failed-reinit") return false;
  return true;
}

export function canReinit(state: Case4State): boolean {
  if (state.adapterError) return false;
  if (state.activeAction) return false;
  return state.ui === "completed" || state.ui === "failed-reinit";
}
