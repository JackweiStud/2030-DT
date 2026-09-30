import { forwardRef, useCallback } from "react";
import { ThreeViewport, type ThreeHandle } from "../../../shared/three/ThreeViewport";
import { createThreeOverlay, loadOverlayImages } from "./threeOverlay";
import type { Case3RuntimeConfig } from "../../../case3/config/case3RuntimeConfig";
import type { BaseRoutePoint, Case3Point } from "../../../case3/types";
type Props = { config: Case3RuntimeConfig; active: boolean; baseRoute: BaseRoutePoint[]; points: Case3Point[]; currentPoint: Case3Point | null; reflectionVisible: boolean; reflectionPlayback: "running" | "static" };
export const MapRenderer3D = forwardRef<ThreeHandle, Props>(function MapRenderer3D(props, ref) {
 const factory = useCallback((images: Parameters<typeof createThreeOverlay>[1]) => createThreeOverlay(props, images), [props.baseRoute, props.points, props.currentPoint, props.config, props.reflectionVisible, props.reflectionPlayback]);
 return <ThreeViewport ref={ref} config={props.config.three} active={props.active} caseName="Case3" scope="case3v2" modelUrl="/api/case3/models/geometry" loadImages={loadOverlayImages} createOverlay={factory} />;
});
