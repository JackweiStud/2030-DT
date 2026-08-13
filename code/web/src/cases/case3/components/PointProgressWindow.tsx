/**
 * Case3 点位进度：最新最多 20 槽；DOM 对齐静态 `.case3-slot*`。
 * Pxx 标签来自 baseRoute。无 DT 显示该点 selectedBeamId，没数据则 NA；
 * 有 DT 有对照才显示对错，无对照 NA。超过 20 点可在槽条上拖动回看更早点。
 */

import { useEffect, useRef, useState } from "react";
import iconOk from "../../../../assets/case3/icon-ok.png";
import iconErr from "../../../../assets/case3/icon-err.png";
import {
  CASE3_POINT_SLOT_PITCH,
  CASE3_POINT_WINDOW,
} from "../config/case3RuntimeConfig";
import {
  pointBeamSlotView,
  pointProgressRouteNos,
  pointProgressWindowRange,
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

function clampStart(value: number, maxStart: number): number {
  return Math.max(0, Math.min(maxStart, Math.round(value)));
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
  const range = pointProgressWindowRange(
    routeNos.length,
    props.points.length,
    CASE3_POINT_WINDOW,
  );
  const [followLatest, setFollowLatest] = useState(true);
  const [userStart, setUserStart] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    originX: number;
    originStart: number;
    scale: number;
  } | null>(null);

  useEffect(() => {
    if (range.maxStart <= 0) setFollowLatest(true);
  }, [range.maxStart]);

  const windowStart = followLatest
    ? range.defaultStart
    : clampStart(userStart, range.maxStart);

  const labelNos =
    routeNos.length > 0
      ? pointProgressRouteNos(
          routeNos,
          props.points.length,
          CASE3_POINT_WINDOW,
          windowStart,
        )
      : Array.from({ length: CASE3_POINT_WINDOW }, (_, i) => i + 1);

  const slots: Array<number | null> = [...labelNos];
  while (slots.length < CASE3_POINT_WINDOW) slots.push(null);

  const canDrag = range.maxStart > 0;

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !canDrag) return;
    event.preventDefault();
    event.stopPropagation();
    const el = event.currentTarget;
    const scale = el.getBoundingClientRect().width / Math.max(1, el.offsetWidth);
    dragRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originStart: windowStart,
      scale,
    };
    el.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const localDx = (event.clientX - drag.originX) / drag.scale;
    const next = clampStart(
      drag.originStart - localDx / CASE3_POINT_SLOT_PITCH,
      range.maxStart,
    );
    setFollowLatest(next >= range.maxStart);
    setUserStart(next);
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  }

  return (
    <div className="case3-progress" data-progress={props.side}>
      <div className="case3-progress__title">点位和波束关系</div>
      <div
        className={`case3-progress__slots${canDrag ? " is-scrollable" : ""}${
          dragging ? " is-dragging" : ""
        }`}
        title={canDrag ? "拖动查看更早的点位" : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
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
