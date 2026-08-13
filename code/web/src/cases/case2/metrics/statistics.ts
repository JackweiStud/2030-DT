/**
 * KPI 派生：经验 CDF、均值、降幅、柱/阶梯几何。
 * 不读热力矩阵；不写死 N=20 / 51 点 / 50% 降幅。
 */

export type CdfPoint = { x: number; y: number };

/** 算术平均；调用方保证 N≥1。 */
export function meanOf(samples: number[]): number {
  let sum = 0;
  for (const v of samples) sum += v;
  return sum / samples.length;
}

/**
 * 完整经验台阶；仅当 N > cap 时均匀取 cap 个端点。
 * 保留重复 x 的概率跃迁（可选合并策略不在此强制）。
 */
export function buildEmpiricalCdfPoints(
  samples: number[],
  cdfPointCap: number,
): CdfPoint[] {
  const N = samples.length;
  if (N < 1) throw new Error("KPI samples must be non-empty");
  const sorted = [...samples].sort((a, b) => a - b);

  if (N <= cdfPointCap) {
    const points: CdfPoint[] = [];
    for (let k = 1; k <= N; k += 1) {
      points.push({ x: sorted[k - 1]!, y: k / N });
    }
    return points;
  }

  const points: CdfPoint[] = [];
  for (let i = 0; i < cdfPointCap; i += 1) {
    const t = i / (cdfPointCap - 1);
    const idx = Math.floor(t * (N - 1));
    points.push({ x: sorted[idx]!, y: (idx + 1) / N });
  }
  return points;
}

export type XDomain = { xMin: number; xMax: number };

/** 样本联合 x 域；min=max 时两侧扩 pad。 */
export function resolveXDomain(values: number[]): XDomain {
  let xMinRaw = Infinity;
  let xMaxRaw = -Infinity;
  for (const v of values) {
    if (v < xMinRaw) xMinRaw = v;
    if (v > xMaxRaw) xMaxRaw = v;
  }
  if (xMinRaw === xMaxRaw) {
    const pad = Math.max(1, Math.abs(xMinRaw) * 0.05);
    return { xMin: xMinRaw - pad, xMax: xMaxRaw + pad };
  }
  return { xMin: xMinRaw, xMax: xMaxRaw };
}

/** 与 CdfChart viewBox 绘图区对齐：x=26～374。 */
export const CDF_X_AXIS = Object.freeze({
  left: 26,
  right: 374,
  width: 348,
  maxTicks: 16,
  minTicks: 5,
});

export function formatCdfXTick(value: number): string {
  if (Math.abs(value) >= 10 || Number.isInteger(value)) {
    return String(Math.round(value));
  }
  return (Math.round(value * 10) / 10).toFixed(1);
}

/**
 * MAX 小时（标签 ≤3 字符）保持 16 档；MAX 大到四～五位时减少档数，避免末两档重叠。
 */
export function cdfXTickCount(xMin: number, xMax: number): number {
  const samples = [xMin, xMax, (xMin + xMax) / 2];
  const chars = Math.max(1, ...samples.map((value) => formatCdfXTick(value).length));
  if (chars <= 3) return CDF_X_AXIS.maxTicks;
  const minStep = chars * 6 + 10;
  const fitted = Math.floor(CDF_X_AXIS.width / minStep) + 1;
  return Math.max(CDF_X_AXIS.minTicks, Math.min(CDF_X_AXIS.maxTicks, fitted));
}

export type CdfXTick = {
  x: number;
  text: string;
  align: "start" | "center" | "end";
};

/** 刻度与竖网格共用同一组 x。小 MAX 全居中（与静态 16 档一致）；大 MAX 减少档数后首左末右，避免贴边裁切。 */
export function buildCdfXAxis(xMin: number, xMax: number): CdfXTick[] {
  const count = cdfXTickCount(xMin, xMax);
  const { left, width, maxTicks } = CDF_X_AXIS;
  const edgeAlign = count < maxTicks;
  const ticks: CdfXTick[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1);
    const value = xMin + (xMax - xMin) * t;
    const align = edgeAlign
      ? i === 0
        ? "start"
        : i === count - 1
          ? "end"
          : "center"
      : "center";
    ticks.push({
      x: left + t * width,
      text: formatCdfXTick(value),
      align,
    });
  }
  return ticks;
}

/**
 * 阶梯 path：从 (xMin,0) 起笔，逐点先水平后垂直，最后延伸到 (xMax,1)。
 */
export function buildCdfStairPath(
  points: CdfPoint[],
  domain: XDomain,
  plot: { left: number; top: number; width: number; height: number },
): string {
  const { xMin, xMax } = domain;
  const sx = (x: number) =>
    plot.left + ((x - xMin) / (xMax - xMin)) * plot.width;
  const sy = (y: number) => plot.top + (1 - y) * plot.height;

  let d = `M ${sx(xMin)} ${sy(0)}`;
  let currentY = 0;
  for (const p of points) {
    d += ` L ${sx(p.x)} ${sy(currentY)}`;
    d += ` L ${sx(p.x)} ${sy(p.y)}`;
    currentY = p.y;
  }
  d += ` L ${sx(xMax)} ${sy(1)}`;
  return d;
}

export type BarLayout = {
  yMin: number;
  yMax: number;
  zeroY: number;
  barTop: number;
  barHeight: number;
};

/** 柱图定域：参与显示的 mean 与 0；全 0 时用 ±1 防御。 */
export function layoutMeanBar(
  mean: number,
  peerMeans: number[],
  plot: { top: number; height: number },
): BarLayout {
  const values = [0, mean, ...peerMeans].filter((v) => Number.isFinite(v));
  let yMin = Math.min(...values);
  let yMax = Math.max(...values);
  if (yMin === 0 && yMax === 0) {
    yMin = -1;
    yMax = 1;
  }
  const sy = (v: number) =>
    plot.top + ((yMax - v) / (yMax - yMin)) * plot.height;
  const zeroY = sy(0);
  if (mean >= 0) {
    const barTop = sy(mean);
    return { yMin, yMax, zeroY, barTop, barHeight: zeroY - barTop };
  }
  return {
    yMin,
    yMax,
    zeroY,
    barTop: zeroY,
    barHeight: sy(mean) - zeroY,
  };
}

/**
 * Calibrated 相对 Initial 的变化百分比：`(Cali - Init) / Init × 100`。
 * 正值 = 升高，负值 = 降低。Initial 均值非正时不可计算，返回 null。
 */
export function relativeChangePercent(
  meanInitial: number,
  meanCalibrated: number,
): number | null {
  if (!(meanInitial > 0) || !Number.isFinite(meanInitial) || !Number.isFinite(meanCalibrated)) {
    return null;
  }
  return ((meanCalibrated - meanInitial) / meanInitial) * 100;
}

/** 下降箭头图转到朝上所需角度。 */
export const CHANGE_ARROW_INCREASE_DEG = 180;
/** 与 `.reduction-badge` 高度一致，用于把气泡接到均值上方。 */
export const REDUCTION_BADGE_HEIGHT = 47;
const REDUCTION_BADGE_STACK_GAP = 4;
const STACK_MIN_TOP = 4;

export type MeanChangeMarker = {
  increased: boolean;
  arrowRotationDeg: number;
  guideTop: number;
};

/**
 * 气泡跟 Calibrated 柱顶；虚线：升高对齐 Initial 柱顶，降低对齐 Calibrated 柱顶。
 */
export function meanChangeMarker(
  meanInitial: number,
  meanCalibrated: number,
  initBarTop: number,
  caliBarTop: number,
): MeanChangeMarker {
  const increased = meanCalibrated > meanInitial;
  return {
    increased,
    arrowRotationDeg: increased ? CHANGE_ARROW_INCREASE_DEG : 0,
    guideTop: increased ? initBarTop : caliBarTop,
  };
}

/**
 * 气泡在 Calibrated 均值之上，避免 311.5 与 6130% 叠成乱码。
 * 顶部空间不够时气泡贴顶，均值下移到气泡下方。
 */
export function meanChangeStackTops(
  caliBarTop: number,
  meanOffsetAbove: number,
): { badgeTop: number; caliMeanTop: number } {
  const caliMeanTop = Math.max(STACK_MIN_TOP, caliBarTop - meanOffsetAbove);
  const badgeTop = caliMeanTop - REDUCTION_BADGE_HEIGHT - REDUCTION_BADGE_STACK_GAP;
  if (badgeTop >= STACK_MIN_TOP) {
    return { badgeTop, caliMeanTop };
  }
  return {
    badgeTop: STACK_MIN_TOP,
    caliMeanTop: STACK_MIN_TOP + REDUCTION_BADGE_HEIGHT + REDUCTION_BADGE_STACK_GAP,
  };
}

/** 四舍五入为整数文案（不保留小数）。 */
export function formatOneDecimal(value: number): string {
  return String(Math.round(value));
}

/** 徽章只显示变化幅度；方向由箭头承担，不带正负号。 */
export function formatReductionLabel(pct: number | null): string {
  if (pct === null) return "不可计算";
  return `${Math.abs(Math.round(pct))}%`;
}
