/**
 * CDF 阶梯 SVG；Initial 单线或 completed/resetting 双线共用 x 域。
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
  title: string;
};

const PLOT = { left: 36, top: 8, width: 320, height: 180 };

export function CdfChart(props: Props) {
  const { initialKpi, calibratedKpi, cdfPointCap, title } = props;
  const showCali = calibratedKpi !== null && calibratedKpi.length > 0;

  const initPoints = buildEmpiricalCdfPoints(initialKpi, cdfPointCap);
  const caliPoints = showCali
    ? buildEmpiricalCdfPoints(calibratedKpi, cdfPointCap)
    : null;

  const domainValues = showCali
    ? [...initialKpi, ...calibratedKpi]
    : [...initialKpi];
  const domain = resolveXDomain(domainValues);

  const initPath = buildCdfStairPath(initPoints, domain, PLOT);
  const caliPath = caliPoints
    ? buildCdfStairPath(caliPoints, domain, PLOT)
    : null;

  return (
    <div className="cdf-area">
      <div className="chart-head">
        <span>{title}</span>
        <div className="legend">
          <span className="leg-initial">Initial</span>
          {showCali ? <span className="leg-calibrated">Calibrated</span> : null}
        </div>
      </div>
      <div className="cdf-plot">
        <svg className="cdf-svg" viewBox="0 0 400 220" preserveAspectRatio="none">
          <line
            x1={PLOT.left}
            y1={PLOT.top + PLOT.height}
            x2={PLOT.left + PLOT.width}
            y2={PLOT.top + PLOT.height}
            stroke="var(--case2-color-axis)"
            strokeWidth="1"
          />
          <line
            x1={PLOT.left}
            y1={PLOT.top}
            x2={PLOT.left}
            y2={PLOT.top + PLOT.height}
            stroke="var(--case2-color-axis)"
            strokeWidth="1"
          />
          <path d={initPath} fill="none" stroke="var(--case2-color-cdf-initial)" strokeWidth="2" />
          {caliPath ? (
            <path
              d={caliPath}
              fill="none"
              stroke="var(--case2-color-calibrated)"
              strokeWidth="2"
            />
          ) : null}
        </svg>
      </div>
    </div>
  );
}
