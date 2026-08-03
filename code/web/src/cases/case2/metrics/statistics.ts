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
 * 降幅百分比；Initial 均值非正时不可计算。
 * 返回 null 表示 UI 显示「不可计算」。
 */
export function reductionPercent(
  meanInitial: number,
  meanCalibrated: number,
): number | null {
  if (!(meanInitial > 0) || !Number.isFinite(meanInitial) || !Number.isFinite(meanCalibrated)) {
    return null;
  }
  return ((meanInitial - meanCalibrated) / meanInitial) * 100;
}

/** 四舍五入为整数文案（不保留小数）。 */
export function formatOneDecimal(value: number): string {
  return String(Math.round(value));
}

export function formatReductionLabel(pct: number | null): string {
  if (pct === null) return "不可计算";
  return `${formatOneDecimal(pct)}%`;
}
