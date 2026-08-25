/**
 * 波束预测准确率：调用现有 deriveBeamAccuracy，初始显示 init-data 基线。
 * 主文案在独立 overlay，不受绿/红 fill 宽度裁切。
 */

import {
  deriveBeamAccuracy,
  formatOneDecimal,
} from "../../case3/metrics/case3Metrics";
import type { BeamAccuracyBaseline, SideSnapshot } from "../../case3/types";

type Props = {
  baseline: BeamAccuracyBaseline | null;
  without: SideSnapshot | null;
  withSide: SideSnapshot | null;
  pairValid: boolean;
};

/**
 * BA 横条卡。
 */
export function BeamAccuracyCard(props: Props) {
  const display = deriveBeamAccuracy(
    props.baseline,
    props.without,
    props.withSide,
    props.pairValid,
  );

  const okText = display ? String(display.displaySuccess) : "--";
  const errText = display ? String(display.displayError) : "--";
  const pctText = display ? formatOneDecimal(display.displayPct) : "--";
  const okPct = display ? Math.max(0, Math.min(100, display.displayPct)) : 0;
  const badPct = display ? 100 - okPct : 0;

  return (
    <article className="case3v2-kpi case3v2-kpi--ba" data-region="BeamAccuracyCard">
      <div className="case3v2-kpi__head">
        <span className="case3v2-kpi__title">波束预测准确率</span>
      </div>
      <div className="case3v2-ba-counts">
        <div className="case3v2-ba-count case3v2-ba-count--ok">
          <i className="case3v2-ba-dot case3v2-ba-dot--ok" />
          <span className="case3v2-ba-count__label">正确次数</span>
          <span
            className="case3v2-ba-count__value case3v2-ba-count__value--ok"
            data-ba-ok
          >
            {okText}
          </span>
        </div>
        <div className="case3v2-ba-count case3v2-ba-count--bad">
          <i className="case3v2-ba-dot case3v2-ba-dot--bad" />
          <span className="case3v2-ba-count__label">错误次数</span>
          <span
            className="case3v2-ba-count__value case3v2-ba-count__value--bad"
            data-ba-bad
          >
            {errText}
          </span>
        </div>
      </div>
      <div className="case3v2-ba-bar">
        <div className="case3v2-ba-plot">
          <div className="case3v2-ba-fill-row">
            <div className="case3v2-ba-fill--ok" style={{ width: `${okPct}%` }} />
            <div className="case3v2-ba-fill--bad" style={{ width: `${badPct}%` }} />
          </div>
          <div className="case3v2-ba-main" data-ba-overlay>
            <div className="case3v2-ba-main__row">
              <span className="case3v2-ba-main__num" data-ba-pct>
                {pctText}
              </span>
              <span className="case3v2-ba-main__unit-wrap">
                <span className="case3v2-ba-main__unit">%</span>
              </span>
            </div>
            <span className="case3v2-ba-main__desc">预测准确率</span>
          </div>
        </div>
        <div className="case3v2-ba-bottom">
          <div className="case3v2-ba-bottom__ok" style={{ width: `${okPct}%` }} />
          <div className="case3v2-ba-bottom__bad" style={{ width: `${badPct}%` }} />
        </div>
      </div>
    </article>
  );
}
