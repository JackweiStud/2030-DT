/**
 * Case3 V2 单地图渲染器：冻结等轴测底图 + 动态预置路线/编号点。
 * 底图、路线、点位共用 transform；HUD / Dock 不进入本层。
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import mapSrc from "../../../../../assets/case3-v2/site-2d.jpg";
import iconReset from "../../../../../assets/case3-v2/icon-rotate-ccw.svg";
import { CASE3_MAP_CAPTURE_READY_TIMEOUT_MS } from "../../../case3/config/case3RuntimeConfig";
import type { MapRendererHandle } from "../../../case3/hooks/useCase3Controller";
import {
  IDENTITY_MAP_VIEW,
  clientDeltaToStageLogical,
  isIdentityMapView,
  mapViewToCssTransform,
  panMapView,
  rotateMapViewByDrag,
  zoomMapViewAtPointer,
  type MapView,
} from "../../../case3/metrics/mapProjection";
import type { BaseRoutePoint } from "../../../case3/types";
import {
  CASE3V2_MAP_STAGE,
  pinBoxFromStagePoint,
  projectBusinessToStage,
} from "../../mapProjectionV2";

type Props = {
  baseRoute: BaseRoutePoint[];
  stageElementRef: React.RefObject<HTMLElement>;
};

type CaptureWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
};

function routePointsAttr(
  points: Array<{ stageX: number; stageY: number }>,
): string {
  return points.map((p) => `${p.stageX},${p.stageY}`).join(" ");
}

/**
 * V2 地图底图与交互变换层。
 */
export const MapRenderer2D = forwardRef<MapRendererHandle, Props>(
  function MapRenderer2D(props, ref) {
    const { baseRoute, stageElementRef } = props;
    const rootRef = useRef<HTMLDivElement>(null);
    const [view, setView] = useState<MapView>(IDENTITY_MAP_VIEW);
    const captureReadyRef = useRef(false);
    const captureErrorRef = useRef<Error | null>(null);
    const captureWaitersRef = useRef(new Set<CaptureWaiter>());
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
          if (captureReadyRef.current) return;
          if (captureErrorRef.current) throw captureErrorRef.current;

          await new Promise<void>((resolve, reject) => {
            let settled = false;
            let waiter: CaptureWaiter;
            const timer = window.setTimeout(() => {
              if (settled) return;
              settled = true;
              captureWaitersRef.current.delete(waiter);
              reject(
                new Error(
                  `case3-v2 map capture readiness timed out after ${CASE3_MAP_CAPTURE_READY_TIMEOUT_MS}ms`,
                ),
              );
            }, CASE3_MAP_CAPTURE_READY_TIMEOUT_MS);
            const finish = (callback: () => void) => {
              if (settled) return;
              settled = true;
              window.clearTimeout(timer);
              captureWaitersRef.current.delete(waiter);
              callback();
            };
            waiter = {
              resolve: () => finish(resolve),
              reject: (error) => finish(() => reject(error)),
            };
            captureWaitersRef.current.add(waiter);
          });
        },
      }),
      [],
    );

    useEffect(
      () => () => {
        const error = new Error("case3-v2 map renderer unmounted before capture");
        for (const waiter of captureWaitersRef.current) waiter.reject(error);
        captureWaitersRef.current.clear();
      },
      [],
    );

    useEffect(() => {
      const el = rootRef.current;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const scaleRatio = rect.width / el.clientWidth || 1;
        const lx =
          (e.clientX - rect.left) / scaleRatio - el.clientWidth / 2;
        const ly =
          (e.clientY - rect.top) / scaleRatio - el.clientHeight / 2;
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
      const stage = stageElementRef.current;
      const stageCssW = stage?.getBoundingClientRect().width ?? 1920;
      const dx = clientDeltaToStageLogical(e.clientX - drag.lastX, stageCssW);
      const dy = clientDeltaToStageLogical(e.clientY - drag.lastY, stageCssW);
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      const w = rootRef.current?.clientWidth ?? CASE3V2_MAP_STAGE.width;
      if (drag.mode === "rotate") {
        setView((v: MapView) => rotateMapViewByDrag(v, dx, w));
      } else {
        setView((v: MapView) => panMapView(v, dx, dy));
      }
    };

    const settleCaptureOk = () => {
      captureReadyRef.current = true;
      captureErrorRef.current = null;
      for (const waiter of captureWaitersRef.current) waiter.resolve();
      captureWaitersRef.current.clear();
    };

    const settleCaptureError = (error: Error) => {
      captureErrorRef.current = error;
      console.error("[case3-v2] map image error", error);
      for (const waiter of captureWaitersRef.current) waiter.reject(error);
      captureWaitersRef.current.clear();
    };

    const routePts = baseRoute.map((p) => projectBusinessToStage(p.x, p.y));
    const polyline = routePointsAttr(routePts);

    return (
      <div
        className="case3v2-map-interact"
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
          className="case3v2-map-transform"
          style={{ transform: mapViewToCssTransform(view) }}
        >
          <img
            className="case3v2-map-image"
            src={mapSrc}
            alt=""
            draggable={false}
            onLoad={settleCaptureOk}
            onError={() =>
              settleCaptureError(new Error("case3-v2 map image failed to load"))
            }
          />
          <div className="case3v2-route-base" aria-hidden>
            {routePts.length > 1 ? (
              <>
                <svg
                  className="case3v2-route-svg"
                  viewBox={`0 0 ${CASE3V2_MAP_STAGE.width} ${CASE3V2_MAP_STAGE.height}`}
                  preserveAspectRatio="none"
                >
                  <polyline
                    fill="none"
                    stroke="#ABC5FF80"
                    strokeWidth={14}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    points={polyline}
                  />
                </svg>
                <svg
                  className="case3v2-route-svg"
                  viewBox={`0 0 ${CASE3V2_MAP_STAGE.width} ${CASE3V2_MAP_STAGE.height}`}
                  preserveAspectRatio="none"
                >
                  <polyline
                    fill="none"
                    stroke="#457EF980"
                    strokeWidth={9}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    points={polyline}
                  />
                </svg>
              </>
            ) : null}
          </div>
          <div className="case3v2-route-points" data-route-points>
            {baseRoute.map((point, index) => {
              const stage = routePts[index];
              if (!stage) return null;
              const box = pinBoxFromStagePoint(stage);
              return (
                <div
                  key={point.no}
                  className="case3v2-pin is-idle"
                  data-route-no={point.no}
                  style={{ left: box.left, top: box.top }}
                >
                  <span className="case3v2-pin__icon" aria-hidden />
                  <span className="case3v2-pin__no">{point.no}</span>
                </div>
              );
            })}
          </div>
        </div>
        {!isIdentityMapView(view) ? (
          <button
            type="button"
            className="case3v2-map-reset"
            aria-label="复位地图"
            onPointerDown={(e) => {
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
