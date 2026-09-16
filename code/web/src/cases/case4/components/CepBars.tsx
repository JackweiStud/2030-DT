/**
 * CEP 50/90 柱。柱高用原值，标签 toFixed(1)。禁止固定像素特例。
 * 空态保留轴与「传统/商用/DT」标签，不画柱、不用「--」占位。
 */

import {
  cepFromStatistics,
  cepGroupGeometry,
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

/**
 * 一组 CEP 柱。
 */
export function CepBars(props: Props) {
  const title = props.kind === "p50M" ? "CEP(50%)" : "CEP(90%)";
  const geom = props.cep
    ? cepGroupGeometry(cepFromStatistics(props.cep, props.kind))
    : null;
  const ticks = geom ? dataTicks(geom.yMax) : EMPTY_TICKS[props.kind];
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
          {SCHEME_ORDER.map((scheme) => {
            const bar = geom?.bars.find((b) => b.scheme === scheme);
            const value = bar ? formatFixed(bar.value, 1) : "";
            const height = bar ? PLOT_MAX * bar.heightRatio : 0;
            const emptyBar = !bar || bar.heightRatio === 0;
            return (
              <div key={scheme} className="c4-cep-col">
                <div className="c4-cep-value">{value}</div>
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
