/**
 * Case4 2D 地图：底图与轨迹共层，支持滚轮缩放、左旋、右移、复位。
 * 投影 import case3-v2 纯函数；UE 36×48，不用 V2 的 36×38。
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
import pinIdle from "../../../../../assets/case4/ue-pin-idle.png";
import pinLit from "../../../../../assets/case4/ue-pin-lit.png";
import ueSrc from "../../../../../assets/case4/ue-2d.png";
import {
  CASE4_MAP_CAPTURE_READY_TIMEOUT_MS,
  CASE4_MAP_STAGE,
  CASE4_PIN_ANCHOR,
  CASE4_PIN_SIZE,
  CASE4_UE_SIZE,
  type Case4RuntimeConfig,
} from "../../config/case4RuntimeConfig";
import type { MapRendererHandle } from "../../hooks/useCase4Controller";
import type { BasePoint, TrajectoryPoint } from "../../types";
import {
  mapImageLayerToCssTransform,
  projectBusinessToImage,
  type Case3V2ImagePoint,
  type Case3V2MapImageTransform,
} from "../../../case3-v2/mapProjectionV2";
import {
  clientDeltaToStageLogical,
  dragPan,
  dragRotate,
  sameImageTransform,
  wheelZoomAtPointer,
} from "./mapGestures";

type Props = {
  config: Case4RuntimeConfig;
  stageElementRef: React.RefObject<HTMLElement>;
  baseRoute: BasePoint[];
  livePoints: TrajectoryPoint[];
};

type CaptureWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
};

function v2Cfg(config: Case4RuntimeConfig) {
  return {
    v2MapOriginX: config.mapOriginX,
    v2MapOriginY: config.mapOriginY,
    v2MapUnitsPerPx: config.mapUnitsPerPx,
  };
}

function polyline(pts: Case3V2ImagePoint[]): string {
  return pts.map((p) => `${p.imageX},${p.imageY}`).join(" ");
}

function ueBox(point: Case3V2ImagePoint): { left: number; top: number } {
  return {
    left: point.imageX - CASE4_UE_SIZE.width / 2,
    top: point.imageY - CASE4_UE_SIZE.height,
  };
}

/** Pencil c0EO9c / nkOCa：35×42 外框；路径锚点为图钉白点（非外框底边）。 */
function pinBox(point: Case3V2ImagePoint): { left: number; top: number } {
  return {
    left: point.imageX - CASE4_PIN_ANCHOR.x,
    top: point.imageY - CASE4_PIN_ANCHOR.y,
  };
}

/** Pencil Accuj / 静态：外带 + 内芯（半透明预置走廊）。 */
const CORRIDOR = {
  outer: { stroke: "#ABC5FF80", strokeWidth: 14 },
  inner: { stroke: "#457EF980", strokeWidth: 9 },
} as const;

/** Pencil H6Yqj / ZaC4G / 静态 COLORS.walked*：虚拟已走（不透明双线）。 */
const WALKED = {
  outer: { stroke: "#ABC5FF", strokeWidth: 14 },
  inner: { stroke: "#457EF9", strokeWidth: 9 },
} as const;

/**
 * 地图渲染器。
 */
export const MapRenderer2D = forwardRef<MapRendererHandle, Props>(
  function MapRenderer2D(props, ref) {
    const { config, stageElementRef, baseRoute, livePoints } = props;
    const rootRef = useRef<HTMLDivElement>(null);
    const baseView: Case3V2MapImageTransform = {
      scale: config.mapImageScale,
      rotationDeg: config.mapImageRotationDeg,
      offsetX: config.mapImageOffsetX,
      offsetY: config.mapImageOffsetY,
    };
    const [view, setView] = useState(baseView);
    const [natural, setNatural] = useState<{ w: number; h: number } | null>(
      null,
    );
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
          setView(baseView);
        },
        async prepareCapture() {
          if (captureReadyRef.current) return;
          if (captureErrorRef.current) {
            console.error("[case4] map prepareCapture", captureErrorRef.current);
            return;
          }
          await new Promise<void>((resolve) => {
            let settled = false;
            const timer = window.setTimeout(() => {
              if (settled) return;
              settled = true;
              console.error(
                `[case4] map capture timed out after ${CASE4_MAP_CAPTURE_READY_TIMEOUT_MS}ms`,
              );
              resolve();
            }, CASE4_MAP_CAPTURE_READY_TIMEOUT_MS);
            const waiter: CaptureWaiter = {
              resolve: () => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timer);
                resolve();
              },
              reject: () => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timer);
                resolve();
              },
            };
            captureWaitersRef.current.add(waiter);
          });
        },
      }),
      [baseView],
    );

    useEffect(() => {
      const el = rootRef.current;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const scaleRatio = rect.width / el.clientWidth || 1;
        const lx = (e.clientX - rect.left) / scaleRatio - el.clientWidth / 2;
        const ly = (e.clientY - rect.top) / scaleRatio - el.clientHeight / 2;
        setView((v) => wheelZoomAtPointer(v, lx, ly, e.deltaY < 0));
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, []);

    const onPointerDown = (e: React.PointerEvent) => {
      if (e.button === 0) {
        dragRef.current = { mode: "rotate", lastX: e.clientX, lastY: e.clientY };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        return;
      }
      if (e.button === 2) {
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
      const w = rootRef.current?.clientWidth ?? CASE4_MAP_STAGE.width;
      if (drag.mode === "rotate") {
        setView((v) => dragRotate(v, dx, w));
      } else {
        setView((v) => dragPan(v, dx, dy));
      }
    };

    const settleOk = (img: HTMLImageElement) => {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      captureReadyRef.current = true;
      for (const waiter of captureWaitersRef.current) waiter.resolve();
      captureWaitersRef.current.clear();
    };

    const cfg = v2Cfg(config);
    const routePts = baseRoute.map((p) =>
      projectBusinessToImage(p.x, p.y, cfg),
    );
    const k = livePoints.length;
    const walkedPts = routePts.slice(0, k);
    const uePoint = walkedPts.at(-1) ?? null;
    const ue = uePoint ? ueBox(uePoint) : null;
    const viewBox = natural ?? { w: 1, h: 1 };
    const showReset = !sameImageTransform(view, baseView);

    return (
      <div
        className="c4-map-interact"
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
          className="c4-map-image-layer"
          style={{
            width: natural?.w,
            height: natural?.h,
            transform: mapImageLayerToCssTransform(view),
          }}
        >
          <img
            className="c4-map-image"
            src={mapSrc}
            alt=""
            draggable={false}
            onLoad={(e) => settleOk(e.currentTarget)}
          />
          <svg
            className="c4-route-base"
            viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
            aria-hidden
          >
            {routePts.length > 1 ? (
              <>
                <polyline
                  fill="none"
                  stroke={CORRIDOR.outer.stroke}
                  strokeWidth={CORRIDOR.outer.strokeWidth}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={polyline(routePts)}
                />
                <polyline
                  fill="none"
                  stroke={CORRIDOR.inner.stroke}
                  strokeWidth={CORRIDOR.inner.strokeWidth}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={polyline(routePts)}
                />
              </>
            ) : null}
          </svg>
          <svg
            className="c4-route-walked"
            viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
            aria-hidden
          >
            {walkedPts.length > 1 ? (
              <>
                <polyline
                  fill="none"
                  stroke={WALKED.outer.stroke}
                  strokeWidth={WALKED.outer.strokeWidth}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={polyline(walkedPts)}
                />
                <polyline
                  fill="none"
                  stroke={WALKED.inner.stroke}
                  strokeWidth={WALKED.inner.strokeWidth}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={polyline(walkedPts)}
                />
              </>
            ) : null}
          </svg>
          <div className="c4-route-points">
            {routePts.map((pt, i) => {
              const pin = baseRoute[i];
              if (!pin) return null;
              const box = pinBox(pt);
              const lit = i < k;
              return (
                <div
                  key={pin.no}
                  className={`c4-pin${lit ? " is-lit" : ""}`}
                  style={{
                    left: box.left,
                    top: box.top,
                    width: CASE4_PIN_SIZE.width,
                    height: CASE4_PIN_SIZE.height,
                  }}
                >
                  <img
                    className="c4-pin__icon"
                    src={lit ? pinLit : pinIdle}
                    alt=""
                    width={CASE4_PIN_SIZE.width}
                    height={CASE4_PIN_SIZE.height}
                    draggable={false}
                  />
                  <span className="c4-pin__no">{pin.no}</span>
                </div>
              );
            })}
            {ue ? (
              <div
                className="c4-ue"
                style={{
                  left: ue.left,
                  top: ue.top,
                  display: "block",
                  backgroundImage: `url(${ueSrc})`,
                }}
              />
            ) : null}
          </div>
          <svg
            className="c4-tracks"
            viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
            aria-hidden
          >
            {livePoints.length > 1 ? (
              <>
                {(
                  [
                    ["traditional", "#97AAC4"],
                    ["commercial", "#F0A12E"],
                    ["dt", "#7A6BFF"],
                  ] as const
                ).map(([key, color]) => {
                  const pts = livePoints.map((p) =>
                    projectBusinessToImage(p[key].x, p[key].y, cfg),
                  );
                  return (
                    <g key={key}>
                      <polyline
                        fill="none"
                        stroke={color}
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={polyline(pts)}
                      />
                      {pts.map((pt, i) => (
                        <circle
                          key={`${key}-${i}`}
                          cx={pt.imageX}
                          cy={pt.imageY}
                          r={4}
                          fill={color}
                        />
                      ))}
                    </g>
                  );
                })}
              </>
            ) : null}
          </svg>
        </div>
        {showReset ? (
          <button
            type="button"
            className="c4-map-reset"
            aria-label="复位地图"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setView(baseView)}
          >
            <img src={iconReset} alt="" />
          </button>
        ) : null}
      </div>
    );
  },
);
