/**
 * 钉底栏：回溯表 + 三 KPI。
 */

import type { Case3Presentation } from "../../case3/presentation/selectCase3Presentation";
import { completePointsOf } from "../v2CompletePoints";
import { v2LiveMapSide } from "../v2WithCompare";
import { BeamAccuracyCard } from "./BeamAccuracyCard";
import { CostCompareCard } from "./CostCompareCard";
import { PointBeamReplay } from "./PointBeamReplay";
import { ThroughputCompareCard } from "./ThroughputCompareCard";

type Props = {
  view: Case3Presentation;
  onStartWithout: () => void;
  onStartWith: () => void;
  onReinitWithout: () => void;
  onReinitWith: () => void;
};

/**
 * BottomDock。
 */
export function BottomDock(props: Props) {
  const { view } = props;
  const withoutComplete = completePointsOf(view.withoutKpiSnapshot);
  const withComplete = completePointsOf(view.withKpiSnapshot);
  return (
    <section className="case3v2-dock" data-region="BottomDock">
      <PointBeamReplay
        routeNos={view.routeNos}
        withoutPoints={withoutComplete}
        withPoints={withComplete}
        withPeerPoints={view.withPeerPoints}
        progressSide={v2LiveMapSide(view)}
        withoutStatus={view.withoutBadge}
        withStatus={view.withBadge}
        startWithoutEnabled={view.startWithoutEnabled}
        startWithEnabled={view.startWithEnabled}
        reinitWithoutEnabled={view.reinitWithoutEnabled}
        reinitWithEnabled={view.reinitWithEnabled}
        withoutPlayBusy={view.activeStartSide === "without" && view.busy}
        withPlayBusy={view.activeStartSide === "with" && view.busy}
        onStartWithout={props.onStartWithout}
        onStartWith={props.onStartWith}
        onReinitWithout={props.onReinitWithout}
        onReinitWith={props.onReinitWith}
      />
      <div className="case3v2-kpi-row" data-region="KpiRow">
        <CostCompareCard
          withoutCostPct={view.withoutKpiSnapshot?.costPct ?? null}
          withCostPct={view.withKpiSnapshot?.costPct ?? null}
          pairValid={view.pairValid}
        />
        <ThroughputCompareCard
          routeNos={view.routeNos}
          withoutPoints={withoutComplete}
          withPoints={withComplete}
          showWithSeries={view.showWithThroughput}
        />
        <BeamAccuracyCard
          baseline={view.baseline}
          without={view.beamWithout}
          withSide={view.beamWith}
          pairValid={view.pairValid}
        />
      </div>
    </section>
  );
}
