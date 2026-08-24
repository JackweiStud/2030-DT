/**
 * Case3 共享展示模型纯函数测试。
 * 覆盖快照选择、单侧历史、未配对、按钮权限、状态文案、地图与 KPI 输入。
 */
import { describe, expect, it } from "vitest";
import { selectCase3Presentation } from "../../src/cases/case3/presentation/selectCase3Presentation";
import {
  CASE3_ADAPTER_ERROR_BADGE,
  case3Reducer,
  createInitialCase3State,
  type Case3State,
} from "../../src/cases/case3/state/case3Reducer";
import type { SideSnapshot } from "../../src/cases/case3/types";

function snap(side: "without" | "with", cost = 25, count = 1): SideSnapshot {
  return {
    side,
    points: Array.from({ length: count }, (_, index) => {
      const no = index + 1;
      return {
        no,
        ue: { x: no, y: no, z: 0 },
        selectedBeamId: no,
        throughputGbps: side === "without" ? 8 + no / 10 : 9 + no / 10,
        ...(side === "without"
          ? { scanBeamIds: Array.from({ length: 16 }, (_, beam) => beam) }
          : { reflection: { x: 0, y: 0, z: 0, los: true } }),
      };
    }),
    completeCount: count,
    pendingTail: false,
    costPct: cost,
  };
}

function ready(): Case3State {
  return case3Reducer(createInitialCase3State(), {
    type: "INIT_READY",
    baseRoute: [
      { no: 1, x: 0, y: 0, z: 0 },
      { no: 2, x: 1, y: 0, z: 0 },
    ],
    baseline: { success: 10, total: 20 },
  });
}

function begin(
  state: Case3State,
  kind: "start" | "reinit",
  side: "without" | "with",
): Case3State {
  return case3Reducer(state, {
    type: "ACTION_BEGIN",
    kind,
    side,
    generation: state.generation + 1,
  });
}

function completeStart(
  state: Case3State,
  side: "without" | "with",
  snapshot: SideSnapshot,
): Case3State {
  let next = begin(state, "start", side);
  next = case3Reducer(next, { type: "SEEN_EXECUTE_SUCCESS" });
  return case3Reducer(next, {
    type: "START_COMPLETE",
    side,
    snapshot,
  });
}

function closed(state: Case3State): Case3State {
  return case3Reducer(state, { type: "ROUND_CLOSE_COMPLETE" });
}

describe("selectCase3Presentation", () => {
  it("initial：仅 Without Start 可点，地图与 KPI 为空", () => {
    const view = selectCase3Presentation(ready());
    expect(view.visible).toBe("initial");
    expect(view.dataState).toBe("initial");
    expect(view.busy).toBe(false);
    expect(view.activeStartSide).toBeNull();
    expect(view.startWithoutEnabled).toBe(true);
    expect(view.startWithEnabled).toBe(false);
    expect(view.reinitWithoutEnabled).toBe(false);
    expect(view.reinitWithEnabled).toBe(false);
    expect(view.withoutBadge).toBe("等待启动测试");
    expect(view.withBadge).toBe("等待无DT测试完成");
    expect(view.withoutBadgeError).toBe(false);
    expect(view.withBadgeError).toBe(false);
    expect(view.withoutPoints).toEqual([]);
    expect(view.withPoints).toEqual([]);
    expect(view.withPeerPoints).toBeNull();
    expect(view.withoutKpiSnapshot).toBeNull();
    expect(view.withKpiSnapshot).toBeNull();
    expect(view.showWithThroughput).toBe(false);
    expect(view.routeNos).toEqual([1, 2]);
    expect(view.pairValid).toBe(false);
    expect(view.baseline).toEqual({ success: 10, total: 20 });
    expect(view.beamWithout).toBeNull();
    expect(view.beamWith).toBeNull();
  });

  it("Without running：live 进入地图与 KPI，按钮全锁", () => {
    const live = snap("without", 25, 2);
    let state = begin(ready(), "start", "without");
    state = case3Reducer(state, { type: "SEEN_EXECUTE_SUCCESS" });
    state = case3Reducer(state, {
      type: "LIVE_SNAPSHOT",
      side: "without",
      snapshot: live,
    });
    const view = selectCase3Presentation(state);
    expect(view.visible).toBe("without-running");
    expect(view.dataState).toBe("without-running");
    expect(view.busy).toBe(true);
    expect(view.activeStartSide).toBe("without");
    expect(view.startWithoutEnabled).toBe(false);
    expect(view.startWithEnabled).toBe(false);
    expect(view.reinitWithoutEnabled).toBe(false);
    expect(view.reinitWithEnabled).toBe(false);
    expect(view.withoutBadge).toBe("测试中");
    expect(view.withBadge).toBe("等待无DT测试完成");
    expect(view.withoutPoints).toBe(live.points);
    expect(view.withPoints).toEqual([]);
    expect(view.withPeerPoints).toBeNull();
    expect(view.withoutKpiSnapshot).toBe(live);
    expect(view.withKpiSnapshot).toBeNull();
    expect(view.showWithThroughput).toBe(false);
    expect(view.beamWithout).toBeNull();
    expect(view.pairValid).toBe(false);
  });

  it("Without completed：关闭 roundClosing 后可 Start With / ReInit Without", () => {
    const without = snap("without", 25, 2);
    const closing = completeStart(ready(), "without", without);
    const closingView = selectCase3Presentation(closing);
    expect(closingView.visible).toBe("without-completed");
    expect(closingView.dataState).toBe("without-completed");
    expect(closingView.busy).toBe(true);
    expect(closingView.startWithEnabled).toBe(false);
    expect(closingView.reinitWithoutEnabled).toBe(false);

    const view = selectCase3Presentation(closed(closing));
    expect(view.visible).toBe("without-completed");
    expect(view.dataState).toBe("without-completed");
    expect(view.busy).toBe(false);
    expect(view.activeStartSide).toBeNull();
    expect(view.startWithoutEnabled).toBe(false);
    expect(view.startWithEnabled).toBe(true);
    expect(view.reinitWithoutEnabled).toBe(true);
    expect(view.reinitWithEnabled).toBe(false);
    expect(view.withoutBadge).toBe("已完成");
    expect(view.withBadge).toBe("等待启动测试");
    expect(view.withoutPoints).toBe(without.points);
    expect(view.withoutKpiSnapshot).toBe(without);
    expect(view.withKpiSnapshot).toBeNull();
    expect(view.showWithThroughput).toBe(false);
    expect(view.withPeerPoints).toBeNull();
    expect(view.beamWithout).toBe(without);
    expect(view.pairValid).toBe(false);
  });

  it("With running：Without 结果进 KPI/peer，With 用 live，pairValid 仍 false", () => {
    const without = snap("without", 25, 2);
    const liveWith = snap("with", 15, 2);
    let state = closed(completeStart(ready(), "without", without));
    state = begin(state, "start", "with");
    state = case3Reducer(state, { type: "SEEN_EXECUTE_SUCCESS" });
    state = case3Reducer(state, {
      type: "LIVE_SNAPSHOT",
      side: "with",
      snapshot: liveWith,
    });
    const view = selectCase3Presentation(state);
    expect(view.visible).toBe("with-running");
    expect(view.dataState).toBe("with-running");
    expect(view.busy).toBe(true);
    expect(view.activeStartSide).toBe("with");
    expect(view.startWithoutEnabled).toBe(false);
    expect(view.startWithEnabled).toBe(false);
    expect(view.reinitWithoutEnabled).toBe(false);
    expect(view.reinitWithEnabled).toBe(false);
    expect(view.withoutBadge).toBe("已完成");
    expect(view.withBadge).toBe("测试中");
    expect(view.withoutPoints).toBe(without.points);
    expect(view.withPoints).toBe(liveWith.points);
    expect(view.withPeerPoints).toBe(without.points);
    expect(view.withoutKpiSnapshot).toBe(without);
    expect(view.withKpiSnapshot).toBe(liveWith);
    expect(view.showWithThroughput).toBe(true);
    expect(view.pairValid).toBe(false);
    expect(view.beamWithout).toBe(without);
    expect(view.beamWith).toBeNull();
  });

  it("With completed：pairValid 后两侧 KPI/BA/peer 均可比较", () => {
    const without = snap("without", 25, 2);
    const withSide = snap("with", 15, 2);
    let state = closed(completeStart(ready(), "without", without));
    state = completeStart(state, "with", withSide);
    const closingView = selectCase3Presentation(state);
    expect(closingView.visible).toBe("with-completed");
    expect(closingView.dataState).toBe("with-completed");
    expect(closingView.busy).toBe(true);
    expect(closingView.pairValid).toBe(true);
    expect(closingView.startWithoutEnabled).toBe(false);
    expect(closingView.reinitWithEnabled).toBe(false);

    const view = selectCase3Presentation(closed(state));
    expect(view.visible).toBe("with-completed");
    expect(view.dataState).toBe("with-completed");
    expect(view.busy).toBe(false);
    expect(view.startWithoutEnabled).toBe(false);
    expect(view.startWithEnabled).toBe(false);
    expect(view.reinitWithoutEnabled).toBe(true);
    expect(view.reinitWithEnabled).toBe(true);
    expect(view.withoutBadge).toBe("已完成");
    expect(view.withBadge).toBe("已完成");
    expect(view.withoutPoints).toBe(without.points);
    expect(view.withPoints).toBe(withSide.points);
    expect(view.withPeerPoints).toBe(without.points);
    expect(view.withoutKpiSnapshot).toBe(without);
    expect(view.withKpiSnapshot).toBe(withSide);
    expect(view.showWithThroughput).toBe(true);
    expect(view.pairValid).toBe(true);
    expect(view.beamWithout).toBe(without);
    expect(view.beamWith).toBe(withSide);
  });

  it("with-history-only：With 历史独立进地图与 KPI，不得跨侧比较", () => {
    const without = snap("without", 25, 2);
    const withSide = snap("with", 15, 2);
    let state = closed(completeStart(ready(), "without", without));
    state = closed(completeStart(state, "with", withSide));
    state = begin(state, "reinit", "without");
    state = case3Reducer(state, { type: "SEEN_EXECUTE_SUCCESS" });
    state = case3Reducer(state, { type: "REINIT_COMPLETE", side: "without" });
    state = closed(state);

    const view = selectCase3Presentation(state);
    expect(view.visible).toBe("with-history-only");
    expect(view.dataState).toBe("without-completed");
    expect(view.busy).toBe(false);
    expect(view.startWithoutEnabled).toBe(true);
    expect(view.startWithEnabled).toBe(false);
    expect(view.reinitWithoutEnabled).toBe(false);
    expect(view.reinitWithEnabled).toBe(true);
    expect(view.withoutBadge).toBe("等待启动测试");
    expect(view.withBadge).toBe("历史结果");
    expect(view.withoutPoints).toEqual([]);
    expect(view.withPoints).toBe(withSide.points);
    expect(view.withPeerPoints).toBeNull();
    expect(view.withoutKpiSnapshot).toBeNull();
    expect(view.withKpiSnapshot).toBe(withSide);
    expect(view.showWithThroughput).toBe(true);
    expect(view.pairValid).toBe(false);
    expect(view.beamWithout).toBeNull();
    expect(view.beamWith).toBe(withSide);
  });

  it("unpaired-both：两侧地图可有点，但旧 With KPI 隐藏且不得比较", () => {
    const oldWith = snap("with", 15, 2);
    const nextWithout = snap("without", 22, 2);
    let state: Case3State = {
      ...ready(),
      results: { without: null, with: oldWith },
      pairValid: false,
    };
    state = closed(completeStart(state, "without", nextWithout));

    const view = selectCase3Presentation(state);
    expect(view.visible).toBe("unpaired-both");
    expect(view.dataState).toBe("without-completed");
    expect(view.busy).toBe(false);
    expect(view.startWithoutEnabled).toBe(false);
    expect(view.startWithEnabled).toBe(true);
    expect(view.reinitWithoutEnabled).toBe(true);
    expect(view.reinitWithEnabled).toBe(true);
    expect(view.withoutBadge).toBe("已完成");
    expect(view.withBadge).toBe("未配对历史");
    expect(view.withoutPoints).toBe(nextWithout.points);
    expect(view.withPoints).toBe(oldWith.points);
    expect(view.withPeerPoints).toBeNull();
    expect(view.withoutKpiSnapshot).toBe(nextWithout);
    expect(view.withKpiSnapshot).toBeNull();
    expect(view.showWithThroughput).toBe(false);
    expect(view.pairValid).toBe(false);
    expect(view.beamWithout).toBe(nextWithout);
    expect(view.beamWith).toBe(oldWith);
  });

  it("新 Without Start 后立即隐藏旧 With KPI，地图仍可保留 With 历史点", () => {
    const oldWith = snap("with", 15, 2);
    let state: Case3State = {
      ...ready(),
      results: { without: null, with: oldWith },
      pairValid: false,
    };
    state = begin(state, "start", "without");
    const view = selectCase3Presentation(state);
    expect(view.visible).toBe("without-running");
    expect(view.activeStartSide).toBe("without");
    expect(view.withPoints).toBe(oldWith.points);
    expect(view.withKpiSnapshot).toBeNull();
    expect(view.showWithThroughput).toBe(false);
    expect(view.withPeerPoints).toBeNull();
    expect(view.pairValid).toBe(false);
    expect(view.withoutKpiSnapshot).toBeNull();
    expect(view.beamWith).toBe(oldWith);
  });

  it("resetting-without：data-state 落在 without-completed，With 历史仍可展示", () => {
    const without = snap("without", 25, 2);
    const withSide = snap("with", 15, 2);
    let state = closed(completeStart(ready(), "without", without));
    state = closed(completeStart(state, "with", withSide));
    state = begin(state, "reinit", "without");

    const view = selectCase3Presentation(state);
    expect(view.visible).toBe("resetting-without");
    expect(view.dataState).toBe("without-completed");
    expect(view.busy).toBe(true);
    expect(view.activeStartSide).toBeNull();
    expect(view.startWithoutEnabled).toBe(false);
    expect(view.startWithEnabled).toBe(false);
    expect(view.reinitWithoutEnabled).toBe(false);
    expect(view.reinitWithEnabled).toBe(false);
    expect(view.withoutBadge).toBe("重置中");
    expect(view.withBadge).toBe("等待无DT测试完成");
    expect(view.withoutPoints).toEqual([]);
    expect(view.withPoints).toBe(withSide.points);
    expect(view.withPeerPoints).toBeNull();
    expect(view.withoutKpiSnapshot).toBeNull();
    expect(view.withKpiSnapshot).toBe(withSide);
    expect(view.showWithThroughput).toBe(true);
    expect(view.pairValid).toBe(false);
  });

  it("resetting-with：data-state 落在 with-completed，Without 结果保留", () => {
    const without = snap("without", 25, 2);
    const withSide = snap("with", 15, 2);
    let state = closed(completeStart(ready(), "without", without));
    state = closed(completeStart(state, "with", withSide));
    state = begin(state, "reinit", "with");

    const view = selectCase3Presentation(state);
    expect(view.visible).toBe("resetting-with");
    expect(view.dataState).toBe("with-completed");
    expect(view.busy).toBe(true);
    expect(view.activeStartSide).toBeNull();
    expect(view.startWithoutEnabled).toBe(false);
    expect(view.reinitWithEnabled).toBe(false);
    expect(view.withoutBadge).toBe("已完成");
    expect(view.withBadge).toBe("重置中");
    expect(view.withoutPoints).toBe(without.points);
    expect(view.withPoints).toEqual([]);
    expect(view.withPeerPoints).toBeNull();
    expect(view.withoutKpiSnapshot).toBe(without);
    expect(view.withKpiSnapshot).toBeNull();
    expect(view.showWithThroughput).toBe(false);
    expect(view.pairValid).toBe(false);
    expect(view.beamWithout).toBe(without);
    expect(view.beamWith).toBeNull();
  });

  it("failed Start Without：data-state=initial，仅同侧 Start 可点", () => {
    let state = begin(ready(), "start", "without");
    state = case3Reducer(state, { type: "EXECUTE_FAIL" });
    const view = selectCase3Presentation(state);
    expect(view.visible).toBe("failed-start-without");
    expect(view.dataState).toBe("initial");
    expect(view.busy).toBe(false);
    expect(view.startWithoutEnabled).toBe(true);
    expect(view.startWithEnabled).toBe(false);
    expect(view.reinitWithoutEnabled).toBe(false);
    expect(view.reinitWithEnabled).toBe(false);
    expect(view.withoutBadge).toBe("执行失败");
    expect(view.withBadge).toBe("等待无DT测试完成");
    expect(view.withoutBadgeError).toBe(true);
    expect(view.withBadgeError).toBe(false);
    expect(view.withoutPoints).toEqual([]);
    expect(view.withoutKpiSnapshot).toBeNull();
    expect(view.withKpiSnapshot).toBeNull();
    expect(view.showWithThroughput).toBe(false);
    expect(view.withPeerPoints).toBeNull();
  });

  it("failed Start With：保留 Without 结果，但不进入跨侧比较", () => {
    const without = snap("without", 25, 2);
    let state = closed(completeStart(ready(), "without", without));
    state = begin(state, "start", "with");
    state = case3Reducer(state, { type: "EXECUTE_FAIL" });
    const view = selectCase3Presentation(state);
    expect(view.visible).toBe("failed-start-with");
    expect(view.dataState).toBe("initial");
    expect(view.busy).toBe(false);
    expect(view.startWithoutEnabled).toBe(false);
    expect(view.startWithEnabled).toBe(true);
    expect(view.reinitWithoutEnabled).toBe(false);
    expect(view.reinitWithEnabled).toBe(false);
    expect(view.withoutBadge).toBe("已完成");
    expect(view.withBadge).toBe("执行失败");
    expect(view.withoutBadgeError).toBe(false);
    expect(view.withBadgeError).toBe(true);
    expect(view.withoutPoints).toBe(without.points);
    expect(view.withPoints).toEqual([]);
    expect(view.withPeerPoints).toBeNull();
    expect(view.withoutKpiSnapshot).toBe(without);
    expect(view.withKpiSnapshot).toBeNull();
    expect(view.pairValid).toBe(false);
    expect(view.beamWithout).toBe(without);
    expect(view.beamWith).toBeNull();
  });

  it("failed ReInit Without：With 历史仍可独立展示", () => {
    const without = snap("without", 25, 2);
    const withSide = snap("with", 15, 2);
    let state = closed(completeStart(ready(), "without", without));
    state = closed(completeStart(state, "with", withSide));
    state = begin(state, "reinit", "without");
    state = case3Reducer(state, { type: "EXECUTE_FAIL" });
    const view = selectCase3Presentation(state);
    expect(view.visible).toBe("failed-reinit-without");
    expect(view.dataState).toBe("initial");
    expect(view.busy).toBe(false);
    expect(view.startWithoutEnabled).toBe(false);
    expect(view.startWithEnabled).toBe(false);
    expect(view.reinitWithoutEnabled).toBe(true);
    expect(view.reinitWithEnabled).toBe(false);
    expect(view.withoutBadge).toBe("重置失败");
    expect(view.withBadge).toBe("等待无DT测试完成");
    expect(view.withoutBadgeError).toBe(true);
    expect(view.withBadgeError).toBe(false);
    expect(view.withPoints).toBe(withSide.points);
    expect(view.withKpiSnapshot).toBe(withSide);
    expect(view.showWithThroughput).toBe(true);
    expect(view.withPeerPoints).toBeNull();
    expect(view.pairValid).toBe(false);
  });

  it("failed ReInit With：Without 结果保留，With KPI 清空", () => {
    const without = snap("without", 25, 2);
    const withSide = snap("with", 15, 2);
    let state = closed(completeStart(ready(), "without", without));
    state = closed(completeStart(state, "with", withSide));
    state = begin(state, "reinit", "with");
    state = case3Reducer(state, { type: "EXECUTE_FAIL" });
    const view = selectCase3Presentation(state);
    expect(view.visible).toBe("failed-reinit-with");
    expect(view.dataState).toBe("initial");
    expect(view.busy).toBe(false);
    expect(view.startWithoutEnabled).toBe(false);
    expect(view.startWithEnabled).toBe(false);
    expect(view.reinitWithoutEnabled).toBe(false);
    expect(view.reinitWithEnabled).toBe(true);
    expect(view.withoutBadge).toBe("已完成");
    expect(view.withBadge).toBe("重置失败");
    expect(view.withoutBadgeError).toBe(false);
    expect(view.withBadgeError).toBe(true);
    expect(view.withoutPoints).toBe(without.points);
    expect(view.withPoints).toEqual([]);
    expect(view.withoutKpiSnapshot).toBe(without);
    expect(view.withKpiSnapshot).toBeNull();
    expect(view.showWithThroughput).toBe(false);
    expect(view.withPeerPoints).toBeNull();
  });

  it("roundClosing：busy 锁按钮，KPI 用 completed 结果而非 live", () => {
    const without = snap("without", 25, 2);
    const state = completeStart(ready(), "without", without);
    const view = selectCase3Presentation(state);
    expect(view.visible).toBe("without-completed");
    expect(view.dataState).toBe("without-completed");
    expect(view.busy).toBe(true);
    expect(view.activeAction).toBeNull();
    expect(view.activeStartSide).toBeNull();
    expect(view.startWithoutEnabled).toBe(false);
    expect(view.startWithEnabled).toBe(false);
    expect(view.reinitWithoutEnabled).toBe(false);
    expect(view.reinitWithEnabled).toBe(false);
    expect(view.withoutBadge).toBe("已完成");
    expect(view.withBadge).toBe("等待启动测试");
    expect(view.withoutKpiSnapshot).toBe(without);
    expect(view.withoutPoints).toBe(without.points);
    expect(view.withKpiSnapshot).toBeNull();
    expect(view.showWithThroughput).toBe(false);
  });

  it("adapter retry：忙态保留测试中，仅动作侧亮重试中", () => {
    let state = begin(ready(), "start", "without");
    state = case3Reducer(state, { type: "ADAPTER_ERROR", value: true });
    const view = selectCase3Presentation(state);
    expect(view.visible).toBe("without-running");
    expect(view.dataState).toBe("without-running");
    expect(view.busy).toBe(true);
    expect(view.withoutBadge).toBe("测试中");
    expect(view.withBadge).toBe("等待无DT测试完成");
    expect(view.withoutBadgeError).toBe(false);
    expect(view.withBadgeError).toBe(false);
    expect(view.withoutRetryHint).toBe(true);
    expect(view.withRetryHint).toBe(false);
    expect(view.startWithoutEnabled).toBe(false);
    expect(view.startWithEnabled).toBe(false);
  });

  it("空闲 adapterError 两侧都显示连接异常文案", () => {
    let state = ready();
    state = case3Reducer(state, { type: "ADAPTER_ERROR", value: true });
    const view = selectCase3Presentation(state);
    expect(view.visible).toBe("initial");
    expect(view.dataState).toBe("initial");
    expect(view.busy).toBe(false);
    expect(view.withoutBadge).toBe(CASE3_ADAPTER_ERROR_BADGE);
    expect(view.withBadge).toBe(CASE3_ADAPTER_ERROR_BADGE);
    expect(view.withoutBadgeError).toBe(true);
    expect(view.withBadgeError).toBe(true);
    expect(view.withoutRetryHint).toBe(false);
    expect(view.startWithoutEnabled).toBe(true);
  });
});
