/**
 * V2 只消费快照中的完整点：completeCount 前缀，忽略 pendingTail。
 */

import type { Case3Point, SideSnapshot } from "../case3/types";

/**
 * 取出最新快照的完整点。不把不完整尾点当完成点。
 */
export function completePointsOf(
  snapshot: SideSnapshot | null | undefined,
): Case3Point[] {
  if (!snapshot) return [];
  const done = Math.max(0, Math.floor(snapshot.completeCount));
  const n = Math.min(done, snapshot.points.length);
  return snapshot.points.slice(0, n);
}

/** 最新完整点；没有则 null。 */
export function latestCompletePoint(
  snapshot: SideSnapshot | null | undefined,
): Case3Point | null {
  const points = completePointsOf(snapshot);
  return points.at(-1) ?? null;
}
