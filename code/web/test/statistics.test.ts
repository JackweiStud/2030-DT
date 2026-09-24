import { describe, expect, it } from "vitest";
import {
  buildCdfStairPath,
  buildEmpiricalCdfPoints,
  formatReductionLabel,
  kpiHasChartData,
  meanChangeMarker,
  meanChangeStackTops,
  meanOf,
  relativeChangePercent,
  resolveXDomain,
  buildCdfXAxis,
  cdfXTickCount,
  validKpiSamples,
} from "../src/cases/case2/metrics/statistics";

describe("statistics", () => {
  it("CDF 点数随 N，不写死 51", () => {
    const pts = buildEmpiricalCdfPoints([3, 1, 2], 256);
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ x: 1, y: 1 / 3 });
    expect(pts[2]).toEqual({ x: 3, y: 1 });
  });

  it("N>CAP 时下采样到 CAP", () => {
    const samples = Array.from({ length: 20 }, (_, i) => i);
    const pts = buildEmpiricalCdfPoints(samples, 5);
    expect(pts).toHaveLength(5);
  });

  it("阶梯 path 从 (xMin,0) 起笔", () => {
    const points = buildEmpiricalCdfPoints([1, 2], 256);
    const domain = resolveXDomain([1, 2]);
    const d = buildCdfStairPath(points, domain, {
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
    expect(d.startsWith("M ")).toBe(true);
    expect(d).toContain(" L ");
  });

  it("相对变化 (Cali-Init)/Init，Initial=0 不可计算", () => {
    expect(relativeChangePercent(10, 5)).toBe(-50);
    expect(relativeChangePercent(5, 311.5)).toBe(6130);
    expect(formatReductionLabel(relativeChangePercent(0, 1))).toBe("不可计算");
    expect(meanOf([1, 2, 3])).toBe(2);
  });

  it("徽章文案只显示幅度，不带正负号", () => {
    expect(formatReductionLabel(40)).toBe("40%");
    expect(formatReductionLabel(-6130)).toBe("6130%");
    expect(formatReductionLabel(44.44)).toBe("44%");
    expect(formatReductionLabel(50.55)).toBe("51%");
  });

  it("升高时箭头旋转 180°、虚线对齐 Initial 柱顶；降低时箭头朝下、虚线对齐 Calibrated 柱顶", () => {
    const up = meanChangeMarker(5, 311.5, 148, 40);
    expect(up.increased).toBe(true);
    expect(up.arrowRotationDeg).toBe(180);
    expect(up.guideTop).toBe(148);

    const down = meanChangeMarker(10, 5, 80, 120);
    expect(down.increased).toBe(false);
    expect(down.arrowRotationDeg).toBe(0);
    expect(down.guideTop).toBe(120);
  });

  it("气泡叠在 Calibrated 均值上方，不与 311.5 抢同一行", () => {
    const stacked = meanChangeStackTops(109, 26);
    expect(stacked.caliMeanTop).toBe(83);
    expect(stacked.badgeTop).toBe(83 - 47 - 4);
    expect(stacked.badgeTop + 47).toBeLessThanOrEqual(stacked.caliMeanTop);

    const cramped = meanChangeStackTops(56, 26);
    expect(cramped.caliMeanTop).toBe(30);
    expect(cramped.badgeTop).toBe(30 - 47 - 4);
    expect(cramped.badgeTop + 47).toBeLessThanOrEqual(cramped.caliMeanTop);
    expect(cramped.caliMeanTop).toBeLessThan(56);

    const barNearTop = meanChangeStackTops(20, 26);
    expect(barNearTop.caliMeanTop).toBe(4);
    expect(barNearTop.badgeTop).toBe(4 - 47 - 4);
    expect(barNearTop.caliMeanTop).toBeLessThan(20);
  });

  it("允许 Initial/Calibrated 不等长", () => {
    const a = buildEmpiricalCdfPoints([1, 2, 3, 4], 256);
    const b = buildEmpiricalCdfPoints([1, 2], 256);
    expect(a).toHaveLength(4);
    expect(b).toHaveLength(2);
  });

  it("KPI 哨兵 -1 不进入有效样本，全无效时不画图", () => {
    expect(validKpiSamples([1, -1, 3, -1])).toEqual([1, 3]);
    expect(validKpiSamples([-1, -1])).toEqual([]);
    expect(meanOf(validKpiSamples([1, -1, 3]))).toBe(2);
    expect(buildEmpiricalCdfPoints(validKpiSamples([3, -1, 1]), 256)).toEqual(
      buildEmpiricalCdfPoints([1, 3], 256),
    );
    const domain = resolveXDomain(validKpiSamples([5, -1, 9]));
    expect(domain.xMin).toBe(5);
    expect(domain.xMax).toBe(9);
    const equalDomain = resolveXDomain(validKpiSamples([-1, 5, 5]));
    expect(equalDomain.xMin).toBe(5);
    expect(equalDomain.xMax).toBeGreaterThan(5);
    expect(kpiHasChartData([-1, -1], null)).toBe(false);
    expect(kpiHasChartData([-1], [-1, -1])).toBe(false);
    expect(kpiHasChartData([1, -1], null)).toBe(true);
    expect(kpiHasChartData([-1], [2])).toBe(true);
  });

  it("CDF x 轴：MAX 小时保持 16 档居中；五位数减少档数且首左末右", () => {
    expect(cdfXTickCount(0.5, 689)).toBe(16);
    const narrow = buildCdfXAxis(0.5, 689);
    expect(narrow).toHaveLength(16);
    expect(narrow[0]?.align).toBe("center");
    expect(narrow.at(-1)?.align).toBe("center");
    expect(narrow.at(-1)?.text).toBe("689");

    expect(cdfXTickCount(3, 45796)).toBeLessThan(16);
    const wide = buildCdfXAxis(3, 45796);
    expect(wide[0]?.align).toBe("start");
    expect(wide.at(-1)?.align).toBe("end");
    expect(wide.at(-1)?.text).toBe("45796");
    const lastGap = wide.at(-1)!.x - wide.at(-2)!.x;
    const denseGap = (374 - 26) / 15;
    expect(lastGap).toBeGreaterThan(denseGap);
  });
});
