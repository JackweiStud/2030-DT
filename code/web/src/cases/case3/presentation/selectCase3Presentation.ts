/**
 * Case3 共享展示模型：从 Case3State 派生页面输入。
 * 旧皮肤与未来 V2 共用；不改 reducer 状态或转移。
 *
 * 快照规则：
 * - 地图点：live 优先于 result。
 * - Cost / Throughput：当前 Start 侧只用 live；With 单侧历史可独立展示；
 *   新 Without 一旦进入 Start 或已有 Without 数据，即隐藏旧 With KPI。
 * - BA：只用 completed results + pairValid，不用 live。
 * - 未配对历史不得进入跨侧比较（peer / pairValid）。
 */

import {
  canCompareWithCurrentWithout,
  canReinit,
  canStartWith,
  canStartWithout,
  deriveVisibleState,
  isActionBusy,
  sideStatusBadge,
  sideStatusBadgeIsError,
  sideStatusRetryHint,
  type Case3State,
} from "../state/case3Reducer";
import type {
  ActiveAction,
  BaseRoutePoint,
  BeamAccuracyBaseline,
  Case3Point,
  Case3Side,
  Case3VisibleState,
  SideSnapshot,
} from "../types";

/** CSS data-state：failed/resetting/未配对历史映射到旧页面当前视觉壳。 */
export type Case3DataState =
  | "initial"
  | "without-running"
  | "with-running"
  | "without-completed"
  | "with-completed";

export type Case3Presentation = {
  visible: Case3VisibleState;
  dataState: Case3DataState;
  busy: boolean;
  activeAction: ActiveAction | null;
  activeStartSide: Case3Side | null;
  baseRoute: BaseRoutePoint[];
  routeNos: number[];
  pairValid: boolean;
  baseline: BeamAccuracyBaseline | null;
  withoutPoints: Case3Point[];
  withPoints: Case3Point[];
  withPeerPoints: Case3Point[] | null;
  withoutKpiSnapshot: SideSnapshot | null;
  withKpiSnapshot: SideSnapshot | null;
  showWithThroughput: boolean;
  beamWithout: SideSnapshot | null;
  beamWith: SideSnapshot | null;
  withoutBadge: string;
  withBadge: string;
  withoutBadgeError: boolean;
  withBadgeError: boolean;
  withoutRetryHint: boolean;
  withRetryHint: boolean;
  startWithoutEnabled: boolean;
  startWithEnabled: boolean;
  reinitWithoutEnabled: boolean;
  reinitWithEnabled: boolean;
};

/**
 * 旧 Case3Page 的 data-state 映射。不得改 failed/resetting/未配对分支。
 */
export function deriveCase3DataState(
  visible: Case3VisibleState,
): Case3DataState {
  switch (visible) {
    case "unpaired-both":
    case "with-history-only":
    case "resetting-without":
      return "without-completed";
    case "failed-start-without":
    case "failed-start-with":
    case "failed-reinit-without":
    case "failed-reinit-with":
      return "initial";
    case "resetting-with":
      return "with-completed";
    case "initial":
    case "without-running":
    case "with-running":
    case "without-completed":
    case "with-completed":
      return visible;
  }
}

function selectActiveStartSide(state: Case3State): Case3Side | null {
  return state.activeAction?.kind === "start" ? state.activeAction.side : null;
}

function selectWithoutKpiSnapshot(state: Case3State): SideSnapshot | null {
  return selectActiveStartSide(state) === "without"
    ? state.live.without
    : state.results.without;
}

function selectWithKpiSnapshot(
  state: Case3State,
  withoutKpiSnapshot: SideSnapshot | null,
): SideSnapshot | null {
  const activeStartSide = selectActiveStartSide(state);
  if (activeStartSide === "with") {
    return state.live.with;
  }
  /*
   * pairValid 只控制跨侧结论，不能充当 With 单侧结果的显示开关。
   * 重置 Without 后没有可比较的 Without 快照，此时仍展示保留下来的
   * With 历史；新 Without 已产生数据后则隐藏旧 With KPI，避免跨代对比。
   */
  const showStandaloneWithHistory =
    activeStartSide !== "without" &&
    withoutKpiSnapshot === null &&
    state.results.with !== null;
  if (state.pairValid || showStandaloneWithHistory) {
    return state.results.with;
  }
  return null;
}

/**
 * 从 Case3State 派生展示模型。
 */
export function selectCase3Presentation(state: Case3State): Case3Presentation {
  const visible = deriveVisibleState(state);
  const withoutKpiSnapshot = selectWithoutKpiSnapshot(state);
  const withKpiSnapshot = selectWithKpiSnapshot(state, withoutKpiSnapshot);

  return {
    visible,
    dataState: deriveCase3DataState(visible),
    busy: isActionBusy(state),
    activeAction: state.activeAction,
    activeStartSide: selectActiveStartSide(state),
    baseRoute: state.baseRoute,
    routeNos: state.baseRoute.map((p) => p.no),
    pairValid: state.pairValid,
    baseline: state.baseline,
    withoutPoints:
      state.live.without?.points ?? state.results.without?.points ?? [],
    withPoints: state.live.with?.points ?? state.results.with?.points ?? [],
    withPeerPoints: canCompareWithCurrentWithout(state)
      ? (state.results.without?.points ?? null)
      : null,
    withoutKpiSnapshot,
    withKpiSnapshot,
    showWithThroughput: withKpiSnapshot !== null,
    beamWithout: state.results.without,
    beamWith: state.results.with,
    withoutBadge: sideStatusBadge(state, "without"),
    withBadge: sideStatusBadge(state, "with"),
    withoutBadgeError: sideStatusBadgeIsError(state, "without"),
    withBadgeError: sideStatusBadgeIsError(state, "with"),
    withoutRetryHint: sideStatusRetryHint(state, "without"),
    withRetryHint: sideStatusRetryHint(state, "with"),
    startWithoutEnabled: canStartWithout(state),
    startWithEnabled: canStartWith(state),
    reinitWithoutEnabled: canReinit(state, "without"),
    reinitWithEnabled: canReinit(state, "with"),
  };
}
