/**
 * Case4 误差、窗口、CDF/CEP 几何与吞吐窗口。
 * 几何用原值；标签格式化不参与柱高。
 */
import { describe, expect, it } from "vitest";
import {
  cdfGeometry,
  cdfXTicks,
  cepFromStatistics,
  cepGroupGeometry,
  errorAxisTicks,
  errorPlotYMax,
  errorPlotYMin,
  errorValueToSvgY,
  CASE4_ERROR_REPLAY_PLOT_H,
  CASE4_ERROR_REPLAY_POINT_R,
  errorWindow,
  errorWindowRange,
  errorWindowYMax,
  errorsFromTrajectory,
  isFinalResultReady,
  niceCeilThroughput,
  nlosPercentLabel,
  pointErrorM,
  throughputWindow,
  throughputYTicks,
} from "../../src/cases/case4/metrics/case4Metrics";
import { projectBusinessToImage } from "../../src/cases/case3-v2/mapProjectionV2";
import {
  CASE4_TEST_CONFIG,
  sampleBaseRoute,
  sampleResult,
  sampleStatistics,
  trajPoint,
  trajectorySnapshot,
  thrpSamples,
} from "./fixtures";

describe("pointErrorM", () => {
  it("用 XYZ 欧氏距离，2D 时 z=0 与平面距离相同", () => {
    expect(
      pointErrorM({ x: 3, y: 4, z: 0 }, { x: 0, y: 0, z: 0 }),
    ).toBeCloseTo(5);
    expect(
      pointErrorM({ x: 3, y: 4, z: 12 }, { x: 0, y: 0, z: 0 }),
    ).toBeCloseTo(13);
  });
});

describe("errorsFromTrajectory", () => {
  it("按 no 配对 base，缺 base 的点跳过", () => {
    const base = sampleBaseRoute(2);
    const first = base[0];
    expect(first).toBeTruthy();
    if (!first) return;
    const points = [
      trajPoint(1, first),
      trajPoint(9, { x: 99, y: 99, z: 0 }),
    ];
    const errors = errorsFromTrajectory(points, base);
    expect(errors.traditional).toHaveLength(1);
    expect(errors.dt[0]).toBeCloseTo(0.1);
  });
});

describe("errorWindow", () => {
  it("N=0 空窗；N<=20 左起真实 no；N>20 只留最近 20", () => {
    const base = sampleBaseRoute(30);
    expect(errorWindow([], base)).toEqual([]);
    const twenty = errorWindow(
      base.slice(0, 20).map((p) => trajPoint(p.no, p)),
      base,
    );
    expect(twenty).toHaveLength(20);
    expect(twenty[0]?.label).toBe("P1");
    expect(twenty[19]?.label).toBe("P20");
    const thirty = errorWindow(
      base.map((p) => trajPoint(p.no, p)),
      base,
    );
    expect(thirty).toHaveLength(20);
    expect(thirty[0]?.label).toBe("P11");
    expect(thirty[19]?.label).toBe("P30");
  });

  it("windowStart=0 时 N>20 显示 P1–P20", () => {
    const base = sampleBaseRoute(30);
    const points = base.map((p) => trajPoint(p.no, p));
    const win = errorWindow(points, base, 20, 0);
    expect(win).toHaveLength(20);
    expect(win[0]?.label).toBe("P1");
    expect(win[19]?.label).toBe("P20");
  });

  it("errorWindowRange：N≤20 不可滑，N=21 maxStart=1", () => {
    expect(errorWindowRange(20).maxStart).toBe(0);
    expect(errorWindowRange(21).maxStart).toBe(1);
    expect(errorWindowRange(21).defaultStart).toBe(1);
  });

  it("空窗与低于 5.5 的峰值都用 5.5；更高峰值不截顶", () => {
    expect(errorWindowYMax([])).toBe(5.5);
    expect(
      errorWindowYMax([
        { no: 1, label: "P1", traditional: 2, commercial: 1, dt: 0.4 },
      ]),
    ).toBe(5.5);
    expect(
      errorWindowYMax([
        { no: 1, label: "P1", traditional: 8.2, commercial: 1, dt: 0.4 },
      ]),
    ).toBe(8.2);
  });

  it("绘图 yMax 为峰值顶缘留白（圆点半径 5 + 1px）", () => {
    expect(errorPlotYMax(5.5)).toBe(5.8);
    expect(errorPlotYMax(100)).toBe(105.8);
    expect(errorPlotYMax(8.2)).toBe(8.7);
  });

  it("绘图 yMin 为 plotYMax 的 -1%；0 值 y 高于底缘圆点半径", () => {
    const yMax = errorPlotYMax(100);
    const yMin = errorPlotYMin(yMax);
    expect(yMin).toBe(-1.058);
    const y0 = errorValueToSvgY(0, yMin, yMax);
    const yPeak = errorValueToSvgY(yMax, yMin, yMax);
    expect(y0 + CASE4_ERROR_REPLAY_POINT_R).toBeLessThanOrEqual(
      CASE4_ERROR_REPLAY_PLOT_H,
    );
    expect(yPeak - CASE4_ERROR_REPLAY_POINT_R).toBeGreaterThanOrEqual(0);
  });

  it("Y 轴六刻度对齐 Pencil 5.5…0；峰值抬轴后按比例一位小数", () => {
    expect(errorAxisTicks(5.5)).toEqual([5.5, 4.5, 3.5, 2.5, 1.5, 0]);
    expect(errorAxisTicks(11)).toEqual([11, 9, 7, 5, 3, 0]);
    expect(errorAxisTicks(8.2)).toEqual([8.2, 6.7, 5.2, 3.7, 2.2, 0]);
    expect(errorAxisTicks(errorPlotYMax(100))).toEqual([
      105.8, 86.6, 67.3, 48.1, 28.9, 0,
    ]);
  });
});

describe("projectBusinessToImage case4 标定", () => {
  it("x/y 交换且使用 916/608，不出现 905", () => {
    const cfg = {
      v2MapOriginX: CASE4_TEST_CONFIG.mapOriginX,
      v2MapOriginY: CASE4_TEST_CONFIG.mapOriginY,
      v2MapUnitsPerPx: CASE4_TEST_CONFIG.mapUnitsPerPx,
    };
    const p = projectBusinessToImage(1, 15, cfg);
    expect(p.imageX).toBeCloseTo(916 + 15 / 0.11);
    expect(p.imageY).toBeCloseTo(608 + 1 / 0.11);
    expect(JSON.stringify(p)).not.toContain("905");
  });
});

describe("cdfGeometry", () => {
  it("三线共用 0～max 横轴，不补 0/1，末概率 0.9 不拉到 1", () => {
    const stats = sampleStatistics();
    const geom = cdfGeometry(stats.cdf)!;
    expect(geom.xMin).toBe(0);
    expect(geom.xMax).toBeCloseTo(0.8);
    const dt = geom.series.find((s) => s.scheme === "dt")!;
    expect(dt.d.startsWith("M ")).toBe(true);
    expect(dt.d).not.toMatch(/ 0(\.0+)?$/);
    expect(dt.d.includes("0,136") || dt.d.endsWith(" 136")).toBe(false);
    const lastY = Number(dt.d.trim().split(" ").at(-1));
    expect(lastY).toBeCloseTo(136 - 0.9 * 136);
  });

  it("单点只下笔一次", () => {
    const geom = cdfGeometry({
      traditional: [{ errorM: 1, probability: 0.5 }],
      commercial: [],
      dt: [],
    })!;
    expect(geom.series[0]?.d.split("L").length).toBe(1);
  });
});

describe("cdfXTicks", () => {
  it("0～max 10 档等分含两端", () => {
    const ticks = cdfXTicks(0.8);
    expect(ticks).toHaveLength(10);
    expect(ticks[0]).toBe(0);
    expect(ticks.at(-1)).toBeCloseTo(0.8);
    expect(ticks[1]).toBeCloseTo(0.8 / 9);
  });
});

describe("cepGroupGeometry", () => {
  it("组内按原值比例；改 p90 不影响 p50 组 yMax", () => {
    const stats = sampleStatistics();
    const p50 = cepGroupGeometry(cepFromStatistics(stats.cep, "p50M"));
    const p90 = cepGroupGeometry(cepFromStatistics(stats.cep, "p90M"));
    expect(p50.yMax).toBeCloseTo(0.4);
    expect(p90.yMax).toBeCloseTo(0.9);
    const dt50 = p50.bars.find((b) => b.scheme === "dt")!;
    expect(dt50.heightRatio).toBeCloseTo(0.1 / 0.4);
    const mutated = {
      ...stats.cep,
      traditional: { ...stats.cep.traditional, p90M: 2 },
    };
    const p50b = cepGroupGeometry(cepFromStatistics(mutated, "p50M"));
    const p90b = cepGroupGeometry(cepFromStatistics(mutated, "p90M"));
    expect(p50b.yMax).toBe(p50.yMax);
    expect(p90b.yMax).toBeCloseTo(2);
  });
});

describe("nlosPercentLabel", () => {
  it("0 显示 0.0，0.897 显示 89.7，null 为 --", () => {
    expect(nlosPercentLabel(0)).toBe("0.0");
    expect(nlosPercentLabel(0.897)).toBe("89.7");
    expect(nlosPercentLabel(null)).toBe("--");
  });
});

describe("niceCeilThroughput", () => {
  it("峰值≤10 锁 10；刚过 10 抬到 12 而不是 20", () => {
    expect(niceCeilThroughput(0)).toBe(10);
    expect(niceCeilThroughput(8)).toBe(10);
    expect(niceCeilThroughput(9.5)).toBe(10);
    expect(niceCeilThroughput(10)).toBe(10);
    expect(niceCeilThroughput(10.5)).toBe(12);
    expect(niceCeilThroughput(11)).toBe(15);
    expect(niceCeilThroughput(18)).toBe(20);
  });
});

describe("throughputYTicks", () => {
  it("空闲 10…0；12 为整数 12…0；20 为隔 2", () => {
    expect(throughputYTicks(10)).toEqual([
      10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
    ]);
    expect(throughputYTicks(12)).toEqual([
      12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
    ]);
    expect(throughputYTicks(20)).toEqual([
      20, 18, 16, 14, 12, 10, 8, 6, 4, 2, 0,
    ]);
  });
});

describe("throughputWindow", () => {
  it("不等长不补 0；N≤20 横轴仍 1–20；>20 只切显示窗口", () => {
    const without = thrpSamples(3);
    const withDt = thrpSamples(5);
    const win = throughputWindow(without, withDt);
    expect(win.without.map((s) => s.no)).toEqual([1, 2, 3]);
    expect(win.with.map((s) => s.no)).toEqual([1, 2, 3, 4, 5]);
    expect(win.windowStart).toBe(1);
    expect(win.windowEnd).toBe(20);
    expect(win.yMax).toBe(10);
    expect(win.without.some((s) => s.gbps === 0 && s.no === 4)).toBe(false);

    const empty = throughputWindow([], []);
    expect(empty.without).toEqual([]);
    expect(empty.with).toEqual([]);
    expect(empty.windowEnd).toBe(20);
    expect(empty.yMax).toBe(10);

    const long = thrpSamples(25);
    const cut = throughputWindow(long, []);
    expect(cut.windowStart).toBe(6);
    expect(cut.windowEnd).toBe(25);
    expect(cut.without[0]?.no).toBe(6);
    expect(cut.yMax).toBe(12);
  });
});

describe("isFinalResultReady", () => {
  it("轨迹空或 pending 不通过；完整快照通过", () => {
    const ready = sampleResult(2);
    expect(isFinalResultReady(ready).ok).toBe(true);
    expect(
      isFinalResultReady({
        ...ready,
        trajectory: trajectorySnapshot(ready.trajectory.points, true),
      }).ok,
    ).toBe(false);
    expect(
      isFinalResultReady({
        ...ready,
        trajectory: trajectorySnapshot([]),
      }).ok,
    ).toBe(false);
  });
});
