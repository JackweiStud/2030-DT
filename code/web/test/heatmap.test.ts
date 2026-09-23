import { describe, expect, it } from "vitest";
import {
  colorAt,
  heatmapContainsInvalid,
  matrixMinMax,
  normalizeScalar,
  sampleBilinear,
  buildMosaicRgba,
} from "../src/cases/case2/metrics/heatmap";
import {
  assertHeatmapAnchor,
  loadCase2RuntimeConfig,
  HeatmapConfigError,
} from "../src/cases/case2/metrics/heatmapConfig";

describe("heatmap math", () => {
  it("2x2 四角精确对应矩阵四角", () => {
    const m = [
      [1, 2],
      [3, 4],
    ];
    expect(sampleBilinear(m, 0, 0, 10, 10)).toBe(1);
    expect(sampleBilinear(m, 9, 0, 10, 10)).toBe(2);
    expect(sampleBilinear(m, 0, 9, 10, 10)).toBe(3);
    expect(sampleBilinear(m, 9, 9, 10, 10)).toBe(4);
  });

  it("支持 1x1 / 1xN / Nx1", () => {
    expect(sampleBilinear([[7]], 3, 4, 10, 10)).toBe(7);
    expect(sampleBilinear([[1, 9]], 0, 5, 10, 10)).toBe(1);
    expect(sampleBilinear([[1, 9]], 9, 5, 10, 10)).toBe(9);
    expect(sampleBilinear([[1], [9]], 5, 0, 10, 10)).toBe(1);
    expect(sampleBilinear([[1], [9]], 5, 9, 10, 10)).toBe(9);
  });

  it("本张矩阵独立 min/max；常数矩阵 t=0.5", () => {
    const stats = matrixMinMax([
      [10, 90],
      [10, 90],
    ]);
    expect(normalizeScalar(50, stats.eMin, stats.eMax)).toBe(0.5);
    expect(normalizeScalar(10, 10, 10)).toBe(0.5);
  });

  it("色标断点精确", () => {
    expect(colorAt(0)).toEqual([37, 99, 235]);
    expect(colorAt(1)).toEqual([239, 68, 68]);
  });

  it("矩阵含哨兵 -1 则判定为不可画", () => {
    expect(heatmapContainsInvalid([[1, 2], [3, 4]])).toBe(false);
    expect(heatmapContainsInvalid([[1, -1], [3, 4]])).toBe(true);
    expect(heatmapContainsInvalid([[-1]])).toBe(true);
  });

  it("马赛克 CELL=3 GAP=1：色块不透明、缝透明", () => {
    const config = loadCase2RuntimeConfig({});
    const data = buildMosaicRgba([[0, 100], [0, 100]], config);
    // (0,0) 在色块内
    expect(data.data[3]).toBe(255);
    // (3,0) 为缝
    const gapIdx = (0 * config.rangeWidth + 3) * 4 + 3;
    expect(data.data[gapIdx]).toBe(0);
  });
});

describe("heatmapConfig", () => {
  it("缺省使用默认值", () => {
    const c = loadCase2RuntimeConfig({});
    expect(c.x0).toBe(750);
    expect(c.cdfPointCap).toBe(256);
    expect(c.pollMs).toBe(1000);
  });

  it("非法 CAP 明确失败", () => {
    expect(() =>
      loadCase2RuntimeConfig({ VITE_CASE2_CDF_POINT_CAP: "1" }),
    ).toThrow(HeatmapConfigError);
  });

  it("锚区越界失败", () => {
    const c = loadCase2RuntimeConfig({});
    expect(() => assertHeatmapAnchor(c, 100, 100)).toThrow(HeatmapConfigError);
  });
});
