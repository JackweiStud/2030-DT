/**
 * Case3 点位进度：最新最多 20 槽；DOM 对齐静态 `.case3-slot*`。
 * 无真实点时显示空窗 P1～P20（与 Gate 1.5 初始态一致）；
 * 有真实点后按 WEB-SPEC 滑动窗口显示业务 no。
 */

import iconOk from "../../../../assets/case3/icon-ok.png";
import iconErr from "../../../../assets/case3/icon-err.png";
import { CASE3_POINT_WINDOW } from "../config/case3RuntimeConfig";
import { pointProgressWindow } from "../metrics/case3Metrics";
import type { Case3Point, Case3Side } from "../types";

type Props = {
  side: Case3Side;
  points: Case3Point[];
  peerPoints?: Case3Point[] | null;
};

/**
 * 点位进度窗口。
 */
export function PointProgressWindow(props: Props) {
  const peerByNo = new Map(
    (props.peerPoints ?? []).map((p) => [p.no, p] as const),
  );

  // 空窗：对齐静态 Gate 1.5 初始态的 P1～P20 空槽行
  if (props.points.length === 0) {
    return (
      <div className="case3-progress" data-progress={props.side}>
        <div className="case3-progress__title">点位进度</div>
        <div className="case3-progress__slots">
          {Array.from({ length: CASE3_POINT_WINDOW }, (_, i) => (
            <div key={`placeholder-${i + 1}`} className="case3-slot">
              <span className="case3-slot__label">P{i + 1}</span>
              <span className="case3-slot__empty" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const visible = pointProgressWindow(props.points, CASE3_POINT_WINDOW);
  const slots: Array<Case3Point | null> = [...visible];
  while (slots.length < CASE3_POINT_WINDOW) slots.push(null);

  return (
    <div className="case3-progress" data-progress={props.side}>
      <div className="case3-progress__title">点位进度</div>
      <div className="case3-progress__slots">
        {slots.map((point, index) => {
          if (!point) {
            return (
              <div key={`empty-${index}`} className="case3-slot">
                <span className="case3-slot__label" aria-hidden>
                  {"\u00A0"}
                </span>
                <span className="case3-slot__empty" />
              </div>
            );
          }

          if (props.side === "without") {
            return (
              <div key={point.no} className="case3-slot">
                <span className="case3-slot__label">P{point.no}</span>
                <span className="case3-slot__value">{point.no}</span>
              </div>
            );
          }

          const peer = peerByNo.get(point.no);
          const predict =
            peer && peer.selectedBeamId === point.selectedBeamId
              ? "ok"
              : peer
                ? "err"
                : null;

          return (
            <div key={point.no} className="case3-slot">
              <span className="case3-slot__label">P{point.no}</span>
              {predict ? (
                <img
                  className="case3-slot__icon"
                  src={predict === "ok" ? iconOk : iconErr}
                  width={12}
                  height={12}
                  alt={predict === "ok" ? "预测正确" : "预测错误"}
                />
              ) : (
                <span className="case3-slot__empty" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
