/**
 * 吞吐率对比卡：Ticket 02 只画空坐标系，不写演示折线/点。
 * X 域来自完整 baseRoute；Y 用 Case3 默认上界 0～12。
 */

import { useMemo } from "react";
import {
  CASE3_THRP_Y_MAX_DEFAULT,
  throughputXDomain,
  throughputXTicks,
} from "../../case3/metrics/case3Metrics";

type Props = {
  /** init baseRoute 点号；用于固定 X 域。 */
  routeNos: ReadonlyArray<number>;
};

/** 与已验收 V2 绘图区 602×176 内框一致，不是静态 THR_X/THR_Y 数组。 */
const PLOT_LEFT = 29.264;
const PLOT_RIGHT = 593.639;
const PLOT_TOP = 4.591;
const PLOT_BOTTOM = 159.165;
const Y_LINE_WIDTH = PLOT_RIGHT - PLOT_LEFT;
const X_LINE_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
const X_LABEL_TOP = 162.226;
const Y_LABEL_SHIFT = 5;

/**
 * 吞吐对比图：无数据时仍渲染网格、Y 轴与 X 点位刻度。
 */
export function ThroughputCompareCard(props: Props) {
  const [minNo, maxNo] = throughputXDomain(props.routeNos);
  const maxY = CASE3_THRP_Y_MAX_DEFAULT;
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

  return (
    <article className="case3v2-kpi case3v2-kpi--thr" data-region="ThroughputCompareCard">
      <div className="case3v2-kpi__head">
        <span className="case3v2-kpi__title">吞吐率对比(Gbps)</span>
      </div>
      <div className="case3v2-thr-legend">
        <span className="case3v2-thr-legend__item">
          <i className="case3v2-thr-legend__dot case3v2-thr-legend__dot--wo" />
          <span className="case3v2-thr-legend__text--wo">无DT</span>
        </span>
        <span className="case3v2-thr-legend__item">
          <i className="case3v2-thr-legend__dot case3v2-thr-legend__dot--w" />
          <span className="case3v2-thr-legend__text--w">有DT</span>
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
            viewBox="0 0 576 230"
            preserveAspectRatio="none"
          >
            <path
              data-thr-wo
              fill="none"
              stroke="#6B7280"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            <path
              data-thr-w
              fill="none"
              stroke="#22D3EE"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="case3v2-thr-dots" data-thr-dots />
        </div>
      </div>
    </article>
  );
}
