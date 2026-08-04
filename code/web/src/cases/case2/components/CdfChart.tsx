/**
 * CDF 图：Gate 1.5 网格 chrome + 运行时阶梯曲线。
 * 轴标用 HTML 叠加（避免 html-to-image 对嵌套 SVG text 栅格化失真）。
 * 无样本时只出 chrome（网格/轴），不画阶梯线。
 */

import {
  buildCdfStairPath,
  buildEmpiricalCdfPoints,
  resolveXDomain,
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

const Y_LABELS = [
  { y: 8, text: "1" },
  { y: 28, text: "0.9" },
  { y: 48, text: "0.8" },
  { y: 69, text: "0.7" },
  { y: 89, text: "0.6" },
  { y: 109, text: "0.5" },
  { y: 129, text: "0.4" },
  { y: 149, text: "0.3" },
  { y: 170, text: "0.2" },
  { y: 190, text: "0.1" },
  { y: 210, text: "0" },
];

const H_GRID = [4, 24, 44, 65, 85, 105, 125, 145, 166, 186, 206];
const V_GRID = [
  26, 49, 72, 96, 119, 142, 165, 188, 212, 235, 258, 281, 304, 328, 351, 374,
];

function pctX(x: number): string {
  return `${(x / VB.w) * 100}%`;
}

function pctY(y: number): string {
  return `${(y / VB.h) * 100}%`;
}

/** 生成与静态接近的 x 轴刻度文案（按当前 domain 均匀取点）。 */
function buildXTickLabels(xMin: number, xMax: number): { x: number; text: string }[] {
  const count = V_GRID.length;
  const labels: { x: number; text: string }[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1);
    const value = xMin + (xMax - xMin) * t;
    const text =
      Math.abs(value) >= 10 || Number.isInteger(value)
        ? String(Math.round(value))
        : (Math.round(value * 10) / 10).toFixed(1);
    labels.push({ x: V_GRID[i]!, text });
  }
  return labels;
}

export function CdfChart(props: Props) {
  const { initialKpi, calibratedKpi, cdfPointCap } = props;
  const hasInit = initialKpi.length > 0;
  const showCali = calibratedKpi !== null && calibratedKpi.length > 0;

  const initPoints = hasInit
    ? buildEmpiricalCdfPoints(initialKpi, cdfPointCap)
    : null;
  const caliPoints = showCali
    ? buildEmpiricalCdfPoints(calibratedKpi, cdfPointCap)
    : null;

  const domainValues = showCali
    ? [...initialKpi, ...calibratedKpi]
    : [...initialKpi];
  const domain =
    domainValues.length > 0 ? resolveXDomain(domainValues) : EMPTY_X_DOMAIN;
  const xTicks = buildXTickLabels(domain.xMin, domain.xMax);

  const initPath = initPoints
    ? buildCdfStairPath(initPoints, domain, PLOT)
    : null;
  const caliPath = caliPoints
    ? buildCdfStairPath(caliPoints, domain, PLOT)
    : null;

  return (
    <div className="cdf-area">
      <div className="chart-head">
        <span>CDF图对比</span>
        <div className="legend">
          <span className="leg-initial">● Initial DT</span>
          <span className="leg-calibrated">● Calibrated DT</span>
        </div>
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
            {V_GRID.map((x) => (
              <line key={`v-${x}`} x1={x} y1={4} x2={x} y2={206} />
            ))}
          </g>
          {initPath ? (
            <path
              d={initPath}
              fill="none"
              stroke="#939393"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {caliPath ? (
            <path
              d={caliPath}
              fill="none"
              stroke="#22D3EE"
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
              className="cdf-axis-label cdf-axis-label--x"
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
