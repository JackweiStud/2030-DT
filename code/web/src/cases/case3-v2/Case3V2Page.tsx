/**
 * Case3 V2 页面：全幅单地图 + 底栏。
 * 复用现有 useCase3Controller / selectCase3Presentation，不新增 Case5 状态链。
 */

import { useMemo, useRef } from "react";
import { useSiteEnvWindow } from "../../shell/siteEnvWindowContext";
import type { Case3RuntimeConfig } from "../case3/config/case3RuntimeConfig";
import {
  useCase3Controller,
  type MapRendererHandle,
} from "../case3/hooks/useCase3Controller";
import { selectCase3Presentation } from "../case3/presentation/selectCase3Presentation";
import { BottomDock } from "./components/BottomDock";
import { MapHud } from "./components/MapHud";
import { MapRenderer2D } from "./components/map/MapRenderer2D";
import "./case3v2.css";

type Props = {
  config: Case3RuntimeConfig;
  stageElementRef: React.RefObject<HTMLElement>;
  onBusyChange?: (busy: boolean) => void;
};

/**
 * Case3 V2 根页面（开发期挂在 case5 Tab）。
 */
export function Case3V2Page(props: Props) {
  const { config, stageElementRef, onBusyChange } = props;
  const { open: openSiteEnv } = useSiteEnvWindow();
  const mapRef = useRef<MapRendererHandle | null>(null);
  const mapRendererRefs = useMemo(
    () => ({ without: mapRef, with: mapRef }),
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
    <main
      className="case3v2-page"
      data-testid="case3-v2-page"
      data-state={view.dataState}
    >
      <section className="case3v2-map-stage" data-region="MapStage">
        <MapRenderer2D
          ref={mapRef}
          baseRoute={view.baseRoute}
          stageElementRef={stageElementRef}
        />
      </section>
      <MapHud onOpenSiteEnv={openSiteEnv} />
      <BottomDock
        view={view}
        onStartWithout={ctrl.onStartWithout}
        onStartWith={ctrl.onStartWith}
        onReinitWithout={ctrl.onReinitWithout}
        onReinitWith={ctrl.onReinitWith}
      />
    </main>
  );
}
