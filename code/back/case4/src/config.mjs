/**
 * Case4 stub 正式环境变量解析。
 * 正式配置不允许缩短 3000ms success 窗口；测试走构造函数依赖注入。
 */

import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { DEFAULTS } from "./constants.mjs";
import { StubError } from "./errors.mjs";

function invalid(message) {
  throw new StubError("CONFIG_INVALID", message);
}

function decimalInteger(env, name, fallback, minimum) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) invalid(`${name} 必须是十进制整数`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) {
    invalid(`${name} 必须不小于 ${minimum}`);
  }
  return value;
}

function enumValue(env, name, fallback, values) {
  const value = env[name] ?? fallback;
  if (!values.includes(value)) {
    invalid(`${name} 必须是 ${values.join(" / ")}`);
  }
  return value;
}

function booleanFlag(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  if (raw !== "0" && raw !== "1") invalid(`${name} 只能是 0 或 1`);
  return raw === "1";
}

export async function loadRuntimeConfig(env = process.env, options = {}) {
  const fsOps = options.fsOps ?? defaultFs;
  const sharedDir = env.DT_SHARED_DIR;
  const sharedName = "DT_SHARED_DIR";
  if (!sharedDir) invalid("缺少必填环境变量 DT_SHARED_DIR");
  if (!path.isAbsolute(sharedDir)) invalid(`${sharedName} 必须是绝对路径`);

  const resolvedSharedDir = path.resolve(sharedDir);
  let sharedStat;
  try {
    sharedStat = await fsOps.stat(resolvedSharedDir);
  } catch (error) {
    throw new StubError(
      "CONFIG_INVALID",
      `${sharedName} 不可访问：${resolvedSharedDir}`,
      { cause: error },
    );
  }
  if (!sharedStat.isDirectory()) invalid(`${sharedName} 必须是目录`);

  return {
    sharedDir: resolvedSharedDir,
    pollMs: decimalInteger(env, "CASE4_STUB_POLL_MS", DEFAULTS.pollMs, 1),
    successDwellMs: decimalInteger(
      env,
      "CASE4_STUB_SUCCESS_DWELL_MS",
      DEFAULTS.successDwellMs,
      3000,
    ),
    stepMs: decimalInteger(env, "CASE4_STUB_STEP_MS", DEFAULTS.stepMs, 1),
    outcome: enumValue(env, "CASE4_STUB_OUTCOME", DEFAULTS.outcome, [
      "success",
      "fail",
    ]),
    requestPicture: booleanFlag(
      env,
      "CASE4_STUB_REQUEST_PICTURE",
      DEFAULTS.requestPicture,
    ),
    seedInit: booleanFlag(env, "CASE4_STUB_SEED_INIT", DEFAULTS.seedInit),
    dataMode: enumValue(env, "CASE4_STUB_DATA_MODE", DEFAULTS.dataMode, [
      "random",
      "replay",
    ]),
    seed: env.CASE4_STUB_SEED ?? DEFAULTS.seed,
    logLevel: enumValue(env, "CASE4_STUB_LOG_LEVEL", DEFAULTS.logLevel, [
      "info",
      "debug",
    ]),
  };
}
