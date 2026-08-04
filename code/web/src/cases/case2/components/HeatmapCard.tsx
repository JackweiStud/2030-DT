/**
 * 单张热力卡。
 * 有矩阵：Canvas 一次画「底图 + 热力」（object-fit:cover）。
 * 无矩阵：只显示 CSS cover 底图空槽。
 */

import { useEffect, useRef } from "react";
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

export function HeatmapCard(props: Props) {
  const { matrix, config, empty, metricClass, label, variant } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const showHeat = !empty && matrix !== null && matrix.length > 0;

  useEffect(() => {
    if (!showHeat || !matrix) return;
    let cancelled = false;

    void (async () => {
      try {
        const img = await loadBaseImage();
        if (cancelled) return;

        // 等 Canvas 真正挂到 DOM（StrictMode / 条件渲染后）
        let canvas = canvasRef.current;
        if (!canvas) {
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
          canvas = canvasRef.current;
        }
        if (!canvas || cancelled) return;

        assertHeatmapAnchor(config, img.naturalWidth, img.naturalHeight);
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        console.info("[case2] heatmap base image size", {
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          variant,
          metric: metricClass,
          label,
        });

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          console.error("[case2] heatmap: 2d context unavailable");
          return;
        }
        paintHeatmapOnCanvas(ctx, img, matrix, config);
      } catch (err) {
        console.error("[case2] heatmap paint failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [matrix, config, showHeat, variant, metricClass, label]);

  return (
    <article className={`heatmap-card is-${variant}`}>
      <div className="heatmap-card__media">
        {/* 有热力时由 Canvas 自带底图；空槽才用 CSS 底图 */}
        {!showHeat ? <div className="heatmap-base" aria-hidden /> : null}
        {showHeat ? (
          <canvas ref={canvasRef} className="heatmap-canvas" />
        ) : null}
      </div>
      <div className={`metric-tag metric-tag--${metricClass}`}>
        <span className="metric-tag__label">{label}</span>
      </div>
    </article>
  );
}
