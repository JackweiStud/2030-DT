/**
 * Case3 派生 KPI 纯函数：开销变化、吞吐序列、波束准确率。
 * 不读 DOM/timer；pairValid=false 时跨侧结论必须失效。
 */

import type {
  BeamAccuracyBaseline,
  Case3Point,
  SideSnapshot,
  ThroughputSnapshot,
} from "../types";

/** -1 是后端的波束异常标记；其他可用 BeamID 为 0-255。 */
export function isValidBeamId(value: number | undefined): value is number {
  return (
    value !== undefined &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 255
  );
}

/** Without 扫描行包含 -1 时整点异常，即使所选 BeamID 本身正常。 */
export function isAbnormalBeamPoint(
  point: Case3Point | null | undefined,
): boolean {
  return Boolean(
    point &&
      (point.selectedBeamId === -1 || point.scanBeamIds?.includes(-1)),
  );
}

/** 一位小数展示（不改变业务权威精度语义，仅 UI 格式）。 */
export function formatOneDecimal(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

/**
 * 相对开销变化：有 DT 相对无 DT。仅双方 Cost 有效且 Without≠0 时可算。
 * 正数 = With 开销升高；负数 = With 开销降低。
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
  return ((withCostPct - withoutCostPct) / withoutCostPct) * 100;
}

export type BeamAccuracyDisplay = {
  displaySuccess: number;
  displayTotal: number;
  displayError: number;
  displayPct: number;
};

/**
 * Beam Accuracy：文件基线 +（pairValid 时）同 no 的 selectedBeamId 增量。
 * 只有两侧都存在的 no 才计入 roundTotal；缺一侧的点显示 NA，不进准确率。
 */
export function deriveBeamAccuracy(
  baseline: BeamAccuracyBaseline | null,
  without: SideSnapshot | null,
  withSide: SideSnapshot | null,
  roundCompareEnabled: boolean,
): BeamAccuracyDisplay | null {
  if (!baseline) return null;

  let roundSuccess = 0;
  let roundTotal = 0;
  if (roundCompareEnabled && without && withSide) {
    const withoutByNo = new Map(
      without.points.map((p) => [p.no, p] as const),
    );
    for (const wp of withSide.points) {
      const o = withoutByNo.get(wp.no);
      if (
        !o ||
        isAbnormalBeamPoint(o) ||
        isAbnormalBeamPoint(wp) ||
        !isValidBeamId(o.selectedBeamId) ||
        !isValidBeamId(wp.selectedBeamId)
      ) {
        continue;
      }
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

/** 从独立吞吐快照构造曲线点；两路不等长不补 0。 */
export function throughputSeriesFromSnapshots(
  without: ThroughputSnapshot | null | undefined,
  withSnap: ThroughputSnapshot | null | undefined,
): ThroughputSeries {
  const map = (snap: ThroughputSnapshot | null | undefined) =>
    [...(snap?.samples ?? [])]
      .filter((s) => Number.isFinite(s.gbps))
      .sort((a, b) => a.no - b.no)
      .map((s) => ({ no: s.no, value: s.gbps }));
  return {
    without: map(without),
    with: map(withSnap),
  };
}

/**
 * Y 轴上界：至少 12（默认 Max Gbps），否则 max*1.1 向上取美观整数。
 */
export const CASE3_THRP_Y_MAX_DEFAULT = 12;

export function niceCeilThroughput(maxValue: number): number {
  const target = Math.max(CASE3_THRP_Y_MAX_DEFAULT, maxValue * 1.1);
  if (target <= CASE3_THRP_Y_MAX_DEFAULT) return CASE3_THRP_Y_MAX_DEFAULT;
  const pow = 10 ** Math.floor(Math.log10(target));
  const n = target / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

export {
  THRP_X_DOMAIN_FALLBACK as CASE3_THRP_X_DOMAIN_FALLBACK,
  THRP_X_TICK_MAX as CASE3_THRP_X_TICK_MAX,
  niceIntegerStep,
  throughputXDomain,
  throughputXTicks,
} from "../../shared/throughputX";

/** 点位-波束槽：无 DT 只看本侧波束；有 DT 无对照点为 NA。 */
export type PointBeamSlotView =
  | { kind: "empty" }
  | { kind: "na" }
  | { kind: "beam"; beamId: number }
  | { kind: "predict"; ok: boolean };

export function pointBeamSlotView(
  side: "without" | "with",
  point: Case3Point | null | undefined,
  peer: Case3Point | null | undefined,
): PointBeamSlotView {
  if (side === "without") {
    if (
      point == null ||
      isAbnormalBeamPoint(point) ||
      !isValidBeamId(point.selectedBeamId)
    ) {
      return { kind: "na" };
    }
    return { kind: "beam", beamId: point.selectedBeamId };
  }
  if (
    point == null ||
    peer == null ||
    isAbnormalBeamPoint(point) ||
    isAbnormalBeamPoint(peer) ||
    !isValidBeamId(point.selectedBeamId) ||
    !isValidBeamId(peer.selectedBeamId)
  ) {
    return { kind: "na" };
  }
  return {
    kind: "predict",
    ok: point.selectedBeamId === peer.selectedBeamId,
  };
}

/** 点位进度窗口：最新最多 20 个真实点。 */
export function pointProgressWindow<T>(points: T[], windowSize = 20): T[] {
  if (points.length <= windowSize) return points;
  return points.slice(-windowSize);
}

/**
 * 点位进度窗口可滑动范围。
 * completeCount≤窗口：只能看路线前窗（start=0）；超出后默认可滑到最新 20 点。
 */
export function pointProgressWindowRange(
  routeLength: number,
  completeCount: number,
  windowSize = 20,
): { maxStart: number; defaultStart: number } {
  const size = Math.max(1, Math.floor(windowSize));
  const done = Math.max(0, Math.floor(completeCount));
  const length = Math.max(0, Math.floor(routeLength));
  const covered =
    done <= size ? Math.min(size, length) : Math.min(done, length);
  const maxStart = Math.max(0, covered - size);
  return {
    maxStart,
    defaultStart: done <= size ? 0 : maxStart,
  };
}

/**
 * 点位进度槽位标签序列：来自 baseRoute 点号。
 * completeCount≤窗口：固定显示路线前窗，已完成点只填波束值；
 * 超出后默认显示最新 windowSize 个；windowStart 可把窗口拖回更早点号。
 */
export function pointProgressRouteNos(
  routeNos: ReadonlyArray<number>,
  completeCount: number,
  windowSize = 20,
  windowStart?: number,
): number[] {
  if (routeNos.length === 0) return [];
  const size = Math.max(1, Math.floor(windowSize));
  const { maxStart, defaultStart } = pointProgressWindowRange(
    routeNos.length,
    completeCount,
    size,
  );
  const start =
    windowStart == null
      ? defaultStart
      : Math.max(0, Math.min(maxStart, Math.floor(windowStart)));
  return routeNos.slice(start, start + size);
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
