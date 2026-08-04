/**
 * 单行 KPI：CDF + 均值柱/降幅。
 * 标题文案对齐 Gate 1.5 静态 HTML。
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

/** 与 web-static/case2 初始态一致的 KPI 行标题。 */
const KPI_TITLES: Record<MetricKey, string> = {
  rss: "RSS (接收信号强度)",
  effective_path_num: "Effective Path Num (有效路径数)",
  first_path_delay: "First Path Delay (首径时延)",
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
        <img
          className="metric-icon"
          src={ICONS[metric]}
          width={24}
          height={24}
          alt=""
        />
        <h3>{KPI_TITLES[metric]}</h3>
      </div>
      <div className="chart-row">
        <CdfChart
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
