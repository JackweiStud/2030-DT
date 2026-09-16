/**
 * 地图 HUD：测试对比、现场环境、2D/3D、图例。不进地图 transform。
 */

import { TrackLegend } from "./TrackLegend";
import { ViewModeToggle } from "./ViewModeToggle";

type Props = {
  onOpenSiteEnv: () => void;
};

/**
 * 地图浮层。
 */
export function MapHud(props: Props) {
  return (
    <section className="c4-map-hud" data-region="MapHud">
      <div className="c4-top-mask" aria-hidden />
      <div className="c4-compare">
        <span className="c4-compare__icon" aria-hidden />
        <span className="c4-compare__text">测试对比</span>
      </div>
      <button
        type="button"
        className="c4-site-env-link"
        onClick={props.onOpenSiteEnv}
      >
        {"现场环境 >"}
      </button>
      <ViewModeToggle />
      <TrackLegend />
    </section>
  );
}
