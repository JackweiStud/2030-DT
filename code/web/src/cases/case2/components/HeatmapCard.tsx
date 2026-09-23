/**
 * 单张热力卡。
 * 有矩阵：Canvas 一次画「底图 + 热力」（object-fit:cover）。
 * 无矩阵或矩阵含哨兵 -1：只显示 CSS cover 底图空槽，不画热力。
 * 该窗图像全屏：滚轮缩放（0.5×～5×，缩向指针）、左键拖旋转（±90°）、
 * 右键拖平移；右上角 ↺ 恢复初始变换；关闭后小窗保留变换（cover 可裁切）；六窗独立。
 * 全屏底部常驻操作提示。
 * 卡底常驻色标：指标名 + 本张矩阵 min/max（1 位小数）+ 5 实色块。
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import type { HeatmapConfig } from "../metrics/heatmapConfig";
import { assertHeatmapAnchor } from "../metrics/heatmapConfig";
import {
  heatmapContainsInvalid,
  matrixMinMax,
  paintHeatmapOnCanvas,
} from "../metrics/heatmap";
import mapBaseUrl from "../../../../assets/case2/maps/heatmap-map-base.png";

type Props = {
  matrix: number[][] | null;
  config: HeatmapConfig;
  empty: boolean;
  metricClass: "rss" | "path" | "delay";
  label: string;
  variant: "initial" | "calibrated";
};

type ViewTransform = {
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
};

const SCALE_MIN = 0.5;
const SCALE_MAX = 5;
const ROTATION_MIN = -90;
const ROTATION_MAX = 90;
const IDENTITY_TRANSFORM: ViewTransform = {
  scale: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
};

let baseImagePromise: Promise<HTMLImageElement> | null = null;
let baseImageSizeLogged = false;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function loadBaseImage(): Promise<HTMLImageElement> {
  if (baseImagePromise) return baseImagePromise;
  baseImagePromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => {
      baseImagePromise = null;
      reject(new Error("heatmap base image failed to load"));
    };
    img.src = mapBaseUrl;
  });
  return baseImagePromise;
}

async function paintHeatOnCanvas(
  canvas: HTMLCanvasElement,
  matrix: number[][],
  config: HeatmapConfig,
  logOnce?: boolean,
): Promise<void> {
  const img = await loadBaseImage();
  assertHeatmapAnchor(config, img.naturalWidth, img.naturalHeight);
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  if (logOnce && !baseImageSizeLogged) {
    baseImageSizeLogged = true;
    console.info("[case2] heatmap base image size", {
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    });
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("[case2] heatmap: 2d context unavailable");
    return;
  }
  paintHeatmapOnCanvas(ctx, img, matrix, config);
}

function toTransformStyle(view: ViewTransform): CSSProperties {
  return {
    transform: `translate(${view.offsetX}px, ${view.offsetY}px) rotate(${view.rotation}deg) scale(${view.scale})`,
    transformOrigin: "center center",
  };
}

function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M2 2h4v1.5H3.5V6H2V2zm8 0h4v4h-1.5V3.5H10V2zM2 10h1.5v2.5H6V14H2v-4zm10.5 0H14v4h-4v-1.5h2.5V10z"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <path
        fill="currentColor"
        d="M5.2 4.1 10 8.9l4.8-4.8 1.1 1.1L11.1 10l4.8 4.8-1.1 1.1L10 11.1l-4.8 4.8-1.1-1.1L8.9 10 4.1 5.2l1.1-1.1z"
      />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <path
        fill="currentColor"
        d="M10 3.5a6.5 6.5 0 1 1-6.1 4.2l1.4.4A5.1 5.1 0 1 0 10 4.9V7l3-3.2L10 0.5V3.5z"
      />
    </svg>
  );
}

const LEGEND_TITLE: Record<Props["metricClass"], string> = {
  rss: "接收信号强度",
  path: "有效径数",
  delay: "最强径时延",
};

function formatLegendBound(value: number | null): string {
  if (value === null) return "—";
  const text = value.toFixed(1);
  return text === "-0.0" ? "0.0" : text;
}

/** 不进变换层：缩放/旋转时色标仍钉在卡底。 */
function HeatmapColorLegend(props: {
  metricClass: Props["metricClass"];
  min: number | null;
  max: number | null;
}) {
  const title = LEGEND_TITLE[props.metricClass];
  const minText = formatLegendBound(props.min);
  const maxText = formatLegendBound(props.max);
  return (
    <div
      className="heatmap-card__legend"
      aria-label={`${title}色标 ${minText} 到 ${maxText}`}
    >
      <span className="heatmap-card__legend-title">{title}</span>
      <span className="heatmap-card__legend-end">{minText}</span>
      <span className="heatmap-card__legend-bar" aria-hidden>
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="heatmap-card__legend-end">{maxText}</span>
    </div>
  );
}

export function HeatmapCard(props: Props) {
  const { matrix, config, empty, metricClass, label, variant } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const expandCanvasRef = useRef<HTMLCanvasElement>(null);
  const lightboxFrameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    mode: "rotate" | "pan";
    startX: number;
    startY: number;
    startRotation: number;
    startOffsetX: number;
    startOffsetY: number;
    frameWidth: number;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<ViewTransform>(IDENTITY_TRANSFORM);
  const titleId = useId();
  const showHeat =
    !empty &&
    matrix !== null &&
    matrix.length > 0 &&
    !heatmapContainsInvalid(matrix);
  const heatRange = showHeat && matrix ? matrixMinMax(matrix) : null;
  const legendMin = heatRange?.eMin ?? null;
  const legendMax = heatRange?.eMax ?? null;
  const xformStyle = toTransformStyle(view);

  useEffect(() => {
    if (!showHeat || !matrix) return;
    let cancelled = false;

    void (async () => {
      try {
        let canvas = canvasRef.current;
        if (!canvas) {
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
          canvas = canvasRef.current;
        }
        if (!canvas || cancelled) return;
        await paintHeatOnCanvas(canvas, matrix, config, true);
      } catch (err) {
        console.error("[case2] heatmap paint failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [matrix, config, showHeat]);

  useEffect(() => {
    if (!expanded || !showHeat || !matrix) return;
    let cancelled = false;

    void (async () => {
      try {
        let canvas = expandCanvasRef.current;
        if (!canvas) {
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
          canvas = expandCanvasRef.current;
        }
        if (!canvas || cancelled) return;
        await paintHeatOnCanvas(canvas, matrix, config);
      } catch (err) {
        console.error("[case2] heatmap expand paint failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [expanded, showHeat, matrix, config]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const resetView = useCallback(() => {
    setView(IDENTITY_TRANSFORM);
  }, []);

  // React onWheel 默认可能是 passive，preventDefault 会刷控制台警告；改为非 passive 原生监听
  useEffect(() => {
    if (!expanded) return;
    const frame = lightboxFrameRef.current;
    if (!frame) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const rect = frame.getBoundingClientRect();
      const mx = event.clientX - rect.left - rect.width / 2;
      const my = event.clientY - rect.top - rect.height / 2;
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;

      setView((prev) => {
        const nextScale = clamp(prev.scale * factor, SCALE_MIN, SCALE_MAX);
        if (nextScale === prev.scale) return prev;
        const ratio = nextScale / prev.scale;
        return {
          ...prev,
          scale: nextScale,
          offsetX: mx - (mx - prev.offsetX) * ratio,
          offsetY: my - (my - prev.offsetY) * ratio,
        };
      });
    };

    frame.addEventListener("wheel", onWheel, { passive: false });
    const onContextMenu = (event: Event) => {
      event.preventDefault();
    };
    frame.addEventListener("contextmenu", onContextMenu);
    return () => {
      frame.removeEventListener("wheel", onWheel);
      frame.removeEventListener("contextmenu", onContextMenu);
    };
  }, [expanded]);

  const onLightboxPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // 0=左键旋转，2=右键平移
      if (event.button !== 0 && event.button !== 2) return;
      const frame = lightboxFrameRef.current;
      if (!frame) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const mode = event.button === 2 ? "pan" : "rotate";
      dragRef.current = {
        pointerId: event.pointerId,
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startRotation: view.rotation,
        startOffsetX: view.offsetX,
        startOffsetY: view.offsetY,
        frameWidth: Math.max(1, frame.getBoundingClientRect().width),
      };
    },
    [view.offsetX, view.offsetY, view.rotation],
  );

  const onLightboxPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      if (drag.mode === "pan") {
        const nextOffsetX = drag.startOffsetX + (event.clientX - drag.startX);
        const nextOffsetY = drag.startOffsetY + (event.clientY - drag.startY);
        setView((prev) => ({
          ...prev,
          offsetX: nextOffsetX,
          offsetY: nextOffsetY,
        }));
        return;
      }

      const deltaX = event.clientX - drag.startX;
      // 拖过视窗宽度 ≈ 从当前起点转到 ±90° 端点（相对 0 时满宽到端）
      const nextRotation = clamp(
        drag.startRotation + (deltaX / drag.frameWidth) * 90,
        ROTATION_MIN,
        ROTATION_MAX,
      );
      setView((prev) =>
        prev.rotation === nextRotation
          ? prev
          : { ...prev, rotation: nextRotation },
      );
    },
    [],
  );

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return (
    <article className={`heatmap-card is-${variant}`}>
      <div className="heatmap-card__media">
        <div className="heatmap-card__xform" style={xformStyle}>
          {!showHeat ? <div className="heatmap-base" aria-hidden /> : null}
          {showHeat ? (
            <canvas ref={canvasRef} className="heatmap-canvas" />
          ) : null}
        </div>
      </div>
      <div className={`metric-tag metric-tag--${metricClass}`}>
        <span className="metric-tag__label">{label}</span>
      </div>
      <HeatmapColorLegend
        metricClass={metricClass}
        min={legendMin}
        max={legendMax}
      />
      <button
        type="button"
        className="heatmap-expand-btn"
        title="全屏查看"
        aria-label={`${label} ${variant} 全屏查看`}
        onClick={(event) => {
          event.stopPropagation();
          setExpanded(true);
        }}
      >
        <ExpandIcon />
      </button>

      {expanded
        ? createPortal(
            <div
              className="case2-heatmap-lightbox"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              <div className="case2-heatmap-lightbox__toolbar">
                <button
                  type="button"
                  className="case2-heatmap-lightbox__reset"
                  title="恢复初始缩放、旋转与平移"
                  aria-label="恢复初始缩放、旋转与平移"
                  onClick={resetView}
                >
                  <ResetIcon />
                </button>
                <button
                  type="button"
                  className="case2-heatmap-lightbox__close"
                  title="关闭全屏"
                  aria-label="关闭全屏"
                  onClick={() => setExpanded(false)}
                >
                  <CloseIcon />
                </button>
              </div>
              <div
                ref={lightboxFrameRef}
                className="case2-heatmap-lightbox__frame"
                onPointerDown={onLightboxPointerDown}
                onPointerMove={onLightboxPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <span id={titleId} className="visually-hidden">
                  {label} {variant}
                </span>
                <div
                  className="case2-heatmap-lightbox__xform"
                  style={xformStyle}
                >
                  {!showHeat ? (
                    <div className="heatmap-base" aria-hidden />
                  ) : null}
                  {showHeat ? (
                    <canvas
                      ref={expandCanvasRef}
                      className="heatmap-canvas"
                    />
                  ) : null}
                </div>
                <div className={`metric-tag metric-tag--${metricClass}`}>
                  <span className="metric-tag__label">{label}</span>
                </div>
                <HeatmapColorLegend
                  metricClass={metricClass}
                  min={legendMin}
                  max={legendMax}
                />
              </div>
              <p className="case2-heatmap-lightbox__hint" aria-hidden>
                滚轮缩放 · 左键拖旋转 · 右键拖平移 · ↺恢复 · Esc关闭
              </p>
            </div>,
            document.body,
          )
        : null}
    </article>
  );
}
