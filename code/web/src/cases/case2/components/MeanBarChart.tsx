/**
 * 均值柱：Gate 1.5 静态 chrome（轴/基线/双标签）+ 运行时柱高。
 * 初始态也保留「Calibrated DT」轴标签，仅隐藏柱体。
 * 无 Initial 样本时只出 chrome，不画柱/均值/降幅。
 */

import barFillUrl from "../../../../assets/case2/icons/bar-initial-fill.png";
import badgeBgUrl from "../../../../assets/case2/icons/reduction-badge-bg.png";
import arrowUrl from "../../../../assets/case2/icons/reduction-arrow-icon.png";
import {
  formatReductionLabel,
  meanChangeMarker,
  meanChangeStackTops,
  meanOf,
  relativeChangePercent,
} from "../metrics/statistics";

type Props = {
  initialKpi: number[];
  calibratedKpi: number[] | null;
  showReduction: boolean;
};

/**
 * 与 web-static 一致的绘图几何（bar-plot 内像素）。
 * y 轴上界 = 当前柱均值最大值 / Y_MAX_FILL_RATIO。
 */
const BASELINE_Y = 190;
const BAR_BOTTOM = 190;
const BAR_MAX_HEIGHT = 101;
const BAR_LEFT_INIT = 8;
const BAR_LEFT_CALI = 10;
const BAR_WIDTH = 40;
const MEAN_OFFSET_ABOVE = 26;
/** 最高柱相对 BAR_MAX_HEIGHT 的目标占比 */
const Y_MAX_FILL_RATIO = 0.8;
/** 无样本时的占位 y 上界（仅轴刻度 chrome，对齐 Gate 1.5 默认刻度）。 */
const EMPTY_Y_MAX = 8;

const GUIDE_DASH =
  "M0 1h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6m4 0h6";

/** 柱顶均值文案：固定一位小数（如 5.0）。 */
function formatBarMean(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

/** 视觉 y 域上界：两柱均值最大值 / Y_MAX_FILL_RATIO。 */
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
  const hasInit = initialKpi.length > 0;
  const meanInit = hasInit ? meanOf(initialKpi) : null;
  const meanCali =
    calibratedKpi && calibratedKpi.length > 0 ? meanOf(calibratedKpi) : null;
  const showCali = meanCali !== null;

  const yMax = hasInit
    ? resolveYMax(showCali ? [meanInit!, meanCali] : [meanInit!])
    : EMPTY_Y_MAX;
  const yLabels = yAxisLabels(yMax);
  const initBar =
    hasInit && meanInit !== null ? barGeometry(meanInit, yMax) : null;
  const caliBar = showCali ? barGeometry(meanCali, yMax) : null;

  const changePct =
    showReduction && showCali && meanInit !== null
      ? relativeChangePercent(meanInit, meanCali)
      : null;
  const changeMarker =
    showReduction && showCali && initBar && caliBar && meanInit !== null
      ? meanChangeMarker(meanInit, meanCali, initBar.top, caliBar.top)
      : null;
  const stackTops =
    showReduction && caliBar ? meanChangeStackTops(caliBar.top, MEAN_OFFSET_ABOVE) : null;
  const caliMeanTop = stackTops
    ? stackTops.caliMeanTop
    : caliBar
      ? Math.max(4, caliBar.top - MEAN_OFFSET_ABOVE)
      : 4;

  return (
    <div className="bar-area">
      <div className="chart-head">
        <span>平均误差</span>
        <div className="legend legend--sm">
          <span className="leg-initial">● 初始 DT</span>
          <span className="leg-calibrated">● 校正 DT</span>
        </div>
      </div>
      <div className="bar-plot">
        <div className="bar-y-axis" aria-hidden>
          {yLabels.map((text, index) => (
            <span key={`y-${index}`}>{text}</span>
          ))}
        </div>

        <div className="bar-group bar-group--initial">
          {initBar && meanInit !== null ? (
            <>
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
            </>
          ) : null}
          <span className="bar-axis-label">初始 DT</span>
        </div>

        {/* 初始态也保留 Calibrated 轴标签（无柱），对齐静态 HTML */}
        <div className="bar-group bar-group--calibrated">
          {showCali && caliBar ? (
            <>
              <span className="mean-value" style={{ top: caliMeanTop }}>
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
          <span className="bar-axis-label">校正 DT</span>
        </div>

        <div className="bar-baseline" style={{ top: BASELINE_Y }} />

        {showCali && caliBar ? (
          <svg
            className="bar-guide-dash"
            style={{ top: changeMarker?.guideTop ?? caliBar.top }}
            viewBox="0 0 200 2"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path d={GUIDE_DASH} />
          </svg>
        ) : null}

        {showReduction && showCali && caliBar && changeMarker ? (
          <div
            className="reduction-badge"
            style={{
              backgroundImage: `url(${badgeBgUrl})`,
              top: stackTops?.badgeTop ?? 4,
            }}
          >
            <img
              src={arrowUrl}
              width={24}
              height={24}
              alt={changeMarker.increased ? "相对 Initial 增加" : "相对 Initial 减少"}
              className={
                changeMarker.increased
                  ? "reduction-badge__arrow is-up"
                  : "reduction-badge__arrow"
              }
              style={{ transform: `rotate(${changeMarker.arrowRotationDeg}deg)` }}
            />
            <span>{formatReductionLabel(changePct)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
