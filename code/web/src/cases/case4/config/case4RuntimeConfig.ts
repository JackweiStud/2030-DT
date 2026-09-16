/**
 * Case4 构建时 Vite env 的唯一入口。
 * 组件不得直接读 import.meta.env；显式非法配置必须启动失败。
 * API 前缀不进 env，写死在 case4Api.ts。
 */

export type Case4RuntimeConfig = {
  pollMs: number;
  mapOriginX: number;
  mapOriginY: number;
  mapUnitsPerPx: number;
  mapImageScale: number;
  mapImageRotationDeg: number;
  mapImageOffsetX: number;
  mapImageOffsetY: number;
  mapDebugShow: boolean;
};

const DEFAULTS: Case4RuntimeConfig = {
  pollMs: 500,
  mapOriginX: 916,
  mapOriginY: 608,
  mapUnitsPerPx: 0.11,
  mapImageScale: 2,
  mapImageRotationDeg: 0,
  mapImageOffsetX: 205,
  mapImageOffsetY: -670,
  mapDebugShow: true,
};

export class Case4ConfigError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "Case4ConfigError";
    this.field = field;
  }
}

type EnvLike = Record<string, string | undefined>;

function readPositiveSafeInt(
  env: EnvLike,
  key: string,
  fallback: number,
): number {
  const raw = env[key];
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Case4ConfigError(key, `${key} must be digits, got ${JSON.stringify(raw)}`);
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Case4ConfigError(key, `${key} must be a positive safe integer`);
  }
  return value;
}

function readFiniteNumber(
  env: EnvLike,
  key: string,
  fallback: number,
): number {
  const raw = env[key];
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (trimmed === "") {
    throw new Case4ConfigError(key, `${key} must not be empty`);
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    throw new Case4ConfigError(key, `${key} must be finite, got ${JSON.stringify(raw)}`);
  }
  return value;
}

function readPositiveFinite(
  env: EnvLike,
  key: string,
  fallback: number,
): number {
  const value = readFiniteNumber(env, key, fallback);
  if (!(value > 0)) {
    throw new Case4ConfigError(key, `${key} must be finite and > 0`);
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
  throw new Case4ConfigError(key, `${key} must be 0 or 1`);
}

/**
 * 解析 Case4 Vite env。键已提供但非法 → 抛键名，禁止静默 fallback。
 */
export function loadCase4RuntimeConfig(
  env: EnvLike = import.meta.env,
): Case4RuntimeConfig {
  return {
    pollMs: readPositiveSafeInt(env, "VITE_CASE4_POLL_MS", DEFAULTS.pollMs),
    mapOriginX: readFiniteNumber(
      env,
      "VITE_CASE4_MAP_ORIGIN_X",
      DEFAULTS.mapOriginX,
    ),
    mapOriginY: readFiniteNumber(
      env,
      "VITE_CASE4_MAP_ORIGIN_Y",
      DEFAULTS.mapOriginY,
    ),
    mapUnitsPerPx: readPositiveFinite(
      env,
      "VITE_CASE4_MAP_UNITS_PER_PX",
      DEFAULTS.mapUnitsPerPx,
    ),
    mapImageScale: readPositiveFinite(
      env,
      "VITE_CASE4_MAP_IMAGE_SCALE",
      DEFAULTS.mapImageScale,
    ),
    mapImageRotationDeg: readFiniteNumber(
      env,
      "VITE_CASE4_MAP_IMAGE_ROTATION_DEG",
      DEFAULTS.mapImageRotationDeg,
    ),
    mapImageOffsetX: readFiniteNumber(
      env,
      "VITE_CASE4_MAP_IMAGE_OFFSET_X",
      DEFAULTS.mapImageOffsetX,
    ),
    mapImageOffsetY: readFiniteNumber(
      env,
      "VITE_CASE4_MAP_IMAGE_OFFSET_Y",
      DEFAULTS.mapImageOffsetY,
    ),
    mapDebugShow: readBooleanFlag(
      env,
      "VITE_CASE4_MAP_DEBUG_SHOW",
      DEFAULTS.mapDebugShow,
    ),
  };
}

export const CASE4_REQUEST_TIMEOUT_MS = 5000;
export const CASE4_SCREENSHOT_TIMEOUT_MS = 20_000;
export const CASE4_ADAPTER_RECOVERY_PROBE_MS = 5000;
export const CASE4_POINT_WINDOW = 20;
export const CASE4_MAP_SCALE_MIN = 0.5;
export const CASE4_MAP_SCALE_MAX = 5;
export const CASE4_MAP_ROTATION_MAX_DEG = 90;
export const CASE4_MAP_ZOOM_STEP = 1.1;
export const CASE4_MAP_CAPTURE_READY_TIMEOUT_MS = 10_000;
export const CASE4_SCREENSHOT_MAX_ATTEMPTS = 3;
export const CASE4_FINAL_NOT_READY_MAX_ATTEMPTS = 10;
export const CASE4_POLL_FAIL_RETRY_THRESHOLD = 3;
export const CASE4_STAGE_WIDTH = 1920;
export const CASE4_STAGE_HEIGHT = 1080;
export const CASE4_SCREENSHOT_PIXEL_RATIO = 2;
export const CASE4_MAP_STAGE = { width: 1920, height: 766, top: 60 } as const;
export const CASE4_UE_SIZE = { width: 36, height: 48 } as const;
/** Pencil c0EO9c（实例 nkOCa）：路线点位外框 35×42。 */
export const CASE4_PIN_SIZE = { width: 35, height: 42 } as const;
/** Pencil Is2Ak「编号槽」：35×31。 */
export const CASE4_PIN_NO_SLOT_SIZE = { width: 35, height: 31 } as const;
/** Pencil W0NB1「点位编号」。 */
export const CASE4_PIN_LABEL_STYLE = { fontSize: 12, fontWeight: 700 } as const;
/**
 * 图钉白点锚点（相对 35×42 外框左上，单位 px）。
 * `object-fit: contain`（Pencil E7BWF mode:fit）下由 70×83 白点质心映射。
 */
export const CASE4_PIN_ANCHOR = {
  x: 17.26595744680851,
  y: 37.462765957446805,
} as const;
export const CASE4_THRP_Y_MAX_EMPTY = 10;
export const CASE4_ERROR_EPS = 1e-9;
