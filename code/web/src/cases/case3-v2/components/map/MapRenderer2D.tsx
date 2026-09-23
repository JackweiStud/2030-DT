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
import {
  CASE3_MAP_CAPTURE_READY_TIMEOUT_MS,
  type Case3RuntimeConfig,
} from "../../../case3/config/case3RuntimeConfig";
import type { MapRendererHandle } from "../../../case3/hooks/useCase3Controller";
import {
  clientDeltaToStageLogical,
  panMapView,
  rotateMapViewByDrag,
  zoomMapViewAtPointer,
} from "../../../case3/metrics/mapProjection";
import type { BaseRoutePoint, Case3Point } from "../../../case3/types";
import { ReflectionOverlay } from "./ReflectionOverlay";
import {
  CASE3V2_MAP_STAGE,
  formatCase3V2MapEnv,
  formatBusinessCoordinateRows,
  isImagePointInNaturalBounds,
  mapImageLayerToCssTransform,
  mapImageTransformFromConfig,
  mapStagePointToImagePoint,
  pinBoxFromImagePoint,
  projectBusinessToImage,
  projectImageToBusiness,
  sampleImagePolylineByDistance,
  type Case3V2ImagePoint,
  type Case3V2MapImageTransform,
  ueBoxFromImagePoint,
} from "../../mapProjectionV2";

type Props = {
  config: Case3RuntimeConfig;
  baseRoute: BaseRoutePoint[];
  /** 最新快照中的完整点；不完整尾点不得传入。 */
  points?: Case3Point[];
  currentPoint?: Case3Point | null;
  reflectionVisible?: boolean;
  reflectionPlayback?: "running" | "static";
  stageElementRef: React.RefObject<HTMLElement>;
};

type CaptureWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
};

function routePointsAttr(
  points: Array<{ imageX: number; imageY: number }>,
): string {
  return points.map((p) => `${p.imageX},${p.imageY}`).join(" ");
}

function sameImageTransform(
  left: Case3V2MapImageTransform,
  right: Case3V2MapImageTransform,
): boolean {
  return (
    left.scale === right.scale &&
    left.rotationDeg === right.rotationDeg &&
    left.offsetX === right.offsetX &&
    left.offsetY === right.offsetY
  );
}

function clampSampleCount(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(999, Math.max(1, Math.floor(value)));
}

/**
 * V2 地图底图与交互变换层。
 */
export const MapRenderer2D = forwardRef<MapRendererHandle, Props>(
  function MapRenderer2D(props, ref) {
    const {
      config,
      baseRoute,
      points = [],
      currentPoint = null,
      reflectionVisible = false,
      reflectionPlayback = "static",
      stageElementRef,
    } = props;
    const rootRef = useRef<HTMLDivElement>(null);
    const baseImageTransform = mapImageTransformFromConfig(config);
    const [imageTransform, setImageTransform] =
      useState<Case3V2MapImageTransform>(baseImageTransform);
    const [natural, setNatural] = useState<{ w: number; h: number } | null>(
      null,
    );
    const [drawMode, setDrawMode] = useState(false);
    const [drawPoints, setDrawPoints] = useState<Case3V2ImagePoint[]>([]);
    const [sampleCount, setSampleCount] = useState(() =>
      Math.max(2, baseRoute.length || 20),
    );
    const captureReadyRef = useRef(false);
    const captureErrorRef = useRef<Error | null>(null);
    const captureWaitersRef = useRef(new Set<CaptureWaiter>());
    const dragRef = useRef<
      | {
          mode: "rotate" | "pan";
          lastX: number;
          lastY: number;
        }
      | {
          mode: "draw";
          lastX: number;
          lastY: number;
          lastImageX: number;
          lastImageY: number;
        }
      | null
    >(null);

    useImperativeHandle(
      ref,
      () => ({
        resetView() {
          setImageTransform(baseImageTransform);
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
      [baseImageTransform],
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
        setImageTransform((v: Case3V2MapImageTransform) => {
          const next = zoomMapViewAtPointer(
            {
              scale: v.scale,
              rotation: v.rotationDeg,
              offsetX: v.offsetX,
              offsetY: v.offsetY,
            },
            lx,
            ly,
            e.deltaY < 0,
          );
          return {
            scale: next.scale,
            rotationDeg: next.rotation,
            offsetX: next.offsetX,
            offsetY: next.offsetY,
          };
        });
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, []);

    const pointerToImagePoint = (
      e: React.PointerEvent | React.MouseEvent,
    ): Case3V2ImagePoint | null => {
      const el = rootRef.current;
      if (!el || !natural) return null;
      const rect = el.getBoundingClientRect();
      const rectWidth = rect.width || CASE3V2_MAP_STAGE.width;
      const rectHeight = rect.height || CASE3V2_MAP_STAGE.height;
      const stageX =
        ((e.clientX - rect.left) * CASE3V2_MAP_STAGE.width) / rectWidth;
      const stageY =
        ((e.clientY - rect.top) * CASE3V2_MAP_STAGE.height) / rectHeight;
      const point = mapStagePointToImagePoint(
        { stageX, stageY },
        natural,
        imageTransform,
      );
      if (!isImagePointInNaturalBounds(point, natural.w, natural.h)) return null;
      return point;
    };

    const appendDrawPoint = (point: Case3V2ImagePoint, minDistance = 0) => {
      setDrawPoints((prev) => {
        const last = prev.at(-1);
        if (
          last &&
          Math.hypot(point.imageX - last.imageX, point.imageY - last.imageY) <
            minDistance
        ) {
          return prev;
        }
        return [...prev, point];
      });
    };

    const onPointerDown = (e: React.PointerEvent) => {
      if (e.button !== 2) {
        if (drawMode) {
          const point = pointerToImagePoint(e);
          if (!point) return;
          appendDrawPoint(point, 2);
          dragRef.current = {
            mode: "draw",
            lastX: e.clientX,
            lastY: e.clientY,
            lastImageX: point.imageX,
            lastImageY: point.imageY,
          };
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          e.preventDefault();
          return;
        }
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

    const onMapClick = (e: React.MouseEvent) => {
      if (!drawMode) return;
      const point = pointerToImagePoint(e);
      if (!point) return;
      appendDrawPoint(point, 2);
    };

    const onPointerMove = (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.mode === "draw") {
        const point = pointerToImagePoint(e);
        if (!point) return;
        if (
          Math.hypot(point.imageX - drag.lastImageX, point.imageY - drag.lastImageY) >=
          8
        ) {
          appendDrawPoint(point);
          drag.lastImageX = point.imageX;
          drag.lastImageY = point.imageY;
        }
        drag.lastX = e.clientX;
        drag.lastY = e.clientY;
        return;
      }
      const stage = stageElementRef.current;
      const stageCssW = stage?.getBoundingClientRect().width ?? 1920;
      const dx = clientDeltaToStageLogical(e.clientX - drag.lastX, stageCssW);
      const dy = clientDeltaToStageLogical(e.clientY - drag.lastY, stageCssW);
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      const w = rootRef.current?.clientWidth ?? CASE3V2_MAP_STAGE.width;
      if (drag.mode === "rotate") {
        setImageTransform((v: Case3V2MapImageTransform) => {
          const next = rotateMapViewByDrag(
            {
              scale: v.scale,
              rotation: v.rotationDeg,
              offsetX: v.offsetX,
              offsetY: v.offsetY,
            },
            dx,
            w,
          );
          return { ...v, rotationDeg: next.rotation };
        });
      } else {
        setImageTransform((v: Case3V2MapImageTransform) => {
          const next = panMapView(
            {
              scale: v.scale,
              rotation: v.rotationDeg,
              offsetX: v.offsetX,
              offsetY: v.offsetY,
            },
            dx,
            dy,
          );
          return { ...v, offsetX: next.offsetX, offsetY: next.offsetY };
        });
      }
    };

    const settleCaptureOk = (img: HTMLImageElement) => {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
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

    const routePts = baseRoute.map((p) =>
      projectBusinessToImage(p.x, p.y, config),
    );
    const polyline = routePointsAttr(routePts);
    const litNos = new Set(points.map((p) => p.no));
    const walkedPts = [...points]
      .sort((a, b) => a.no - b.no)
      .map((p) => projectBusinessToImage(p.ue.x, p.ue.y, config));
    const walkedPolyline = routePointsAttr(walkedPts);
    const uePoint = walkedPts.at(-1) ?? null;
    const ueBox = uePoint ? ueBoxFromImagePoint(uePoint) : null;
    const routeViewBox = natural ?? { w: 1, h: 1 };
    const debugEnvText = formatCase3V2MapEnv(imageTransform);
    const sampledImagePoints = sampleImagePolylineByDistance(
      drawPoints,
      sampleCount,
    );
    const sampledBusinessRows = formatBusinessCoordinateRows(
      sampledImagePoints.map((point) => projectImageToBusiness(point, config)),
    );
    const drawnPolyline = routePointsAttr(drawPoints);
    const showReset = !sameImageTransform(imageTransform, baseImageTransform);

    return (
      <div
        className={`case3v2-map-interact ${drawMode ? "is-drawing" : ""}`}
        data-draw-mode={drawMode ? "1" : "0"}
        ref={rootRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        onClick={onMapClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="case3v2-map-transform">
          <div
            className="case3v2-map-image-layer"
            style={{
              width: natural?.w,
              height: natural?.h,
              transform: mapImageLayerToCssTransform(imageTransform),
            }}
          >
            <img
              className="case3v2-map-image"
              src={mapSrc}
              alt=""
              draggable={false}
              onLoad={(e) => settleCaptureOk(e.currentTarget)}
              onError={() =>
                settleCaptureError(new Error("case3-v2 map image failed to load"))
              }
            />
            <div className="case3v2-route-base" aria-hidden>
              {routePts.length > 1 ? (
                <>
                  <svg
                    className="case3v2-route-svg"
                    viewBox={`0 0 ${routeViewBox.w} ${routeViewBox.h}`}
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
                    viewBox={`0 0 ${routeViewBox.w} ${routeViewBox.h}`}
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
            <div className="case3v2-route-walked" data-walked aria-hidden>
              {walkedPts.length > 1 ? (
                <>
                  <svg
                    className="case3v2-route-svg"
                    viewBox={`0 0 ${routeViewBox.w} ${routeViewBox.h}`}
                    preserveAspectRatio="none"
                  >
                    <polyline
                      data-walked-outer
                      fill="none"
                      stroke="#ABC5FF"
                      strokeWidth={14}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      points={walkedPolyline}
                    />
                  </svg>
                  <svg
                    className="case3v2-route-svg"
                    viewBox={`0 0 ${routeViewBox.w} ${routeViewBox.h}`}
                    preserveAspectRatio="none"
                  >
                    <polyline
                      data-walked-inner
                      fill="none"
                      stroke="#457EF9"
                      strokeWidth={9}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      points={walkedPolyline}
                    />
                  </svg>
                </>
              ) : null}
            </div>
            {reflectionVisible ? (
              <ReflectionOverlay
                config={config}
                point={currentPoint}
                viewBox={routeViewBox}
                playback={reflectionPlayback}
              />
            ) : null}
            <div className="case3v2-route-debug" data-debug-route aria-hidden>
              {drawPoints.length > 1 ? (
                <svg
                  className="case3v2-route-svg"
                  viewBox={`0 0 ${routeViewBox.w} ${routeViewBox.h}`}
                  preserveAspectRatio="none"
                >
                  <polyline
                    data-debug-route-line
                    fill="none"
                    stroke="#F97316"
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    points={drawnPolyline}
                  />
                </svg>
              ) : null}
              {drawPoints.length > 0 ? (
                <svg
                  className="case3v2-route-svg"
                  viewBox={`0 0 ${routeViewBox.w} ${routeViewBox.h}`}
                  preserveAspectRatio="none"
                >
                  {drawPoints.map((point, index) => (
                    <circle
                      key={`${point.imageX}-${point.imageY}-${index}`}
                      data-debug-draw-point
                      cx={point.imageX}
                      cy={point.imageY}
                      r={5}
                      fill="#FDBA74"
                      stroke="#7C2D12"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  {sampledImagePoints.map((point, index) => (
                    <circle
                      key={`sample-${point.imageX}-${point.imageY}-${index}`}
                      data-debug-sample-point
                      cx={point.imageX}
                      cy={point.imageY}
                      r={3}
                      fill="#ECFEFF"
                      stroke="#0891B2"
                      strokeWidth={1.5}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </svg>
              ) : null}
            </div>
            <div className="case3v2-route-points" data-route-points>
              {baseRoute.map((point, index) => {
                const imagePoint = routePts[index];
                if (!imagePoint) return null;
                const box = pinBoxFromImagePoint(imagePoint);
                const lit = litNos.has(point.no);
                return (
                  <div
                    key={point.no}
                    className={`case3v2-pin ${lit ? "is-lit" : "is-idle"}`}
                    data-route-no={point.no}
                    data-pin-lit={lit ? "1" : "0"}
                    style={{ left: box.left, top: box.top }}
                  >
                    <span className="case3v2-pin__icon" aria-hidden />
                    <span className="case3v2-pin__no">{point.no}</span>
                  </div>
                );
              })}
            </div>
            {ueBox ? (
              <div
                className="case3v2-ue"
                data-ue
                style={{ left: ueBox.left, top: ueBox.top }}
              />
            ) : null}
          </div>
        </div>
        {config.v2DebugShow ? (
          <aside
            className="case3v2-map-debug"
            data-map-debug
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="case3v2-map-debug__title">V2 地图调参</div>
            <textarea
              className="case3v2-map-debug__env"
              aria-label="case3-v2 地图显示参数"
              readOnly
              value={debugEnvText}
            />
            <div className="case3v2-map-debug__hint">
              复制到 code/web/.env 后重启 dev / 重新 build
            </div>
            <div className="case3v2-map-debug__section">
              <div className="case3v2-map-debug__row">
                <button
                  type="button"
                  className={`case3v2-map-debug__button ${
                    drawMode ? "is-active" : ""
                  }`}
                  aria-pressed={drawMode}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDrawMode((value) => !value);
                  }}
                >
                  {drawMode ? "结束绘制" : "绘制路径"}
                </button>
                <label className="case3v2-map-debug__sample">
                  <span>N</span>
                  <input
                    aria-label="case3-v2 UE路径采样点数"
                    type="number"
                    min={1}
                    max={999}
                    step={1}
                    value={sampleCount}
                    onChange={(e) =>
                      setSampleCount(clampSampleCount(Number(e.currentTarget.value)))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="case3v2-map-debug__button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDrawPoints([]);
                  }}
                >
                  清空
                </button>
              </div>
              <textarea
                className="case3v2-map-debug__coords"
                aria-label="case3-v2 UE预置路径采样坐标"
                readOnly
                placeholder="开启绘制后，在地图上左键拖拽/点选轨迹；这里输出 X,Y,Z 物理坐标"
                value={sampledBusinessRows}
              />
              <div className="case3v2-map-debug__hint">
                输出为 UE 物理坐标 X,Y,Z；按轨迹线欧式距离等距采样。
              </div>
            </div>
          </aside>
        ) : null}
        {showReset ? (
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
              setImageTransform(baseImageTransform);
            }}
          >
            <img src={iconReset} alt="" width={16} height={16} draggable={false} />
          </button>
        ) : null}
      </div>
    );
  },
);
