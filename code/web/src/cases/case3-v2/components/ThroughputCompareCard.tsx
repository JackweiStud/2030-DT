/**
 * 吞吐率对比卡：Without 灰色曲线；缺点不补 0。
 * X 域覆盖完整 baseRoute 和当前可见吞吐样点；Y 按真实最大值扩展。
 * 悬停按样点号对齐两路读数，机制对齐 case4 ThroughputChart。
 */

import { useMemo, useState } from "react";
import {
  throughputSeriesFromSnapshots,
  throughputXDomain,
  throughputXTicks,
} from "../../case3/metrics/case3Metrics";
import type { ThroughputSnapshot } from "../../case3/types";
import {
  CASE3V2_THR_PLOT,
  localXFromClient,
  thrHoverNoFromLocalX,
} from "../v2ThroughputHover";
import {
  formatThrYTick,
  niceCeilThroughputV2,
  throughputYTicksV2,
} from "../v2ThroughputY";
import { segmentedThroughputPath } from "../v2ThroughputPath";

type Props = {
  /** init baseRoute 点号；提供结构路线的基础 X 域。 */
  routeNos: ReadonlyArray<number>;
  without?: ThroughputSnapshot | null;
  withSamples?: ThroughputSnapshot | null;
  showWithSeries?: boolean;
};

type ThrPoint = { no: number; value: number };

const PLOT_LEFT = CASE3V2_THR_PLOT.left;
const PLOT_RIGHT = CASE3V2_THR_PLOT.right;
const PLOT_TOP = CASE3V2_THR_PLOT.top;
const PLOT_BOTTOM = CASE3V2_THR_PLOT.bottom;
const PLOT_WIDTH = CASE3V2_THR_PLOT.artW;
const PLOT_HEIGHT = CASE3V2_THR_PLOT.artH;
const Y_LINE_WIDTH = PLOT_RIGHT - PLOT_LEFT;
const X_LINE_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
const X_LABEL_TOP = 162.226;
const Y_LABEL_SHIFT = 5;
const DOT = 4;
const TIP_W = 148;
/** 约两行 tip 高度（含 padding），用于锚在数据点上方。 */
const TIP_H = 48;
const TIP_GAP = 8;
const WITHOUT_COLOR = "rgb(201, 201, 201)";
const WITH_COLOR = "rgb(90, 191, 251)";

const TIP_ROWS = [
  { key: "with" as const, name: "有DT辅助", color: WITH_COLOR },
  { key: "without" as const, name: "无DT辅助", color: WITHOUT_COLOR },
];

function sampleAt(points: ThrPoint[], no: number): ThrPoint | undefined {
  return points.find((point) => point.no === no);
}

function formatGbps(value: number): string {
  return `${(Math.round(value * 100) / 100).toFixed(2)}Gbps`;
}

function gbpsLabel(point: ThrPoint | undefined): string {
  if (!point) return "--";
  return formatGbps(point.value);
}

/**
 * 吞吐对比图。
 */
export function ThroughputCompareCard(props: Props) {
  const [hoverNo, setHoverNo] = useState<number | null>(null);
  const series = useMemo(
    () =>
      throughputSeriesFromSnapshots(props.without, props.withSamples),
    [props.without, props.withSamples],
  );
  const withSeries = props.showWithSeries ? series.with : [];
  const all = [...series.without, ...withSeries];
  const empty = all.length === 0;

  const [minNo, maxNo] = throughputXDomain(
    props.routeNos,
    all.map((point) => point.no),
  );
  const maxY = empty
    ? niceCeilThroughputV2(0)
    : niceCeilThroughputV2(Math.max(...all.map((p) => p.value)));
  const yTicks = throughputYTicksV2(maxY);
  const xTicks = useMemo(
    () => throughputXTicks(minNo, maxNo),
    [minNo, maxNo],
  );

  const xAt = (no: number) => {
    if (maxNo === minNo) return (PLOT_LEFT + PLOT_RIGHT) / 2;
    return PLOT_LEFT + ((no - minNo) / (maxNo - minNo)) * (PLOT_RIGHT - PLOT_LEFT);
  };
  const yAt = (v: number) => PLOT_BOTTOM - (v / maxY) * (PLOT_BOTTOM - PLOT_TOP);

  const withoutPlot = series.without.map((p) => ({
    no: p.no,
    x: xAt(p.no),
    y: yAt(p.value),
  }));
  const withPlot = withSeries.map((p) => ({
    no: p.no,
    x: xAt(p.no),
    y: yAt(p.value),
  }));

  const hoveredWithout =
    hoverNo == null ? undefined : sampleAt(series.without, hoverNo);
  const hoveredWith = hoverNo == null ? undefined : sampleAt(withSeries, hoverNo);
  const hovered =
    hoverNo != null &&
    hoverNo >= minNo &&
    hoverNo <= maxNo &&
    (hoveredWithout != null || hoveredWith != null)
      ? hoverNo
      : null;

  function applyHoverAt(surface: HTMLDivElement, clientX: number) {
    const no = thrHoverNoFromLocalX(
      localXFromClient(surface, clientX),
      minNo,
      maxNo,
    );
    if (
      no == null ||
      (sampleAt(series.without, no) == null && sampleAt(withSeries, no) == null)
    ) {
      setHoverNo(null);
      return;
    }
    setHoverNo(no);
  }

  function applyHover(event: React.PointerEvent<HTMLDivElement>) {
    applyHoverAt(event.currentTarget, event.clientX);
  }

  function onMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    applyHoverAt(event.currentTarget, event.clientX);
  }

  function onPointerLeave(event: React.PointerEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setHoverNo(null);
  }

  function onMouseLeave(event: React.MouseEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setHoverNo(null);
  }

  const tipStyle =
    hovered != null
      ? (() => {
          const center = xAt(hovered);
          const left = Math.max(0, Math.min(PLOT_WIDTH - TIP_W, center - TIP_W / 2));
          const pointYs: number[] = [];
          if (hoveredWithout != null) pointYs.push(yAt(hoveredWithout.value));
          if (hoveredWith != null) pointYs.push(yAt(hoveredWith.value));
          const pointTop = pointYs.length > 0 ? Math.min(...pointYs) : PLOT_TOP;
          // 锚在最高数据点上方一点；允许略探出 plot 顶（hover 时卡 overflow:visible）。
          const top = pointTop - TIP_H - TIP_GAP;
          return {
            left: `${left}px`,
            top: `${top}px`,
            ["--case3v2-thr-tip-arrow-left" as string]: `${center - left}px`,
          };
        })()
      : undefined;

  return (
    <article
      className={`case3v2-kpi case3v2-kpi--thr${hovered != null ? " is-hover" : ""}`}
      data-region="ThroughputCompareCard"
    >
      <div className="case3v2-kpi__head">
        <span className="case3v2-kpi__title">吞吐率(Gbps)</span>
        <div className="case3v2-thr-legend">
          <span className="case3v2-thr-legend__item">
            <i className="case3v2-thr-legend__dot case3v2-thr-legend__dot--w" />
            <span className="case3v2-thr-legend__text--w">有DT辅助</span>
          </span>
          <span className="case3v2-thr-legend__item">
            <i className="case3v2-thr-legend__dot case3v2-thr-legend__dot--wo" />
            <span className="case3v2-thr-legend__text--wo">无DT辅助</span>
          </span>
        </div>
      </div>
      <div className="case3v2-thr-plot">
        <div className="case3v2-thr-grid" data-thr-grid>
          {yTicks.map((v) => (
            <div
              key={`yg-${v}`}
              className="case3v2-thr-yline"
              data-thr-yline
              style={{
                left: `${PLOT_LEFT}px`,
                top: `${yAt(v)}px`,
                width: `${Y_LINE_WIDTH}px`,
                height: "1px",
              }}
            />
          ))}
          {xTicks.map((t) => (
            <div
              key={`xg-${t}`}
              className="case3v2-thr-xline"
              data-thr-xline
              style={{
                left: `${xAt(t)}px`,
                top: `${PLOT_TOP}px`,
                width: "1px",
                height: `${X_LINE_HEIGHT}px`,
              }}
            />
          ))}
        </div>
        <div className="case3v2-thr-axis" data-thr-axis>
          {yTicks.map((v, i) => (
            <div
              key={`yl-${i}`}
              className="case3v2-thr-label case3v2-thr-label--y"
              data-thr-y-tick
              style={{ top: `${Math.max(0, yAt(v) - Y_LABEL_SHIFT)}px` }}
            >
              {formatThrYTick(v)}
            </div>
          ))}
          {xTicks.map((t) => (
            <div
              key={`xl-${t}`}
              className="case3v2-thr-label case3v2-thr-label--x"
              data-thr-x-tick
              style={{
                left: `${xAt(t)}px`,
                top: `${X_LABEL_TOP}px`,
              }}
            >
              {t}
            </div>
          ))}
        </div>
        <div className="case3v2-thr-lines">
          <svg
            className="case3v2-thr-svg"
            viewBox={`0 0 ${PLOT_WIDTH} ${PLOT_HEIGHT}`}
            preserveAspectRatio="none"
          >
            <path
              data-thr-wo
              d={segmentedThroughputPath(withoutPlot)}
              fill="none"
              stroke={WITHOUT_COLOR}
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            <path
              data-thr-w
              d={segmentedThroughputPath(withPlot)}
              fill="none"
              stroke={WITH_COLOR}
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="case3v2-thr-dots" data-thr-dots>
            {withoutPlot.map((p) => (
              <div
                key={`wo-${p.no}`}
                className={`case3v2-thr-dot${hovered === p.no ? " is-hover" : ""}`}
                data-thr-dot-wo
                data-thr-no={p.no}
                style={{
                  background: WITHOUT_COLOR,
                  left: `${p.x - DOT / 2}px`,
                  top: `${p.y - DOT / 2}px`,
                }}
              />
            ))}
            {withPlot.map((p) => (
              <div
                key={`w-${p.no}`}
                className={`case3v2-thr-dot${hovered === p.no ? " is-hover" : ""}`}
                data-thr-dot-w
                data-thr-no={p.no}
                style={{
                  background: WITH_COLOR,
                  left: `${p.x - DOT / 2}px`,
                  top: `${p.y - DOT / 2}px`,
                }}
              />
            ))}
          </div>
        </div>
        {hovered != null ? (
          <div
            className="case3v2-thr-cursor"
            style={{ left: `${xAt(hovered)}px` }}
            aria-hidden
          />
        ) : null}
        {hovered != null ? (
          <div
            className="case3v2-thr-tip"
            data-thr-tip
            data-thr-tip-no={String(hovered)}
            style={tipStyle}
            aria-hidden
          >
            {TIP_ROWS.map((row) => (
              <div key={row.key} className="case3v2-thr-tip__row">
                <i
                  className="case3v2-thr-tip__dot"
                  style={{ background: row.color }}
                />
                <span>{row.name}</span>
                <b>
                  {gbpsLabel(
                    row.key === "without" ? hoveredWithout : hoveredWith,
                  )}
                </b>
              </div>
            ))}
            <i className="case3v2-thr-tip__arrow" />
          </div>
        ) : null}
        <div
          className="case3v2-thr-hit"
          data-thr-surface
          data-hover-no={hovered == null ? "" : String(hovered)}
          onPointerMove={applyHover}
          onMouseMove={onMouseMove}
          onPointerLeave={onPointerLeave}
          onMouseLeave={onMouseLeave}
        />
      </div>
    </article>
  );
}

// Re-export for tests.
export { thrHoverNoFromLocalX } from "../v2ThroughputHover";
