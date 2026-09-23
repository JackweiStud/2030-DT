/**
 * Issue #6：Case3 运行中 BA 与独立吞吐展示。
 */
import { describe, expect, it } from "vitest";
import {
  deriveBeamAccuracy,
  throughputSeriesFromSnapshots,
} from "../../src/cases/case3/metrics/case3Metrics";
import { selectCase3Presentation } from "../../src/cases/case3/presentation/selectCase3Presentation";
import {
  case3Reducer,
  createInitialCase3State,
} from "../../src/cases/case3/state/case3Reducer";
import type { SideSnapshot, ThroughputSnapshot } from "../../src/cases/case3/types";

function point(
  side: "without" | "with",
  no: number,
  beam: number,
): SideSnapshot["points"][number] {
  return {
    no,
    ue: { x: no, y: no, z: 0 },
    selectedBeamId: beam,
    throughputGbps: side === "without" ? 8 + no / 10 : 9 + no / 10,
    ...(side === "without"
      ? { scanBeamIds: Array.from({ length: 16 }, (_, i) => i) }
      : { reflection: { x: 0, y: 0, z: 0, los: true } }),
  };
}

function side(
  sideName: "without" | "with",
  points: SideSnapshot["points"],
  cost = 25,
): SideSnapshot {
  return {
    side: sideName,
    points,
    completeCount: points.length,
    pendingTail: false,
    costPct: cost,
  };
}

function thrp(samples: Array<{ no: number; gbps: number }>): ThroughputSnapshot {
  return { samples, pendingTail: false };
}

describe("case3 live presentation", () => {
  it("With 运行中：有 Without 对照的点计入 BA，无对照保持中性", () => {
    const without = side("without", [point("without", 1, 2), point("without", 2, 3)]);
    const liveWith = side("with", [point("with", 1, 2), point("with", 2, 9)]);
    const d = deriveBeamAccuracy(
      { success: 10, total: 20 },
      without,
      liveWith,
      true,
    );
    expect(d?.displaySuccess).toBe(11);
    expect(d?.displayTotal).toBe(22);
    expect(d?.displayError).toBe(11);
  });

  it("吞吐快照领先轨迹时仍绘制全部样点", () => {
    const series = throughputSeriesFromSnapshots(
      thrp([
        { no: 1, gbps: 8.1 },
        { no: 2, gbps: 8.2 },
        { no: 3, gbps: 8.3 },
      ]),
      null,
    );
    expect(series.without).toHaveLength(3);
    expect(series.with).toHaveLength(0);
  });

  it("两路吞吐长度不同不补 0", () => {
    const series = throughputSeriesFromSnapshots(
      thrp([{ no: 1, gbps: 8 }, { no: 2, gbps: 9 }]),
      thrp([{ no: 1, gbps: 10 }]),
    );
    expect(series.without.map((p) => p.no)).toEqual([1, 2]);
    expect(series.with.map((p) => p.no)).toEqual([1]);
  });

  it("新 Start 清空目标侧 liveThrp，不泄漏上一轮", () => {
    let state = createInitialCase3State();
    state = case3Reducer(state, {
      type: "INIT_READY",
      baseRoute: [{ no: 1, x: 0, y: 0, z: 0 }],
      baseline: { success: 1, total: 2 },
    });
    state = case3Reducer(state, {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "without",
      generation: 1,
    });
    state = case3Reducer(state, { type: "SEEN_EXECUTE_SUCCESS" });
    state = case3Reducer(state, {
      type: "LIVE_THROUGHPUT",
      side: "without",
      snapshot: thrp([{ no: 1, gbps: 8.5 }]),
    });
    state = case3Reducer(state, {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "without",
      generation: 2,
    });
    expect(state.liveThrp.without).toBeNull();
    expect(state.resultThrp.without).toBeNull();
  });

  it("START_COMPLETE 将 liveThrp 固化为 resultThrp", () => {
    let state = createInitialCase3State();
    state = case3Reducer(state, {
      type: "INIT_READY",
      baseRoute: [{ no: 1, x: 0, y: 0, z: 0 }],
      baseline: { success: 1, total: 2 },
    });
    state = case3Reducer(state, {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "without",
      generation: 1,
    });
    state = case3Reducer(state, { type: "SEEN_EXECUTE_SUCCESS" });
    const live = thrp([{ no: 1, gbps: 9.9 }]);
    state = case3Reducer(state, {
      type: "LIVE_THROUGHPUT",
      side: "without",
      snapshot: live,
    });
    const snap = side("without", [point("without", 1, 1)]);
    state = case3Reducer(state, {
      type: "START_COMPLETE",
      side: "without",
      snapshot: snap,
      throughput: live,
    });
    expect(state.liveThrp.without).toBeNull();
    expect(state.resultThrp.without).toEqual(live);
  });

  it("START_COMPLETE 不用 points[].throughputGbps 回填 resultThrp", () => {
    let state = createInitialCase3State();
    state = case3Reducer(state, {
      type: "INIT_READY",
      baseRoute: [{ no: 1, x: 0, y: 0, z: 0 }],
      baseline: { success: 1, total: 2 },
    });
    state = case3Reducer(state, {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "without",
      generation: 1,
    });
    state = case3Reducer(state, { type: "SEEN_EXECUTE_SUCCESS" });
    const snap = side("without", [point("without", 1, 1)]);
    state = case3Reducer(state, {
      type: "START_COMPLETE",
      side: "without",
      snapshot: snap,
      throughput: null,
    });
    expect(state.resultThrp.without).toBeNull();
  });

  it("Without 运行中 presentation 使用 liveThrp", () => {
    let state = createInitialCase3State();
    state = {
      ...state,
      initStatus: "ready",
      baseline: { success: 1, total: 2 },
      activeAction: {
        kind: "start",
        side: "without",
        seenExecuteSuccess: true,
        generation: 1,
      },
      liveThrp: {
        without: thrp([
          { no: 1, gbps: 8.1 },
          { no: 2, gbps: 8.2 },
        ]),
        with: null,
      },
      live: {
        without: side("without", [point("without", 1, 1)]),
        with: null,
      },
    };
    const view = selectCase3Presentation(state);
    expect(view.thrpWithout?.samples).toHaveLength(2);
    expect(view.thrpWith).toBeNull();
  });
});
