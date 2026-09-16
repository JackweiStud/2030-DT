/**
 * Case4 地图视口：裁切 1920×766，接收鼠标。复位钮在 MapRenderer 内。
 */

import { useRef } from "react";
import type { Case4RuntimeConfig } from "../config/case4RuntimeConfig";
import type { MapRendererHandle } from "../hooks/useCase4Controller";
import type { BasePoint, TrajectoryPoint } from "../types";
import { MapRenderer2D } from "./map/MapRenderer2D";

type Props = {
  config: Case4RuntimeConfig;
  stageElementRef: React.RefObject<HTMLElement>;
  mapRef: React.RefObject<MapRendererHandle | null>;
  baseRoute: BasePoint[];
  livePoints: TrajectoryPoint[];
};

/**
 * MapStage。
 */
export function MapStage(props: Props) {
  const innerRef = useRef<MapRendererHandle | null>(null);
  const setRef = (node: MapRendererHandle | null) => {
    innerRef.current = node;
    if (props.mapRef) {
      (props.mapRef as React.MutableRefObject<MapRendererHandle | null>).current =
        node;
    }
  };
  return (
    <section className="c4-map-stage" data-region="MapStage">
      <MapRenderer2D
        ref={setRef}
        config={props.config}
        stageElementRef={props.stageElementRef}
        baseRoute={props.baseRoute}
        livePoints={props.livePoints}
      />
    </section>
  );
}
