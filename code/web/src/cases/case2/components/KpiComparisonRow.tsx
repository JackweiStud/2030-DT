/**
 * 单行 KPI：CDF + 均值柱/降幅。
 */

import type { MetricKey } from "../types";
import { METRIC_LABELS } from "../types";
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
  return (
    <div className="kpi-row">
      <div className="metric-header">
        <img className="metric-icon" src={ICONS[metric]} width={24} height={24} alt="" />
        <h3>{METRIC_LABELS[metric]}</h3>
      </div>
      <div className="chart-row">
        <CdfChart
          title="CDF"
          initialKpi={initialKpi}
          calibratedKpi={showComparison ? calibratedKpi : null}
          cdfPointCap={cdfPointCap}
        />
        <MeanBarChart
          initialKpi={initialKpi}
          calibratedKpi={showComparison ? calibratedKpi : null}
          showReduction={showComparison}
        />
      </div>
    </div>
  );
}
