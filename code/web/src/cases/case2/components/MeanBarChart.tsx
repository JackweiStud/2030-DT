/**
 * 均值柱：Gate 1.5 静态 chrome（轴/基线/双标签）+ 运行时柱高。
 * 初始态也保留「Calibrated DT」轴标签，仅隐藏柱体。
 */

import barFillUrl from "../../../../assets/case2/icons/bar-initial-fill.png";
import badgeBgUrl from "../../../../assets/case2/icons/reduction-badge-bg.png";
import arrowUrl from "../../../../assets/case2/icons/reduction-arrow-icon.png";
import {
  formatOneDecimal,
  formatReductionLabel,
  meanOf,
  reductionPercent,
} from "../metrics/statistics";

type Props = {
  initialKpi: number[];
  calibratedKpi: number[] | null;
  showReduction: boolean;
};

/**
 * 与 web-static 一致的绘图几何（bar-plot 内像素）。
 * y 轴上界 = 当前柱均值最大值 / 0.6（最高柱约占可视柱高的 60%）。
 */
const BASELINE_Y = 190;
const BAR_BOTTOM = 190;
const BAR_MAX_HEIGHT = 101;
const BAR_LEFT_INIT = 8;
const BAR_LEFT_CALI = 10;
const BAR_WIDTH = 40;
const MEAN_OFFSET_ABOVE = 26;
/** 降幅徽章相对 Initial 均值文案再上移，避免盖住 Calibrated 均值 */
const REDUCTION_BADGE_LIFT = 15;
/** 最高柱相对 BAR_MAX_HEIGHT 的目标占比 */
const Y_MAX_FILL_RATIO = 0.8;

const GUIDE_DASH =
  "M0 1h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6";

/** 柱区均值文案：四舍五入为整数。 */
function formatBarMean(value: number): string {
  return formatOneDecimal(value);
}

/** 视觉 y 域上界：两柱均值最大值 / 0.6。 */
function resolveYMax(means: number[]): number {
  const dataMax = Math.max(0, ...means.filter((v) => Number.isFinite(v)));
  if (dataMax <= 0) return 1;
  return dataMax / Y_MAX_FILL_RATIO;
}

/** 把均值映射到柱高（从基线向上）。 */
function barGeometry(mean: number, yMax: number): { top: number; height: number } {
  const t = yMax <= 0 ? 0 : Math.min(1, Math.max(0, mean / yMax));
  const height = Math.max(mean === 0 ? 2 : 0, Math.round(BAR_MAX_HEIGHT * t));
  return { top: BAR_BOTTOM - height, height };
}

/** y 轴五档文案（上→下）。 */
function yAxisLabels(yMax: number): string[] {
  const step = yMax / 4;
  return [yMax, yMax - step, yMax - 2 * step, yMax - 3 * step, 0].map((v) =>
    Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toString(),
  );
}

export function MeanBarChart(props: Props) {
  const { initialKpi, calibratedKpi, showReduction } = props;
  const meanInit = meanOf(initialKpi);
  const meanCali =
    calibratedKpi && calibratedKpi.length > 0 ? meanOf(calibratedKpi) : null;
  const showCali = meanCali !== null;

  const yMax = resolveYMax(showCali ? [meanInit, meanCali] : [meanInit]);
  const yLabels = yAxisLabels(yMax);
  const initBar = barGeometry(meanInit, yMax);
  const caliBar = showCali ? barGeometry(meanCali, yMax) : null;

  const reduction =
    showReduction && showCali
      ? reductionPercent(meanInit, meanCali)
      : null;

  return (
    <div className="bar-area">
      <div className="chart-head">
        <span>平均值对比</span>
        <div className="legend legend--sm">
          <span className="leg-initial">● Initial DT</span>
          <span className="leg-calibrated">● Calibrated DT</span>
        </div>
      </div>
      <div className="bar-plot">
        <div className="bar-y-axis" aria-hidden>
          {yLabels.map((text, index) => (
            <span key={`y-${index}`}>{text}</span>
          ))}
        </div>

        <div className="bar-group bar-group--initial">
          <span
            className="mean-value"
            style={{ top: Math.max(4, initBar.top - MEAN_OFFSET_ABOVE) }}
          >
            {formatBarMean(meanInit)}
          </span>
          <div
            className="bar-initial"
            style={{
              left: BAR_LEFT_INIT,
              width: BAR_WIDTH,
              top: initBar.top,
              height: initBar.height,
              backgroundImage: `url(${barFillUrl})`,
            }}
          />
          <span className="bar-axis-label">Initial DT</span>
        </div>

        {/* 初始态也保留 Calibrated 轴标签（无柱），对齐静态 HTML */}
        <div className="bar-group bar-group--calibrated">
          {showCali && caliBar ? (
            <>
              <span
                className="mean-value"
                style={{ top: Math.max(4, caliBar.top - MEAN_OFFSET_ABOVE) }}
              >
                {formatBarMean(meanCali)}
              </span>
              <div
                className="bar-calibrated-fill"
                style={{
                  left: BAR_LEFT_CALI,
                  width: BAR_WIDTH,
                  top: caliBar.top,
                  height: caliBar.height,
                }}
              />
            </>
          ) : null}
          <span className="bar-axis-label">Calibrated DT</span>
        </div>

        <div className="bar-baseline" style={{ top: BASELINE_Y }} />

        {showCali && caliBar ? (
          <svg
            className="bar-guide-dash"
            style={{ top: caliBar.top }}
            viewBox="0 0 200 2"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path d={GUIDE_DASH} />
          </svg>
        ) : null}

        {showReduction && showCali ? (
          <div
            className="reduction-badge"
            style={{
              backgroundImage: `url(${badgeBgUrl})`,
              top: Math.max(
                4,
                initBar.top - MEAN_OFFSET_ABOVE - REDUCTION_BADGE_LIFT,
              ),
            }}
          >
            <img src={arrowUrl} width={24} height={24} alt="" />
            <span>{formatReductionLabel(reduction)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
