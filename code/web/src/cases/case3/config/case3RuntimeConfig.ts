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
};

const DEFAULTS: Case3RuntimeConfig = {
  pollMs: 500,
  mapOriginX: 905,
  mapOriginY: 445,
  mapUnitsPerPx: 0.11,
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
  };
}

export const CASE3_ADAPTER_RECOVERY_PROBE_MS = 5000;
export const CASE3_POINT_WINDOW = 20;
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
