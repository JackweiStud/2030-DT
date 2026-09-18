/**
 * CDF 阶梯图。输入 statistics.cdf，不从逐点误差重算。
 * 空态只保留轴骨架，不画中心「--」覆盖层（对齐已接受静态 / Pencil 空闲）。
 * 悬停横线跟概率走，读三方案在该 P 下的误差（阶梯分位，不插值）。
 */

import { useState } from "react";
import {
  cdfGeometry,
  cdfQuantileErrorM,
  cdfXTicks,
  formatFixed,
} from "../metrics/case4Metrics";
import type { CdfPoint, Scheme } from "../types";
import { SCHEMES } from "../types";

const COLORS: Record<Scheme, string> = {
  traditional: "#97AAC4",
  commercial: "#F0A12E",
  dt: "#7A6BFF",
};

const TIP_ROWS: Array<{ scheme: Scheme; name: string }> = [
  { scheme: "traditional", name: "传统基站定位" },
  { scheme: "commercial", name: "商用方案定位" },
  { scheme: "dt", name: "数字孪生辅助定位" },
];

const Y_TICKS = ["1.0", "0.8", "0.6", "0.4", "0.2", "0.0"] as const;
/** 空轴 X 骨架，仅作 chrome，不参与有数据时的 0～max 映射。 */
const EMPTY_X_TICKS = [
  "0",
  "0.5",
  "1.0",
  "1.5",
  "2.0",
  "2.5",
  "3.0",
  "3.5",
  "4.0",
  "4.5",
] as const;

const PLOT_W = 280;
const PLOT_H = 136;
const PLOT_LEFT = 28;
const PLOT_TOP = 8;
const TIP_W = 200;
const TIP_GAP = 20;

type Props = {
  cdf: Record<Scheme, CdfPoint[]> | null;
};

function yOfProb(probability: number): number {
  return PLOT_H - Math.min(1, Math.max(0, probability)) * PLOT_H;
}

function xOfError(errorM: number, xMax: number): number {
  if (!(Number.isFinite(xMax) && xMax > 0)) return 0;
  return (Math.max(0, errorM) / xMax) * PLOT_W;
}

function boardScaleY(el: HTMLElement): number {
  const cssHeight = el.getBoundingClientRect().height;
  const layoutHeight = el.offsetHeight;
  return cssHeight > 0 && layoutHeight > 0 ? cssHeight / layoutHeight : 1;
}

function localYFromClient(el: HTMLElement, clientY: number): number {
  const rect = el.getBoundingClientRect();
  const scale = boardScaleY(el);
  return (clientY - rect.top) / scale;
}

/** 绘图区 Y → 一位小数概率；轴外返回 null。 */
export function cdfHoverProbFromLocalY(localY: number): number | null {
  if (localY < 0 || localY > PLOT_H) return null;
  const raw = 1 - localY / PLOT_H;
  const p = Math.round(raw * 10) / 10;
  if (p < 0 || p > 1) return null;
  return p;
}

function metersLabel(errorM: number | null): string {
  if (errorM == null) return "--";
  return `${formatFixed(errorM, 1)}m`;
}

/**
 * CDF 卡内图。
 */
export function CdfChart(props: Props) {
  const geom = props.cdf ? cdfGeometry(props.cdf) : null;
  const empty = !geom || geom.series.every((s) => !s.d);
  const [hoverP, setHoverP] = useState<number | null>(null);

  const quantiles =
    hoverP != null && props.cdf
      ? SCHEMES.map((scheme) => ({
          scheme,
          errorM: cdfQuantileErrorM(props.cdf?.[scheme] ?? [], hoverP),
        }))
      : [];
  const hovered =
    hoverP != null && quantiles.some((q) => q.errorM != null) ? hoverP : null;

  function applyHover(event: React.PointerEvent<HTMLDivElement>) {
    if (empty || !props.cdf) {
      setHoverP(null);
      return;
    }
    const p = cdfHoverProbFromLocalY(
      localYFromClient(event.currentTarget, event.clientY),
    );
    if (p == null) {
      setHoverP(null);
      return;
    }
    const has = SCHEMES.some(
      (scheme) => cdfQuantileErrorM(props.cdf?.[scheme] ?? [], p) != null,
    );
    setHoverP(has ? p : null);
  }

  function onPointerLeave(event: React.PointerEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setHoverP(null);
  }

  const lineTop =
    hovered != null ? PLOT_TOP + yOfProb(hovered) : null;
  const tipStyle =
    hovered != null && lineTop != null
      ? {
          left: `${PLOT_LEFT + PLOT_W / 2 - TIP_W / 2}px`,
          top: `${lineTop}px`,
          transform: `translateY(calc(-100% - ${TIP_GAP}px))`,
        }
      : undefined;

  return (
    <div className={`c4-cdf${hovered != null ? " is-hover" : ""}`} data-region="CDF">
      <div className="c4-subhead">CDF图对比</div>
      <div className="c4-cdf-plot">
        <div className="c4-cdf-grid" aria-hidden />
        <svg
          className="c4-cdf-svg"
          viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
          preserveAspectRatio="none"
        >
          {geom
            ? geom.series.map((s) =>
                s.d ? (
                  <path
                    key={s.scheme}
                    d={s.d}
                    fill="none"
                    stroke={COLORS[s.scheme]}
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                ) : null,
              )
            : null}
        </svg>
        <div className="c4-cdf-y">
          {Y_TICKS.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="c4-cdf-x">
          {geom && !empty
            ? cdfXTicks(geom.xMax).map((v, i) => (
                <span key={`x-${i}`}>{formatFixed(v, 1)}</span>
              ))
            : EMPTY_X_TICKS.map((t) => (
                <span key={t}>{t}</span>
              ))}
        </div>
        {hovered != null && lineTop != null ? (
          <div
            className="c4-cdf-cursor"
            style={{ top: `${lineTop}px` }}
            aria-hidden
          />
        ) : null}
        {hovered != null && lineTop != null && geom
          ? quantiles.map((q) =>
              q.errorM == null ? null : (
                <span
                  key={`q-${q.scheme}`}
                  className="c4-cdf-hover-dot"
                  style={{
                    left: `${PLOT_LEFT + xOfError(q.errorM, geom.xMax)}px`,
                    top: `${lineTop}px`,
                    background: COLORS[q.scheme],
                  }}
                />
              ),
            )
          : null}
        {hovered != null && lineTop != null ? (
          <span
            className="c4-cdf-hover-p"
            style={{ top: `${lineTop}px` }}
            aria-hidden
          >
            {formatFixed(hovered, 1)}
          </span>
        ) : null}
        {hovered != null ? (
          <div
            className="c4-cdf-tip"
            data-cdf-tip
            data-cdf-tip-p={formatFixed(hovered, 1)}
            style={tipStyle}
            aria-hidden
          >
            {TIP_ROWS.map((row) => {
              const q = quantiles.find((item) => item.scheme === row.scheme);
              return (
                <div key={row.scheme} className="c4-cdf-tip__row">
                  <i
                    className="c4-cdf-tip__dot"
                    style={{ background: COLORS[row.scheme] }}
                  />
                  <span>{row.name}</span>
                  <b>{metersLabel(q?.errorM ?? null)}</b>
                </div>
              );
            })}
            <i className="c4-cdf-tip__arrow" />
          </div>
        ) : null}
        {!empty ? (
          <div
            className="c4-cdf-hit"
            data-cdf-surface
            data-hover-p={hovered == null ? "" : formatFixed(hovered, 1)}
            onPointerMove={applyHover}
            onPointerLeave={onPointerLeave}
          />
        ) : null}
      </div>
    </div>
  );
}
