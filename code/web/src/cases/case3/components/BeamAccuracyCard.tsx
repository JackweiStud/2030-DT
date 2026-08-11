/**
 * Case3 波束预测准确率：DOM 对齐静态 `.case3-ba-body`（槽位底图 + 左右次数 + 中区开口环）。
 * baseline ready 时显示派生值；缺失时保留完整结构，数值位为 `--`。
 */

import iconPredict from "../../../../assets/case3/icon-predict.png";
import iconOk from "../../../../assets/case3/icon-ok.png";
import iconErr from "../../../../assets/case3/icon-err.png";
import baSlotBg from "../../../../assets/case3/ba-slot-bg.png";
import baCircleBg from "../../../../assets/case3/ba-circle-bg.png";
import {
  deriveBeamAccuracy,
  formatOneDecimal,
} from "../metrics/case3Metrics";
import type { BeamAccuracyBaseline, SideSnapshot } from "../types";

type Props = {
  baseline: BeamAccuracyBaseline | null;
  without: SideSnapshot | null;
  withSide: SideSnapshot | null;
  pairValid: boolean;
};

/** 静态开口弧实测周长（r=86、约 240°）。 */
const BA_ARC_LEN = 384.29;

/**
 * Beam Accuracy 卡。
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
  const pctValue = display
    ? Math.max(0, Math.min(100, display.displayPct))
    : 0;
  const offset = BA_ARC_LEN * (1 - pctValue / 100);

  return (
    <article className="case3-kpi-card case3-ba-card">
      <div className="case3-kpi-card__head">
        <img
          className="case3-kpi-card__icon case3-kpi-card__icon--ba"
          src={iconPredict}
          width={24}
          height={24}
          alt=""
        />
        <h3>波束预测准确率</h3>
      </div>
      <div className="case3-ba-body">
        <img className="case3-ba-slot-bg" src={baSlotBg} alt="" />

        <div className="case3-ba-count case3-ba-count--ok">
          <div className="case3-ba-count__value">{okText}</div>
          <div className="case3-ba-count__unit">(次)</div>
          <div className="case3-ba-count__label-row">
            <img src={iconOk} width={16} height={16} alt="" />
            <span>正确次数</span>
          </div>
        </div>

        <div className="case3-ba-ring-wrap">
          <img className="case3-ba-circle-bg" src={baCircleBg} alt="" />
          <div className="case3-ba-ring-comp">
            <svg className="case3-ba-ring" viewBox="0 0 236 236" aria-hidden>
              <defs>
                <filter
                  id="case3-ba-glow"
                  x="-40%"
                  y="-40%"
                  width="180%"
                  height="180%"
                >
                  <feDropShadow
                    dx="0"
                    dy="0"
                    stdDeviation="5"
                    floodColor="#22C55E33"
                  />
                </filter>
              </defs>
              <path
                className="case3-ba-ring__track"
                d="M50.23 170.95 A86 86 0 1 1 185.77 170.95"
                fill="none"
                stroke="#3a4048"
                strokeLinecap="round"
                strokeWidth={12}
              />
              <path
                className="case3-ba-ring__value"
                filter="url(#case3-ba-glow)"
                d="M50.23 170.95 A86 86 0 1 1 185.77 170.95"
                fill="none"
                stroke="#22c55e"
                strokeDasharray={String(BA_ARC_LEN)}
                strokeDashoffset={String(offset)}
                strokeLinecap="round"
                strokeWidth={12}
              />
            </svg>
            <div className="case3-ba-center">
              <div
                className={`case3-ba-pct${
                  pctText.length >= 5
                    ? " case3-ba-pct--lg"
                    : pctText.length >= 4
                      ? " case3-ba-pct--md"
                      : ""
                }`}
              >
                <span className="case3-ba-pct__value">{pctText}</span>
                <span className="case3-ba-pct__unit">%</span>
              </div>
              <div className="case3-ba-caption">预测准确率</div>
              <div className="case3-ba-badge">正常</div>
            </div>
          </div>
        </div>

        <div className="case3-ba-count case3-ba-count--err">
          <div className="case3-ba-count__value">{errText}</div>
          <div className="case3-ba-count__unit">(次)</div>
          <div className="case3-ba-count__label-row">
            <img src={iconErr} width={16} height={16} alt="" />
            <span>错误次数</span>
          </div>
        </div>
      </div>
    </article>
  );
}
