/**
 * V2 With 展示适配：同 no 找 peer，不按坐标或数组下标。
 * 不改 reducer / metrics 公式。
 */

import type { Case3Presentation } from "../case3/presentation/selectCase3Presentation";
import type { Case3Point } from "../case3/types";

export type WithBeamVerdict = "empty" | "no-peer" | "match" | "mismatch";
export type WithReplayTone = "idle" | "ok" | "fail";
export type V2LiveMapSide = "without" | "with";

/**
 * 只按 point.no 取对照点。不同 no 或缺失都算没有 peer。
 */
export function peerPointByNo(
  peers: ReadonlyArray<Case3Point> | null | undefined,
  no: number,
): Case3Point | null {
  if (!peers) return null;
  for (const point of peers) {
    if (point.no === no) return point;
  }
  return null;
}

/**
 * 当前 With 点相对同 no Without 的预测结论。
 * 缺 With 点为空；缺同 no peer 为 no-peer，不得发明「待比对」。
 */
export function withBeamVerdict(
  withPoint: Case3Point | null | undefined,
  peerPoint: Case3Point | null | undefined,
): WithBeamVerdict {
  if (!withPoint) return "empty";
  if (!peerPoint || peerPoint.no !== withPoint.no) return "no-peer";
  return withPoint.selectedBeamId === peerPoint.selectedBeamId
    ? "match"
    : "mismatch";
}

/** 回溯 With 格 PNG：有点且同 no 相等=ok，不等=fail，否则 idle。 */
export function withReplayTone(
  withPoint: Case3Point | null | undefined,
  peerPoint: Case3Point | null | undefined,
): WithReplayTone {
  const verdict = withBeamVerdict(withPoint, peerPoint);
  if (verdict === "match") return "ok";
  if (verdict === "mismatch") return "fail";
  return "idle";
}

/**
 * 单地图本轮轨迹侧：With Start 起切到 With 完整点，底栏 Without 历史另算。
 */
export function v2LiveMapSide(
  view: Pick<Case3Presentation, "activeStartSide" | "dataState">,
): V2LiveMapSide {
  if (view.activeStartSide === "with") return "with";
  if (view.dataState === "with-running" || view.dataState === "with-completed") {
    return "with";
  }
  return "without";
}

/**
 * 回溯窗口 / 列头完成 / 进度条所用完整点数。
 * With 展示侧跟 With 进度；其余跟 Without。两行仍按同一窗口 no 填值。
 */
export function v2ReplayCompleteCount(
  side: V2LiveMapSide,
  withoutCompleteCount: number,
  withCompleteCount: number,
): number {
  return side === "with" ? withCompleteCount : withoutCompleteCount;
}
