/**
 * 吞吐折线。横轴样点序号；两路不等长不补 0。
 * 刻度 left/top 与折线共用 AFTrn 绘图区映射，禁止无坐标绝对定位叠在左上角。
 */

import { throughputWindow, throughputYTicks } from "../metrics/case4Metrics";
import type { ThroughputSample } from "../types";

type Props = {
  without: ThroughputSample[];
  withSamples: ThroughputSample[];
};

/** Pencil AFTrn / 静态 THRP_PLOT：602×176 内的网格与曲线坐标系。 */
const PLOT = {
  artW: 602,
  artH: 176,
  left: 29.263888888888886,
  top: 4.591304347826087,
  width: 564.375,
  height: 154.57391304347829,
  xLabelY: 162.22608695652175,
  xLabel0: 26.12847222222222,
  xStep: 29.703947368421052,
  yLabelX: 15,
} as const;

const GRID_X = [
  29.264, 58.968, 88.672, 118.376, 148.08, 177.784, 207.488, 237.192, 266.895,
  296.599, 326.303, 356.007, 385.711, 415.415, 445.119, 474.823, 504.527,
  534.231, 563.935, 593.639,
];

function xOf(no: number, start: number, end: number): number {
  const slots = end - start + 1;
  if (slots <= 1) return PLOT.left + PLOT.width / 2;
  return PLOT.left + ((no - start) / (slots - 1)) * PLOT.width;
}

function yOf(gbps: number, yMax: number): number {
  return PLOT.top + PLOT.height - (gbps / yMax) * PLOT.height;
}

function pathOf(
  samples: ThroughputSample[],
  start: number,
  end: number,
  yMax: number,
): string {
  if (samples.length === 0) return "";
  const pts = samples.map((s) => ({
    x: xOf(s.no, start, end),
    y: yOf(s.gbps, yMax),
  }));
  const first = pts[0];
  if (!first) return "";
  if (pts.length === 1) return `M ${first.x} ${first.y}`;
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

function formatYTick(v: number): string {
  if (Number.isInteger(v)) return String(v);
  const t = v.toFixed(1);
  return t.endsWith(".0") ? String(Math.round(v)) : t;
}

function xLabelLeft(no: number, start: number, end: number): number {
  const slots = end - start + 1;
  if (slots <= 1) {
    return PLOT.xLabel0 + ((20 - 1) / 2) * PLOT.xStep;
  }
  const i = no - start;
  return PLOT.xLabel0 + (i / (slots - 1)) * ((20 - 1) * PLOT.xStep);
}

/** 与 Pencil 空闲帧同构：空闲 Y 11 档 0–10；抬轴后横网格跟整数刻度走。 */
export function ThroughputChart(props: Props) {
  const win = throughputWindow(props.without, props.withSamples);
  const dWithout = pathOf(win.without, win.windowStart, win.windowEnd, win.yMax);
  const dWith = pathOf(win.with, win.windowStart, win.windowEnd, win.yMax);
  const labels: number[] = [];
  for (let n = win.windowStart; n <= win.windowEnd; n += 1) labels.push(n);
  const yLabels = throughputYTicks(win.yMax);

  return (
    <div className="c4-thrp-shell">
      <article className="c4-kpi c4-kpi--thrp" data-region="Throughput">
        <div className="c4-kpi__head">
          <span className="c4-kpi__title c4-kpi__title--thrp">
            吞吐率对比(Gbps)
          </span>
          <div className="c4-kpi__legend c4-kpi__legend--thrp">
            <span>
              <i className="c4-dot c4-dot--bs" />
              传统基站定位
            </span>
            <span>
              <i className="c4-dot c4-dot--dt" />
              数字孪生辅助定位
            </span>
          </div>
        </div>
        <div className="c4-thrp-plot">
          <div className="c4-thrp-art">
            <svg
              className="c4-thrp-grid-svg"
              viewBox={`0 0 ${PLOT.artW} ${PLOT.artH}`}
              aria-hidden
            >
              <g fill="#ffffff14" stroke="none">
                {yLabels.map((v) => (
                  <rect
                    key={`hy-${v}`}
                    x={PLOT.left}
                    y={yOf(v, win.yMax)}
                    width={PLOT.width}
                    height="1"
                    data-thrp-yline
                  />
                ))}
                {GRID_X.map((x) => (
                  <rect
                    key={`vx-${x}`}
                    x={x}
                    y={PLOT.top}
                    width="1"
                    height={PLOT.height}
                  />
                ))}
              </g>
            </svg>
            <svg
              className="c4-thrp-svg"
              viewBox={`0 0 ${PLOT.artW} ${PLOT.artH}`}
              aria-hidden
            >
              <path
                d={dWithout}
                fill="none"
                stroke="#97AAC4"
                strokeWidth="1.5"
              />
              <path d={dWith} fill="none" stroke="#7A6BFF" strokeWidth="2.5" />
            </svg>
            <div className="c4-thrp-dots">
              {win.without.map((s) => (
                <span
                  key={`wo-${s.no}`}
                  className="c4-thrp-dot"
                  style={{
                    left: `${xOf(s.no, win.windowStart, win.windowEnd)}px`,
                    top: `${yOf(s.gbps, win.yMax)}px`,
                    background: "#97AAC4",
                  }}
                />
              ))}
              {win.with.map((s) => (
                <span
                  key={`w-${s.no}`}
                  className="c4-thrp-dot"
                  style={{
                    left: `${xOf(s.no, win.windowStart, win.windowEnd)}px`,
                    top: `${yOf(s.gbps, win.yMax)}px`,
                    background: "#7A6BFF",
                  }}
                />
              ))}
            </div>
            <div className="c4-thrp-y">
              {yLabels.map((v) => (
                <span
                  key={`y-${v}`}
                  style={{
                    left: `${PLOT.yLabelX}px`,
                    top: `${yOf(v, win.yMax)}px`,
                  }}
                >
                  {formatYTick(v)}
                </span>
              ))}
            </div>
            <div className="c4-thrp-x">
              {labels.map((n) => (
                <span
                  key={n}
                  style={{
                    left: `${xLabelLeft(n, win.windowStart, win.windowEnd)}px`,
                    top: `${PLOT.xLabelY}px`,
                  }}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
