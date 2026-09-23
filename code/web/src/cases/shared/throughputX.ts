/**
 * case3 / case3-v2 / case4 吞吐图 X 域与刻度：路线 + 样点并集，nice 抽稀。
 */

export const THRP_X_DOMAIN_FALLBACK: readonly [number, number] = [1, 20];

/** 吞吐图 X 轴默认最多刻度数。 */
export const THRP_X_TICK_MAX = 24;

/**
 * 吞吐图 X 域覆盖完整路线与当前可见吞吐样点的并集。
 * 无路线、无吞吐时回退占位 [1,20]。
 */
export function throughputXDomain(
  routeNos: ReadonlyArray<number> | null | undefined,
  sampleNos: ReadonlyArray<number> = [],
): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const no of routeNos ?? []) {
    if (Number.isFinite(no)) {
      lo = Math.min(lo, no);
      hi = Math.max(hi, no);
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    lo = THRP_X_DOMAIN_FALLBACK[0];
    hi = THRP_X_DOMAIN_FALLBACK[1];
  }
  for (const no of sampleNos) {
    if (!Number.isFinite(no)) continue;
    lo = Math.min(lo, no);
    hi = Math.max(hi, no);
  }
  return [lo, hi];
}

/** 将步长收到 1/2/5×10^k。 */
export function niceIntegerStep(rawStep: number): number {
  const step = Math.max(1, Math.ceil(rawStep));
  const pow = 10 ** Math.floor(Math.log10(step));
  const n = step / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

/**
 * 吞吐图 X 轴整数刻度：相对固定 X 域一次算齐。
 * 小范围全标；大范围 nice 步长抽稀，始终包含端点。
 */
export function throughputXTicks(
  minNo: number,
  maxNo: number,
  maxLabels = THRP_X_TICK_MAX,
): number[] {
  if (!Number.isFinite(minNo) || !Number.isFinite(maxNo)) return [];
  const lo = Math.min(minNo, maxNo);
  const hi = Math.max(minNo, maxNo);
  const span = hi - lo;
  if (span === 0) return [lo];

  const budget = Math.max(2, Math.floor(maxLabels));
  if (span + 1 <= budget) {
    return Array.from({ length: span + 1 }, (_, i) => lo + i);
  }

  const step = niceIntegerStep(span / (budget - 1));
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) {
    ticks.push(v);
  }
  if (ticks[ticks.length - 1] !== hi) ticks.push(hi);
  return ticks;
}
