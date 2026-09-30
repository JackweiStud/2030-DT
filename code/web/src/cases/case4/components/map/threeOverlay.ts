import idle from "../../../../../assets/case4/ue-pin-idle.png";
import lit from "../../../../../assets/case4/ue-pin-lit.png";
import ue from "../../../../../assets/case4/ue-2d.png";
import { createOverlay, loadImages, type OverlayImages, type OverlayInput } from "../../../shared/three/overlay";
import { buildReflectionPaths } from "./reflectionGeometry";
import type { Case4RuntimeConfig } from "../../config/case4RuntimeConfig";
import type { BasePoint, TrajectoryPoint } from "../../types";
export const loadCase4Images = () => loadImages([idle, lit, ue]);
export type Input = { config: Case4RuntimeConfig; baseRoute: BasePoint[]; livePoints: TrajectoryPoint[]; playback: "running" | "static" };
export function case4OverlayInput(input: Input): OverlayInput {
 const { config, baseRoute, livePoints } = input;
 const current = livePoints.at(-1), bs = config.bsXyz3d ?? config.bsXyz;
 const ready = config.reflectionEnable && current?.reflection?.state === "ready";
 const paths = config.reflectionEnable && current ? buildReflectionPaths(current.dt, bs, current.reflection) : [];
 return {
  baseRoute, completed: baseRoute.slice(0, livePoints.length).map(p=>p.no), walked: baseRoute.slice(0, livePoints.length), ue: baseRoute[livePoints.length-1],
  tracks: ([ ["traditional", 0x97aac4], ["commercial", 0xf0a12e], ["dt", 0x5abffb] ] as const).map(([key,color])=>({color, points: livePoints.map(p=>p[key])})),
  bs: ready ? bs : undefined,
  paths: paths.map(path=>({los: path.kind === "los", points: path.points, ri: path.kind === "hop" ? {id: Number(path.id.slice(1)), point: path.points[1]!} : undefined})),
  running: input.playback === "running",
 };
}
export const createCase4Overlay = (input: Input, images: OverlayImages) => createOverlay(case4OverlayInput(input), images);
