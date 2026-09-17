/**
 * CEP 50/90 柱。柱高用原值，标签 toFixed(1)。禁止固定像素特例。
 * 空态保留轴与「传统/商用/DT」标签，不画柱、不用「--」占位。
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
  dt: "#7A6BFF",
};

const LABELS: Record<Scheme, string> = {
  traditional: "传统",
  commercial: "商用",
  dt: "DT",
};

const SCHEME_ORDER: Scheme[] = ["traditional", "commercial", "dt"];

const PLOT_MAX = 109;
/** 与 `.c4-cep-label` 高度一致，用于传统柱顶虚线。 */
const CEP_LABEL_H = 13;
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
  return [1, 0.75, 0.5, 0.25, 0].map((ratio) => formatFixed(yMax * ratio, 1));
}

/** 虚线始终锚传统柱顶；气泡同时让开 DT 数值顶边。 */
function cepDeltaBottomPx(tradHeight: number, dtHeight: number): number {
  const onBaseline = CEP_LABEL_H + tradHeight + CEP_CARET_H;
  const aboveDtValue = CEP_LABEL_H + dtHeight + CEP_VALUE_H + CEP_DELTA_GAP;
  return Math.max(onBaseline, aboveDtValue);
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
  const title = props.kind === "p50M" ? "CEP(50%)" : "CEP(90%)";
  const geom = props.cep
    ? cepGroupGeometry(cepFromStatistics(props.cep, props.kind))
    : null;
  const ticks = geom ? dataTicks(geom.yMax) : EMPTY_TICKS[props.kind];
  const delta = props.cep
    ? cepImprovement(props.cep.traditional[props.kind], props.cep.dt[props.kind])
    : null;
  const tradBar = geom?.bars.find((b) => b.scheme === "traditional");
  const dtBar = geom?.bars.find((b) => b.scheme === "dt");
  const tradHeight = tradBar ? PLOT_MAX * tradBar.heightRatio : 0;
  const dtHeight = dtBar ? PLOT_MAX * dtBar.heightRatio : 0;
  const baselineBottom = CEP_LABEL_H + tradHeight;
  const deltaBottom = cepDeltaBottomPx(tradHeight, dtHeight);
  const showBaseline = delta != null && tradHeight > 0;
  return (
    <div
      className="c4-cep"
      data-region="CEP"
      data-cep={props.kind === "p50M" ? "50" : "90"}
    >
      <div className="c4-subhead">{title}</div>
      <div className="c4-cep-slot">
        <div className="c4-cep-grid" aria-hidden />
        <div className="c4-cep-y">
          {ticks.map((t, i) => (
            <span key={`${t}-${i}`}>{t}</span>
          ))}
        </div>
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
            return (
              <div key={scheme} className="c4-cep-col">
                {scheme === "dt" && delta && showBaseline ? (
                  <span
                    className="c4-cep-delta"
                    data-cep-delta
                    data-cep-delta-dir={delta.direction}
                    style={{ bottom: `${deltaBottom}px` }}
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
                <div className="c4-cep-label">{LABELS[scheme]}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
