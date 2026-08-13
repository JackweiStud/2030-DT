/**
 * Case3 点位进度：最新最多 20 槽；DOM 对齐静态 `.case3-slot*`。
 * Pxx 标签来自 baseRoute。无 DT 显示该点 selectedBeamId，没数据则 NA；
 * 有 DT 有对照才显示对错，无对照 NA。
 */

import iconOk from "../../../../assets/case3/icon-ok.png";
import iconErr from "../../../../assets/case3/icon-err.png";
import { CASE3_POINT_WINDOW } from "../config/case3RuntimeConfig";
import {
  pointBeamSlotView,
  pointProgressRouteNos,
} from "../metrics/case3Metrics";
import type { BaseRoutePoint, Case3Point, Case3Side } from "../types";

type Props = {
  side: Case3Side;
  baseRoute: BaseRoutePoint[];
  points: Case3Point[];
  peerPoints?: Case3Point[] | null;
};

function SlotValue(props: {
  side: Case3Side;
  point: Case3Point | null;
  peer: Case3Point | undefined;
}) {
  const view = pointBeamSlotView(props.side, props.point, props.peer);
  if (view.kind === "na") {
    return (
      <span
        className="case3-slot__na"
        title={props.side === "without" ? "该点无数据" : "无对照点"}
      >
        NA
      </span>
    );
  }
  if (view.kind === "beam") {
    return <span className="case3-slot__value">{view.beamId}</span>;
  }
  if (view.kind === "predict") {
    return (
      <img
        className="case3-slot__icon"
        src={view.ok ? iconOk : iconErr}
        width={12}
        height={12}
        alt={view.ok ? "预测正确" : "预测错误"}
      />
    );
  }
  return <span className="case3-slot__empty" />;
}

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
          const peer = peerByNo.get(no);

          return (
            <div key={no} className="case3-slot">
              <span className="case3-slot__label">P{no}</span>
              <span className="case3-slot__value-slot">
                <SlotValue side={props.side} point={point} peer={peer} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
