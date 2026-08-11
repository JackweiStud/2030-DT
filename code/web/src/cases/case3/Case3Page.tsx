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
import { canCompareWithCurrentWithout } from "./state/case3Reducer";
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

  const withoutPoints =
    ctrl.state.live.without?.points ??
    ctrl.state.results.without?.points ??
    [];
  const withPoints =
    ctrl.state.live.with?.points ?? ctrl.state.results.with?.points ?? [];
  const withPeerPoints = canCompareWithCurrentWithout(ctrl.state)
    ? ctrl.state.results.without?.points
    : null;

  const dataState =
    ctrl.visible === "unpaired-both" || ctrl.visible === "with-history-only"
      ? "without-completed"
      : ctrl.visible.startsWith("failed-")
        ? "initial"
        : ctrl.visible.startsWith("resetting-")
          ? ctrl.visible.includes("without")
            ? "without-completed"
            : "with-completed"
          : ctrl.visible;

  return (
    <main className="case3-page" data-state={dataState}>
      <div className="case3-page__bg" aria-hidden />
      <section className="case3-test-panel">
        <PanelHeader onOpenSiteEnv={openSiteEnv} />
        <div className="case3-side-pair">
          <SidePanel
            side="without"
            config={config}
            baseRoute={ctrl.state.baseRoute}
            points={withoutPoints}
            badge={ctrl.withoutBadge}
            badgeError={ctrl.badgeError}
            startEnabled={ctrl.startWithoutEnabled}
            resetEnabled={ctrl.reinitWithoutEnabled}
            onStart={ctrl.onStartWithout}
            onReset={ctrl.onReinitWithout}
            stageElementRef={stageElementRef}
            mapRef={withoutMapRef}
          />
          <SidePanel
            side="with"
            config={config}
            baseRoute={ctrl.state.baseRoute}
            points={withPoints}
            peerPoints={withPeerPoints}
            badge={ctrl.withBadge}
            badgeError={ctrl.badgeError}
            startEnabled={ctrl.startWithEnabled}
            resetEnabled={ctrl.reinitWithEnabled}
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
            withoutCostPct={ctrl.state.results.without?.costPct ?? null}
            withCostPct={
              ctrl.state.pairValid
                ? (ctrl.state.results.with?.costPct ?? null)
                : null
            }
            pairValid={ctrl.state.pairValid}
          />
          <ThroughputChart
            withoutPoints={ctrl.state.results.without?.points ?? null}
            withPoints={ctrl.state.results.with?.points ?? null}
            pairValid={ctrl.state.pairValid}
          />
          <BeamAccuracyCard
            baseline={ctrl.state.baseline}
            without={ctrl.state.results.without}
            withSide={ctrl.state.results.with}
            pairValid={ctrl.state.pairValid}
          />
        </div>
      </section>
    </main>
  );
}
