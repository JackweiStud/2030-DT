/**
 * Case3 reducer / pairValid / 动作矩阵测试。
 */
import { describe, expect, it } from "vitest";
import {
  CASE3_ADAPTER_ERROR_BADGE,
  CASE3_INIT_DATA_ERROR_BADGE,
  canCompareWithCurrentWithout,
  canReinit,
  canStartWith,
  canStartWithout,
  case3Reducer,
  createInitialCase3State,
  deriveVisibleState,
  sideStatusBadge,
  sideStatusBadgeIsError,
} from "../../src/cases/case3/state/case3Reducer";
import type { SideSnapshot } from "../../src/cases/case3/types";

function snap(side: "without" | "with", cost = 25): SideSnapshot {
  return {
    side,
    points: [
      {
        no: 1,
        ue: { x: 1, y: 2, z: 0 },
        selectedBeamId: 1,
        throughputGbps: 2,
        ...(side === "without"
          ? { scanBeamIds: Array.from({ length: 16 }, (_, i) => i) }
          : {
              reflection: { x: 0, y: 0, z: 0, los: true },
            }),
      },
    ],
    completeCount: 1,
    pendingTail: false,
    costPct: cost,
  };
}

describe("case3Reducer", () => {
  it("初始化 ready 后可 Start Without", () => {
    let s = createInitialCase3State();
    s = case3Reducer(s, {
      type: "INIT_READY",
      baseRoute: [{ no: 1, x: 0, y: 0, z: 0 }],
      baseline: { success: 1, total: 2 },
    });
    expect(canStartWithout(s)).toBe(true);
    expect(canStartWith(s)).toBe(false);
  });

  it("adapterError 时徽标替换为连接异常文案", () => {
    let s = createInitialCase3State();
    s = case3Reducer(s, { type: "INIT_LOADING" });
    s = case3Reducer(s, { type: "ADAPTER_ERROR", value: true });
    expect(sideStatusBadgeIsError(s)).toBe(true);
    expect(sideStatusBadge(s, "without")).toBe(CASE3_ADAPTER_ERROR_BADGE);
    expect(sideStatusBadge(s, "with")).toBe(CASE3_ADAPTER_ERROR_BADGE);
    expect(canStartWithout(s)).toBe(false);
  });

  it("initStatus=error 时徽标替换为初始化数据异常", () => {
    let s = createInitialCase3State();
    s = case3Reducer(s, { type: "INIT_ERROR" });
    expect(sideStatusBadgeIsError(s)).toBe(true);
    expect(sideStatusBadge(s, "without")).toBe(CASE3_INIT_DATA_ERROR_BADGE);
    expect(canStartWithout(s)).toBe(false);
  });

  it("Without 完成后 With 可 Start；pairValid 仍 false", () => {
    let s = createInitialCase3State();
    s = case3Reducer(s, {
      type: "INIT_READY",
      baseRoute: [{ no: 1, x: 0, y: 0, z: 0 }],
      baseline: { success: 1, total: 2 },
    });
    s = case3Reducer(s, {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "without",
      generation: 1,
    });
    s = case3Reducer(s, { type: "SEEN_EXECUTE_SUCCESS" });
    s = case3Reducer(s, {
      type: "START_COMPLETE",
      side: "without",
      snapshot: snap("without", 25),
    });
    expect(s.pairValid).toBe(false);
    expect(deriveVisibleState(s)).toBe("without-completed");
    expect(s.roundClosing).toBe(true);
    expect(canStartWith(s)).toBe(false);
    expect(canReinit(s, "without")).toBe(false);
    s = case3Reducer(s, { type: "ROUND_CLOSE_COMPLETE" });
    expect(canStartWith(s)).toBe(true);
  });

  it("With 完成后 pairValid=true；新 Without Start 立即使 pairValid=false", () => {
    let s = createInitialCase3State();
    s = case3Reducer(s, {
      type: "INIT_READY",
      baseRoute: [{ no: 1, x: 0, y: 0, z: 0 }],
      baseline: { success: 1, total: 2 },
    });
    s = {
      ...s,
      results: { without: snap("without"), with: null },
    };
    s = case3Reducer(s, {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "with",
      generation: 2,
    });
    // ACTION_BEGIN 清 with，但 without 保留
    expect(s.results.without).not.toBeNull();
    expect(s.pairValid).toBe(false);
    s = case3Reducer(s, { type: "SEEN_EXECUTE_SUCCESS" });
    s = case3Reducer(s, {
      type: "START_COMPLETE",
      side: "with",
      snapshot: snap("with", 15),
    });
    expect(s.pairValid).toBe(true);
    expect(deriveVisibleState(s)).toBe("with-completed");
    expect(s.roundClosing).toBe(true);
    s = case3Reducer(s, { type: "ROUND_CLOSE_COMPLETE" });

    s = case3Reducer(s, {
      type: "ACTION_BEGIN",
      kind: "reinit",
      side: "without",
      generation: 3,
    });
    expect(s.pairValid).toBe(false);
    expect(s.results.without).toBeNull();
    expect(s.results.with).not.toBeNull();
  });

  it("新 Without 完成但保留旧 With 时仍 unpaired", () => {
    let s = createInitialCase3State();
    s = {
      ...s,
      initStatus: "ready",
      baseline: { success: 1, total: 2 },
      results: { without: null, with: snap("with", 15) },
      pairValid: false,
    };
    s = case3Reducer(s, {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "without",
      generation: 4,
    });
    s = case3Reducer(s, { type: "SEEN_EXECUTE_SUCCESS" });
    s = case3Reducer(s, {
      type: "START_COMPLETE",
      side: "without",
      snapshot: snap("without", 25),
    });
    expect(s.pairValid).toBe(false);
    expect(deriveVisibleState(s)).toBe("unpaired-both");
    expect(canStartWith(s)).toBe(false);
    s = case3Reducer(s, { type: "ROUND_CLOSE_COMPLETE" });
    expect(canStartWith(s)).toBe(true);
    expect(canCompareWithCurrentWithout(s)).toBe(false);

    s = case3Reducer(s, {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "with",
      generation: 5,
    });
    expect(canCompareWithCurrentWithout(s)).toBe(true);
  });

  it("execute fail 进入 failed-start 且只允许同侧 Start", () => {
    let s = createInitialCase3State();
    s = case3Reducer(s, {
      type: "INIT_READY",
      baseRoute: [{ no: 1, x: 0, y: 0, z: 0 }],
      baseline: { success: 1, total: 2 },
    });
    s = case3Reducer(s, {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "without",
      generation: 1,
    });
    s = case3Reducer(s, { type: "EXECUTE_FAIL" });
    expect(deriveVisibleState(s)).toBe("failed-start-without");
    expect(canStartWithout(s)).toBe(true);
    expect(canReinit(s, "without")).toBe(false);
  });

  it("未见 success 的 complete 不提交", () => {
    let s = createInitialCase3State();
    s = case3Reducer(s, {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "without",
      generation: 1,
    });
    const next = case3Reducer(s, {
      type: "START_COMPLETE",
      side: "without",
      snapshot: snap("without"),
    });
    expect(next.results.without).toBeNull();
    expect(next.activeAction).not.toBeNull();
  });
});
