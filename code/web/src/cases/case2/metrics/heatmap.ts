/**
 * 热力图纯算法：双线性插值 → 伪彩 → 马赛克，再叠到底图 Canvas。
 * 不读 env；配置由调用方传入。
 */

import type { HeatmapConfig } from "./heatmapConfig";

export type Rgb = readonly [number, number, number];

/** 冻结色标断点（sRGB 通道线性插值）。 */
export const HEATMAP_COLOR_STOPS: ReadonlyArray<{ t: number; rgb: Rgb }> = [
  { t: 0, rgb: [37, 99, 235] },
  { t: 0.33, rgb: [34, 211, 238] },
  { t: 0.66, rgb: [250, 204, 21] },
  { t: 1, rgb: [239, 68, 68] },
];

export type MatrixStats = { eMin: number; eMax: number };

/** 防御校验：非空矩形、每行至少一个有限数。 */
export function assertHeatmapMatrix(matrix: number[][]): {
  rows: number;
  cols: number;
} {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    throw new Error("heatmap matrix must be non-empty");
  }
  const rows = matrix.length;
  const first = matrix[0];
  if (!first || first.length === 0) {
    throw new Error("heatmap matrix rows must be non-empty");
  }
  const cols = first.length;
  for (let r = 0; r < rows; r += 1) {
    const row = matrix[r];
    if (!row || row.length !== cols) {
      throw new Error("heatmap matrix must be rectangular");
    }
    for (let c = 0; c < cols; c += 1) {
      const v = row[c];
      if (typeof v !== "number" || !Number.isFinite(v)) {
        throw new Error("heatmap matrix values must be finite numbers");
      }
    }
  }
  return { rows, cols };
}

/** 本张矩阵独立 min/max，不与其它图共享。 */
export function matrixMinMax(matrix: number[][]): MatrixStats {
  let eMin = Infinity;
  let eMax = -Infinity;
  for (const row of matrix) {
    for (const v of row) {
      if (v < eMin) eMin = v;
      if (v > eMax) eMax = v;
    }
  }
  return { eMin, eMax };
}

/** 标量 → t∈[0,1]；常数矩阵固定 t=0.5。 */
export function normalizeScalar(value: number, eMin: number, eMax: number): number {
  if (eMax === eMin) return 0.5;
  const t = (value - eMin) / (eMax - eMin);
  return Math.min(1, Math.max(0, t));
}

/** 分段线性伪彩；t=1 直接取末端色。 */
export function colorAt(t: number): Rgb {
  if (t >= 1) return HEATMAP_COLOR_STOPS[HEATMAP_COLOR_STOPS.length - 1]!.rgb;
  for (let i = 0; i < HEATMAP_COLOR_STOPS.length - 1; i += 1) {
    const a = HEATMAP_COLOR_STOPS[i]!;
    const b = HEATMAP_COLOR_STOPS[i + 1]!;
    if (t >= a.t && t < b.t) {
      const u = (t - a.t) / (b.t - a.t);
      return [
        Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * u),
        Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * u),
        Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * u),
      ];
    }
  }
  return HEATMAP_COLOR_STOPS[0]!.rgb;
}

/**
 * 双线性采样矩阵到离屏像素 (x,y)。
 * 第一行在上、第一列在左；不转置、不翻转。
 */
export function sampleBilinear(
  matrix: number[][],
  x: number,
  y: number,
  rangeW: number,
  rangeH: number,
): number {
  const R = matrix.length;
  const C = matrix[0]!.length;
  const gx = C === 1 ? 0 : (x * (C - 1)) / (rangeW - 1);
  const gy = R === 1 ? 0 : (y * (R - 1)) / (rangeH - 1);
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = Math.min(x0 + 1, C - 1);
  const y1 = Math.min(y0 + 1, R - 1);
  const fx = gx - x0;
  const fy = gy - y0;
  const v00 = matrix[y0]![x0]!;
  const v10 = matrix[y0]![x1]!;
  const v01 = matrix[y1]![x0]!;
  const v11 = matrix[y1]![x1]!;
  return (
    v00 * (1 - fx) * (1 - fy) +
    v10 * fx * (1 - fy) +
    v01 * (1 - fx) * fy +
    v11 * fx * fy
  );
}

/** 离屏 RGBA 缓冲（便于在无 ImageData 的环境里单测）。 */
export type RgbaBuffer = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

/** 生成离屏 RGBA：色块 alpha=255，缝 alpha=0。 */
export function buildMosaicRgba(
  matrix: number[][],
  config: HeatmapConfig,
): RgbaBuffer {
  assertHeatmapMatrix(matrix);
  const { rangeWidth: W, rangeHeight: H, cell, period } = config;
  const { eMin, eMax } = matrixMinMax(matrix);
  const data = new Uint8ClampedArray(W * H * 4);

  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const idx = (y * W + x) * 4;
      const inCell = x % period < cell && y % period < cell;
      if (!inCell) {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
        continue;
      }
      const value = sampleBilinear(matrix, x, y, W, H);
      const t = normalizeScalar(value, eMin, eMax);
      const [r, g, b] = colorAt(t);
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  return { data, width: W, height: H };
}

/** 浏览器环境包装为 ImageData。 */
export function buildMosaicImageData(
  matrix: number[][],
  config: HeatmapConfig,
): ImageData {
  const buf = buildMosaicRgba(matrix, config);
  // 拷贝到独立 ArrayBuffer，满足 DOM ImageData 构造签名
  const copy = new Uint8ClampedArray(buf.data);
  return new ImageData(copy, buf.width, buf.height);
}

/**
 * 在主 Canvas 上：先画底图，再以 ALPHA 把离屏马赛克贴到 (x0,y0)。
 * 主 Canvas 内部分辨率必须已等于底图 natural 尺寸。
 */
export function paintHeatmapOnCanvas(
  ctx: CanvasRenderingContext2D,
  baseImage: CanvasImageSource,
  matrix: number[][],
  config: HeatmapConfig,
): void {
  const canvas = ctx.canvas;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

  const mosaic = buildMosaicImageData(matrix, config);
  const offscreen = document.createElement("canvas");
  offscreen.width = config.rangeWidth;
  offscreen.height = config.rangeHeight;
  const offCtx = offscreen.getContext("2d");
  if (!offCtx) {
    ctx.restore();
    throw new Error("failed to create offscreen 2d context");
  }
  offCtx.putImageData(mosaic, 0, 0);

  ctx.globalAlpha = config.alpha;
  ctx.drawImage(offscreen, config.x0, config.y0);
  ctx.restore();
}

/**
 * 只画热力马赛克层（其余透明），叠在 CSS cover 底图之上。
 * 与底图共用同一套 cover 构图，避免整图 contain 把锚区缩没。
 */
export function paintHeatOverlayOnCanvas(
  ctx: CanvasRenderingContext2D,
  matrix: number[][],
  config: HeatmapConfig,
): void {
  const canvas = ctx.canvas;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const mosaic = buildMosaicImageData(matrix, config);
  const offscreen = document.createElement("canvas");
  offscreen.width = config.rangeWidth;
  offscreen.height = config.rangeHeight;
  const offCtx = offscreen.getContext("2d");
  if (!offCtx) {
    ctx.restore();
    throw new Error("failed to create offscreen 2d context");
  }
  offCtx.putImageData(mosaic, 0, 0);

  ctx.globalAlpha = config.alpha;
  ctx.drawImage(offscreen, config.x0, config.y0);
  ctx.restore();
}
