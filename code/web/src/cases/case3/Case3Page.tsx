/**
 * Case3 页面：测试对比双侧 + KPI 对比。
 * DOM 分区对齐 Frontend_Spec / Gate 1.5；状态机不继承静态假逻辑。
 */

import { useMemo, useRef } from "react";
import { useSiteEnvWindow } from "../../shell/siteEnvWindowContext";
import type { Case3RuntimeConfig } from "./config/case3RuntimeConfig";
import {
  useCase3Controller,
  type MapRendererHandle,
} from "./hooks/useCase3Controller";
import { PanelHeader } from "./components/PanelHeader";
import { SidePanel } from "./components/SidePanel";
import { CostCard } from "./components/CostCard";
import { ThroughputChart } from "./components/ThroughputChart";
import { BeamAccuracyCard } from "./components/BeamAccuracyCard";
import { selectCase3Presentation } from "./presentation/selectCase3Presentation";
import "./case3.css";

type Props = {
  config: Case3RuntimeConfig;
  stageElementRef: React.RefObject<HTMLElement>;
  onBusyChange?: (busy: boolean) => void;
};

/**
 * Case3 根页面。
 */
export function Case3Page(props: Props) {
  const { config, stageElementRef, onBusyChange } = props;
  const { open: openSiteEnv } = useSiteEnvWindow();
  const withoutMapRef = useRef<MapRendererHandle | null>(null);
  const withMapRef = useRef<MapRendererHandle | null>(null);

  const mapRendererRefs = useMemo(
    () => ({ without: withoutMapRef, with: withMapRef }),
    [],
  );

  const ctrl = useCase3Controller({
    config,
    stageElementRef,
    mapRendererRefs,
    onBusyChange,
  });
  const view = selectCase3Presentation(ctrl.state);

  return (
    <main className="case3-page" data-state={view.dataState}>
      <div className="case3-page__bg" aria-hidden />
      <section className="case3-test-panel">
        <PanelHeader onOpenSiteEnv={openSiteEnv} />
        <div className="case3-side-pair">
          <SidePanel
            side="without"
            config={config}
            baseRoute={view.baseRoute}
            points={view.withoutPoints}
            badge={view.withoutBadge}
            badgeError={view.withoutBadgeError}
            retryHint={view.withoutRetryHint}
            startEnabled={view.startWithoutEnabled}
            resetEnabled={view.reinitWithoutEnabled}
            onStart={ctrl.onStartWithout}
            onReset={ctrl.onReinitWithout}
            stageElementRef={stageElementRef}
            mapRef={withoutMapRef}
          />
          <SidePanel
            side="with"
            config={config}
            baseRoute={view.baseRoute}
            points={view.withPoints}
            peerPoints={view.withPeerPoints}
            badge={view.withBadge}
            badgeError={view.withBadgeError}
            retryHint={view.withRetryHint}
            startEnabled={view.startWithEnabled}
            resetEnabled={view.reinitWithEnabled}
            onStart={ctrl.onStartWith}
            onReset={ctrl.onReinitWith}
            stageElementRef={stageElementRef}
            mapRef={withMapRef}
          />
        </div>
      </section>

      <section className="case3-kpi-panel">
        <div className="case3-kpi-title-row">
          <span className="case3-title-accent" aria-hidden />
          <h2 className="case3-panel-title">KPI对比</h2>
        </div>
        <div className="case3-kpi-cols">
          <CostCard
            withoutCostPct={view.withoutKpiSnapshot?.costPct ?? null}
            withCostPct={view.withKpiSnapshot?.costPct ?? null}
            pairValid={view.pairValid}
          />
          <ThroughputChart
            withoutPoints={view.withoutKpiSnapshot?.points ?? null}
            withPoints={view.withKpiSnapshot?.points ?? null}
            routeNos={view.routeNos}
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
    </main>
  );
}
