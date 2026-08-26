/**
 * Case3 构建时 Vite env 的唯一入口。
 * 组件不得直接读 import.meta.env；显式非法配置必须启动失败。
 * API 前缀不进 env，写死在 case3Api.ts。
 */

export type Case3RuntimeConfig = {
  pollMs: number;
  mapOriginX: number;
  mapOriginY: number;
  mapUnitsPerPx: number;
  v2MapOriginX: number;
  v2MapOriginY: number;
  v2MapUnitsPerPx: number;
  v2MapImageScale: number;
  v2MapImageRotationDeg: number;
  v2MapImageOffsetX: number;
  v2MapImageOffsetY: number;
  v2DebugShow: boolean;
};

const DEFAULTS: Case3RuntimeConfig = {
  pollMs: 500,
  mapOriginX: 905,
  mapOriginY: 445,
  mapUnitsPerPx: 0.11,
  v2MapOriginX: 905,
  v2MapOriginY: 445,
  v2MapUnitsPerPx: 0.11,
  v2MapImageScale: 1,
  v2MapImageRotationDeg: 0,
  v2MapImageOffsetX: 0,
  v2MapImageOffsetY: 0,
  v2DebugShow: true,
};

export class Case3ConfigError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "Case3ConfigError";
    this.field = field;
  }
}

type EnvLike = Record<string, string | undefined>;

/** 缺失用默认；已提供则必须是十进制正安全整数。 */
function readPositiveSafeInt(
  env: EnvLike,
  key: string,
  fallback: number,
): number {
  const raw = env[key];
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Case3ConfigError(key, `${key} must be digits, got ${JSON.stringify(raw)}`);
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Case3ConfigError(key, `${key} must be a positive safe integer`);
  }
  return value;
}

/** 缺失用默认；已提供则必须是有限数。 */
function readFiniteNumber(
  env: EnvLike,
  key: string,
  fallback: number,
): number {
  const raw = env[key];
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (trimmed === "") {
    throw new Case3ConfigError(key, `${key} must not be empty`);
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    throw new Case3ConfigError(key, `${key} must be finite, got ${JSON.stringify(raw)}`);
  }
  return value;
}

/** 缺失用默认；已提供则必须是有限正数。 */
function readPositiveFinite(
  env: EnvLike,
  key: string,
  fallback: number,
): number {
  const value = readFiniteNumber(env, key, fallback);
  if (!(value > 0)) {
    throw new Case3ConfigError(key, `${key} must be finite and > 0`);
  }
  return value;
}

/** 缺失用默认；已提供则必须为 0/1。 */
function readBooleanFlag(
  env: EnvLike,
  key: string,
  fallback: boolean,
): boolean {
  const raw = env[key];
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (trimmed === "1") return true;
  if (trimmed === "0") return false;
  throw new Case3ConfigError(key, `${key} must be 0 or 1`);
}

/**
 * 解析 Case3 Vite env。
 * @param env 通常传入 import.meta.env
 */
export function loadCase3RuntimeConfig(
  env: EnvLike = import.meta.env,
): Case3RuntimeConfig {
  return {
    pollMs: readPositiveSafeInt(env, "VITE_CASE3_POLL_MS", DEFAULTS.pollMs),
    mapOriginX: readFiniteNumber(
      env,
      "VITE_CASE3_MAP_ORIGIN_X",
      DEFAULTS.mapOriginX,
    ),
    mapOriginY: readFiniteNumber(
      env,
      "VITE_CASE3_MAP_ORIGIN_Y",
      DEFAULTS.mapOriginY,
    ),
    mapUnitsPerPx: readPositiveFinite(
      env,
      "VITE_CASE3_MAP_UNITS_PER_PX",
      DEFAULTS.mapUnitsPerPx,
    ),
    v2MapOriginX: readFiniteNumber(
      env,
      "VITE_CASE3_V2_MAP_ORIGIN_X",
      DEFAULTS.v2MapOriginX,
    ),
    v2MapOriginY: readFiniteNumber(
      env,
      "VITE_CASE3_V2_MAP_ORIGIN_Y",
      DEFAULTS.v2MapOriginY,
    ),
    v2MapUnitsPerPx: readPositiveFinite(
      env,
      "VITE_CASE3_V2_MAP_UNITS_PER_PX",
      DEFAULTS.v2MapUnitsPerPx,
    ),
    v2MapImageScale: readPositiveFinite(
      env,
      "VITE_CASE3_V2_MAP_IMAGE_SCALE",
      DEFAULTS.v2MapImageScale,
    ),
    v2MapImageRotationDeg: readFiniteNumber(
      env,
      "VITE_CASE3_V2_MAP_IMAGE_ROTATION_DEG",
      DEFAULTS.v2MapImageRotationDeg,
    ),
    v2MapImageOffsetX: readFiniteNumber(
      env,
      "VITE_CASE3_V2_MAP_IMAGE_OFFSET_X",
      DEFAULTS.v2MapImageOffsetX,
    ),
    v2MapImageOffsetY: readFiniteNumber(
      env,
      "VITE_CASE3_V2_MAP_IMAGE_OFFSET_Y",
      DEFAULTS.v2MapImageOffsetY,
    ),
    v2DebugShow: readBooleanFlag(
      env,
      "VITE_CASE3_V2_DEBUG_SHOW",
      DEFAULTS.v2DebugShow,
    ),
  };
}

export const CASE3_ADAPTER_RECOVERY_PROBE_MS = 5000;
export const CASE3_POINT_WINDOW = 20;
/** 槽宽 24 + gap 5，拖动换窗步长。 */
export const CASE3_POINT_SLOT_PITCH = 29;
export const CASE3_MAP_SCALE_MIN = 0.5;
export const CASE3_MAP_SCALE_MAX = 5;
export const CASE3_MAP_ROTATION_MAX_DEG = 90;
export const CASE3_MAP_ZOOM_STEP = 1.1;
export const CASE3_MAP_CAPTURE_READY_TIMEOUT_MS = 10_000;
export const CASE3_SCREENSHOT_MAX_ATTEMPTS = 3;
/** case complete 后最终快照连续不过关次数；耗尽则进「结果不完整已自动回退」并 POST init 撤权。 */
export const CASE3_FINAL_NOT_READY_MAX_ATTEMPTS = 10;
export const CASE3_STAGE_WIDTH = 1920;
export const CASE3_STAGE_HEIGHT = 1080;
export const CASE3_SCREENSHOT_PIXEL_RATIO = 2;
