import { forwardRef, useCallback } from "react";
import { ThreeViewport, type ThreeHandle } from "../../../shared/three/ThreeViewport";
import { createCase4Overlay, loadCase4Images } from "./threeOverlay";
import type { Case4RuntimeConfig } from "../../config/case4RuntimeConfig";
import type { BasePoint, TrajectoryPoint } from "../../types";
type Props = { config: Case4RuntimeConfig; active: boolean; baseRoute: BasePoint[]; livePoints: TrajectoryPoint[]; playback: "running" | "static" };
export const MapRenderer3D = forwardRef<ThreeHandle, Props>(function MapRenderer3D(props, ref) {
 const factory = useCallback((images: Parameters<typeof createCase4Overlay>[1]) => createCase4Overlay(props, images), [props.baseRoute, props.livePoints, props.config, props.playback]);
 return <ThreeViewport ref={ref} config={props.config.three} active={props.active} caseName="Case4" scope="c4" modelUrl="/api/case4/models/geometry" loadImages={loadCase4Images} createOverlay={factory} />;
});
