import { describe, expect, it } from "vitest";
import {
  colorAt,
  heatmapContainsInvalid,
  isHeatmapInvalidCell,
  matrixMinMax,
  normalizeScalar,
  roundHeatmapSemantic,
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
    expect(sampleBilinear(m, 0, 0, 10, 10)).toEqual({ ok: true, value: 1 });
    expect(sampleBilinear(m, 9, 0, 10, 10)).toEqual({ ok: true, value: 2 });
    expect(sampleBilinear(m, 0, 9, 10, 10)).toEqual({ ok: true, value: 3 });
    expect(sampleBilinear(m, 9, 9, 10, 10)).toEqual({ ok: true, value: 4 });
  });

  it("支持 1x1 / 1xN / Nx1", () => {
    expect(sampleBilinear([[7]], 3, 4, 10, 10)).toEqual({ ok: true, value: 7 });
    expect(sampleBilinear([[1, 9]], 0, 5, 10, 10)).toEqual({
      ok: true,
      value: 1,
    });
    expect(sampleBilinear([[1, 9]], 9, 5, 10, 10)).toEqual({
      ok: true,
      value: 9,
    });
    expect(sampleBilinear([[1], [9]], 5, 0, 10, 10)).toEqual({
      ok: true,
      value: 1,
    });
    expect(sampleBilinear([[1], [9]], 5, 9, 10, 10)).toEqual({
      ok: true,
      value: 9,
    });
  });

  it("本张有效格独立 min/max；排除 -1；常数矩阵 t=0.5", () => {
    const stats = matrixMinMax([
      [10, 90],
      [10, 90],
    ]);
    expect(stats).not.toBeNull();
    expect(normalizeScalar(50, stats!.eMin, stats!.eMax)).toBe(0.5);
    expect(normalizeScalar(10, 10, 10)).toBe(0.5);

    const withInvalid = matrixMinMax([
      [1, -1],
      [2, 4],
    ]);
    expect(withInvalid).toEqual({ eMin: 1, eMax: 4 });
    expect(matrixMinMax([[-1, -1], [-1, -1]])).toBeNull();
  });

  it("色标断点精确", () => {
    expect(colorAt(0)).toEqual([37, 99, 235]);
    expect(colorAt(1)).toEqual([239, 68, 68]);
  });

  it("无效格判定：round 到 2 位后 === -1", () => {
    expect(isHeatmapInvalidCell(-1)).toBe(true);
    expect(isHeatmapInvalidCell(-1.0)).toBe(true);
    expect(isHeatmapInvalidCell(-1.004)).toBe(true);
    expect(roundHeatmapSemantic(-0.995)).toBe(-1);
    expect(roundHeatmapSemantic(-1.005)).toBe(-1.01);
    expect(isHeatmapInvalidCell(-0.995)).toBe(true);
    expect(isHeatmapInvalidCell(-1.005)).toBe(false);
    expect(isHeatmapInvalidCell(-0.99)).toBe(false);
    expect(isHeatmapInvalidCell(-1.01)).toBe(false);
    expect(roundHeatmapSemantic(-1.004)).toBe(-1);
    expect(heatmapContainsInvalid([[1, 2], [3, 4]])).toBe(false);
    expect(heatmapContainsInvalid([[1, -1], [3, 4]])).toBe(true);
  });

  it("双线性：无效角丢弃并重归一；全无效则 ok:false", () => {
    const m = [
      [-1, 10],
      [-1, -1],
    ];
    // 右上角有效：靠近 (9,0) 应接近 10
    const right = sampleBilinear(m, 9, 0, 10, 10);
    expect(right).toEqual({ ok: true, value: 10 });
    // 左下全无效邻域
    const left = sampleBilinear(m, 0, 9, 10, 10);
    expect(left).toEqual({ ok: false });
  });

  it("马赛克 CELL=3 GAP=1：色块不透明、缝透明；无效采样写 INVALID alpha", () => {
    const config = loadCase2RuntimeConfig({});
    const data = buildMosaicRgba([[0, 100], [0, 100]], config);
    expect(data.data[3]).toBe(255);
    const gapIdx = (0 * config.rangeWidth + 3) * 4 + 3;
    expect(data.data[gapIdx]).toBe(0);

    const allInvalid = buildMosaicRgba(
      [
        [-1, -1],
        [-1, -1],
      ],
      config,
    );
    // 色块内应为 INVALID A=0
    expect(allInvalid.data[3]).toBe(0);
  });

  it("无效格按等分矩形硬切：末行 -1 时底半区色块全 INVALID，不被上行渗色", () => {
    const config = {
      ...loadCase2RuntimeConfig({}),
      rangeWidth: 20,
      rangeHeight: 20,
      cell: 1,
      gap: 0,
      period: 1,
      invalidRgba: { r: 255, g: 0, b: 0, a: 255 },
    };
    // 2×2：仅底行无效 → y∈[10,20) 应全红不透明
    const matrix = [
      [10, 90],
      [-1, -1],
    ];
    const buf = buildMosaicRgba(matrix, config);
    const top = (5 * 20 + 5) * 4;
    expect(buf.data[top + 3]).toBe(255);
    expect(buf.data[top]).not.toBe(255); // 伪彩，不是纯红 INVALID
    const bottom = (15 * 20 + 5) * 4;
    expect(buf.data[bottom]).toBe(255);
    expect(buf.data[bottom + 1]).toBe(0);
    expect(buf.data[bottom + 2]).toBe(0);
    expect(buf.data[bottom + 3]).toBe(255);
  });
});

describe("heatmapConfig", () => {
  it("缺省使用默认值（含 INVALID 白透明）", () => {
    const c = loadCase2RuntimeConfig({});
    expect(c.x0).toBe(750);
    expect(c.cdfPointCap).toBe(256);
    expect(c.pollMs).toBe(1000);
    expect(c.invalidRgba).toEqual({ r: 255, g: 255, b: 255, a: 0 });
  });

  it("非法 CAP 明确失败", () => {
    expect(() =>
      loadCase2RuntimeConfig({ VITE_CASE2_CDF_POINT_CAP: "1" }),
    ).toThrow(HeatmapConfigError);
  });

  it("非法 INVALID 通道失败", () => {
    expect(() =>
      loadCase2RuntimeConfig({ VITE_CASE2_HEATMAP_INVALID_A: "300" }),
    ).toThrow(HeatmapConfigError);
  });

  it("锚区越界失败", () => {
    const c = loadCase2RuntimeConfig({});
    expect(() => assertHeatmapAnchor(c, 100, 100)).toThrow(HeatmapConfigError);
  });
});
