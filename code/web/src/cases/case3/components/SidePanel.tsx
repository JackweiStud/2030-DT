/**
 * Case3 单侧面板：标题/徽标/按钮 + MapStage。
 * 文案对齐静态页：无 DT / 有 DT。
 */

import iconWithout from "../../../../assets/case3/icon-without.png";
import iconWith from "../../../../assets/case3/icon-with.png";
import type { Case3RuntimeConfig } from "../config/case3RuntimeConfig";
import type { MapRendererHandle } from "../hooks/useCase3Controller";
import type { BaseRoutePoint, Case3Point, Case3Side } from "../types";
import { MapStage } from "./MapStage";

type Props = {
  side: Case3Side;
  config: Case3RuntimeConfig;
  baseRoute: BaseRoutePoint[];
  points: Case3Point[];
  peerPoints?: Case3Point[] | null;
  badge: string;
  startEnabled: boolean;
  resetEnabled: boolean;
  onStart: () => void;
  onReset: () => void;
  stageElementRef: React.RefObject<HTMLElement>;
  mapRef: React.Ref<MapRendererHandle | null>;
};

/**
 * Without / With 侧面板。
 */
export function SidePanel(props: Props) {
  const isWithout = props.side === "without";
  const label = isWithout ? "无 DT" : "有 DT";
  const icon = isWithout ? iconWithout : iconWith;

  return (
    <article className="case3-side" data-side={props.side}>
      <div className="case3-side-header">
        <div className="case3-side-label-group">
          <img className="case3-side-icon" src={icon} width={24} height={24} alt="" />
          <span className="case3-side-label">{label}</span>
          <span className="case3-status-badge">
            <span className="case3-status-text">{props.badge}</span>
          </span>
        </div>
        <div className="case3-side-actions">
          <button
            type="button"
            className={`case3-btn case3-btn--start${!props.startEnabled ? " is-disabled" : ""}`}
            disabled={!props.startEnabled}
            onClick={props.onStart}
          >
            <svg className="case3-btn__icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden>
              <path d="M5 3v18l15-9L5 3z" fill="currentColor" />
            </svg>
            <span>启动</span>
          </button>
          <button
            type="button"
            className={`case3-btn case3-btn--reset${!props.resetEnabled ? " is-disabled" : ""}`}
            disabled={!props.resetEnabled}
            onClick={props.onReset}
          >
            <svg
              className="case3-btn__icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3 3v5h5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>重置</span>
          </button>
        </div>
      </div>
      <MapStage
        ref={props.mapRef as React.Ref<MapRendererHandle>}
        side={props.side}
        config={props.config}
        baseRoute={props.baseRoute}
        points={props.points}
        peerPoints={props.peerPoints}
        stageElementRef={props.stageElementRef}
      />
    </article>
  );
}
