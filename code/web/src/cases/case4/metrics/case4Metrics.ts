/**
 * Case4 纯函数：误差、20 窗、CDF/CEP 几何、吞吐窗口、最终门槛。
 * 不做 IO、不读 env、不从逐点误差重算 CDF/CEP/NLOS。
 * 格式化只用于标签；几何用原值。
 */

import type {
  BasePoint,
  CdfPoint,
  CepPoint,
  Scheme,
  Statistics,
  ThroughputSample,
  ThroughputSnapshot,
  TrajectoryPoint,
  TrajectorySnapshot,
  XYZ,
} from "../types";
import { SCHEMES } from "../types";
import { CASE4_POINT_WINDOW } from "../config/case4RuntimeConfig";

const EPS = 1e-9;

/** XYZ 三维欧氏距离；2D 仅指地图投影，误差计算仍保留 Z 分量。 */
export function pointErrorM(measured: XYZ, base: XYZ): number {
  return Math.hypot(
    measured.x - base.x,
    measured.y - base.y,
    measured.z - base.z,
  );
}

export type SchemeErrors = Record<Scheme, number[]>;

/**
 * 用本页 init-data.baseRoute 配对逐点误差。
 * 缺 base 的点跳过该下标，不造点。
 */
export function errorsFromTrajectory(
  points: TrajectoryPoint[],
  baseRoute: BasePoint[],
): SchemeErrors {
  const byNo = new Map(baseRoute.map((p) => [p.no, p]));
  const out: SchemeErrors = {
    traditional: [],
    commercial: [],
    dt: [],
  };
  for (const p of points) {
    const base = byNo.get(p.no);
    if (!base) continue;
    for (const scheme of SCHEMES) {
      out[scheme].push(pointErrorM(p[scheme], base));
    }
  }
  return out;
}

export type ErrorWindowPoint = {
  no: number;
  label: string;
  traditional: number | null;
  commercial: number | null;
  dt: number | null;
};

/** 误差回溯可滑动范围：N≤窗口不可滑；超出后默认最新 20 点。 */
export function errorWindowRange(
  completeCount: number,
  windowSize = CASE4_POINT_WINDOW,
): { maxStart: number; defaultStart: number } {
  const size = Math.max(1, Math.floor(windowSize));
  const done = Math.max(0, Math.floor(completeCount));
  const maxStart = Math.max(0, done - size);
  return {
    maxStart,
    defaultStart: done <= size ? 0 : maxStart,
  };
}

/** 全部完整点的误差行，不截窗。 */
export function errorWindowRows(
  points: TrajectoryPoint[],
  baseRoute: BasePoint[],
): ErrorWindowPoint[] {
  const byNo = new Map(baseRoute.map((p) => [p.no, p]));
  const rows: ErrorWindowPoint[] = [];
  for (const p of points) {
    const base = byNo.get(p.no);
    if (!base) continue;
    rows.push({
      no: p.no,
      label: `P${p.no}`,
      traditional: pointErrorM(p.traditional, base),
      commercial: pointErrorM(p.commercial, base),
      dt: pointErrorM(p.dt, base),
    });
  }
  return rows;
}

/**
 * 最近 20 个完整点；N≤20 左起填、右侧空槽。
 * windowStart 可把窗口拖回更早点；缺省跟最新。
 */
export function errorWindow(
  points: TrajectoryPoint[],
  baseRoute: BasePoint[],
  windowSize = CASE4_POINT_WINDOW,
  windowStart?: number,
): ErrorWindowPoint[] {
  const rows = errorWindowRows(points, baseRoute);
  const size = Math.max(1, Math.floor(windowSize));
  const { maxStart, defaultStart } = errorWindowRange(rows.length, size);
  const start =
    windowStart == null
      ? defaultStart
      : Math.max(0, Math.min(maxStart, Math.floor(windowStart)));
  return rows.slice(start, start + size);
}

export const CASE4_ERROR_AXIS_FLOOR_M = 5.5;
const ERROR_AXIS_TICK_STEPS = [5.5, 4.5, 3.5, 2.5, 1.5, 0];

/** 与 ErrorReplay `PLOT_H` / `POINT_R` 一致，用于顶缘留白换算。 */
export const CASE4_ERROR_REPLAY_PLOT_H = 110;
export const CASE4_ERROR_REPLAY_POINT_R = 5;
/** 圆点外缘与 SVG 顶边之间至少 1px（viewBox 坐标）。 */
export const CASE4_ERROR_REPLAY_TOP_GAP_PX = 1;
/** 纵轴下限为 0 时，绘图区在数值轴下再留 1% 虚拟余量（与顶缘留白配套）。 */
export const CASE4_ERROR_REPLAY_BOTTOM_MARGIN_RATIO = 0.01;

export function errorWindowYMax(window: ErrorWindowPoint[]): number {
  let max = 0;
  for (const row of window) {
    for (const scheme of SCHEMES) {
      const v = row[scheme];
      if (typeof v === "number" && Number.isFinite(v)) {
        max = Math.max(max, v);
      }
    }
  }
  return Math.max(CASE4_ERROR_AXIS_FLOOR_M, max);
}

/**
 * 绘图用纵轴上限：在数据峰值之上为顶缘圆点（r=5）+ 1px 留空。
 * 例：峰值 100 m → 约 105.8 m（非固定 +1 m，避免大数值仍贴边被裁）。
 */
export function errorPlotYMax(dataYMax: number): number {
  if (!Number.isFinite(dataYMax) || dataYMax <= 0) {
    return CASE4_ERROR_AXIS_FLOOR_M;
  }
  const pad = CASE4_ERROR_REPLAY_POINT_R + CASE4_ERROR_REPLAY_TOP_GAP_PX;
  const h = CASE4_ERROR_REPLAY_PLOT_H;
  const lifted = (dataYMax * h) / (h - pad);
  return Math.round(Math.max(dataYMax, lifted) * 10) / 10;
}

/** 有数据点时：0 以下留 plotYMax 的 1%，避免 0 值圆点贴底被裁。 */
export function errorPlotYMin(plotYMax: number): number {
  if (!Number.isFinite(plotYMax) || plotYMax <= 0) return 0;
  return -plotYMax * CASE4_ERROR_REPLAY_BOTTOM_MARGIN_RATIO;
}

export function errorPlotBandPx(): { top: number; bottom: number } {
  const pointPad =
    CASE4_ERROR_REPLAY_POINT_R + CASE4_ERROR_REPLAY_TOP_GAP_PX;
  const bottom = Math.max(
    pointPad,
    CASE4_ERROR_REPLAY_PLOT_H * CASE4_ERROR_REPLAY_BOTTOM_MARGIN_RATIO,
  );
  return { top: pointPad, bottom };
}

/** 将误差（米）映射到 ErrorReplay SVG 的 y（viewBox 坐标）。 */
export function errorValueToSvgY(
  valueM: number,
  plotYMin: number,
  plotYMax: number,
): number {
  const { top, bottom } = errorPlotBandPx();
  const h = CASE4_ERROR_REPLAY_PLOT_H;
  const innerH = h - top - bottom;
  const span = plotYMax - plotYMin;
  const t = span > 0 ? (valueM - plotYMin) / span : 0;
  return h - bottom - t * innerH;
}

/** Pencil VdJMI：5.5、4.5、3.5、2.5、1.5、0；yMax>5.5 时同比拉伸，结果锁 1 位小数。 */
export function errorAxisTicks(yMax: number): number[] {
  const scale = yMax / CASE4_ERROR_AXIS_FLOOR_M;
  return ERROR_AXIS_TICK_STEPS.map((tick) => {
    if (tick === 0) return 0;
    return Math.round(tick * scale * 10) / 10;
  });
}

export function formatErrorAxisTick(value: number): string {
  if (value === 0) return "0";
  return formatFixed(value, 1);
}

export type CdfSeriesGeom = {
  scheme: Scheme;
  d: string;
};

export type CdfGeometry = {
  xMin: number;
  xMax: number;
  series: CdfSeriesGeom[];
};

function padPositiveMax(x: number): number {
  if (Number.isFinite(x) && x > 0) return x;
  return Math.max(1e-6, Math.abs(x) * 0.05);
}

/**
 * 三方案共用横轴 0～max(errorM)；从第一个真实点下笔，先水平再垂直。
 * 不补 (0,0) 或拉到 (xMax,1)。
 */
export function cdfGeometry(
  cdf: Record<Scheme, CdfPoint[]>,
  plotW = 280,
  plotH = 136,
): CdfGeometry | null {
  const all: CdfPoint[] = [];
  for (const scheme of SCHEMES) {
    all.push(...(cdf[scheme] ?? []));
  }
  if (all.length === 0) return null;
  let xMax = -Infinity;
  for (const p of all) {
    if (!Number.isFinite(p.errorM)) continue;
    xMax = Math.max(xMax, p.errorM);
  }
  if (!Number.isFinite(xMax)) return null;
  xMax = padPositiveMax(xMax);
  const xMin = 0;
  const xOf = (errorM: number) => (Math.max(0, errorM) / xMax) * plotW;
  const yOf = (prob: number) => plotH - Math.min(1, Math.max(0, prob)) * plotH;

  const series: CdfSeriesGeom[] = SCHEMES.map((scheme) => {
    const pts = cdf[scheme] ?? [];
    if (pts.length === 0) return { scheme, d: "" };
    const first = pts[0];
    if (!first) return { scheme, d: "" };
    let d = `M ${xOf(first.errorM)} ${yOf(first.probability)}`;
    for (let i = 1; i < pts.length; i += 1) {
      const prev = pts[i - 1];
      const cur = pts[i];
      if (!prev || !cur) continue;
      d += ` L ${xOf(cur.errorM)} ${yOf(prev.probability)} L ${xOf(cur.errorM)} ${yOf(cur.probability)}`;
    }
    return { scheme, d };
  });
  return { xMin, xMax, series };
}

export const CASE4_CDF_X_TICK_COUNT = 10;

/** 完成态 X：0～xMax 等分，含两端。 */
export function cdfXTicks(
  xMax: number,
  count = CASE4_CDF_X_TICK_COUNT,
): number[] {
  if (!(Number.isFinite(xMax) && xMax > 0)) return [];
  const n = Math.max(2, count);
  return Array.from({ length: n }, (_, i) => (xMax * i) / (n - 1));
}

/**
 * 阶梯 CDF 分位：第一条 probability ≥ P 的 errorM。
 * 不插值、不从轨迹重算。
 */
export function cdfQuantileErrorM(
  points: ReadonlyArray<CdfPoint>,
  probability: number,
): number | null {
  if (!(Number.isFinite(probability) && points.length > 0)) return null;
  const p = Math.min(1, Math.max(0, probability));
  for (const pt of points) {
    if (
      Number.isFinite(pt.probability) &&
      Number.isFinite(pt.errorM) &&
      pt.probability >= p
    ) {
      return pt.errorM;
    }
  }
  return null;
}

export type CepBar = {
  scheme: Scheme;
  value: number;
  heightRatio: number;
};

export type CepGroupGeom = {
  yMax: number;
  bars: CepBar[];
};

/** 组内三方案共用 yMax；柱高用原值。 */
export function cepGroupGeometry(
  values: Record<Scheme, number>,
): CepGroupGeom {
  const nums = SCHEMES.map((s) => values[s]).filter((v) => Number.isFinite(v));
  const yMax = Math.max(...nums, EPS);
  return {
    yMax,
    bars: SCHEMES.map((scheme) => ({
      scheme,
      value: values[scheme],
      heightRatio: Number.isFinite(values[scheme])
        ? Math.max(0, values[scheme] / yMax)
        : 0,
    })),
  };
}

export function cepFromStatistics(
  cep: Record<Scheme, CepPoint>,
  kind: "p50M" | "p90M",
): Record<Scheme, number> {
  return {
    traditional: cep.traditional[kind],
    commercial: cep.commercial[kind],
    dt: cep.dt[kind],
  };
}

export type CepImprovement = {
  direction: "down" | "up";
  label: string;
};

/**
 * DT 相对传统基站的 CEP 变化百分比。
 * 用原值计算；传统为 0 或两者相等时不展示。标签一位小数，不含箭头字符。
 */
export function cepImprovement(
  traditional: number,
  dt: number,
): CepImprovement | null {
  if (!Number.isFinite(traditional) || !Number.isFinite(dt)) return null;
  if (traditional === 0 || traditional === dt) return null;
  const raw = ((traditional - dt) / traditional) * 100;
  const direction: CepImprovement["direction"] = raw > 0 ? "down" : "up";
  return {
    direction,
    label: `${Math.abs(raw).toFixed(1)}%`,
  };
}

export type ThroughputWindow = {
  windowStart: number;
  windowEnd: number;
  yMax: number;
  without: ThroughputSample[];
  with: ThroughputSample[];
};

export const CASE4_THRP_Y_IDLE = 10;

/** 1–2–5 太粗：刚过 10 会直接跳到 20。空闲锁 10，溢出走更细 nice。 */
const THRP_NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const;

export function niceCeilThroughput(
  max: number,
  emptyDefault = CASE4_THRP_Y_IDLE,
): number {
  if (!(Number.isFinite(max) && max > 0)) return emptyDefault;
  if (max <= emptyDefault) return emptyDefault;
  const padded = max * 1.1;
  const mag = 10 ** Math.floor(Math.log10(padded));
  const norm = padded / mag;
  let nice: (typeof THRP_NICE_STEPS)[number] = 10;
  for (const step of THRP_NICE_STEPS) {
    if (norm <= step) {
      nice = step;
      break;
    }
  }
  return Math.max(emptyDefault, nice * mag);
}

/**
 * Y1：未过空闲档 → 10…0。
 * Y2：抬轴后整数等分（12 → 12…0；20 → 20,18…0）。
 */
export function throughputYTicks(yMax: number): number[] {
  if (!(Number.isFinite(yMax)) || yMax <= CASE4_THRP_Y_IDLE) {
    return Array.from(
      { length: CASE4_THRP_Y_IDLE + 1 },
      (_, i) => CASE4_THRP_Y_IDLE - i,
    );
  }
  const integerTop = Number.isInteger(yMax);
  const step =
    integerTop && yMax > 15 && yMax % 10 === 0
      ? yMax / 10
      : integerTop
        ? 1
        : yMax / 10;
  const n = Math.round(yMax / step);
  const ticks: number[] = [];
  for (let i = n; i >= 0; i -= 1) {
    const v = i * step;
    ticks.push(v === 0 ? 0 : v);
  }
  return ticks;
}

/**
 * 两路全量保留，不等长不补 0。
 * N≤windowSize：横轴固定 1..windowSize，新点靠右追加、不拉伸。
 * N>windowSize：滑最近 windowSize。
 */
export function throughputWindow(
  without: ThroughputSample[],
  withSamples: ThroughputSample[],
  windowSize = CASE4_POINT_WINDOW,
): ThroughputWindow {
  const lastWithout = without.at(-1)?.no ?? 0;
  const lastWith = withSamples.at(-1)?.no ?? 0;
  const maxNo = Math.max(lastWithout, lastWith);
  if (maxNo < 1) {
    return {
      windowStart: 1,
      windowEnd: windowSize,
      yMax: 10,
      without: [],
      with: [],
    };
  }
  const windowStart = Math.max(1, maxNo - (windowSize - 1));
  const windowEnd = maxNo <= windowSize ? windowSize : maxNo;
  const inWin = (s: ThroughputSample) =>
    s.no >= windowStart && s.no <= windowEnd;
  const wOut = without.filter(inWin);
  const wWith = withSamples.filter(inWin);
  let dataMax = 0;
  for (const s of [...wOut, ...wWith]) {
    if (Number.isFinite(s.gbps)) dataMax = Math.max(dataMax, s.gbps);
  }
  return {
    windowStart,
    windowEnd,
    yMax: niceCeilThroughput(dataMax),
    without: wOut,
    with: wWith,
  };
}

export type ResultGateFail = {
  ok: false;
  reason: string;
};

export type ResultGateOk = {
  ok: true;
};

/**
 * Web 本地最终门槛，与 Node 成功叠加。
 */
export function isFinalResultReady(args: {
  trajectory: TrajectorySnapshot;
  throughput: { without: ThroughputSnapshot; with: ThroughputSnapshot };
  statistics: Statistics;
}): ResultGateOk | ResultGateFail {
  const { trajectory, throughput, statistics } = args;
  if (trajectory.pendingTail) {
    return { ok: false, reason: "trajectory.pendingTail" };
  }
  if (!(trajectory.completeCount === trajectory.points.length && trajectory.points.length > 0)) {
    return { ok: false, reason: "trajectory.empty-or-mismatch" };
  }
  for (const p of trajectory.points) {
    for (const scheme of SCHEMES) {
      const xyz = p[scheme];
      if (
        !Number.isFinite(xyz.x) ||
        !Number.isFinite(xyz.y) ||
        !Number.isFinite(xyz.z)
      ) {
        return { ok: false, reason: `point.${p.no}.${scheme}` };
      }
    }
  }
  if (throughput.without.pendingTail || throughput.with.pendingTail) {
    return { ok: false, reason: "throughput.pendingTail" };
  }
  for (const scheme of SCHEMES) {
    const cdf = statistics.cdf[scheme];
    if (!Array.isArray(cdf) || cdf.length < 1) {
      return { ok: false, reason: `cdf.${scheme}` };
    }
    const cep = statistics.cep[scheme];
    if (!Number.isFinite(cep.p50M) || !Number.isFinite(cep.p90M)) {
      return { ok: false, reason: `cep.${scheme}` };
    }
  }
  if (!Number.isFinite(statistics.nlosRatio)) {
    return { ok: false, reason: "nlosRatio" };
  }
  return { ok: true };
}

export function formatFixed(value: number, digits: number): string {
  if (!Number.isFinite(value)) return "--";
  return value.toFixed(digits);
}

export function nlosPercentLabel(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return "--";
  return (ratio * 100).toFixed(1);
}
