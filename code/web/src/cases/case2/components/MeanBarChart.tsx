/**
 * 均值柱 + 降幅徽章；柱高按当前样本 mean 计算。
 */

import barFillUrl from "../../../../assets/case2/icons/bar-initial-fill.png";
import badgeBgUrl from "../../../../assets/case2/icons/reduction-badge-bg.png";
import arrowUrl from "../../../../assets/case2/icons/reduction-arrow-icon.png";
import {
  formatOneDecimal,
  formatReductionLabel,
  layoutMeanBar,
  meanOf,
  reductionPercent,
} from "../metrics/statistics";

type Props = {
  initialKpi: number[];
  calibratedKpi: number[] | null;
  showReduction: boolean;
};

const PLOT = { top: 20, height: 140 };

export function MeanBarChart(props: Props) {
  const { initialKpi, calibratedKpi, showReduction } = props;
  const meanInit = meanOf(initialKpi);
  const meanCali =
    calibratedKpi && calibratedKpi.length > 0 ? meanOf(calibratedKpi) : null;
  const showCali = meanCali !== null;

  const initLayout = layoutMeanBar(
    meanInit,
    showCali ? [meanCali] : [],
    PLOT,
  );
  const caliLayout = showCali
    ? layoutMeanBar(meanCali, [meanInit], PLOT)
    : null;

  const reduction =
    showReduction && showCali
      ? reductionPercent(meanInit, meanCali)
      : null;

  return (
    <div className="bar-area">
      <div className="chart-head">
        <span>平均误差</span>
        <div className="legend legend--sm">
          <span className="leg-initial">Initial</span>
          {showCali ? <span className="leg-calibrated">Calibrated</span> : null}
        </div>
      </div>
      <div className="bar-plot" style={{ position: "relative", height: 180 }}>
        <div
          className="zero-baseline"
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            top: initLayout.zeroY,
            height: 1,
            background: "var(--case2-color-baseline)",
          }}
        />
        <div className="bar-group bar-group--initial">
          <div
            className="mean-bar mean-bar--initial"
            style={{
              position: "absolute",
              left: 8,
              width: 40,
              top: initLayout.barTop,
              height: Math.max(initLayout.barHeight, meanInit === 0 ? 2 : 0),
              backgroundImage: `url(${barFillUrl})`,
              backgroundSize: "100% 100%",
            }}
          />
          <div className="mean-value" style={{ top: Math.max(0, initLayout.barTop - 22) }}>
            {formatOneDecimal(meanInit)}
          </div>
        </div>
        {showCali && caliLayout ? (
          <div className="bar-group bar-group--calibrated">
            <div
              className="mean-bar mean-bar--calibrated"
              style={{
                position: "absolute",
                left: 8,
                width: 40,
                top: caliLayout.barTop,
                height: Math.max(caliLayout.barHeight, meanCali === 0 ? 2 : 0),
                background: "var(--case2-color-calibrated)",
              }}
            />
            <div
              className="mean-value"
              style={{ top: Math.max(0, caliLayout.barTop - 22) }}
            >
              {formatOneDecimal(meanCali)}
            </div>
          </div>
        ) : null}
        {showReduction && showCali ? (
          <div
            className="reduction-badge"
            style={{ backgroundImage: `url(${badgeBgUrl})` }}
          >
            <img src={arrowUrl} width={16} height={16} alt="" />
            <span>{formatReductionLabel(reduction)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
