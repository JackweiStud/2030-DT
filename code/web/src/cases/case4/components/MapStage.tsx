/**
 * Case4 地图视口：裁切 1920×766，接收鼠标。复位钮在 MapRenderer 内。
 */

import { useRef, useImperativeHandle } from "react";
import type { Case4RuntimeConfig } from "../config/case4RuntimeConfig";
import type { MapRendererHandle } from "../hooks/useCase4Controller";
import type { BasePoint, TrajectoryPoint } from "../types";
import { MapRenderer3D } from "./map/MapRenderer3D";
import { MapRenderer2D } from "./map/MapRenderer2D";

type Props = {
  viewMode: "2d" | "3d";
  onCaptureLock: (locked: boolean) => void;
  config: Case4RuntimeConfig;
  stageElementRef: React.RefObject<HTMLElement>;
  mapRef: React.RefObject<MapRendererHandle | null>;
  baseRoute: BasePoint[];
  livePoints: TrajectoryPoint[];
  playback?: "running" | "static";
};

/**
 * MapStage。
 */
export function MapStage(props: Props) {
  const map2d = useRef<MapRendererHandle | null>(null);
  const map3d = useRef<MapRendererHandle | null>(null);
  const captured = useRef<MapRendererHandle | null>(null);
  useImperativeHandle(props.mapRef, () => ({
    resetView() { (props.viewMode === "3d" ? map3d : map2d).current?.resetView(); },
    async prepareCapture() {
      props.onCaptureLock(true);
      captured.current = (props.viewMode === "3d" ? map3d : map2d).current;
      if (!captured.current) throw new Error("地图尚未就绪");
      await captured.current.prepareCapture();
    },
    finishCapture() { captured.current?.finishCapture?.(); captured.current = null; props.onCaptureLock(false); },
  }), [props.viewMode, props.onCaptureLock]);
  return <section className="c4-map-stage" data-region="MapStage">
    <div className="c4-map-view" style={{ display: props.viewMode === "2d" ? "block" : "none" }}>
      <MapRenderer2D ref={map2d} config={props.config} stageElementRef={props.stageElementRef} baseRoute={props.baseRoute} livePoints={props.livePoints} playback={props.playback} />
    </div>
    <div className="c4-map-view" style={{ visibility: props.viewMode === "3d" ? "visible" : "hidden", pointerEvents: props.viewMode === "3d" ? "auto" : "none" }}>
      <MapRenderer3D ref={map3d} config={props.config} active={props.viewMode === "3d"} baseRoute={props.baseRoute} livePoints={props.livePoints} playback={props.playback ?? "static"} />
    </div>
  </section>;
}
