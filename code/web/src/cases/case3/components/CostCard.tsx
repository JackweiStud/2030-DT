/**
 * Case3 开销(%)：结构对齐静态 `.case3-cost-*` 半环 SVG。
 */

import iconCost from "../../../../assets/case3/icon-cost-thrp.png";
import {
  formatOneDecimal,
  relativeCostChangePct,
} from "../metrics/case3Metrics";

type Props = {
  withoutCostPct: number | null;
  withCostPct: number | null;
  pairValid: boolean;
};

/** π·58，与静态 Gate 1.5 / CSS stroke-dasharray 一致。 */
const COST_RING_LEN = Math.PI * 58;

function arcOffset(value: number | null): number {
  if (value == null || !Number.isFinite(value)) return COST_RING_LEN;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  return COST_RING_LEN * (1 - pct);
}

function CostGauge(props: {
  side: "without" | "with";
  value: number | null;
}) {
  const offset = arcOffset(props.value);
  const isWith = props.side === "with";
  const dash = {
    strokeDasharray: String(COST_RING_LEN),
    strokeDashoffset: String(offset),
  };

  return (
    <div
      className={`case3-cost-gauge case3-cost-gauge--${props.side}`}
      data-cost-side={props.side}
    >
      <svg className="case3-cost-arc" viewBox="0 0 132 132" aria-hidden>
        <defs>
          {isWith ? (
            <>
              <linearGradient
                id="case3-cost-grad-w"
                x1="66"
                y1="124"
                x2="124"
                y2="66"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#5036ea" />
                <stop offset="100%" stopColor="#b07def" />
              </linearGradient>
              <filter
                id="case3-cost-blur-w"
                x="-80%"
                y="-80%"
                width="260%"
                height="260%"
              >
                <feGaussianBlur stdDeviation="3" />
              </filter>
              <filter
                id="case3-cost-shadow-w"
                x="-80%"
                y="-80%"
                width="260%"
                height="260%"
              >
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="5"
                  floodColor="#8B5CF666"
                />
              </filter>
            </>
          ) : (
            <>
              <linearGradient
                id="case3-cost-grad-wo"
                x1="66"
                y1="124"
                x2="66"
                y2="8"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#ffffff1a" />
                <stop offset="60%" stopColor="#ffffff" />
              </linearGradient>
              <filter
                id="case3-cost-blur-wo"
                x="-80%"
                y="-80%"
                width="260%"
                height="260%"
              >
                <feGaussianBlur stdDeviation="3" />
              </filter>
              <filter
                id="case3-cost-shadow-wo"
                x="-80%"
                y="-80%"
                width="260%"
                height="260%"
              >
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="4"
                  floodColor="#FFFFFF44"
                />
              </filter>
            </>
          )}
        </defs>
        <path className="case3-cost-arc__track" d="M66 8 A58 58 0 0 1 66 124" />
        <path
          className={`case3-cost-arc__glow${isWith ? " case3-cost-arc__glow--with" : ""}`}
          filter={isWith ? "url(#case3-cost-blur-w)" : "url(#case3-cost-blur-wo)"}
          d="M66 124 A58 58 0 0 0 66 8"
          style={dash}
        />
        <path
          className={`case3-cost-arc__value${isWith ? " case3-cost-arc__value--with" : ""}`}
          filter={
            isWith ? "url(#case3-cost-shadow-w)" : "url(#case3-cost-shadow-wo)"
          }
          stroke={isWith ? "url(#case3-cost-grad-w)" : "url(#case3-cost-grad-wo)"}
          d="M66 124 A58 58 0 0 0 66 8"
          style={dash}
        />
      </svg>
      <div className="case3-cost-readout">
        <div className="case3-cost-readout__row">
          <span className="case3-cost-value">
            {props.value == null ? "--" : formatOneDecimal(props.value)}
          </span>
          <span className="case3-cost-unit">%</span>
        </div>
        <div className="case3-cost-side-label">
          {isWith ? "有 DT" : "无 DT"}
        </div>
      </div>
      <span className="case3-cost-tick case3-cost-tick--0">0</span>
      <span className="case3-cost-tick case3-cost-tick--100">100</span>
    </div>
  );
}

/**
 * 开销对比卡。
 */
export function CostCard(props: Props) {
  const delta = relativeCostChangePct(
    props.withoutCostPct,
    props.withCostPct,
    props.pairValid,
  );

  let arrow: string | null = null;
  let deltaText = "--";
  let pillMod = "";
  if (delta != null) {
    deltaText = formatOneDecimal(delta);
    if (delta > 0) {
      arrow = "↓";
      pillMod = " is-down";
    } else if (delta < 0) {
      arrow = "↑";
      pillMod = " is-up";
    } else {
      pillMod = " is-zero";
    }
  }

  return (
    <article className="case3-kpi-card case3-cost-card">
      <div className="case3-kpi-card__head">
        <img
          className="case3-kpi-card__icon case3-kpi-card__icon--cost"
          src={iconCost}
          width={24}
          height={24}
          alt=""
        />
        <h3>开销(%)</h3>
      </div>
      <div className="case3-cost-body">
        <CostGauge side="without" value={props.withoutCostPct} />
        <div className={`case3-cost-delta${pillMod}`}>
          <div className="case3-cost-delta__pill">
            {arrow ? (
              <span className="case3-cost-delta__arrow">{arrow}</span>
            ) : null}
            <span className="case3-cost-delta__value">{deltaText}</span>
            <span className="case3-cost-delta__unit">%</span>
          </div>
          <div className="case3-cost-delta__label">开销变化</div>
        </div>
        <CostGauge side="with" value={props.withCostPct} />
      </div>
    </article>
  );
}
