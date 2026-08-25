/**
 * Case3 V2 With：同 no peer、矩阵格子、回溯色、单地图侧。
 */

import { describe, expect, it } from "vitest";
import { withBeamCellRole } from "../../src/cases/case3-v2/v2BeamGrid";
import {
  peerPointByNo,
  v2DisplayMapSide,
  v2LiveMapSide,
  v2ReplayCompleteCount,
  v2ReplayDriveSide,
  withBeamVerdict,
  withReplayTone,
} from "../../src/cases/case3-v2/v2WithCompare";
import type { Case3Point, SideSnapshot } from "../../src/cases/case3/types";

function point(no: number, beam: number): Case3Point {
  return {
    no,
    ue: { x: no, y: 2, z: 0 },
    selectedBeamId: beam,
    throughputGbps: 8,
  };
}

describe("peerPointByNo", () => {
  it("只按 no 匹配，不按下标或坐标", () => {
    const peers = [point(2, 20), point(1, 10), point(3, 30)];
    expect(peerPointByNo(peers, 1)?.selectedBeamId).toBe(10);
    expect(peerPointByNo(peers, 2)?.selectedBeamId).toBe(20);
    expect(peerPointByNo(null, 1)).toBeNull();
    expect(peerPointByNo(peers, 9)).toBeNull();
    expect(peerPointByNo([point(1, 10)], 1)?.ue).toEqual({ x: 1, y: 2, z: 0 });
  });
});

describe("withBeamVerdict", () => {
  it("match / mismatch / no-peer / empty", () => {
    expect(withBeamVerdict(point(4, 122), point(4, 122))).toBe("match");
    expect(withBeamVerdict(point(4, 7), point(4, 122))).toBe("mismatch");
    expect(withBeamVerdict(point(4, 122), null)).toBe("no-peer");
    expect(withBeamVerdict(point(4, 122), point(5, 122))).toBe("no-peer");
    expect(withBeamVerdict(null, point(4, 122))).toBe("empty");
  });

  it("0 与 255 边界按值比较", () => {
    expect(withBeamVerdict(point(1, 0), point(1, 0))).toBe("match");
    expect(withBeamVerdict(point(1, 255), point(1, 255))).toBe("match");
    expect(withBeamVerdict(point(1, 0), point(1, 255))).toBe("mismatch");
    expect(withBeamVerdict(point(1, 255), point(1, 0))).toBe("mismatch");
  });
});

describe("withReplayTone", () => {
  it("正确/错误/缺 peer 对应 ok/fail/idle", () => {
    expect(withReplayTone(point(1, 10), point(1, 10))).toBe("ok");
    expect(withReplayTone(point(1, 11), point(1, 10))).toBe("fail");
    expect(withReplayTone(point(1, 10), null)).toBe("idle");
    expect(withReplayTone(null, point(1, 10))).toBe("idle");
  });
});

describe("withBeamCellRole", () => {
  it("同格只显示预测波，不显示扫描波", () => {
    expect(withBeamCellRole(7, 10, 122, 122)).toBe("pred");
    expect(withBeamCellRole(0, 0, 122, 0)).toBe("best");
    expect(withBeamCellRole(7, 10, 122, 0)).toBe("pred");
    expect(withBeamCellRole(0, 0, 0, 255)).toBe("pred");
    expect(withBeamCellRole(15, 15, 0, 255)).toBe("best");
    expect(withBeamCellRole(0, 1, 0, 255)).toBeNull();
  });

  it("非法 id 不进格子；0/255 合法", () => {
    expect(withBeamCellRole(0, 0, 0, null)).toBe("pred");
    expect(withBeamCellRole(15, 15, 255, null)).toBe("pred");
    expect(withBeamCellRole(0, 0, 256, 0)).toBe("best");
    expect(withBeamCellRole(0, 0, -1, null)).toBeNull();
  });
});

describe("v2LiveMapSide", () => {
  it("With Start 后切到 With，其余保持 Without", () => {
    expect(
      v2LiveMapSide({ activeStartSide: "with", dataState: "with-running" }),
    ).toBe("with");
    expect(
      v2LiveMapSide({ activeStartSide: null, dataState: "with-completed" }),
    ).toBe("with");
    expect(
      v2LiveMapSide({ activeStartSide: "without", dataState: "without-running" }),
    ).toBe("without");
    expect(
      v2LiveMapSide({ activeStartSide: null, dataState: "without-completed" }),
    ).toBe("without");
    expect(v2LiveMapSide({ activeStartSide: null, dataState: "initial" })).toBe(
      "without",
    );
  });
});

describe("v2DisplayMapSide", () => {
  it("清图保持期间强制 without，解除后恢复 source live side", () => {
    expect(v2DisplayMapSide("with", true)).toBe("without");
    expect(v2DisplayMapSide("without", true)).toBe("without");
    expect(v2DisplayMapSide("with", false)).toBe("with");
    expect(v2DisplayMapSide("without", false)).toBe("without");
  });
});

describe("v2ReplayCompleteCount", () => {
  it("With 展示侧用 With 点数，其余用 Without", () => {
    expect(v2ReplayCompleteCount("without", 31, 2)).toBe(31);
    expect(v2ReplayCompleteCount("with", 31, 2)).toBe(2);
    expect(v2ReplayCompleteCount("with", 31, 0)).toBe(0);
    expect(v2ReplayCompleteCount("with", 31, 22)).toBe(22);
  });
});

function snap(
  side: "without" | "with",
  count: number,
): SideSnapshot {
  return {
    side,
    points: Array.from({ length: count }, (_, i) => point(i + 1, (i + 1) * 10)),
    completeCount: count,
    pendingTail: false,
    costPct: side === "without" ? 25 : 12.5,
  };
}

describe("v2ReplayDriveSide", () => {
  it("Start 运行中跟随 activeStartSide，即使另一侧仍有历史", () => {
    expect(
      v2ReplayDriveSide({
        activeStartSide: "with",
        withoutKpiSnapshot: snap("without", 31),
        withKpiSnapshot: snap("with", 2),
      }),
    ).toBe("with");
    expect(
      v2ReplayDriveSide({
        activeStartSide: "without",
        withoutKpiSnapshot: snap("without", 1),
        withKpiSnapshot: snap("with", 31),
      }),
    ).toBe("without");
  });

  it("双侧配对完成时保持 With", () => {
    expect(
      v2ReplayDriveSide({
        activeStartSide: null,
        withoutKpiSnapshot: snap("without", 31),
        withKpiSnapshot: snap("with", 31),
      }),
    ).toBe("with");
  });

  it("空闲 / ReInit 后跟随仍有完整点的一侧；两侧都空为 Without", () => {
    expect(
      v2ReplayDriveSide({
        activeStartSide: null,
        withoutKpiSnapshot: snap("without", 31),
        withKpiSnapshot: null,
      }),
    ).toBe("without");
    expect(
      v2ReplayDriveSide({
        activeStartSide: null,
        withoutKpiSnapshot: null,
        withKpiSnapshot: snap("with", 31),
      }),
    ).toBe("with");
    expect(
      v2ReplayDriveSide({
        activeStartSide: null,
        withoutKpiSnapshot: null,
        withKpiSnapshot: null,
      }),
    ).toBe("without");
  });
});
