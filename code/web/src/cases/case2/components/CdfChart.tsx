/**
 * CDF 图：Gate 1.5 网格 chrome + 运行时阶梯曲线。
 * 轴标用 HTML 叠加（避免 html-to-image 对嵌套 SVG text 栅格化失真）。
 * 无有效样本时只出 chrome（网格/轴），不画阶梯线。
 * 哨兵 -1 不进入台阶；x 域从有效最小值起。
 */

import {
  buildCdfStairPath,
  buildCdfXAxis,
  buildEmpiricalCdfPoints,
  resolveXDomain,
  validKpiSamples,
} from "../metrics/statistics";

type Props = {
  initialKpi: number[];
  calibratedKpi: number[] | null;
  cdfPointCap: number;
};

/** 与静态 HTML 同构的绘图区（外层 viewBox 宽 384；高略增以给 x 轴刻度留空）。 */
const PLOT = { left: 26, top: 4, width: 348, height: 202 };
const VB = { w: 384, h: 222 };
const SVG_VIEWBOX = `0 0 ${VB.w} ${VB.h}`;
/** x 轴刻度相对网格底边（206）下移；对齐静态原型约 215，避免贴底被裁。 */
const X_TICK_Y = 215;

/** 无样本时的占位 x 域（仅用于轴刻度 chrome）。 */
const EMPTY_X_DOMAIN = { xMin: 0, xMax: 1 };

const Y_VALUES = [1, 0.8, 0.6, 0.4, 0.2, 0] as const;

const H_GRID = Y_VALUES.map((v) => PLOT.top + (1 - v) * PLOT.height);

const Y_LABELS = Y_VALUES.map((v, i) => ({
  y: H_GRID[i]!,
  text: String(v),
}));

function pctX(x: number): string {
  return `${(x / VB.w) * 100}%`;
}

function pctY(y: number): string {
  return `${(y / VB.h) * 100}%`;
}

export function CdfChart(props: Props) {
  const { initialKpi, calibratedKpi, cdfPointCap } = props;
  const initValid = validKpiSamples(initialKpi);
  const caliValid =
    calibratedKpi !== null ? validKpiSamples(calibratedKpi) : [];
  const hasInit = initValid.length > 0;
  const showCali = caliValid.length > 0;

  const initPoints = hasInit
    ? buildEmpiricalCdfPoints(initValid, cdfPointCap)
    : null;
  const caliPoints = showCali
    ? buildEmpiricalCdfPoints(caliValid, cdfPointCap)
    : null;

  const domainSource = showCali ? [...initValid, ...caliValid] : [...initValid];
  const domain =
    domainSource.length > 0 ? resolveXDomain(domainSource) : EMPTY_X_DOMAIN;
  const xTicks = buildCdfXAxis(domain.xMin, domain.xMax);

  const initPath = initPoints
    ? buildCdfStairPath(initPoints, domain, PLOT)
    : null;
  const caliPath = caliPoints
    ? buildCdfStairPath(caliPoints, domain, PLOT)
    : null;

  return (
    <div className="cdf-area">
      <div className="chart-head">
        <span>CDF</span>
      </div>
      <div className="cdf-plot">
        <svg
          className="cdf-svg"
          viewBox={SVG_VIEWBOX}
          preserveAspectRatio="none"
          aria-hidden
        >
          <g className="cdf-grid" stroke="#ffffff33" strokeWidth="1">
            {H_GRID.map((y) => (
              <line key={`h-${y}`} x1={26} y1={y} x2={374} y2={y} />
            ))}
            {xTicks.map((tick) => (
              <line key={`v-${tick.x}`} x1={tick.x} y1={4} x2={tick.x} y2={206} />
            ))}
          </g>
          {initPath ? (
            <path
              d={initPath}
              fill="none"
              stroke="var(--case2-color-cdf-initial)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {caliPath ? (
            <path
              d={caliPath}
              fill="none"
              stroke="var(--case2-color-calibrated)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>
        <div className="cdf-axis-labels cdf-axis-labels--y" aria-hidden>
          {Y_LABELS.map((item) => (
            <span
              key={item.text}
              className="cdf-axis-label cdf-axis-label--y"
              style={{ top: pctY(item.y) }}
            >
              {item.text}
            </span>
          ))}
        </div>
        <div className="cdf-axis-labels cdf-axis-labels--x" aria-hidden>
          {xTicks.map((item) => (
            <span
              key={`x-${item.x}`}
              className={`cdf-axis-label cdf-axis-label--x is-${item.align}`}
              style={{ left: pctX(item.x), top: pctY(X_TICK_Y) }}
            >
              {item.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
