import idle from "../../../../../assets/case3-v2/ue-pin-idle.png";
import lit from "../../../../../assets/case3-v2/ue-pin-lit.png";
import ue from "../../../../../assets/case3-v2/ue-2d.png";
import { createOverlay, loadImages, type OverlayImages } from "../../../shared/three/overlay";
import { isAbnormalBeamPoint } from "../../../case3/metrics/case3Metrics";
import type { BaseRoutePoint, Case3Point } from "../../../case3/types";
import type { Case3RuntimeConfig } from "../../../case3/config/case3RuntimeConfig";
export const loadOverlayImages = () => loadImages([idle, lit, ue]);
type Input = { baseRoute: BaseRoutePoint[]; points: Case3Point[]; currentPoint: Case3Point | null; config: Case3RuntimeConfig; reflectionVisible: boolean; reflectionPlayback: "running" | "static" };
export function createThreeOverlay(input: Input, images: OverlayImages) {
  const p = input.currentPoint, bs = input.config.bsXyz3d ?? input.config.bsXyz, reflection = p?.reflection;
  const visible = input.reflectionVisible && input.config.reflectionEnable && bs && p && reflection && !isAbnormalBeamPoint(p);
  return createOverlay({ baseRoute: input.baseRoute, completed: input.points.map(p => p.no), walked: [...input.points].sort((a,b)=>a.no-b.no).map(p=>p.ue), ue: p?.ue,
    bs: visible ? bs : undefined,
    paths: visible ? [{ los: reflection.los, points: reflection.los ? [bs, p.ue] : [bs, reflection, p.ue], ri: reflection.los ? undefined : { id: 1, point: reflection } }] : [], running: input.reflectionPlayback === "running" }, images);
}
