/**
 * Case3 共享展示模型：从 Case3State 派生页面输入。
 * 旧皮肤与未来 V2 共用；不改 reducer 状态或转移。
 *
 * 快照规则：
 * - 地图点：live 优先于 result。
 * - Cost：当前 Start 侧只用 live side 快照中的 cost。
 * - Throughput：独立 thrp 快照；运行侧读 liveThrp，完成侧读 resultThrp（与 P 点完整度解耦）。
 * - BA：baseline + 可比较时（pairValid 或 With 基于当前 Without 运行中）的 live/result 增量。
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
import { sideSnapshotToThroughput } from "../metrics/case3Metrics";
import type {
  ActiveAction,
  BaseRoutePoint,
  BeamAccuracyBaseline,
  Case3Point,
  Case3Side,
  Case3VisibleState,
  SideSnapshot,
  ThroughputSnapshot,
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
  thrpWithout: ThroughputSnapshot | null;
  thrpWith: ThroughputSnapshot | null;
  beamCompareEnabled: boolean;
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

function selectThrpWithout(
  state: Case3State,
  withoutKpiSnapshot: SideSnapshot | null,
): ThroughputSnapshot | null {
  if (selectActiveStartSide(state) === "without") {
    return state.liveThrp.without;
  }
  if (withoutKpiSnapshot) {
    return (
      state.resultThrp.without ?? sideSnapshotToThroughput(withoutKpiSnapshot)
    );
  }
  return null;
}

function selectThrpWith(
  state: Case3State,
  withKpiSnapshot: SideSnapshot | null,
  showWithThroughput: boolean,
): ThroughputSnapshot | null {
  if (!showWithThroughput) return null;
  if (selectActiveStartSide(state) === "with") {
    return state.liveThrp.with;
  }
  if (withKpiSnapshot) {
    return state.resultThrp.with ?? sideSnapshotToThroughput(withKpiSnapshot);
  }
  return null;
}

function selectBeamWith(state: Case3State): SideSnapshot | null {
  if (
    state.activeAction?.kind === "start" &&
    state.activeAction.side === "with"
  ) {
    return state.live.with;
  }
  return state.results.with;
}

/**
 * 从 Case3State 派生展示模型。
 */
export function selectCase3Presentation(state: Case3State): Case3Presentation {
  const visible = deriveVisibleState(state);
  const withoutKpiSnapshot = selectWithoutKpiSnapshot(state);
  const withKpiSnapshot = selectWithKpiSnapshot(state, withoutKpiSnapshot);
  const showWithThroughput = withKpiSnapshot !== null;
  const beamCompareEnabled = canCompareWithCurrentWithout(state);

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
    showWithThroughput,
    thrpWithout: selectThrpWithout(state, withoutKpiSnapshot),
    thrpWith: selectThrpWith(state, withKpiSnapshot, showWithThroughput),
    beamCompareEnabled,
    beamWithout: state.results.without,
    beamWith: selectBeamWith(state),
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
