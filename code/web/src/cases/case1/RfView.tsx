import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { asset } from "./assets";
import type { loadConfig } from "./config";
import { assertHeatmapAnchor } from "../case2/metrics/heatmapConfig";
import { paintHeatOverlayOnCanvas } from "../case2/metrics/heatmap";

type ViewTransform = {
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function RfView({
  matrix,
  error,
  config,
}: {
  matrix?: number[][];
  error?: string;
  config: ReturnType<typeof loadConfig>;
}) {
  const image = useRef<HTMLImageElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    mode: "rotate" | "pan";
    startX: number;
    startY: number;
    startRotation: number;
    startOffsetX: number;
    startOffsetY: number;
    frameWidth: number;
    screenToLocalX: number;
    screenToLocalY: number;
  } | null>(null);
  const [view, setView] = useState<ViewTransform>({
    scale: config.rfView.scale,
    rotation: config.rfView.rotation,
    offsetX: config.rfView.offsetX,
    offsetY: config.rfView.offsetY,
  });
  const [anchorError, setAnchorError] = useState<string>();

  useEffect(() => {
    const img = image.current;
    const board = canvas.current;
    if (!img || !board || !matrix) return;
    const paint = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      board.width = img.naturalWidth;
      board.height = img.naturalHeight;
      const heat = config.rf;
      try {
        assertHeatmapAnchor(heat, img.naturalWidth, img.naturalHeight);
      } catch {
        setAnchorError(
          `锚区 (${heat.x0},${heat.y0})-(${heat.x1},${heat.y1}) 超出底图 ${img.naturalWidth}×${img.naturalHeight}`,
        );
        return;
      }
      const ctx = board.getContext("2d");
      if (!ctx) return;
      paintHeatOverlayOnCanvas(ctx, matrix, heat);
      setAnchorError(undefined);
    };
    if (img.complete) paint();
    img.addEventListener("load", paint);
    return () => img.removeEventListener("load", paint);
  }, [matrix, config.rf]);

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      // client coordinates include the Shell transform; CSS offsets use layout pixels.
      const mx =
        ((event.clientX - rect.left - rect.width / 2) * node.clientWidth) / rect.width;
      const my =
        ((event.clientY - rect.top - rect.height / 2) * node.clientHeight) / rect.height;
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      setView((prev) => {
        const nextScale = clamp(prev.scale * factor, 0.5, 5);
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
    const onContextMenu = (event: Event) => event.preventDefault();
    node.addEventListener("wheel", onWheel, { passive: false });
    node.addEventListener("contextmenu", onContextMenu);
    return () => {
      node.removeEventListener("wheel", onWheel);
      node.removeEventListener("contextmenu", onContextMenu);
    };
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 && event.button !== 2) return;
      const node = frame.current;
      if (!node) return;
      const box = node.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {
        pointerId: event.pointerId,
        mode: event.button === 2 ? "pan" : "rotate",
        startX: event.clientX,
        startY: event.clientY,
        startRotation: view.rotation,
        startOffsetX: view.offsetX,
        startOffsetY: view.offsetY,
        frameWidth: Math.max(1, box.width),
        screenToLocalX: node.clientWidth / box.width,
        screenToLocalY: node.clientHeight / box.height,
      };
    },
    [view.offsetX, view.offsetY, view.rotation],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.mode === "pan") {
      setView((prev) => ({
        ...prev,
        offsetX:
          current.startOffsetX + (event.clientX - current.startX) * current.screenToLocalX,
        offsetY:
          current.startOffsetY + (event.clientY - current.startY) * current.screenToLocalY,
      }));
      return;
    }
    const nextRotation = clamp(
      current.startRotation + ((event.clientX - current.startX) / current.frameWidth) * 90,
      -90,
      90,
    );
    setView((prev) =>
      prev.rotation === nextRotation ? prev : { ...prev, rotation: nextRotation },
    );
  }, []);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const initialView: ViewTransform = {
    scale: config.rfView.scale,
    rotation: config.rfView.rotation,
    offsetX: config.rfView.offsetX,
    offsetY: config.rfView.offsetY,
  };
  const dirty =
    view.scale !== initialView.scale ||
    view.rotation !== initialView.rotation ||
    view.offsetX !== initialView.offsetX ||
    view.offsetY !== initialView.offsetY;
  const fmt = (value: number) => Number(value.toFixed(2));
  const debugText = [
    `VITE_CASE1_RF_VIEW_SCALE=${fmt(view.scale)}`,
    `VITE_CASE1_RF_VIEW_ROTATION_DEG=${fmt(view.rotation)}`,
    `VITE_CASE1_RF_VIEW_OFFSET_X=${fmt(view.offsetX)}`,
    `VITE_CASE1_RF_VIEW_OFFSET_Y=${fmt(view.offsetY)}`,
  ].join("\n");
  const note = error || anchorError || (matrix ? "" : "正在读取 RSS 数据…");

  return (
    <>
      <div
        ref={frame}
        className="c1-rf-frame is-live"
        role="application"
        aria-label="RSS 地图"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="c1-rf-xform"
          style={{
            transform: `translate(${view.offsetX}px, ${view.offsetY}px) rotate(${view.rotation}deg) scale(${view.scale})`,
            transformOrigin: "center center",
          }}
        >
          <img
            ref={image}
            className="c1-view-rf"
            src={asset("rf-map.png")}
            alt="RSS 地图底图"
            draggable={false}
          />
          <canvas className="c1-rf-overlay" ref={canvas} />
        </div>
        {dirty ? (
          <button
            type="button"
            className="c1-rf-reset"
            title="恢复到配置里的缩放、旋转与平移"
            aria-label="恢复到配置里的缩放、旋转与平移"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setView(initialView)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
              <path
                fill="currentColor"
                d="M10 3.5a6.5 6.5 0 1 1-6.1 4.2l1.4.4A5.1 5.1 0 1 0 10 4.9V7l3-3.2L10 0.5V3.5z"
              />
            </svg>
          </button>
        ) : null}
      </div>
      {config.rfViewDebug && (
        <aside className="c1-rf-debug">
          <textarea aria-label="RF 视图配置" readOnly value={debugText} />
          <button
            type="button"
            onClick={() => {
              if (!navigator.clipboard) return;
              void navigator.clipboard.writeText(debugText);
            }}
          >
            复制配置
          </button>
        </aside>
      )}
      {note ? <small className="c1-source-note">{note}</small> : null}
    </>
  );
}
