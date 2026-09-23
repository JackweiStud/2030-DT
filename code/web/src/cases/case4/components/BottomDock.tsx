/**
 * 底栏：误差回溯 + KPI 行。
 */

import type { BasePoint, Statistics, ThroughputSample, TrajectoryPoint } from "../types";
import { ErrorReplay } from "./ErrorReplay";
import { NlosGauge } from "./NlosGauge";
import { PositionStatistics } from "./PositionStatistics";
import { ThroughputChart } from "./ThroughputChart";

type Props = {
  baseRoute: BasePoint[];
  points: TrajectoryPoint[];
  statistics: Statistics | null;
  without: ThroughputSample[];
  withSamples: ThroughputSample[];
  statusText: string;
  startEnabled: boolean;
  resetEnabled: boolean;
  busy: boolean;
  onStart: () => void;
  onReset: () => void;
};

export function BottomDock(props: Props) {
  return (
    <section className="c4-dock" data-region="BottomDock">
      <ErrorReplay
        baseRoute={props.baseRoute}
        points={props.points}
        statusText={props.statusText}
        startEnabled={props.startEnabled}
        resetEnabled={props.resetEnabled}
        busy={props.busy}
        onStart={props.onStart}
        onReset={props.onReset}
      />
      <div className="c4-kpi-row" data-region="KpiRow">
        <PositionStatistics statistics={props.statistics} />
        <NlosGauge nlosRatio={props.statistics?.nlosRatio ?? null} />
        <ThroughputChart
          routeNos={props.baseRoute.map((point) => point.no)}
          without={props.without}
          withSamples={props.withSamples}
        />
      </div>
    </section>
  );
}
