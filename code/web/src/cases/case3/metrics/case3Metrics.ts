/**
 * Case3 派生 KPI 纯函数：开销变化、吞吐序列、波束准确率。
 * 不读 DOM/timer；pairValid=false 时跨侧结论必须失效。
 */

import type {
  BeamAccuracyBaseline,
  Case3Point,
  SideSnapshot,
} from "../types";

/** 一位小数展示（不改变业务权威精度语义，仅 UI 格式）。 */
export function formatOneDecimal(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

/**
 * 相对开销变化。仅双方 Cost 有效且 Without≠0 时可算。
 * 正数 = With 开销下降；负数 = 上升。
 */
export function relativeCostChangePct(
  withoutCostPct: number | null | undefined,
  withCostPct: number | null | undefined,
  pairValid: boolean,
): number | null {
  if (!pairValid) return null;
  if (
    withoutCostPct == null ||
    withCostPct == null ||
    !Number.isFinite(withoutCostPct) ||
    !Number.isFinite(withCostPct) ||
    withoutCostPct === 0
  ) {
    return null;
  }
  return ((withoutCostPct - withCostPct) / withoutCostPct) * 100;
}

export type BeamAccuracyDisplay = {
  displaySuccess: number;
  displayTotal: number;
  displayError: number;
  displayPct: number;
};

/**
 * Beam Accuracy：文件基线 +（pairValid 时）同 no 的 selectedBeamId 增量。
 */
export function deriveBeamAccuracy(
  baseline: BeamAccuracyBaseline | null,
  without: SideSnapshot | null,
  withSide: SideSnapshot | null,
  pairValid: boolean,
): BeamAccuracyDisplay | null {
  if (!baseline) return null;

  let roundSuccess = 0;
  let roundTotal = 0;
  if (pairValid && without && withSide) {
    const withoutByNo = new Map(
      without.points.map((p) => [p.no, p] as const),
    );
    for (const wp of withSide.points) {
      const o = withoutByNo.get(wp.no);
      if (!o) continue;
      roundTotal += 1;
      if (o.selectedBeamId === wp.selectedBeamId) roundSuccess += 1;
    }
  }

  const displaySuccess = baseline.success + roundSuccess;
  const displayTotal = baseline.total + roundTotal;
  if (displayTotal <= 0) return null;
  return {
    displaySuccess,
    displayTotal,
    displayError: displayTotal - displaySuccess,
    displayPct: (displaySuccess / displayTotal) * 100,
  };
}

export type ThroughputSeries = {
  without: Array<{ no: number; value: number }>;
  with: Array<{ no: number; value: number }>;
};

/** 按 no 升序提取吞吐点；缺点不补 0。 */
export function throughputSeries(
  without: Case3Point[] | null | undefined,
  withPoints: Case3Point[] | null | undefined,
): ThroughputSeries {
  const sort = (pts: Case3Point[]) =>
    [...pts]
      .filter((p) => Number.isFinite(p.throughputGbps))
      .sort((a, b) => a.no - b.no)
      .map((p) => ({ no: p.no, value: p.throughputGbps }));
  return {
    without: sort(without ?? []),
    with: sort(withPoints ?? []),
  };
}

/**
 * Y 轴上界：至少 10，否则 max*1.1 向上取美观整数。
 */
export function niceCeilThroughput(maxValue: number): number {
  const target = Math.max(10, maxValue * 1.1);
  if (target <= 10) return 10;
  const pow = 10 ** Math.floor(Math.log10(target));
  const n = target / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

/** 点位进度窗口：最新最多 20 个真实点。 */
export function pointProgressWindow<T>(points: T[], windowSize = 20): T[] {
  if (points.length <= windowSize) return points;
  return points.slice(-windowSize);
}

/** 最终快照完整门槛（Web 本地）。 */
export function isFinalSideReady(snapshot: SideSnapshot | null | undefined): boolean {
  if (!snapshot) return false;
  return (
    snapshot.pendingTail === false &&
    snapshot.points.length > 0 &&
    snapshot.completeCount === snapshot.points.length &&
    snapshot.costPct !== null
  );
}
