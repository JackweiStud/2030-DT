/**
 * 单张热力卡：底图 + 运行时 Canvas 色场（内部分辨率=底图像素）。
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

export function HeatmapCard(props: Props) {
  const { matrix, config, empty, metricClass, label, variant } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (empty || !matrix) return;
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.decoding = "async";
    img.src = mapBaseUrl;
    imageRef.current = img;

    void img.decode().then(() => {
      if (cancelled) return;
      assertHeatmapAnchor(config, img.naturalWidth, img.naturalHeight);
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      paintHeatmapOnCanvas(ctx, img, matrix, config);
    }).catch((err) => {
      console.error("[case2] heatmap paint failed", err);
    });

    return () => {
      cancelled = true;
    };
  }, [matrix, config, empty]);

  return (
    <article className={`heatmap-card is-${variant}`}>
      <div className="heatmap-card__media">
        {empty || !matrix ? (
          <div className="heat-empty-slot" aria-hidden />
        ) : (
          <canvas ref={canvasRef} className="heatmap-canvas" />
        )}
      </div>
      <div className={`metric-tag metric-tag--${metricClass}`}>
        <span className="metric-tag__label">{label}</span>
      </div>
    </article>
  );
}
