/**
 * Case3 V2 完整点切片。
 */

import { describe, expect, it } from "vitest";
import {
  completePointsOf,
  latestCompletePoint,
} from "../../src/cases/case3-v2/v2CompletePoints";
import type { Case3Point, SideSnapshot } from "../../src/cases/case3/types";

function point(no: number): Case3Point {
  return {
    no,
    ue: { x: no, y: 2, z: 0 },
    selectedBeamId: no,
    throughputGbps: 8,
    scanBeamIds: [0],
  };
}

function snap(
  points: Case3Point[],
  completeCount: number,
  pendingTail = false,
): SideSnapshot {
  return {
    side: "without",
    points,
    completeCount,
    pendingTail,
    costPct: 25,
  };
}

describe("completePointsOf", () => {
  it("null 快照为空", () => {
    expect(completePointsOf(null)).toEqual([]);
    expect(latestCompletePoint(null)).toBeNull();
  });

  it("尊重 completeCount，丢弃 pendingTail 尾点", () => {
    const snapshot = snap([point(1), point(2), point(3)], 2, true);
    expect(completePointsOf(snapshot).map((p) => p.no)).toEqual([1, 2]);
    expect(latestCompletePoint(snapshot)?.no).toBe(2);
  });

  it("completeCount 大于点数时不超过数组长度", () => {
    const snapshot = snap([point(1)], 4, false);
    expect(completePointsOf(snapshot)).toHaveLength(1);
  });
});
