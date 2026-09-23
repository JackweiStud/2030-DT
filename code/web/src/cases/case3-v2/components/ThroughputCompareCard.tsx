/**
 * 吞吐率对比卡：Without 灰色曲线；缺点不补 0。
 * X 域来自完整 baseRoute；Y 按真实最大值扩展。
 */

import { useMemo } from "react";
import {
  CASE3_THRP_Y_MAX_DEFAULT,
  niceCeilThroughput,
  throughputSeries,
  throughputXDomain,
  throughputXTicks,
} from "../../case3/metrics/case3Metrics";
import type { Case3Point } from "../../case3/types";
import { segmentedThroughputPath } from "../v2ThroughputPath";

type Props = {
  /** init baseRoute 点号；用于固定 X 域。 */
  routeNos: ReadonlyArray<number>;
  withoutPoints?: Case3Point[] | null;
  withPoints?: Case3Point[] | null;
  showWithSeries?: boolean;
};

/** 与已验收 V2 绘图区 602×176 内框一致。 */
const PLOT_LEFT = 29.264;
const PLOT_RIGHT = 593.639;
const PLOT_TOP = 4.591;
const PLOT_BOTTOM = 159.165;
const PLOT_WIDTH = 602;
const PLOT_HEIGHT = 176;
const Y_LINE_WIDTH = PLOT_RIGHT - PLOT_LEFT;
const X_LINE_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
const X_LABEL_TOP = 162.226;
const Y_LABEL_SHIFT = 5;
const DOT = 4;

/**
 * 吞吐对比图。
 */
export function ThroughputCompareCard(props: Props) {
  const series = useMemo(
    () => throughputSeries(props.withoutPoints ?? [], props.withPoints ?? []),
    [props.withoutPoints, props.withPoints],
  );
  const withSeries = props.showWithSeries ? series.with : [];
  const all = [...series.without, ...withSeries];
  const empty = all.length === 0;

  const [minNo, maxNo] = throughputXDomain(props.routeNos);
  const maxY = empty
    ? CASE3_THRP_Y_MAX_DEFAULT
    : niceCeilThroughput(Math.max(...all.map((p) => p.value)));
  const yDivisions = maxY === CASE3_THRP_Y_MAX_DEFAULT ? 12 : 10;
  const yTicks = Array.from(
    { length: yDivisions + 1 },
    (_, i) => (maxY / yDivisions) * i,
  );
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

  return (
    <article className="case3v2-kpi case3v2-kpi--thr" data-region="ThroughputCompareCard">
      <div className="case3v2-kpi__head">
        <span className="case3v2-kpi__title">吞吐率(Gbps)</span>
      </div>
      <div className="case3v2-thr-legend">
        <span className="case3v2-thr-legend__item">
          <i className="case3v2-thr-legend__dot case3v2-thr-legend__dot--wo" />
          <span className="case3v2-thr-legend__text--wo">无DT辅助</span>
        </span>
        <span className="case3v2-thr-legend__item">
          <i className="case3v2-thr-legend__dot case3v2-thr-legend__dot--w" />
          <span className="case3v2-thr-legend__text--w">有DT辅助</span>
        </span>
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
              {maxY === CASE3_THRP_Y_MAX_DEFAULT
                ? String(i)
                : String(Math.round(v * 10) / 10)}
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
              d={segmentedThroughputPath(props.routeNos, withoutPlot)}
              fill="none"
              stroke="#6B7280"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            <path
              data-thr-w
              d={segmentedThroughputPath(props.routeNos, withPlot)}
              fill="none"
              stroke="#22D3EE"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="case3v2-thr-dots" data-thr-dots>
            {withoutPlot.map((p) => (
              <div
                key={`wo-${p.no}`}
                className="case3v2-thr-dot"
                data-thr-dot-wo
                data-thr-no={p.no}
                style={{
                  background: "#6B7280",
                  left: `${p.x - DOT / 2}px`,
                  top: `${p.y - DOT / 2}px`,
                }}
              />
            ))}
            {withPlot.map((p) => (
              <div
                key={`w-${p.no}`}
                className="case3v2-thr-dot"
                data-thr-dot-w
                data-thr-no={p.no}
                style={{
                  background: "#22D3EE",
                  left: `${p.x - DOT / 2}px`,
                  top: `${p.y - DOT / 2}px`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
