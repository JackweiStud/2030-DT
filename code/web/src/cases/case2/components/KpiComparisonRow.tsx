/**
 * 单项误差卡：标题 + 图例，下方 CDF + 平均误差柱/降幅。
 */

import type { MetricKey } from "../types";
import { CdfChart } from "./CdfChart";
import { MeanBarChart } from "./MeanBarChart";
import rssIcon from "../../../../assets/case2/icons/metric-rss-icon.png";
import pathIcon from "../../../../assets/case2/icons/metric-path-icon.png";
import delayIcon from "../../../../assets/case2/icons/metric-delay-icon.png";

const ICONS: Record<MetricKey, string> = {
  rss: rssIcon,
  effective_path_num: pathIcon,
  first_path_delay: delayIcon,
};

const KPI_TITLES: Record<MetricKey, string> = {
  rss: "RSS误差 (dBm)",
  effective_path_num: "有效径数误差 (条)",
  first_path_delay: "最强径时延误差 (ns)",
};

type Props = {
  metric: MetricKey;
  initialKpi: number[];
  calibratedKpi: number[] | null;
  cdfPointCap: number;
  showComparison: boolean;
};

export function KpiComparisonRow(props: Props) {
  const { metric, initialKpi, calibratedKpi, cdfPointCap, showComparison } =
    props;
  const comparisonKpi = showComparison ? calibratedKpi : null;
  return (
    <div className="kpi-row">
      <div className="metric-header">
        <img
          className="metric-icon"
          src={ICONS[metric]}
          width={20}
          height={20}
          alt=""
        />
        <h3>{KPI_TITLES[metric]}</h3>
        <div className="legend">
          <span className="leg-initial">
            <i className="leg-dot" />
            初始 DT
          </span>
          <span className="leg-calibrated">
            <i className="leg-dot" />
            校正 DT
          </span>
        </div>
      </div>
      <div className="chart-row">
        <CdfChart
          initialKpi={initialKpi}
          calibratedKpi={comparisonKpi}
          cdfPointCap={cdfPointCap}
        />
        <MeanBarChart
          initialKpi={initialKpi}
          calibratedKpi={comparisonKpi}
          showReduction={showComparison}
        />
      </div>
    </div>
  );
}
