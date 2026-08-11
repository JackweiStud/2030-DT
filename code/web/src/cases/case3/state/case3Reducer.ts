/**
 * Case3 纯 reducer：业务结果、activeAction、failure、pairValid。
 * 不持有 timer / AbortController / DOM；可见态由选择器派生。
 */

import type {
  ActionKind,
  ActiveAction,
  BaseRoutePoint,
  BeamAccuracyBaseline,
  Case3Side,
  Case3VisibleState,
  Failure,
  SideSnapshot,
} from "../types";

export type Case3State = {
  initStatus: "loading" | "ready" | "error";
  baseRoute: BaseRoutePoint[];
  baseline: BeamAccuracyBaseline | null;
  results: { without: SideSnapshot | null; with: SideSnapshot | null };
  live: { without: SideSnapshot | null; with: SideSnapshot | null };
  pairValid: boolean;
  activeAction: ActiveAction | null;
  failure: Failure;
  adapterError: boolean;
  generation: number;
};

export type Case3Action =
  | { type: "MOUNT_RESET" }
  | { type: "INIT_LOADING" }
  | {
      type: "INIT_READY";
      baseRoute: BaseRoutePoint[];
      baseline: BeamAccuracyBaseline;
    }
  | { type: "INIT_ERROR" }
  | { type: "ADAPTER_ERROR"; value: boolean }
  | {
      type: "ACTION_BEGIN";
      kind: ActionKind;
      side: Case3Side;
      generation: number;
    }
  | { type: "MARK_FAILED_RETRY"; kind: ActionKind; side: Case3Side }
  | { type: "ACTION_POST_FAILED" }
  | { type: "SEEN_EXECUTE_SUCCESS" }
  | { type: "LIVE_SNAPSHOT"; side: Case3Side; snapshot: SideSnapshot }
  | { type: "START_COMPLETE"; side: Case3Side; snapshot: SideSnapshot }
  | { type: "REINIT_COMPLETE"; side: Case3Side }
  | { type: "EXECUTE_FAIL" }
  | { type: "CLEAR_ACTIVE" };

/**
 * 构造初始状态。刷新/挂载不恢复历史结果。
 */
export function createInitialCase3State(): Case3State {
  return {
    initStatus: "loading",
    baseRoute: [],
    baseline: null,
    results: { without: null, with: null },
    live: { without: null, with: null },
    pairValid: false,
    activeAction: null,
    failure: null,
    adapterError: false,
    generation: 0,
  };
}

function invalidateSide(state: Case3State, side: Case3Side): Case3State {
  return {
    ...state,
    results: { ...state.results, [side]: null },
    live: { ...state.live, [side]: null },
    pairValid: false,
  };
}

/**
 * Case3 业务状态归约。
 */
export function case3Reducer(
  state: Case3State,
  action: Case3Action,
): Case3State {
  switch (action.type) {
    case "MOUNT_RESET":
      return createInitialCase3State();

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
        baseline: action.baseline,
        adapterError: false,
        failure: null,
      };

    case "INIT_ERROR":
      return {
        ...state,
        initStatus: "error",
        adapterError: false,
      };

    case "ADAPTER_ERROR":
      return { ...state, adapterError: action.value };

    case "ACTION_BEGIN": {
      const next = invalidateSide(state, action.side);
      return {
        ...next,
        failure: null,
        adapterError: false,
        generation: action.generation,
        activeAction: {
          kind: action.kind,
          side: action.side,
          seenExecuteSuccess: false,
          generation: action.generation,
        },
      };
    }

    case "MARK_FAILED_RETRY":
      return {
        ...state,
        activeAction: null,
        failure: { kind: action.kind, side: action.side },
      };

    case "ACTION_POST_FAILED":
      // 目标侧已在 ACTION_BEGIN 失效，不得恢复
      return {
        ...state,
        activeAction: null,
        adapterError: true,
      };

    case "SEEN_EXECUTE_SUCCESS": {
      if (!state.activeAction) return state;
      return {
        ...state,
        activeAction: {
          ...state.activeAction,
          seenExecuteSuccess: true,
        },
      };
    }

    case "LIVE_SNAPSHOT": {
      if (
        !state.activeAction ||
        state.activeAction.side !== action.side ||
        state.activeAction.kind !== "start"
      ) {
        return state;
      }
      return {
        ...state,
        live: { ...state.live, [action.side]: action.snapshot },
      };
    }

    case "START_COMPLETE": {
      if (
        !state.activeAction ||
        state.activeAction.kind !== "start" ||
        state.activeAction.side !== action.side ||
        !state.activeAction.seenExecuteSuccess
      ) {
        return state;
      }
      const results = {
        ...state.results,
        [action.side]: action.snapshot,
      };
      const live = { ...state.live, [action.side]: null };
      // Without 完成不能单独置 pairValid；With 完成且 Without 仍有效才 true
      const pairValid =
        action.side === "with" && results.without !== null;
      return {
        ...state,
        results,
        live,
        pairValid,
        activeAction: null,
        failure: null,
      };
    }

    case "REINIT_COMPLETE": {
      if (
        !state.activeAction ||
        state.activeAction.kind !== "reinit" ||
        state.activeAction.side !== action.side
      ) {
        return state;
      }
      return {
        ...state,
        results: { ...state.results, [action.side]: null },
        live: { ...state.live, [action.side]: null },
        pairValid: false,
        activeAction: null,
        failure: null,
      };
    }

    case "EXECUTE_FAIL": {
      if (!state.activeAction) return state;
      const failure: Failure = {
        kind: state.activeAction.kind,
        side: state.activeAction.side,
      };
      const side = state.activeAction.side;
      return {
        ...state,
        results: { ...state.results, [side]: null },
        live: { ...state.live, [side]: null },
        pairValid: false,
        activeAction: null,
        failure,
      };
    }

    case "CLEAR_ACTIVE":
      return { ...state, activeAction: null };

    default:
      return state;
  }
}

/**
 * 派生可见态（含未配对历史变体）。
 */
export function deriveVisibleState(state: Case3State): Case3VisibleState {
  if (state.activeAction) {
    const { kind, side } = state.activeAction;
    if (kind === "start") {
      return side === "without" ? "without-running" : "with-running";
    }
    return side === "without" ? "resetting-without" : "resetting-with";
  }
  if (state.failure) {
    const prefix =
      state.failure.kind === "start" ? "failed-start" : "failed-reinit";
    return `${prefix}-${state.failure.side}` as Case3VisibleState;
  }

  const wo = state.results.without;
  const wi = state.results.with;
  if (wo && wi && state.pairValid) return "with-completed";
  if (wo && wi && !state.pairValid) return "unpaired-both";
  if (wo && !wi) return "without-completed";
  if (!wo && wi) return "with-history-only";
  return "initial";
}

/**
 * 侧栏 StatusBadge 文案。
 */
export function statusBadgeText(
  visible: Case3VisibleState,
  side: Case3Side,
): string {
  if (visible === "without-running" && side === "without") return "测试中";
  if (visible === "with-running" && side === "with") return "测试中";
  if (visible === "resetting-without" && side === "without") return "重置中";
  if (visible === "resetting-with" && side === "with") return "重置中";
  if (visible === "failed-start-without" && side === "without") {
    return "执行失败";
  }
  if (visible === "failed-start-with" && side === "with") return "执行失败";
  if (visible === "failed-reinit-without" && side === "without") {
    return "重置失败";
  }
  if (visible === "failed-reinit-with" && side === "with") return "重置失败";

  if (side === "without") {
    if (
      visible === "without-completed" ||
      visible === "with-completed" ||
      visible === "with-running" ||
      visible === "unpaired-both" ||
      visible === "resetting-with" ||
      visible === "failed-start-with" ||
      visible === "failed-reinit-with"
    ) {
      return "已完成";
    }
    return "等待启动测试";
  }

  if (visible === "with-completed") return "已完成";
  if (visible === "unpaired-both") return "未配对历史";
  if (visible === "with-history-only") return "历史结果";
  if (visible === "without-completed") return "等待启动测试";
  return "等待无DT测试完成";
}

/** Without Start 是否可点。 */
export function canStartWithout(state: Case3State): boolean {
  if (state.initStatus !== "ready") return false;
  if (state.activeAction) return false;
  if (state.failure) {
    return (
      state.failure.kind === "start" && state.failure.side === "without"
    );
  }
  return state.results.without === null;
}

/**
 * With Start：需要当前有效 Without。
 * 未配对（有旧 With）时允许重新 Start With。
 */
export function canStartWith(state: Case3State): boolean {
  if (state.initStatus !== "ready") return false;
  if (state.activeAction) return false;
  if (state.results.without === null) return false;
  if (state.failure) {
    return state.failure.kind === "start" && state.failure.side === "with";
  }
  // 已有配对完成的 With → 禁止；无 With 或未配对 → 允许
  if (state.results.with !== null && state.pairValid) return false;
  return true;
}

/** ReInit：目标侧有结果，或同侧 failed-reinit。 */
export function canReinit(state: Case3State, side: Case3Side): boolean {
  if (state.activeAction) return false;
  if (state.failure) {
    return state.failure.kind === "reinit" && state.failure.side === side;
  }
  return state.results[side] !== null;
}

/** 业务动作等待态。 */
export function isActionBusy(state: Case3State): boolean {
  return state.activeAction !== null;
}

/**
 * With 侧是否可以使用当前 Without 做逐点预测比较。
 *
 * 已完成结果必须由 pairValid 证明同代；With 正在基于当前 Without 执行时，
 * activeAction 本身就是本轮比较上下文。旧 With + 新 Without 的未配对历史
 * 不得进入该分支。
 */
export function canCompareWithCurrentWithout(state: Case3State): boolean {
  if (state.results.without === null) return false;
  if (state.pairValid) return true;
  return (
    state.activeAction?.kind === "start" &&
    state.activeAction.side === "with"
  );
}
