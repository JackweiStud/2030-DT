/**
 * case2 构建时 env 的唯一入口。
 * 所有 `import.meta.env.VITE_*` 只允许在本文件读取；组件与算法只消费已校验配置。
 */

export type HeatmapInvalidRgba = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type HeatmapConfig = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  rangeWidth: number;
  rangeHeight: number;
  cell: number;
  gap: number;
  period: number;
  alpha: number;
  cdfPointCap: number;
  /** 无效格（round2===-1 / 采样 W===0）离屏 RGBA，通道 0～255。 */
  invalidRgba: HeatmapInvalidRgba;
};

export type Case2RuntimeConfig = HeatmapConfig & {
  pollMs: number;
};

const DEFAULTS = {
  pollMs: 1000,
  x0: 750,
  y0: 400,
  x1: 1200,
  y1: 700,
  cell: 3,
  gap: 1,
  alpha: 0.38,
  cdfPointCap: 256,
  invalidR: 255,
  invalidG: 255,
  invalidB: 255,
  invalidA: 0,
} as const;

export class HeatmapConfigError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "HeatmapConfigError";
    this.field = field;
  }
}

type EnvLike = Record<string, string | undefined>;

/** 缺失用默认；已提供则必须严格合法，禁止钳制或静默回退。 */
function readOptionalDigits(
  env: EnvLike,
  key: string,
  fallback: number,
): number {
  const raw = env[key];
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new HeatmapConfigError(key, `${key} must be digits, got ${JSON.stringify(raw)}`);
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value)) {
    throw new HeatmapConfigError(key, `${key} must be a safe integer`);
  }
  return value;
}

function readAlpha(env: EnvLike, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (trimmed === "") {
    throw new HeatmapConfigError(key, `${key} must not be empty`);
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || !(value > 0 && value <= 1)) {
    throw new HeatmapConfigError(key, `${key} must be finite and in (0,1]`);
  }
  return value;
}

/** RGBA 通道：缺失用默认；已提供须为 0～255 整数。 */
function readChannel255(
  env: EnvLike,
  key: string,
  fallback: number,
): number {
  const raw = env[key];
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new HeatmapConfigError(key, `${key} must be digits 0-255`);
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < 0 || value > 255) {
    throw new HeatmapConfigError(key, `${key} must be integer in 0..255`);
  }
  return value;
}

/**
 * 解析构建时 env，产出热力锚区与轮询配置。
 * API 前缀写死为同源 `/api/case2`，不进 env。
 * @param env 通常传入 `import.meta.env`
 */
export function loadCase2RuntimeConfig(env: EnvLike = import.meta.env): Case2RuntimeConfig {
  const x0 = readOptionalDigits(env, "VITE_CASE2_HEATMAP_X0", DEFAULTS.x0);
  const y0 = readOptionalDigits(env, "VITE_CASE2_HEATMAP_Y0", DEFAULTS.y0);
  const x1 = readOptionalDigits(env, "VITE_CASE2_HEATMAP_X1", DEFAULTS.x1);
  const y1 = readOptionalDigits(env, "VITE_CASE2_HEATMAP_Y1", DEFAULTS.y1);
  const cell = readOptionalDigits(env, "VITE_CASE2_HEATMAP_CELL", DEFAULTS.cell);
  const gap = readOptionalDigits(env, "VITE_CASE2_HEATMAP_GAP", DEFAULTS.gap);
  const cdfPointCap = readOptionalDigits(
    env,
    "VITE_CASE2_CDF_POINT_CAP",
    DEFAULTS.cdfPointCap,
  );
  const pollMs = readOptionalDigits(env, "VITE_CASE2_POLL_MS", DEFAULTS.pollMs);
  const alpha = readAlpha(env, "VITE_CASE2_HEATMAP_ALPHA", DEFAULTS.alpha);
  const invalidRgba: HeatmapInvalidRgba = {
    r: readChannel255(env, "VITE_CASE2_HEATMAP_INVALID_R", DEFAULTS.invalidR),
    g: readChannel255(env, "VITE_CASE2_HEATMAP_INVALID_G", DEFAULTS.invalidG),
    b: readChannel255(env, "VITE_CASE2_HEATMAP_INVALID_B", DEFAULTS.invalidB),
    a: readChannel255(env, "VITE_CASE2_HEATMAP_INVALID_A", DEFAULTS.invalidA),
  };

  if (x0 < 0 || y0 < 0 || gap < 0) {
    throw new HeatmapConfigError("anchor", "X0/Y0/GAP must be >= 0");
  }
  if (cell < 1) {
    throw new HeatmapConfigError("VITE_CASE2_HEATMAP_CELL", "CELL must be >= 1");
  }
  if (cdfPointCap < 2) {
    throw new HeatmapConfigError("VITE_CASE2_CDF_POINT_CAP", "CAP must be >= 2");
  }
  if (pollMs < 1) {
    throw new HeatmapConfigError("VITE_CASE2_POLL_MS", "POLL_MS must be >= 1");
  }
  if (x1 - x0 < 2 || y1 - y0 < 2) {
    throw new HeatmapConfigError("anchor", "anchor range must be at least 2px on each axis");
  }

  return {
    pollMs,
    x0,
    y0,
    x1,
    y1,
    rangeWidth: x1 - x0,
    rangeHeight: y1 - y0,
    cell,
    gap,
    period: cell + gap,
    alpha,
    cdfPointCap,
    invalidRgba,
  };
}

/** 底图 decode 后校验锚区是否落在真实像素内。 */
export function assertHeatmapAnchor(
  config: HeatmapConfig,
  naturalWidth: number,
  naturalHeight: number,
): void {
  const { x0, y0, x1, y1 } = config;
  if (
    !(
      0 <= x0 &&
      x0 < x1 &&
      x1 <= naturalWidth &&
      0 <= y0 &&
      y0 < y1 &&
      y1 <= naturalHeight
    )
  ) {
    throw new HeatmapConfigError(
      "anchor",
      `anchor (${x0},${y0})-(${x1},${y1}) out of image ${naturalWidth}x${naturalHeight}`,
    );
  }
}

/** case complete 后 Calibrated 六文件连续不过关次数；耗尽则「结果不完整已自动回退」并 POST init。 */
export const CASE2_CALIBRATED_NOT_READY_MAX_ATTEMPTS = 10;
