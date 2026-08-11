/**
 * Case3 MapStage：地图 + 固定浮层（波束卡、点位进度）。
 */

import { forwardRef } from "react";
import type { Case3RuntimeConfig } from "../config/case3RuntimeConfig";
import type { MapRendererHandle } from "../hooks/useCase3Controller";
import type { BaseRoutePoint, Case3Point, Case3Side } from "../types";
import { BeamScanCard } from "./BeamScanCard";
import { PointProgressWindow } from "./PointProgressWindow";
import { MapRenderer2D } from "./map/MapRenderer2D";

type Props = {
  side: Case3Side;
  config: Case3RuntimeConfig;
  baseRoute: BaseRoutePoint[];
  points: Case3Point[];
  peerPoints?: Case3Point[] | null;
  stageElementRef: React.RefObject<HTMLElement>;
};

/**
 * 单侧地图舞台。
 */
export const MapStage = forwardRef<MapRendererHandle, Props>(
  function MapStage(props, ref) {
    const active = props.points[props.points.length - 1] ?? null;
    const peerActive =
      active && props.peerPoints
        ? (props.peerPoints.find((p) => p.no === active.no) ?? null)
        : null;

    return (
      <div className="case3-map-stage">
        <MapRenderer2D
          ref={ref}
          config={props.config}
          baseRoute={props.baseRoute}
          points={props.points}
          stageElementRef={props.stageElementRef}
        />
        <BeamScanCard
          side={props.side}
          point={active}
          peerPoint={peerActive}
        />
        <PointProgressWindow
          side={props.side}
          points={props.points}
          peerPoints={props.peerPoints}
        />
      </div>
    );
  },
);
