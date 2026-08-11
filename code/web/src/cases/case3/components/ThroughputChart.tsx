/**
 * Case3 吞吐折线：原生 SVG，DOM 对齐静态 `.case3-thrp-*`。
 * X/Y 域按 WEB-SPEC：无数据时 1～20 / 0～10；有数据时动态扩展。
 */

import { useMemo } from "react";
import {
  niceCeilThroughput,
  throughputSeries,
} from "../metrics/case3Metrics";
import type { Case3Point } from "../types";

type Props = {
  withoutPoints: Case3Point[] | null;
  withPoints: Case3Point[] | null;
  pairValid: boolean;
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

  const withSeries = props.pairValid ? series.with : [];
  const all = [...series.without, ...withSeries];
  const empty = all.length === 0;

  const minNo = empty ? 1 : Math.min(...all.map((p) => p.no));
  const maxNo = empty ? 20 : Math.max(...all.map((p) => p.no));
  const maxY = empty
    ? 10
    : niceCeilThroughput(Math.max(...all.map((p) => p.value)));

  const xAt = (no: number) => {
    if (maxNo === minNo) return (LEFT + RIGHT) / 2;
    return LEFT + ((no - minNo) / (maxNo - minNo)) * (RIGHT - LEFT);
  };
  const yAt = (v: number) => BOTTOM - (v / maxY) * (BOTTOM - TOP);

  const toPoints = (pts: Array<{ no: number; value: number }>) =>
    pts.map((p) => `${xAt(p.no)},${yAt(p.value)}`).join(" ");

  const xTickCount = Math.min(20, Math.max(2, maxNo - minNo + 1));
  const xTicks: number[] = [];
  if (maxNo === minNo) xTicks.push(minNo);
  else {
    for (let i = 0; i < xTickCount; i++) {
      xTicks.push(
        Math.round(minNo + ((maxNo - minNo) * i) / (xTickCount - 1)),
      );
    }
  }

  const yTicks = Array.from({ length: 11 }, (_, i) => (maxY / 10) * i);

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
              const y = TOP + ((10 - i) / 10) * (BOTTOM - TOP);
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
              const y = TOP + ((10 - i) / 10) * (BOTTOM - TOP) + 4;
              const label =
                maxY === 10 ? String(i) : String(Math.round(v * 10) / 10);
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
          />
          <polyline
            className="case3-thrp-line case3-thrp-line--w"
            fill="none"
            stroke="#22D3EE"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={toPoints(withSeries)}
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
