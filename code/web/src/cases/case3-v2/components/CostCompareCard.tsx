/**
 * 开销对比卡：初始为空，不写代表数字。
 */

import { formatOneDecimal } from "../../case3/metrics/case3Metrics";

type Props = {
  withoutCostPct: number | null;
  withCostPct: number | null;
  deltaText: string;
};

function costText(value: number | null): string {
  return value == null ? "--" : formatOneDecimal(value);
}

/**
 * 开销对比。
 */
export function CostCompareCard(props: Props) {
  const wo = costText(props.withoutCostPct);
  const w = costText(props.withCostPct);

  return (
    <article className="case3v2-kpi case3v2-kpi--cost" data-region="CostCompareCard">
      <div className="case3v2-kpi__head">
        <span className="case3v2-kpi__title">开销对比</span>
      </div>
      <div className="case3v2-cost-plot">
        <div className="case3v2-cost-col">
          <div className="case3v2-cost-shell">
            <div className="case3v2-cost-aux--left" />
            <div className="case3v2-cost-fill--left" />
            <div className="case3v2-cost-edge--left" />
          </div>
          <div className="case3v2-cost-value case3v2-cost-value--left">
            <span className="case3v2-cost-value__num" data-cost-wo>
              {wo}
            </span>
            <span className="case3v2-cost-value__unit">%</span>
          </div>
          <div className="case3v2-cost-caption--left">无 DT</div>
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
            <div className="case3v2-cost-fill--right" />
            <div className="case3v2-cost-edge--right" />
          </div>
          <div className="case3v2-cost-value case3v2-cost-value--right">
            <span className="case3v2-cost-value__num" data-cost-w>
              {w}
            </span>
            <span className="case3v2-cost-value__unit">%</span>
          </div>
          <div className="case3v2-cost-caption--right">有 DT</div>
        </div>
        <div className="case3v2-cost-delta">
          <div className="case3v2-cost-delta__row">
            <span className="case3v2-cost-delta__num" data-cost-delta>
              {props.deltaText}
            </span>
            <span className="case3v2-cost-delta__unit">%</span>
          </div>
          <span className="case3v2-cost-delta__label">开销变化</span>
        </div>
      </div>
    </article>
  );
}
