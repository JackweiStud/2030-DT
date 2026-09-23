/**
 * case3-v2 / case4 吞吐图 Y 轴：初始 3.2G、8 格、步长 0.4；
 * 窗口内全局 max 超 85% 时 ×1.15 阶梯抬轴，Ymax 对齐到 step 为 0.1 整数倍（即 0.8 的倍数）。
 */

export const THRP_Y_IDLE = 3.2;
export const THRP_GRID_COUNT = 8;

const THRP_EXPAND = 1.15;
const THRP_THRESHOLD = 0.85;
/** step = yMax/8 为 0.1 整数倍 ⇔ yMax 为 0.8 的倍数 */
const THRP_YMAX_ALIGN_UNIT = 0.8;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function alignYMaxUp(candidate: number): number {
  return round1(
    Math.ceil(candidate / THRP_YMAX_ALIGN_UNIT) * THRP_YMAX_ALIGN_UNIT,
  );
}

/** 窗口内两路全局 max；空数据回落 3.2。每次重算，尖峰滑出后自动缩回。 */
export function resolveThroughputYMax(windowMax: number): number {
  if (!Number.isFinite(windowMax) || windowMax <= 0) return THRP_Y_IDLE;

  let yMax = THRP_Y_IDLE;
  for (let guard = 0; guard < 100; guard += 1) {
    if (windowMax <= yMax * THRP_THRESHOLD) break;
    const scaled = round1(yMax * THRP_EXPAND);
    const next = scaled > yMax ? scaled : round1(yMax * THRP_EXPAND + 0.1);
    const aligned = alignYMaxUp(next);
    yMax =
      aligned > yMax ? aligned : alignYMaxUp(round1(yMax + THRP_YMAX_ALIGN_UNIT));
  }
  return yMax;
}

/** 固定 8 格，自上而下 yMax…0。 */
export function throughputYTicks(yMax: number): number[] {
  const top =
    Number.isFinite(yMax) && yMax > 0 ? yMax : THRP_Y_IDLE;
  const step = top / THRP_GRID_COUNT;
  return Array.from({ length: THRP_GRID_COUNT + 1 }, (_, i) =>
    round1(step * (THRP_GRID_COUNT - i)),
  );
}

export function formatThroughputYTick(v: number): string {
  return round1(v).toFixed(1);
}
