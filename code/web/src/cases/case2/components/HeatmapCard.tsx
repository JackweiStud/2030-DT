/**
 * 单张热力卡。
 * 有矩阵：Canvas 一次画「底图 + 热力」（object-fit:cover）。
 * 无矩阵：只显示 CSS cover 底图空槽。
 * 右上角可展开「该窗图像全屏」：黑底居中（底图+热力+标签）；Esc / 叉关闭。
 */

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { HeatmapConfig } from "../metrics/heatmapConfig";
import { assertHeatmapAnchor } from "../metrics/heatmapConfig";
import { paintHeatmapOnCanvas } from "../metrics/heatmap";
import mapBaseUrl from "../../../../assets/case2/maps/heatmap-map-base.png";

type Props = {
  matrix: number[][] | null;
  config: HeatmapConfig;
  empty: boolean;
  metricClass: "rss" | "path" | "delay";
  label: string;
  variant: "initial" | "calibrated";
};

function loadBaseImage(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("heatmap base image failed to load"));
    img.src = mapBaseUrl;
  });
}

async function paintHeatOnCanvas(
  canvas: HTMLCanvasElement,
  matrix: number[][],
  config: HeatmapConfig,
  logCtx?: {
    variant: string;
    metricClass: string;
    label: string;
  },
): Promise<void> {
  const img = await loadBaseImage();
  assertHeatmapAnchor(config, img.naturalWidth, img.naturalHeight);
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  if (logCtx) {
    console.info("[case2] heatmap base image size", {
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      ...logCtx,
    });
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("[case2] heatmap: 2d context unavailable");
    return;
  }
  paintHeatmapOnCanvas(ctx, img, matrix, config);
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

export function HeatmapCard(props: Props) {
  const { matrix, config, empty, metricClass, label, variant } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const expandCanvasRef = useRef<HTMLCanvasElement>(null);
  const [expanded, setExpanded] = useState(false);
  const titleId = useId();
  const showHeat = !empty && matrix !== null && matrix.length > 0;

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
        await paintHeatOnCanvas(canvas, matrix, config, {
          variant,
          metricClass,
          label,
        });
      } catch (err) {
        console.error("[case2] heatmap paint failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [matrix, config, showHeat, variant, metricClass, label]);

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

  return (
    <article className={`heatmap-card is-${variant}`}>
      <div className="heatmap-card__media">
        {!showHeat ? <div className="heatmap-base" aria-hidden /> : null}
        {showHeat ? <canvas ref={canvasRef} className="heatmap-canvas" /> : null}
      </div>
      <div className={`metric-tag metric-tag--${metricClass}`}>
        <span className="metric-tag__label">{label}</span>
      </div>
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
              <button
                type="button"
                className="case2-heatmap-lightbox__close"
                title="关闭全屏"
                aria-label="关闭全屏"
                onClick={() => setExpanded(false)}
              >
                <CloseIcon />
              </button>
              <div className="case2-heatmap-lightbox__frame">
                <span id={titleId} className="visually-hidden">
                  {label} {variant}
                </span>
                <div className="case2-heatmap-lightbox__media">
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
              </div>
            </div>,
            document.body,
          )
        : null}
    </article>
  );
}
