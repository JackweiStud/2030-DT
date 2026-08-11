/**
 * Case3 KPI / 地图投影纯函数测试。
 */
import { describe, expect, it } from "vitest";
import {
  deriveBeamAccuracy,
  isFinalSideReady,
  niceCeilThroughput,
  niceIntegerStep,
  pointProgressWindow,
  relativeCostChangePct,
  throughputXDomain,
  throughputXTicks,
} from "../../src/cases/case3/metrics/case3Metrics";
import {
  projectPointToMap2D,
  zoomMapViewAtPointer,
  IDENTITY_MAP_VIEW,
  clampMapRotation,
} from "../../src/cases/case3/metrics/mapProjection";
import type { SideSnapshot } from "../../src/cases/case3/types";

describe("case3Metrics", () => {
  it("开销变化公式与缺值", () => {
    expect(relativeCostChangePct(25, 15, true)).toBeCloseTo(40);
    expect(relativeCostChangePct(25, 15, false)).toBeNull();
    expect(relativeCostChangePct(0, 15, true)).toBeNull();
  });

  it("BA 按 no 匹配", () => {
    const without: SideSnapshot = {
      side: "without",
      points: [
        {
          no: 1,
          ue: { x: 0, y: 0, z: 0 },
          selectedBeamId: 2,
          throughputGbps: 1,
          scanBeamIds: Array.from({ length: 16 }, (_, i) => i),
        },
        {
          no: 2,
          ue: { x: 0, y: 0, z: 0 },
          selectedBeamId: 3,
          throughputGbps: 1,
          scanBeamIds: Array.from({ length: 16 }, (_, i) => i),
        },
      ],
      completeCount: 2,
      pendingTail: false,
      costPct: 25,
    };
    const withSide: SideSnapshot = {
      side: "with",
      points: [
        {
          no: 1,
          ue: { x: 0, y: 0, z: 0 },
          selectedBeamId: 2,
          throughputGbps: 1,
          reflection: { x: 0, y: 0, z: 0, los: true },
        },
        {
          no: 2,
          ue: { x: 0, y: 0, z: 0 },
          selectedBeamId: 9,
          throughputGbps: 1,
          reflection: { x: 0, y: 0, z: 0, los: false },
        },
      ],
      completeCount: 2,
      pendingTail: false,
      costPct: 15,
    };
    const d = deriveBeamAccuracy(
      { success: 80, total: 100 },
      without,
      withSide,
      true,
    );
    expect(d?.displaySuccess).toBe(81);
    expect(d?.displayTotal).toBe(102);
    expect(d?.displayError).toBe(21);
  });

  it("点位窗口与最终门槛", () => {
    const pts = Array.from({ length: 22 }, (_, i) => i + 1);
    expect(pointProgressWindow(pts)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 3),
    );
    expect(
      isFinalSideReady({
        side: "without",
        points: [{ no: 1, ue: { x: 0, y: 0, z: 0 }, selectedBeamId: 0, throughputGbps: 1 }],
        completeCount: 1,
        pendingTail: false,
        costPct: 1,
      }),
    ).toBe(true);
    expect(
      isFinalSideReady({
        side: "without",
        points: [],
        completeCount: 0,
        pendingTail: false,
        costPct: 1,
      }),
    ).toBe(false);
  });

  it("niceCeil", () => {
    expect(niceCeilThroughput(0)).toBe(12);
    expect(niceCeilThroughput(8)).toBe(12);
    expect(niceCeilThroughput(12)).toBeGreaterThanOrEqual(13);
  });

  it("吞吐 X 域固定自 baseRoute，刻度相对域稳定", () => {
    expect(throughputXDomain(null)).toEqual([1, 20]);
    expect(throughputXDomain([])).toEqual([1, 20]);
    expect(throughputXDomain([3, 1, 50])).toEqual([1, 50]);
    expect(throughputXDomain([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual([1, 10]);

    expect(niceIntegerStep(1)).toBe(1);
    expect(niceIntegerStep(3)).toBe(5);
    expect(niceIntegerStep(6)).toBe(10);

    expect(throughputXTicks(1, 1)).toEqual([1]);
    expect(throughputXTicks(1, 8)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    const wide = throughputXTicks(1, 100);
    expect(wide[0]).toBe(1);
    expect(wide[wide.length - 1]).toBe(100);
    expect(wide.length).toBeLessThanOrEqual(25);
    const midSteps = wide.slice(1, -1).map((v, i) => v - wide[i]!);
    expect(new Set(midSteps).size).toBe(1);
    const step = midSteps[0]!;
    expect(wide[wide.length - 1]! - wide[wide.length - 2]!).toBeLessThanOrEqual(step);
  });
});

describe("mapProjection", () => {
  it("x/y 交换映射", () => {
    const p = projectPointToMap2D(11, 22, {
      mapOriginX: 905,
      mapOriginY: 445,
      mapUnitsPerPx: 0.11,
    });
    expect(p.mapPixelX).toBeCloseTo(905 + 22 / 0.11);
    expect(p.mapPixelY).toBeCloseTo(445 + 11 / 0.11);
  });

  it("缩放与旋转 clamp", () => {
    const z = zoomMapViewAtPointer(IDENTITY_MAP_VIEW, 100, 100, true);
    expect(z.scale).toBeGreaterThan(1);
    expect(clampMapRotation(120)).toBe(90);
    expect(clampMapRotation(-120)).toBe(-90);
  });

  it("指针中心缩放：相对中心坐标下指针点不动", () => {
    // 模拟 transform-origin:center：指针在中心偏右下 (80, 40)
    const pointerX = 80;
    const pointerY = 40;
    const before = IDENTITY_MAP_VIEW;
    const after = zoomMapViewAtPointer(before, pointerX, pointerY, true);
    const ratio = after.scale / before.scale;
    // 缩放前后「指针处」的内容坐标应一致： (p - offset) / scale
    const contentBeforeX = (pointerX - before.offsetX) / before.scale;
    const contentBeforeY = (pointerY - before.offsetY) / before.scale;
    const contentAfterX = (pointerX - after.offsetX) / after.scale;
    const contentAfterY = (pointerY - after.offsetY) / after.scale;
    expect(contentAfterX).toBeCloseTo(contentBeforeX);
    expect(contentAfterY).toBeCloseTo(contentBeforeY);
    expect(after.offsetX).toBeCloseTo(pointerX - (pointerX - before.offsetX) * ratio);
    expect(after.offsetY).toBeCloseTo(pointerY - (pointerY - before.offsetY) * ratio);
  });
});
