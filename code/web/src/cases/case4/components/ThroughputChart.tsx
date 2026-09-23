/**
 * 吞吐折线。横轴样点序号；两路不等长不补 0。
 * 刻度 left/top 与折线共用 AFTrn 绘图区映射，禁止无坐标绝对定位叠在左上角。
 * 悬停按样点号对齐两条曲线读数；窗口滑动时跟 no，不跟像素。
 */

import { useMemo, useState } from "react";
import { formatThroughputYTick } from "../../shared/throughputAxis";
import { throughputXTicks } from "../../shared/throughputX";
import {
  formatFixed,
  throughputWindow,
  throughputYTicks,
} from "../metrics/case4Metrics";
import type { ThroughputSample } from "../types";

type Props = {
  routeNos: ReadonlyArray<number>;
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
  yLabelX: 15,
} as const;

/** 案侧文案较长（传统/数字孪生），宽于 case3-v2 的 148。 */
const TIP_W = 200;
/** 约两行 tip 高度（含 padding），用于锚在数据点上方。 */
const TIP_H = 48;
const TIP_GAP = 8;
const WITHOUT_COLOR = "#97AAC4";
const WITH_COLOR = "#7A6BFF";

const TIP_ROWS = [
  { key: "without" as const, name: "传统基站定位", color: WITHOUT_COLOR },
  { key: "with" as const, name: "数字孪生辅助定位", color: WITH_COLOR },
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

const formatYTick = formatThroughputYTick;

function sampleAt(
  samples: ThroughputSample[],
  no: number,
): ThroughputSample | undefined {
  return samples.find((s) => s.no === no);
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

/** 绘图区 X → 最近整数样点号；落在轴外返回 null。 */
export function thrpHoverNoFromLocalX(
  localX: number,
  windowStart: number,
  windowEnd: number,
): number | null {
  if (localX < PLOT.left || localX > PLOT.left + PLOT.width) return null;
  const slots = windowEnd - windowStart + 1;
  if (slots <= 1) return windowStart;
  const t = (localX - PLOT.left) / PLOT.width;
  const no = Math.round(windowStart + t * (slots - 1));
  if (no < windowStart || no > windowEnd) return null;
  return no;
}

function gbpsLabel(sample: ThroughputSample | undefined): string {
  if (!sample) return "--";
  return `${formatFixed(sample.gbps, 2)}Gbps`;
}

/** 与 Pencil 空闲帧同构：空闲 Y 11 档 0–10；抬轴后横网格跟整数刻度走。 */
export function ThroughputChart(props: Props) {
  const win = throughputWindow(
    props.without,
    props.withSamples,
    props.routeNos,
  );
  const [hoverNo, setHoverNo] = useState<number | null>(null);
  const dWithout = pathOf(win.without, win.windowStart, win.windowEnd, win.yMax);
  const dWith = pathOf(win.with, win.windowStart, win.windowEnd, win.yMax);
  const xLabels = useMemo(
    () => throughputXTicks(win.windowStart, win.windowEnd),
    [win.windowStart, win.windowEnd],
  );
  const yLabels = throughputYTicks(win.yMax);
  const hoveredWithout = hoverNo == null ? undefined : sampleAt(win.without, hoverNo);
  const hoveredWith = hoverNo == null ? undefined : sampleAt(win.with, hoverNo);
  const hovered =
    hoverNo != null &&
    hoverNo >= win.windowStart &&
    hoverNo <= win.windowEnd &&
    (hoveredWithout != null || hoveredWith != null)
      ? hoverNo
      : null;

  function applyHover(event: React.PointerEvent<HTMLDivElement>) {
    const no = thrpHoverNoFromLocalX(
      localXFromClient(event.currentTarget, event.clientX),
      win.windowStart,
      win.windowEnd,
    );
    if (
      no == null ||
      (sampleAt(win.without, no) == null && sampleAt(win.with, no) == null)
    ) {
      setHoverNo(null);
      return;
    }
    setHoverNo(no);
  }

  function onPointerLeave(event: React.PointerEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setHoverNo(null);
  }

  const tipStyle =
    hovered != null
      ? (() => {
          const center = xOf(hovered, win.windowStart, win.windowEnd);
          const left = Math.max(0, Math.min(PLOT.artW - TIP_W, center - TIP_W / 2));
          const pointYs: number[] = [];
          if (hoveredWithout != null) pointYs.push(yOf(hoveredWithout.gbps, win.yMax));
          if (hoveredWith != null) pointYs.push(yOf(hoveredWith.gbps, win.yMax));
          const pointTop = pointYs.length > 0 ? Math.min(...pointYs) : PLOT.top;
          const top = pointTop - TIP_H - TIP_GAP;
          return {
            left: `${left}px`,
            top: `${top}px`,
            ["--c4-tip-arrow-left" as string]: `${center - left}px`,
          };
        })()
      : undefined;

  return (
    <div className={`c4-thrp-shell${hovered != null ? " is-hover" : ""}`}>
      <article className="c4-kpi c4-kpi--thrp" data-region="Throughput">
        <div className="c4-kpi__head">
          <span className="c4-kpi__title c4-kpi__title--thrp">
            吞吐率(Gbps)
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
                {xLabels.map((n) => (
                  <rect
                    key={`vx-${n}`}
                    x={xOf(n, win.windowStart, win.windowEnd)}
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
                stroke={WITHOUT_COLOR}
                strokeWidth="1.5"
              />
              <path
                d={dWith}
                fill="none"
                stroke={WITH_COLOR}
                strokeWidth="2.5"
              />
            </svg>
            <div className="c4-thrp-dots">
              {win.without.map((s) => (
                <span
                  key={`wo-${s.no}`}
                  className={`c4-thrp-dot${hovered === s.no ? " is-hover" : ""}`}
                  style={{
                    left: `${xOf(s.no, win.windowStart, win.windowEnd)}px`,
                    top: `${yOf(s.gbps, win.yMax)}px`,
                    background: WITHOUT_COLOR,
                  }}
                />
              ))}
              {win.with.map((s) => (
                <span
                  key={`w-${s.no}`}
                  className={`c4-thrp-dot${hovered === s.no ? " is-hover" : ""}`}
                  style={{
                    left: `${xOf(s.no, win.windowStart, win.windowEnd)}px`,
                    top: `${yOf(s.gbps, win.yMax)}px`,
                    background: WITH_COLOR,
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
              {xLabels.map((n) => (
                <span
                  key={n}
                  style={{
                    left: `${xOf(n, win.windowStart, win.windowEnd)}px`,
                    top: `${PLOT.xLabelY}px`,
                  }}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
          {hovered != null ? (
            <div
              className="c4-thrp-cursor"
              style={{ left: `${xOf(hovered, win.windowStart, win.windowEnd)}px` }}
              aria-hidden
            />
          ) : null}
          {hovered != null ? (
            <div
              className="c4-thrp-tip"
              data-thrp-tip
              data-thrp-tip-no={String(hovered)}
              style={tipStyle}
              aria-hidden
            >
              {TIP_ROWS.map((row) => (
                <div key={row.key} className="c4-thrp-tip__row">
                  <i
                    className="c4-thrp-tip__dot"
                    style={{ background: row.color }}
                  />
                  <span>{row.name}</span>
                  <b>
                    {gbpsLabel(row.key === "without" ? hoveredWithout : hoveredWith)}
                  </b>
                </div>
              ))}
              <i className="c4-thrp-tip__arrow" />
            </div>
          ) : null}
          <div
            className="c4-thrp-hit"
            data-thrp-surface
            data-hover-no={hovered == null ? "" : String(hovered)}
            onPointerMove={applyHover}
            onPointerLeave={onPointerLeave}
          />
        </div>
      </article>
    </div>
  );
}
