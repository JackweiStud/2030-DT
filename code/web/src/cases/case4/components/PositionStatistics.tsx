/**
 * 定位误差卡：CDF + CEP50/90。
 */

import type { Statistics } from "../types";
import { CdfChart } from "./CdfChart";
import { CepBars } from "./CepBars";

type Props = {
  statistics: Statistics | null;
};

export function PositionStatistics(props: Props) {
  const stats = props.statistics;
  return (
    <article className="c4-kpi c4-kpi--pos" data-region="CdfCepCard">
      <div className="c4-kpi__head">
        <span className="c4-kpi__title c4-kpi__title--pos">定位误差(m)</span>
        <div className="c4-kpi__legend">
          <span>
            <i className="c4-dot c4-dot--bs" />
            传统基站定位
          </span>
          <span>
            <i className="c4-dot c4-dot--gaode" />
            商用方案定位
          </span>
          <span>
            <i className="c4-dot c4-dot--dt" />
            数字孪生辅助定位
          </span>
        </div>
      </div>
      <div className="c4-pos-body">
        <CdfChart cdf={stats?.cdf ?? null} />
        <CepBars cep={stats?.cep ?? null} kind="p50M" />
        <CepBars cep={stats?.cep ?? null} kind="p90M" />
      </div>
    </article>
  );
}
