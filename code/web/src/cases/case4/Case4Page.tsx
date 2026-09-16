/**
 * Case4 根页面：只组装 DOM 与接线，不 fetch、不开 timer。
 * DOM 分区对齐静态 data-region。
 */

import { useRef } from "react";
import { useSiteEnvWindow } from "../../shell/siteEnvWindowContext";
import type { Case4RuntimeConfig } from "./config/case4RuntimeConfig";
import { useCase4Controller, type MapRendererHandle } from "./hooks/useCase4Controller";
import { Banner } from "./components/Banner";
import { BottomDock } from "./components/BottomDock";
import { MapHud } from "./components/MapHud";
import { MapStage } from "./components/MapStage";
import "../../../assets/case4/tokens.css";
import "./case4.css";

type Props = {
  config: Case4RuntimeConfig;
  stageElementRef: React.RefObject<HTMLElement>;
  onBusyChange?: (busy: boolean) => void;
};

/**
 * Case4 根页面。
 */
export function Case4Page(props: Props) {
  const { config, stageElementRef, onBusyChange } = props;
  const { open: openSiteEnv } = useSiteEnvWindow();
  const mapRef = useRef<MapRendererHandle | null>(null);
  const ctrl = useCase4Controller({
    config,
    stageElementRef,
    mapRendererRef: mapRef,
    onBusyChange,
  });

  const liveHintBanner =
    ctrl.banner ??
    (ctrl.ui === "running" && ctrl.liveHint ? ctrl.liveHint : null);

  return (
    <main className="case4-page" data-testid="case4-page" data-state={ctrl.dataState}>
      <MapStage
        config={config}
        stageElementRef={stageElementRef}
        mapRef={mapRef}
        baseRoute={ctrl.baseRoute}
        livePoints={ctrl.trajectory?.points ?? []}
      />
      <MapHud onOpenSiteEnv={openSiteEnv} />
      <Banner text={liveHintBanner} />
      <BottomDock
        baseRoute={ctrl.baseRoute}
        points={ctrl.trajectory?.points ?? []}
        statistics={ctrl.statistics}
        without={ctrl.thrpWithout?.samples ?? []}
        withSamples={ctrl.thrpWith?.samples ?? []}
        statusText={ctrl.statusText}
        startEnabled={ctrl.startEnabled}
        resetEnabled={ctrl.resetEnabled}
        busy={ctrl.busy}
        onStart={ctrl.onStart}
        onReset={ctrl.onReinit}
      />
    </main>
  );
}
