/**
 * CDF 阶梯图。输入 statistics.cdf，不从逐点误差重算。
 * 空态只保留轴骨架，不画中心「--」覆盖层（对齐已接受静态 / Pencil 空闲）。
 */

import { cdfGeometry, cdfXTicks, formatFixed } from "../metrics/case4Metrics";
import type { CdfPoint, Scheme } from "../types";

const COLORS: Record<Scheme, string> = {
  traditional: "#97AAC4",
  commercial: "#F0A12E",
  dt: "#7A6BFF",
};

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

type Props = {
  cdf: Record<Scheme, CdfPoint[]> | null;
};

/**
 * CDF 卡内图。
 */
export function CdfChart(props: Props) {
  const geom = props.cdf ? cdfGeometry(props.cdf) : null;
  const empty = !geom || geom.series.every((s) => !s.d);
  return (
    <div className="c4-cdf" data-region="CDF">
      <div className="c4-subhead">CDF图对比</div>
      <div className="c4-cdf-plot">
        <div className="c4-cdf-grid" aria-hidden />
        <svg
          className="c4-cdf-svg"
          viewBox="0 0 280 136"
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
      </div>
    </div>
  );
}
