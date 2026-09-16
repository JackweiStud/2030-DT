/**
 * 误差回溯：开始/重置、Y 轴、最近 20 槽与折线。
 * 列几何与静态一致：gap=3，点落在列中心；每点画圆，避免只靠细折线。
 */

import {
  CASE4_POINT_WINDOW,
} from "../config/case4RuntimeConfig";
import {
  errorAxisTicks,
  errorPlotYMax,
  errorWindow,
  errorWindowYMax,
  formatErrorAxisTick,
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

const PLOT_W = 1748;
const PLOT_H = 110;
const COL_GAP = 3;
const POINT_R = 5;

type SchemeKey = "traditional" | "commercial" | "dt";

const SCHEME_COLOR: Record<SchemeKey, string> = {
  traditional: "#97AAC4",
  commercial: "#F0A12E",
  dt: "#7A6BFF",
};

function colWidth(slotCount: number): number {
  return slotCount > 0
    ? (PLOT_W - Math.max(0, slotCount - 1) * COL_GAP) / slotCount
    : 85;
}

function slotCenterX(index: number, slotCount: number): number {
  const w = colWidth(slotCount);
  return index * (w + COL_GAP) + w / 2;
}

function seriesPoints(
  values: Array<number | null>,
  yMax: number,
  slotCount: number,
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) return;
    pts.push({
      x: slotCenterX(i, slotCount),
      y: PLOT_H - (v / yMax) * PLOT_H,
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

function slotHeaderLabel(
  index: number,
  slot: { label: string } | null,
  baseRoute: BasePoint[],
): string {
  if (slot) return slot.label;
  const no = baseRoute[index]?.no ?? index + 1;
  return `P${no}`;
}

/**
 * ErrorReplay。
 */
export function ErrorReplay(props: Props) {
  const visible = errorWindow(props.points, props.baseRoute);
  const dataYMax = errorWindowYMax(visible);
  const plotYMax = errorPlotYMax(dataYMax);
  const slots = Array.from(
    { length: CASE4_POINT_WINDOW },
    (_, i) => visible[i] ?? null,
  );
  const nCols = CASE4_POINT_WINDOW;
  const w = colWidth(nCols);
  const n = visible.length;
  const progW = n > 0 ? n * w + Math.max(0, n - 1) * COL_GAP + 2 : 0;
  const cursorLeft = n > 0 ? -2 + progW - 24 : 0;

  const trad = seriesPoints(
    slots.map((s) => s?.traditional ?? null),
    plotYMax,
    nCols,
  );
  const comm = seriesPoints(
    slots.map((s) => s?.commercial ?? null),
    plotYMax,
    nCols,
  );
  const dt = seriesPoints(
    slots.map((s) => s?.dt ?? null),
    plotYMax,
    nCols,
  );

  const playClass = props.startEnabled
    ? "is-ready"
    : props.busy
      ? "is-busy"
      : "is-off";
  const resetClass = props.resetEnabled ? "is-ready" : "is-off";

  return (
    <div className="c4-error-replay" data-region="ErrorReplay">
      <div className="c4-ctrl-col" data-region="ReplayControls">
        <div className="c4-ctrl-left">
          <div className="c4-ctrl-btns">
            <button
              type="button"
              className={`c4-icon-btn c4-icon-btn--play ${playClass}`}
              aria-label="开始"
              disabled={!props.startEnabled}
              onClick={props.onStart}
            />
            <button
              type="button"
              className={`c4-icon-btn c4-icon-btn--reset ${resetClass}`}
              aria-label="重置"
              disabled={!props.resetEnabled}
              onClick={props.onReset}
            />
          </div>
          <div className="c4-ctrl-status">{props.statusText}</div>
        </div>
        <div className="c4-axis-title" aria-hidden>
          <span>点位</span>
          <span className="c4-axis-title__err">定位误差</span>
          <span>(m)</span>
        </div>
      </div>
      <div className="c4-y-axis" data-region="ErrorYAxis">
        {errorAxisTicks(plotYMax).map((tick, index) => (
          <span key={index}>{formatErrorAxisTick(tick)}</span>
        ))}
      </div>
      <div className="c4-replay-board">
        <div className="c4-replay-head">
          <div className="c4-col-headers">
            {slots.map((slot, i) => (
              <div
                key={i}
                className={`c4-col-head${slot ? " is-done" : ""}`}
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
              <div key={i} className="c4-col-slot" />
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
                    <path d={d} fill="none" stroke={color} strokeWidth="2" />
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
