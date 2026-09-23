/**
 * 开销对比卡：数字槽按 88.8 预留右对齐；fill 为 SVG 梯形体积。
 */

import { useId } from "react";
import costLeftAux from "../../../../assets/case3-v2/cost-left-aux.png";
import costRightAux from "../../../../assets/case3-v2/cost-right-aux.png";
import { formatOneDecimal, relativeCostChangePct } from "../../case3/metrics/case3Metrics";
import { CASE3V2_COST_AUX, costFillVolume } from "../v2CostFill";

type Props = {
  withoutCostPct: number | null;
  withCostPct: number | null;
  pairValid: boolean;
};

function costText(value: number | null): string {
  return value == null ? "--" : formatOneDecimal(value);
}

export type CostDeltaTone = "up" | "down" | "zero" | "empty";

export function costDeltaView(
  withoutCostPct: number | null,
  withCostPct: number | null,
  pairValid: boolean,
): { text: string; label: string; tone: CostDeltaTone } {
  const delta = relativeCostChangePct(withoutCostPct, withCostPct, pairValid);
  if (delta == null) {
    return { text: "--", label: "开销变化", tone: "empty" };
  }
  if (delta > 0) {
    return { text: formatOneDecimal(delta), label: "开销增加", tone: "up" };
  }
  if (delta < 0) {
    return { text: formatOneDecimal(delta), label: "开销减少", tone: "down" };
  }
  return { text: formatOneDecimal(delta), label: "开销变化", tone: "zero" };
}

function CostVolumeFill(props: {
  side: "without" | "with";
  value: number | null;
}) {
  const uid = useId();
  const vol = costFillVolume(props.value, props.side);
  const isLeft = props.side === "without";
  const testAttr = isLeft ? { "data-cost-fill-wo": true } : { "data-cost-fill-w": true };
  const gradId = `${uid}-g`;
  const maskId = `${uid}-m`;
  const auxSrc = isLeft ? costLeftAux : costRightAux;

  return (
    <svg
      className={`case3v2-cost-fill-svg case3v2-cost-fill-svg--${isLeft ? "left" : "right"}`}
      viewBox={`0 0 ${CASE3V2_COST_AUX.width} ${CASE3V2_COST_AUX.height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      {...(vol == null ? { hidden: true } : {})}
      {...testAttr}
    >
      {vol ? (
        <>
          <defs>
            <linearGradient
              id={gradId}
              x1={vol.gradient.x1}
              y1={vol.gradient.y1}
              x2={vol.gradient.x2}
              y2={vol.gradient.y2}
              gradientUnits="userSpaceOnUse"
            >
              {isLeft ? (
                <>
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="50%" stopColor="#f4f7fb" stopOpacity="1" />
                  <stop offset="100%" stopColor="#e8eef6" stopOpacity="0.92" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#b8ffe8" stopOpacity="1" />
                  <stop offset="50%" stopColor="#1affa8" stopOpacity="1" />
                  <stop offset="100%" stopColor="#7dffd0" stopOpacity="0.92" />
                </>
              )}
            </linearGradient>
            <mask id={maskId} maskUnits="userSpaceOnUse">
              <image
                href={auxSrc}
                width={CASE3V2_COST_AUX.width}
                height={CASE3V2_COST_AUX.height}
              />
            </mask>
          </defs>
          <rect
            data-cost-fill-clip
            x="0"
            y={vol.yCut}
            width={CASE3V2_COST_AUX.width}
            height={Math.max(0, vol.clipHeight)}
            fill={`url(#${gradId})`}
            mask={`url(#${maskId})`}
          />
        </>
      ) : null}
    </svg>
  );
}

/**
 * 开销对比。
 */
export function CostCompareCard(props: Props) {
  const wo = costText(props.withoutCostPct);
  const w = costText(props.withCostPct);
  const delta = costDeltaView(
    props.withoutCostPct,
    props.withCostPct,
    props.pairValid,
  );

  return (
    <article className="case3v2-kpi case3v2-kpi--cost" data-region="CostCompareCard">
      <div className="case3v2-kpi__head">
        <span className="case3v2-kpi__title">通信开销</span>
      </div>
      <div className="case3v2-cost-plot">
        <div className="case3v2-cost-col">
          <div className="case3v2-cost-shell">
            <div className="case3v2-cost-aux--left" />
            <CostVolumeFill side="without" value={props.withoutCostPct} />
            <div className="case3v2-cost-edge--left" />
          </div>
          <div className="case3v2-cost-value case3v2-cost-value--left">
            <span className="case3v2-cost-value__num" data-cost-wo>
              {wo}
            </span>
            <span className="case3v2-cost-value__unit">%</span>
          </div>
          <div className="case3v2-cost-caption--left">无DT辅助</div>
        </div>
        <div className="case3v2-cost-axis">
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>0%</span>
        </div>
        <div className="case3v2-cost-col">
          <div className="case3v2-cost-shell">
            <div className="case3v2-cost-aux--right" />
            <CostVolumeFill side="with" value={props.withCostPct} />
            <div className="case3v2-cost-edge--right" />
          </div>
          <div className="case3v2-cost-value case3v2-cost-value--right">
            <span className="case3v2-cost-value__num" data-cost-w>
              {w}
            </span>
            <span className="case3v2-cost-value__unit">%</span>
          </div>
          <div className="case3v2-cost-caption--right">有DT辅助</div>
        </div>
        <div className="case3v2-cost-delta" data-delta-tone={delta.tone}>
          <div className="case3v2-cost-delta__row">
            <span className="case3v2-cost-delta__num" data-cost-delta>
              {delta.text}
            </span>
            <span className="case3v2-cost-delta__unit">%</span>
          </div>
          <span className="case3v2-cost-delta__label" data-cost-delta-label>
            {delta.label}
          </span>
        </div>
      </div>
    </article>
  );
}
