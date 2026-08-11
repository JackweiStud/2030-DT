/**
 * Case3 吞吐折线：原生 SVG，DOM 对齐静态 `.case3-thrp-*`。
 * X 域固定为 init baseRoute 全程点号（无路线时占位 1～20），刻度/竖网格相对该域一次算齐；
 * Y 域无数据时 0～12，有数据时按 niceCeil 扩展（下限 12 Gbps）。
 */

import { useMemo } from "react";
import {
  niceCeilThroughput,
  CASE3_THRP_Y_MAX_DEFAULT,
  throughputSeries,
  throughputXDomain,
  throughputXTicks,
} from "../metrics/case3Metrics";
import type { Case3Point } from "../types";

type Props = {
  withoutPoints: Case3Point[] | null;
  withPoints: Case3Point[] | null;
  /** init baseRoute 点号；用于固定 X 域。 */
  routeNos: ReadonlyArray<number> | null;
  /** 是否显示传入的 With 曲线；配对/历史策略由页面统一决定。 */
  showWithSeries: boolean;
};

const VB_W = 596;
const VB_H = 242;
const LEFT = 36;
const RIGHT = 580;
const TOP = 12;
const BOTTOM = 210;

/**
 * 吞吐对比图。
 */
export function ThroughputChart(props: Props) {
  const series = useMemo(
    () =>
      throughputSeries(
        props.withoutPoints ?? [],
        props.withPoints ?? [],
      ),
    [props.withoutPoints, props.withPoints],
  );

  const withSeries = props.showWithSeries ? series.with : [];
  const all = [...series.without, ...withSeries];
  const empty = all.length === 0;

  const [minNo, maxNo] = throughputXDomain(props.routeNos);
  const maxY = empty
    ? CASE3_THRP_Y_MAX_DEFAULT
    : niceCeilThroughput(Math.max(...all.map((p) => p.value)));

  const xAt = (no: number) => {
    if (maxNo === minNo) return (LEFT + RIGHT) / 2;
    return LEFT + ((no - minNo) / (maxNo - minNo)) * (RIGHT - LEFT);
  };
  const yAt = (v: number) => BOTTOM - (v / maxY) * (BOTTOM - TOP);

  const toPoints = (pts: Array<{ no: number; value: number }>) =>
    pts.map((p) => `${xAt(p.no)},${yAt(p.value)}`).join(" ");

  const xTicks = useMemo(
    () => throughputXTicks(minNo, maxNo),
    [minNo, maxNo],
  );
  // 默认 12：整数刻度 0～12；扩展后仍用 10 等分
  const yDivisions = maxY === CASE3_THRP_Y_MAX_DEFAULT ? 12 : 10;
  const yTicks = Array.from(
    { length: yDivisions + 1 },
    (_, i) => (maxY / yDivisions) * i,
  );

  return (
    <article className="case3-kpi-card case3-thrp-card">
      <div className="case3-kpi-card__head">
        <span className="case3-kpi-card__icon case3-kpi-card__icon--thrp" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"
              fill="currentColor"
            />
          </svg>
        </span>
        <h3>吞吐(Gbps)</h3>
      </div>
      <div className="case3-thrp-legend">
        <span className="case3-thrp-legend__item case3-thrp-legend__item--wo">
          无 DT
        </span>
        <span className="case3-thrp-legend__item case3-thrp-legend__item--w">
          有 DT
        </span>
      </div>
      <div className="case3-thrp-plot" aria-hidden>
        <svg
          className="case3-thrp-svg"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <g className="case3-thrp-grid" fill="#ffffff14" stroke="none">
            {yTicks.map((_, i) => {
              const y = TOP + ((yDivisions - i) / yDivisions) * (BOTTOM - TOP);
              return (
                <rect
                  key={`yg-${i}`}
                  x={LEFT}
                  y={y}
                  width={RIGHT - LEFT}
                  height={1}
                />
              );
            })}
            {xTicks.map((t) => (
              <rect
                key={`xg-${t}`}
                x={xAt(t)}
                y={TOP}
                width={1}
                height={BOTTOM - TOP}
              />
            ))}
          </g>
          <g
            className="case3-thrp-ylabels"
            fill="#939393"
            fontSize={9}
            fontWeight={400}
            fontFamily="Inter, sans-serif"
          >
            {yTicks.map((v, i) => {
              const y =
                TOP + ((yDivisions - i) / yDivisions) * (BOTTOM - TOP) + 4;
              const label =
                maxY === CASE3_THRP_Y_MAX_DEFAULT
                  ? String(i)
                  : String(Math.round(v * 10) / 10);
              return (
                <text key={`yl-${i}`} x={28} y={y} textAnchor="end">
                  {label}
                </text>
              );
            })}
          </g>
          <g
            className="case3-thrp-xlabels"
            fill="#939393"
            fontSize={9}
            fontWeight={400}
            fontFamily="Inter, sans-serif"
          >
            {xTicks.map((t) => (
              <text key={`xl-${t}`} x={xAt(t)} y={232} textAnchor="middle">
                {t}
              </text>
            ))}
          </g>
          <polyline
            className="case3-thrp-line case3-thrp-line--wo"
            fill="none"
            stroke="#6B7280"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={toPoints(series.without)}
            style={{ opacity: series.without.length > 0 ? 1 : 0.15 }}
          />
          <polyline
            className="case3-thrp-line case3-thrp-line--w"
            fill="none"
            stroke="#22D3EE"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={toPoints(withSeries)}
            style={{ opacity: withSeries.length > 0 ? 1 : 0.15 }}
          />
          <g>
            {series.without.map((p) => (
              <circle
                key={`wo-${p.no}`}
                cx={xAt(p.no)}
                cy={yAt(p.value)}
                r={3}
                fill="#6B7280"
              />
            ))}
          </g>
          <g>
            {withSeries.map((p) => (
              <circle
                key={`w-${p.no}`}
                cx={xAt(p.no)}
                cy={yAt(p.value)}
                r={3}
                fill="#22D3EE"
              />
            ))}
          </g>
        </svg>
      </div>
    </article>
  );
}
