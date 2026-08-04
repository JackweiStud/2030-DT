import { describe, expect, it } from "vitest";
import {
  buildCdfStairPath,
  buildEmpiricalCdfPoints,
  formatReductionLabel,
  meanOf,
  reductionPercent,
  resolveXDomain,
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

  it("降幅按样本计算，Initial=0 不可计算", () => {
    expect(reductionPercent(10, 5)).toBe(50);
    expect(formatReductionLabel(reductionPercent(0, 1))).toBe("不可计算");
    expect(meanOf([1, 2, 3])).toBe(2);
  });

  it("降幅与均值文案四舍五入为整数，不保留小数", () => {
    expect(formatReductionLabel(40)).toBe("40%");
    expect(formatReductionLabel(50)).toBe("50%");
    expect(formatReductionLabel(44.44)).toBe("44%");
    expect(formatReductionLabel(50.55)).toBe("51%");
  });

  it("允许 Initial/Calibrated 不等长", () => {
    const a = buildEmpiricalCdfPoints([1, 2, 3, 4], 256);
    const b = buildEmpiricalCdfPoints([1, 2], 256);
    expect(a).toHaveLength(4);
    expect(b).toHaveLength(2);
  });
});
