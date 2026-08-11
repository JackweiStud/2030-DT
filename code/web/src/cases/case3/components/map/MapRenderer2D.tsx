/**
 * Case3 2D 地图渲染器：底图 + 同层 SVG 轨迹/变换。
 * class 名对齐静态页 .case3-map-img / route-layer，浮层由 MapStage 管理。
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import mapSrc from "../../../../../assets/case3/ue_comm_map.png";
import iconReset from "../../../../../assets/case3/icon-rotate-ccw.svg";
import type { Case3RuntimeConfig } from "../../config/case3RuntimeConfig";
import type { MapRendererHandle } from "../../hooks/useCase3Controller";
import {
  IDENTITY_MAP_VIEW,
  assertMapCalibrationInBounds,
  clientDeltaToStageLogical,
  isIdentityMapView,
  mapViewToCssTransform,
  panMapView,
  projectPointToMap2D,
  rotateMapViewByDrag,
  zoomMapViewAtPointer,
  type MapView,
} from "../../metrics/mapProjection";
import type { BaseRoutePoint, Case3Point } from "../../types";

type Props = {
  config: Case3RuntimeConfig;
  baseRoute: BaseRoutePoint[];
  points: Case3Point[];
  stageElementRef: React.RefObject<HTMLElement>;
};

/**
 * 地图底图与交互变换层。
 */
export const MapRenderer2D = forwardRef<MapRendererHandle, Props>(
  function MapRenderer2D(props, ref) {
    const { config, baseRoute, points } = props;
    const rootRef = useRef<HTMLDivElement>(null);
    const [view, setView] = useState<MapView>(IDENTITY_MAP_VIEW);
    const [natural, setNatural] = useState<{ w: number; h: number } | null>(
      null,
    );
    const [ready, setReady] = useState(false);
    const dragRef = useRef<{
      mode: "rotate" | "pan";
      lastX: number;
      lastY: number;
    } | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        resetView() {
          setView(IDENTITY_MAP_VIEW);
        },
        async prepareCapture() {
          if (ready) return;
          await new Promise<void>((resolve) => {
            const t = window.setInterval(() => {
              if (ready) {
                window.clearInterval(t);
                resolve();
              }
            }, 16);
          });
        },
      }),
      [ready],
    );

    useEffect(() => {
      const el = rootRef.current;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const scaleRatio = rect.width / el.clientWidth || 1;
        const lx = (e.clientX - rect.left) / scaleRatio;
        const ly = (e.clientY - rect.top) / scaleRatio;
        setView((v: MapView) => zoomMapViewAtPointer(v, lx, ly, e.deltaY < 0));
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, []);

    const onPointerDown = (e: React.PointerEvent) => {
      if (e.button === 0) {
        dragRef.current = {
          mode: "rotate",
          lastX: e.clientX,
          lastY: e.clientY,
        };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      } else if (e.button === 2) {
        dragRef.current = { mode: "pan", lastX: e.clientX, lastY: e.clientY };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }
    };

    const onPointerMove = (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const stage = props.stageElementRef.current;
      const stageCssW = stage?.getBoundingClientRect().width ?? 1920;
      const dx = clientDeltaToStageLogical(e.clientX - drag.lastX, stageCssW);
      const dy = clientDeltaToStageLogical(e.clientY - drag.lastY, stageCssW);
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      const w = rootRef.current?.clientWidth ?? 891;
      if (drag.mode === "rotate") {
        setView((v: MapView) => rotateMapViewByDrag(v, dx, w));
      } else {
        setView((v: MapView) => panMapView(v, dx, dy));
      }
    };

    const routePts = baseRoute.map((p) =>
      projectPointToMap2D(p.x, p.y, config),
    );
    const livePts = points.map((p) => ({
      no: p.no,
      ...projectPointToMap2D(p.ue.x, p.ue.y, config),
    }));

    return (
      <div
        className="case3-map-interact"
        ref={rootRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className="case3-map__transform"
          style={{ transform: mapViewToCssTransform(view) }}
        >
          <img
            className="case3-map-img"
            src={mapSrc}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              try {
                assertMapCalibrationInBounds(
                  config,
                  img.naturalWidth,
                  img.naturalHeight,
                );
                setNatural({ w: img.naturalWidth, h: img.naturalHeight });
                setReady(true);
              } catch (err) {
                console.error("[case3] map calibration error", err);
              }
            }}
          />
          {natural ? (
            <svg
              className="case3-route-layer"
              viewBox={`0 0 ${natural.w} ${natural.h}`}
              preserveAspectRatio="none"
            >
              {routePts.length > 1 ? (
                <polyline
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  points={routePts
                    .map((p) => `${p.mapPixelX},${p.mapPixelY}`)
                    .join(" ")}
                />
              ) : null}
              {livePts.length > 1 ? (
                <polyline
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth={2.5}
                  points={livePts
                    .map((p) => `${p.mapPixelX},${p.mapPixelY}`)
                    .join(" ")}
                />
              ) : null}
              {livePts.map((p) => (
                <circle
                  key={p.no}
                  cx={p.mapPixelX}
                  cy={p.mapPixelY}
                  r={4}
                  fill="#22d3ee"
                />
              ))}
            </svg>
          ) : null}
        </div>
        {!isIdentityMapView(view) ? (
          <button
            type="button"
            className="case3-map-reset"
            aria-label="复位地图"
            onPointerDown={(e) => {
              // 阻止落到地图交互层，否则左键会开旋转拖拽并吞掉点击
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              setView(IDENTITY_MAP_VIEW);
            }}
          >
            <img src={iconReset} alt="" width={16} height={16} draggable={false} />
          </button>
        ) : null}
      </div>
    );
  },
);
