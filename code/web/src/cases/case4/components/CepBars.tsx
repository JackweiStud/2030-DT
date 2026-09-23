/**
 * CEP 50/90 柱。柱高用原值，标签 toFixed(1)。禁止固定像素特例。
 * 空态保留轴与「传统/商用/DT」标签，不画柱、不用「--」占位。
 * X 轴标签在独立行，位于 Y=0 基线下方，不与柱列共用底部空间。
 */

import {
  cepFromStatistics,
  cepGroupGeometry,
  cepImprovement,
  formatFixed,
} from "../metrics/case4Metrics";
import type { CepPoint, Scheme } from "../types";

const COLORS: Record<Scheme, string> = {
  traditional: "#97AAC4",
  commercial: "#F0A12E",
  dt: "rgba(90, 191, 251, 1)",
};

const LABELS: Record<Scheme, string> = {
  traditional: "方案1",
  commercial: "方案2",
  dt: "DT",
};

const SCHEME_ORDER: Scheme[] = ["traditional", "commercial", "dt"];
/** 相对传统画变化气泡的方案。 */
const DELTA_SCHEMES: Scheme[] = ["commercial", "dt"];

/** 与 `.c4-cep-grid` 高度一致；柱区 136 高，顶部只留半行给最高刻度文字。 */
const PLOT_MAX = 130;
/** 与 `.c4-cep-x` 高度 + margin-top 一致；Y=0 基线距柱槽底边的距离。 */
const CEP_X_AXIS_H = 22;
/** 与 ticks 顺序一一对应（顶 → 底）。 */
const TICK_RATIOS = [1, 0.75, 0.5, 0.25, 0] as const;
/** 与 `.c4-cep-value` 的 11px × line-height 1.2 一致。 */
const CEP_VALUE_H = 13.2;
/** 气泡底边小三角高度，尖端落在虚线上。 */
const CEP_CARET_H = 8;
/** 气泡底边相对 DT 数值顶边的间距。 */
const CEP_DELTA_GAP = 2;

/** Pencil 空闲轴骨架，不参与有数据时的 yMax 映射。 */
const EMPTY_TICKS = {
  p50M: ["4.0", "3.0", "2.0", "1.0", "0.0"],
  p90M: ["10.0", "7.5", "5.0", "2.5", "0.0"],
} as const;

type Props = {
  cep: Record<Scheme, CepPoint> | null;
  kind: "p50M" | "p90M";
};

function dataTicks(yMax: number): string[] {
  return TICK_RATIOS.map((ratio) => formatFixed(yMax * ratio, 1));
}

/** 虚线始终锚传统柱顶；气泡同时让开本列数值顶边。bottom 相对柱图区底边。 */
function cepDeltaBottomPx(tradHeight: number, barHeight: number): number {
  const onBaseline = tradHeight + CEP_CARET_H;
  const aboveValue = barHeight + CEP_VALUE_H + CEP_DELTA_GAP;
  return Math.max(onBaseline, aboveValue);
}

function CepDeltaArrow(props: { direction: "up" | "down" }) {
  const down = props.direction === "down";
  return (
    <svg
      className="c4-cep-delta__arrow"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden
    >
      <path
        fill="currentColor"
        d={
          down
            ? "M9.2 2.8h5.6v8.2H19L12 21.4 5 11H9.2V2.8z"
            : "M9.2 21.2h5.6v-8.2H19L12 2.6 5 13h4.2v8.2z"
        }
      />
    </svg>
  );
}

/**
 * 一组 CEP 柱。
 */
export function CepBars(props: Props) {
  const title = props.kind === "p50M" ? "CEP,50%" : "CEP,90%";
  const geom = props.cep
    ? cepGroupGeometry(cepFromStatistics(props.cep, props.kind))
    : null;
  const ticks = geom ? dataTicks(geom.yMax) : EMPTY_TICKS[props.kind];
  const heightOf = (scheme: Scheme) => {
    const bar = geom?.bars.find((b) => b.scheme === scheme);
    return bar ? PLOT_MAX * bar.heightRatio : 0;
  };
  const tradHeight = heightOf("traditional");
  const deltas = new Map(
    DELTA_SCHEMES.map((scheme) => [
      scheme,
      props.cep
        ? cepImprovement(
            props.cep.traditional[props.kind],
            props.cep[scheme][props.kind],
          )
        : null,
    ]),
  );
  const baselineBottom = tradHeight;
  const showBaseline =
    tradHeight > 0 && [...deltas.values()].some((d) => d != null);
  return (
    <div
      className="c4-cep"
      data-region="CEP"
      data-cep={props.kind === "p50M" ? "50" : "90"}
    >
      <div className="c4-subhead">{title}</div>
      <div className="c4-cep-slot">
        <div className="c4-cep-grid" aria-hidden>
          <i className="c4-cep-grid__line" style={{ bottom: "0px" }} />
        </div>
        <div className="c4-cep-y">
          {ticks.map((t, i) => (
            <span
              key={`${t}-${i}`}
              style={{
                bottom: `${CEP_X_AXIS_H + (TICK_RATIOS[i] ?? 0) * PLOT_MAX}px`,
              }}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="c4-cep-main">
          <div className="c4-cep-plot">
            {showBaseline ? (
              <div
                className="c4-cep-baseline"
                data-cep-baseline
                style={{ bottom: `${baselineBottom}px` }}
              />
            ) : null}
            {SCHEME_ORDER.map((scheme) => {
              const bar = geom?.bars.find((b) => b.scheme === scheme);
              const value = bar ? formatFixed(bar.value, 1) : "";
              const height = bar ? PLOT_MAX * bar.heightRatio : 0;
              const emptyBar = !bar || bar.heightRatio === 0;
              const delta = deltas.get(scheme);
              return (
                <div key={scheme} className="c4-cep-col">
                  {delta && showBaseline ? (
                    <span
                      className="c4-cep-delta"
                      data-cep-delta={scheme}
                      data-cep-delta-dir={delta.direction}
                      style={{
                        bottom: `${cepDeltaBottomPx(tradHeight, height)}px`,
                      }}
                    >
                      <CepDeltaArrow direction={delta.direction} />
                      <span className="c4-cep-delta__readout">
                        <span className="c4-cep-delta__num">
                          {delta.label.replace(/%$/, "")}
                        </span>
                        <span className="c4-cep-delta__pct">%</span>
                      </span>
                    </span>
                  ) : null}
                  <div className="c4-cep-value-wrap">
                    <div className="c4-cep-value">{value}</div>
                  </div>
                  <div
                    className={`c4-cep-bar${emptyBar ? " is-empty" : ""}`}
                    style={{
                      height: `${height}px`,
                      background: COLORS[scheme],
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="c4-cep-x">
            {SCHEME_ORDER.map((scheme) => (
              <div key={scheme} className="c4-cep-label">
                {LABELS[scheme]}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
