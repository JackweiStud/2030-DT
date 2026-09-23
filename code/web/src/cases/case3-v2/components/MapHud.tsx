/**
 * 地图 HUD：测试对比、现场环境、2D|3D、波束矩阵。不进地图 transform。
 */

import type { Case3Point } from "../../case3/types";
import { BeamMatrixCard } from "./BeamMatrixCard";
import { ViewModeToggle } from "./ViewModeToggle";

type Props = {
  currentPoint?: Case3Point | null;
  peerPoint?: Case3Point | null;
  beamMode?: "without" | "with";
  onOpenSiteEnv: () => void;
};

/**
 * 地图浮层。
 */
export function MapHud(props: Props) {
  return (
    <section className="case3v2-map-hud" data-region="MapHud">
      <div className="case3v2-top-mask" aria-hidden />
      <div className="case3v2-compare">
        <span className="case3v2-compare__icon" aria-hidden />
        <span className="case3v2-compare__text">通信性能测试</span>
      </div>
      <button
        type="button"
        className="case3v2-site-env-link"
        onClick={props.onOpenSiteEnv}
      >
        {"现场环境 >"}
      </button>
      <ViewModeToggle />
      <BeamMatrixCard
        mode={props.beamMode ?? "without"}
        point={props.currentPoint ?? null}
        peerPoint={props.peerPoint ?? null}
      />
    </section>
  );
}
