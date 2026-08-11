/**
 * Case3 点位进度：最新最多 20 槽；DOM 对齐静态 `.case3-slot*`。
 * Pxx 标签来自 baseRoute（先出现）；Without 波束 ID / With 对错图标仅在点到达后填入。
 */

import iconOk from "../../../../assets/case3/icon-ok.png";
import iconErr from "../../../../assets/case3/icon-err.png";
import { CASE3_POINT_WINDOW } from "../config/case3RuntimeConfig";
import { pointProgressRouteNos } from "../metrics/case3Metrics";
import type { BaseRoutePoint, Case3Point, Case3Side } from "../types";

type Props = {
  side: Case3Side;
  baseRoute: BaseRoutePoint[];
  points: Case3Point[];
  peerPoints?: Case3Point[] | null;
};

/**
 * 点位进度窗口。
 */
export function PointProgressWindow(props: Props) {
  const pointByNo = new Map(props.points.map((p) => [p.no, p] as const));
  const peerByNo = new Map(
    (props.peerPoints ?? []).map((p) => [p.no, p] as const),
  );

  const routeNos = props.baseRoute.map((p) => p.no);
  const labelNos =
    routeNos.length > 0
      ? pointProgressRouteNos(
          routeNos,
          props.points.length,
          CASE3_POINT_WINDOW,
        )
      : Array.from({ length: CASE3_POINT_WINDOW }, (_, i) => i + 1);

  const slots: Array<number | null> = [...labelNos];
  while (slots.length < CASE3_POINT_WINDOW) slots.push(null);

  return (
    <div className="case3-progress" data-progress={props.side}>
      <div className="case3-progress__title">点位和波束关系</div>
      <div className="case3-progress__slots">
        {slots.map((no, index) => {
          if (no == null) {
            return (
              <div key={`pad-${index}`} className="case3-slot">
                <span className="case3-slot__label" aria-hidden>
                  {"\u00A0"}
                </span>
                <span className="case3-slot__value-slot">
                  <span className="case3-slot__empty" />
                </span>
              </div>
            );
          }

          const point = pointByNo.get(no) ?? null;

          if (props.side === "without") {
            return (
              <div key={no} className="case3-slot">
                <span className="case3-slot__label">P{no}</span>
                <span className="case3-slot__value-slot">
                  {point ? (
                    <span className="case3-slot__value">
                      {point.selectedBeamId}
                    </span>
                  ) : (
                    <span className="case3-slot__empty" />
                  )}
                </span>
              </div>
            );
          }

          const peer = peerByNo.get(no);
          const predict =
            point && peer && peer.selectedBeamId === point.selectedBeamId
              ? "ok"
              : point && peer
                ? "err"
                : null;

          return (
            <div key={no} className="case3-slot">
              <span className="case3-slot__label">P{no}</span>
              <span className="case3-slot__value-slot">
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
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
