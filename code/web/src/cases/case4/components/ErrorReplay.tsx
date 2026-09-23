/**
 * 误差回溯：开始/重置、Y 轴、最近 20 槽与折线。
 * 列几何与静态一致：gap=3，点落在列中心；每点画圆，避免只靠细折线。
 * 超过 20 点可在回放板上拖动，P 列头与误差折线共用同一窗口。
 * 悬停有数据的槽弹出该点三方案误差；拖过阈值后优先滑动并收起浮层。
 */

import { useEffect, useRef, useState } from "react";
import { CASE4_POINT_WINDOW } from "../config/case4RuntimeConfig";
import {
  errorAxisTicks,
  errorPlotYMax,
  errorPlotYMin,
  errorValueToSvgY,
  errorWindow,
  errorWindowRange,
  errorWindowRows,
  errorWindowYMax,
  formatErrorAxisTick,
  formatFixed,
} from "../metrics/case4Metrics";
import type { BasePoint, TrajectoryPoint } from "../types";

type Props = {
  baseRoute: BasePoint[];
  points: TrajectoryPoint[];
  statusText: string;
  startEnabled: boolean;
  resetEnabled: boolean;
  busy: boolean;
  onStart: () => void;
  onReset: () => void;
};

const PLOT_W = 1666;
const PLOT_H = 110;
const COL_GAP = 3;
const POINT_R = 5;
const TIP_W = 268;

/** 列心间距，与拖动换算一致（测试可 import）。 */
export const CASE4_ERROR_REPLAY_SLOT_PITCH =
  (PLOT_W - (CASE4_POINT_WINDOW - 1) * COL_GAP) / CASE4_POINT_WINDOW + COL_GAP;

/** 超过该位移才进入拖窗，避免和悬停抢手势。 */
export const CASE4_ERROR_REPLAY_DRAG_THRESHOLD_PX = 6;

type SchemeKey = "traditional" | "commercial" | "dt";

const SCHEME_COLOR: Record<SchemeKey, string> = {
  traditional: "#97AAC4",
  commercial: "#F0A12E",
  dt: "rgba(90, 191, 251, 1)",
};

const TIP_ROWS: Array<{ scheme: SchemeKey; name: string }> = [
  { scheme: "traditional", name: "方案1轨迹" },
  { scheme: "commercial", name: "方案2轨迹" },
  { scheme: "dt", name: "数字孪生辅助定位轨迹" },
];

function colWidth(slotCount: number): number {
  return slotCount > 0
    ? (PLOT_W - Math.max(0, slotCount - 1) * COL_GAP) / slotCount
    : 85;
}

function slotCenterX(index: number, slotCount: number): number {
  const w = colWidth(slotCount);
  return index * (w + COL_GAP) + w / 2;
}

function slotIndexFromLocalX(localX: number, slotCount: number): number | null {
  if (slotCount <= 0 || localX < 0) return null;
  const pitch = colWidth(slotCount) + COL_GAP;
  const index = Math.floor(localX / pitch);
  if (index < 0 || index >= slotCount) return null;
  return index;
}

function seriesPoints(
  values: Array<number | null>,
  plotYMin: number,
  plotYMax: number,
  slotCount: number,
  usePlotPadding: boolean,
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) return;
    pts.push({
      x: slotCenterX(i, slotCount),
      y: usePlotPadding
        ? errorValueToSvgY(v, plotYMin, plotYMax)
        : PLOT_H - (v / plotYMax) * PLOT_H,
    });
  });
  return pts;
}

function pathFrom(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return "";
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

function clampStart(value: number, maxStart: number): number {
  return Math.max(0, Math.min(maxStart, Math.round(value)));
}

/** 启动/重置进行中：动态省略号。已完成仍可能 busy，不能用 busy 判断。 */
function isBusyStatus(text: string): boolean {
  return text === "测试中" || text === "重置中";
}

function slotHeaderLabel(
  index: number,
  slot: { label: string } | null,
  baseRoute: BasePoint[],
): string {
  if (slot) return slot.label;
  const no = baseRoute[index]?.no ?? index + 1;
  return `P${no}`;
}

function boardScale(el: HTMLElement): number {
  const cssWidth = el.getBoundingClientRect().width;
  const layoutWidth = el.offsetWidth;
  return cssWidth > 0 && layoutWidth > 0 ? cssWidth / layoutWidth : 1;
}

function localXFromClient(el: HTMLElement, clientX: number): number {
  const rect = el.getBoundingClientRect();
  const scale = boardScale(el);
  return (clientX - rect.left) / scale;
}

type DragState = {
  pointerId: number;
  originX: number;
  originStart: number;
  scale: number;
  active: boolean;
};

/**
 * ErrorReplay。
 */
export function ErrorReplay(props: Props) {
  const completeCount = errorWindowRows(props.points, props.baseRoute).length;
  const range = errorWindowRange(completeCount, CASE4_POINT_WINDOW);
  const [followLatest, setFollowLatest] = useState(true);
  const [userStart, setUserStart] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    if (completeCount <= 0) {
      setFollowLatest(true);
      setUserStart(0);
      setHoverSlot(null);
    }
  }, [completeCount]);

  useEffect(() => {
    if (range.maxStart <= 0) setFollowLatest(true);
  }, [range.maxStart]);

  const windowStart = followLatest
    ? range.defaultStart
    : clampStart(userStart, range.maxStart);

  const visible = errorWindow(
    props.points,
    props.baseRoute,
    CASE4_POINT_WINDOW,
    windowStart,
  );
  const dataYMax = errorWindowYMax(visible);
  const hasPlot = visible.length > 0;
  const plotYMax = hasPlot ? errorPlotYMax(dataYMax) : dataYMax;
  const plotYMin = hasPlot ? errorPlotYMin(plotYMax) : 0;
  const slots = Array.from(
    { length: CASE4_POINT_WINDOW },
    (_, i) => visible[i] ?? null,
  );
  const nCols = CASE4_POINT_WINDOW;
  const w = colWidth(nCols);
  const n = visible.length;
  const progW = n > 0 ? n * w + Math.max(0, n - 1) * COL_GAP + 2 : 0;
  const cursorLeft = n > 0 ? -2 + progW - 24 : 0;
  const canDrag = range.maxStart > 0;
  const hovered = hoverSlot != null ? slots[hoverSlot] : null;
  const hoverNo = hovered?.no ?? null;

  const trad = seriesPoints(
    slots.map((s) => s?.traditional ?? null),
    plotYMin,
    plotYMax,
    nCols,
    hasPlot,
  );
  const comm = seriesPoints(
    slots.map((s) => s?.commercial ?? null),
    plotYMin,
    plotYMax,
    nCols,
    hasPlot,
  );
  const dt = seriesPoints(
    slots.map((s) => s?.dt ?? null),
    plotYMin,
    plotYMax,
    nCols,
    hasPlot,
  );

  const playClass =
    props.statusText === "测试中"
      ? "is-busy"
      : props.startEnabled
        ? "is-ready"
        : "is-off";
  const resetClass =
    props.statusText === "重置中"
      ? "is-busy"
      : props.resetEnabled
        ? "is-ready"
        : "is-off";
  const statusBusy = isBusyStatus(props.statusText);

  function samePointer(
    event: React.PointerEvent<HTMLDivElement>,
    pointerId: number,
  ): boolean {
    if (event.pointerId == null || event.pointerId === 0) return true;
    return event.pointerId === pointerId;
  }

  function applyHover(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.active) {
      setHoverSlot(null);
      return;
    }
    const index = slotIndexFromLocalX(
      localXFromClient(event.currentTarget, event.clientX),
      nCols,
    );
    const next = index != null && slots[index] ? index : null;
    setHoverSlot(next);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button > 0) return;
    applyHover(event);
    if (!canDrag) return;
    event.preventDefault();
    event.stopPropagation();
    const el = event.currentTarget;
    dragRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originStart: windowStart,
      scale: boardScale(el),
      active: false,
    };
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      /* jsdom 可能未实现 pointer capture */
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag && samePointer(event, drag.pointerId)) {
      const localDx = (event.clientX - drag.originX) / drag.scale;
      if (!drag.active) {
        if (Math.abs(localDx) < CASE4_ERROR_REPLAY_DRAG_THRESHOLD_PX) {
          applyHover(event);
          return;
        }
        drag.active = true;
        setDragging(true);
        setHoverSlot(null);
      }
      const next = clampStart(
        drag.originStart - localDx / CASE4_ERROR_REPLAY_SLOT_PITCH,
        range.maxStart,
      );
      setFollowLatest(next >= range.maxStart);
      setUserStart(next);
      return;
    }
    applyHover(event);
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag && !samePointer(event, drag.pointerId)) return;
    const wasActive = drag?.active === true;
    dragRef.current = null;
    try {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* jsdom 可能未实现 pointer capture */
    }
    if (wasActive) setDragging(false);
    applyHover(event);
  }

  function onPointerLeave(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.active) return;
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    setHoverSlot(null);
  }

  const tipStyle = hovered
    ? (() => {
        const center = slotCenterX(hoverSlot!, nCols);
        const left = Math.max(0, Math.min(PLOT_W - TIP_W, center - TIP_W / 2));
        return {
          left: `${left}px`,
          ["--c4-tip-arrow-left" as string]: `${center - left}px`,
        };
      })()
    : undefined;

  return (
    <div className="c4-error-replay" data-region="ErrorReplay">
      <div className="c4-ctrl-col" data-region="ReplayControls">
        <div className="c4-ctrl-title">定位误差(m)</div>
        <div className="c4-ctrl-left">
          <div className="c4-ctrl-btns">
            <button
              type="button"
              className={`c4-icon-btn c4-icon-btn--play ${playClass}`}
              aria-label="开始"
              disabled={!props.startEnabled}
              onClick={props.onStart}
            >
              <svg viewBox="0 0 16 16" aria-hidden>
                <path
                  d="M5.5 3.6v8.8a.6.6 0 0 0 .9.5l7-4.4a.6.6 0 0 0 0-1l-7-4.4a.6.6 0 0 0-.9.5z"
                  fill="currentColor"
                />
              </svg>
            </button>
            <button
              type="button"
              className={`c4-icon-btn c4-icon-btn--reset ${resetClass}`}
              aria-label="重置"
              disabled={!props.resetEnabled}
              onClick={props.onReset}
            >
              <svg viewBox="0 0 16 16" aria-hidden>
                <path
                  d="M12.6 9.4A4.8 4.8 0 1 1 11.4 4.6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M12.4 2.2v3h-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className={`c4-ctrl-status${statusBusy ? " is-busy" : ""}`}>
            <span className="c4-ctrl-status__text">{props.statusText}</span>
            {statusBusy ? (
              <span className="c4-status-ellipsis" aria-hidden>
                <span className="c4-status-ellipsis__track" />
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="c4-y-axis" data-region="ErrorYAxis">
        <div className="c4-y-axis__label" aria-hidden>
          点位
        </div>
        {errorAxisTicks(plotYMax).map((tick, index) => (
          <span key={index}>{formatErrorAxisTick(tick)}</span>
        ))}
      </div>
      <div
        className={`c4-replay-board${canDrag ? " is-scrollable" : ""}${
          dragging ? " is-dragging" : ""
        }`}
        data-replay-surface
        data-replay-can-drag={canDrag ? "1" : "0"}
        data-replay-window-start={String(windowStart)}
        data-replay-follow-latest={followLatest ? "1" : "0"}
        data-hover-no={hoverNo == null ? "" : String(hoverNo)}
        title={canDrag ? "拖动查看更早的点位" : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={onPointerLeave}
      >
        {hovered ? (
          <div
            className="c4-error-tip"
            data-error-tip
            data-error-tip-no={String(hovered.no)}
            style={tipStyle}
            aria-hidden
          >
            <div className="c4-error-tip__title">{hovered.label}定位误差</div>
            {TIP_ROWS.map((row) => (
              <div key={row.scheme} className="c4-error-tip__row">
                <i
                  className="c4-error-tip__dot"
                  style={{ background: SCHEME_COLOR[row.scheme] }}
                />
                <span>{row.name}</span>
                <b>{formatFixed(hovered[row.scheme] ?? Number.NaN, 3)}m</b>
              </div>
            ))}
            <i className="c4-error-tip__arrow" />
          </div>
        ) : null}
        <div className="c4-replay-head">
          <div className="c4-col-headers">
            {slots.map((slot, i) => (
              <div
                key={i}
                className={`c4-col-head${slot ? " is-done" : ""}${
                  hoverSlot === i && slot ? " is-hover" : ""
                }`}
              >
                {slotHeaderLabel(i, slot, props.baseRoute)}
              </div>
            ))}
          </div>
          {n > 0 ? (
            <div className="c4-progress" style={{ width: `${progW}px` }} />
          ) : null}
          {n > 0 ? (
            <div className="c4-cursor" style={{ left: `${cursorLeft}px` }} />
          ) : null}
        </div>
        <div className="c4-error-plot">
          <div className="c4-col-slots" aria-hidden>
            {slots.map((_, i) => (
              <div
                key={i}
                className={`c4-col-slot${
                  hoverSlot === i && slots[i] ? " is-hover" : ""
                }`}
              />
            ))}
          </div>
          <svg
            className="c4-error-svg"
            viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
            width={PLOT_W}
            height={PLOT_H}
          >
            {(
              [
                ["traditional", trad],
                ["commercial", comm],
                ["dt", dt],
              ] as const
            ).map(([scheme, pts]) => {
              const d = pathFrom(pts);
              const color = SCHEME_COLOR[scheme];
              return (
                <g key={scheme}>
                  {d ? (
                    <path
                      d={d}
                      fill="none"
                      stroke={color}
                      strokeWidth="1"
                      strokeDasharray="6 4"
                    />
                  ) : null}
                  {pts.map((p, i) => (
                    <circle
                      key={`${scheme}-${i}`}
                      cx={p.x}
                      cy={p.y}
                      r={POINT_R}
                      fill={color}
                    />
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
