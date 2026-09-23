/**
 * Case4 误差、窗口、CDF/CEP 几何与吞吐窗口。
 * 几何用原值；标签格式化不参与柱高。
 */
import { describe, expect, it } from "vitest";
import {
  cdfGeometry,
  cdfQuantileErrorM,
  cdfXTicks,
  cepAxisTop,
  cepFromStatistics,
  cepGroupGeometry,
  cepImprovement,
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

describe("cdfQuantileErrorM", () => {
  it("取第一条 probability ≥ P 的误差，不插值", () => {
    const stats = sampleStatistics();
    expect(cdfQuantileErrorM(stats.cdf.traditional, 0.4)).toBe(0.2);
    expect(cdfQuantileErrorM(stats.cdf.traditional, 0.5)).toBe(0.8);
    expect(cdfQuantileErrorM(stats.cdf.dt, 0.5)).toBe(0.05);
    expect(cdfQuantileErrorM(stats.cdf.commercial, 0.9)).toBe(0.6);
    expect(cdfQuantileErrorM(stats.cdf.dt, 1)).toBeNull();
    expect(cdfQuantileErrorM([], 0.5)).toBeNull();
  });
});

describe("cepGroupGeometry", () => {
  it("组内按原值比例；改 p90 不影响 p50 组 yMax", () => {
    const stats = sampleStatistics();
    const p50 = cepGroupGeometry(cepFromStatistics(stats.cep, "p50M"));
    const p90 = cepGroupGeometry(cepFromStatistics(stats.cep, "p90M"));
    expect(p50.yMax).toBe(0.8);
    expect(p90.yMax).toBe(1.2);
    const dt50 = p50.bars.find((b) => b.scheme === "dt")!;
    expect(dt50.heightRatio).toBeCloseTo(0.1 / 0.8);
    const mutated = {
      ...stats.cep,
      traditional: { ...stats.cep.traditional, p90M: 2 },
    };
    const p50b = cepGroupGeometry(cepFromStatistics(mutated, "p50M"));
    const p90b = cepGroupGeometry(cepFromStatistics(mutated, "p90M"));
    expect(p50b.yMax).toBe(p50.yMax);
    expect(p90b.yMax).toBe(2.4);
  });

  it("yMax = 峰值×1.2 向上取 0.4 倍数，最高柱不顶满", () => {
    expect(cepAxisTop(3)).toBe(3.6);
    expect(cepAxisTop(3.2)).toBe(4);
    expect(cepAxisTop(5)).toBe(6);
    expect(cepAxisTop(0)).toBe(0.4);
    const geom = cepGroupGeometry({ traditional: 3, commercial: 2, dt: 1 });
    const peak = Math.max(...geom.bars.map((b) => b.heightRatio));
    expect(peak).toBeLessThanOrEqual(1 / 1.2 + 1e-9);
  });
});

describe("cepImprovement", () => {
  it("传统10、DT2 为下降 80.0%；9.5 为 5.0%；15 为上升 50.0%", () => {
    expect(cepImprovement(10, 2)).toEqual({
      direction: "down",
      label: "80.0%",
    });
    expect(cepImprovement(10, 9.5)).toEqual({
      direction: "down",
      label: "5.0%",
    });
    expect(cepImprovement(10, 15)).toEqual({
      direction: "up",
      label: "50.0%",
    });
  });

  it("传统为 0 或两者原值相等时隐藏，不显示 0% 或 —", () => {
    expect(cepImprovement(0, 5)).toBeNull();
    expect(cepImprovement(10, 10)).toBeNull();
    expect(cepImprovement(Number.NaN, 2)).toBeNull();
  });

  it("可见性按原值，舍入成 0.0% 仍显示", () => {
    expect(cepImprovement(10, 9.999)).toEqual({
      direction: "down",
      label: "0.0%",
    });
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
  it("空 / 常态峰值锁 3.2；超 85% 阶梯抬轴并对齐", () => {
    expect(niceCeilThroughput(0)).toBe(3.2);
    expect(niceCeilThroughput(2.5)).toBe(3.2);
    expect(niceCeilThroughput(2.8)).toBe(4);
    expect(niceCeilThroughput(8.4)).toBe(11.2);
    expect(niceCeilThroughput(19)).toBe(24.8);
  });
});

describe("throughputYTicks", () => {
  it("空闲 3.2…0；抬轴后固定 8 格", () => {
    expect(throughputYTicks(3.2)).toEqual([
      3.2, 2.8, 2.4, 2.0, 1.6, 1.2, 0.8, 0.4, 0,
    ]);
    expect(throughputYTicks(4)).toEqual([
      4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5, 0,
    ]);
    expect(throughputYTicks(24.8)).toEqual([
      24.8, 21.7, 18.6, 15.5, 12.4, 9.3, 6.2, 3.1, 0,
    ]);
  });
});

describe("throughputWindow", () => {
  it("不等长不补 0；X 域为路线与样点并集；不滑窗裁切", () => {
    const route = Array.from({ length: 20 }, (_, i) => i + 1);
    const without = thrpSamples(3);
    const withDt = thrpSamples(5);
    const win = throughputWindow(without, withDt, route);
    expect(win.without.map((s) => s.no)).toEqual([1, 2, 3]);
    expect(win.with.map((s) => s.no)).toEqual([1, 2, 3, 4, 5]);
    expect(win.windowStart).toBe(1);
    expect(win.windowEnd).toBe(20);
    expect(win.yMax).toBe(11.2);
    expect(win.without.some((s) => s.gbps === 0 && s.no === 4)).toBe(false);

    const empty = throughputWindow([], [], route);
    expect(empty.without).toEqual([]);
    expect(empty.with).toEqual([]);
    expect(empty.windowEnd).toBe(20);
    expect(empty.yMax).toBe(3.2);

    const long = thrpSamples(25);
    const wide = throughputWindow(long, [], route);
    expect(wide.windowStart).toBe(1);
    expect(wide.windowEnd).toBe(25);
    expect(wide.without[0]?.no).toBe(1);
    expect(wide.without).toHaveLength(25);
    expect(wide.yMax).toBe(13.6);
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
