import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

export const CALIBRATED_FILES = Object.freeze([
  "heatmap_cali_rss.txt",
  "heatmap_cali_effective_path_num.txt",
  "heatmap_cali_first_path_delay.txt",
  "heatmap_cali_kpi_rss.txt",
  "heatmap_cali_kpi_effective_path_num.txt",
  "heatmap_cali_kpi_first_path_delay.txt",
]);

const CONTROL_FILE = "case_control.json";
const ALLOWED_STATUS_PATCHES = new Set([
  "execute success",
  "execute fail",
  "case complete",
  "reinit complete",
]);
const IDLE_STATUSES = new Set(["execute fail", "case complete", "reinit complete"]);
const REQUIRED_FIELDS = ["case", "command", "dt_type", "status", "save_picture_flag"];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SOURCE_DIR = path.resolve(__dirname, "back");

export class StubError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "StubError";
    this.code = code;
    this.details = details;
  }
}

class SerialQueue {
  #tail = Promise.resolve();

  run(task) {
    const result = this.#tail.then(task, task);
    this.#tail = result.catch(() => undefined);
    return result;
  }
}

function createLogger(level = "info") {
  const debugEnabled = level === "debug";
  const write = (kind, message, meta = {}) => {
    const payload = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    console.log(`[case2-stub] ${kind} ${message}${payload}`);
  };
  return {
    debug: (message, meta) => {
      if (debugEnabled) write("debug", message, meta);
    },
    info: (message, meta) => write("info", message, meta),
    warn: (message, meta) => write("warn", message, meta),
    error: (message, meta) => write("error", message, meta),
  };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertControlShape(control) {
  if (!isObject(control)) {
    throw new StubError("CONTROL_INVALID", "case_control.json root must be an object");
  }
  for (const field of REQUIRED_FIELDS) {
    if (!Object.hasOwn(control, field)) {
      throw new StubError("CONTROL_INVALID", `case_control.json missing ${field}`);
    }
  }
  for (const field of ["case", "command", "dt_type", "status"]) {
    if (typeof control[field] !== "string") {
      throw new StubError("CONTROL_INVALID", `${field} must be a string`);
    }
  }
  if (control.save_picture_flag !== 0 && control.save_picture_flag !== 1) {
    throw new StubError("CONTROL_INVALID", "save_picture_flag must be 0 or 1");
  }
  if (Object.hasOwn(control, "debug_flag") && !Number.isInteger(control.debug_flag)) {
    throw new StubError("CONTROL_INVALID", "debug_flag must be an integer");
  }
  if (Object.hasOwn(control, "scene_type") && typeof control.scene_type !== "string") {
    throw new StubError("CONTROL_INVALID", "scene_type must be a string");
  }
  return control;
}

export async function readControl(controlPath, fsOps = fs) {
  const text = await fsOps.readFile(controlPath, "utf8");
  return assertControlShape(JSON.parse(text));
}

async function atomicReplaceFile(targetPath, content, fsOps = fs) {
  const directory = path.dirname(targetPath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );

  let mode = 0o600;
  try {
    mode = (await fsOps.stat(targetPath)).mode & 0o777;
  } catch {
    // 控制文件通常已存在；若测试场景创建新文件，则使用保守权限。
  }

  let handle;
  try {
    handle = await fsOps.open(temporaryPath, "wx", mode);
    await handle.writeFile(content);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fsOps.rename(temporaryPath, targetPath);
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    await fsOps.unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
  return temporaryPath;
}

function assertStubPatch(patch) {
  if (!isObject(patch)) {
    throw new StubError("PATCH_INVALID", "stub patch must be an object");
  }
  const keys = Object.keys(patch);
  if (keys.length === 0) {
    throw new StubError("PATCH_INVALID", "stub patch must not be empty");
  }
  for (const key of keys) {
    if (key !== "status" && key !== "save_picture_flag") {
      throw new StubError("PATCH_INVALID", `stub cannot write ${key}`);
    }
  }
  if (Object.hasOwn(patch, "status") && !ALLOWED_STATUS_PATCHES.has(patch.status)) {
    throw new StubError("PATCH_INVALID", "stub status patch is not owned");
  }
  if (
    Object.hasOwn(patch, "save_picture_flag") &&
    patch.save_picture_flag !== 1
  ) {
    throw new StubError("PATCH_INVALID", "stub can only set save_picture_flag=1");
  }
}

function verifyPatch(current, written, patch, options) {
  for (const [field, expected] of Object.entries(patch)) {
    if (written[field] !== expected) {
      throw new StubError("CONTROL_WRITE_VERIFY_FAILED", `${field} patch was not persisted`);
    }
  }
  if (options.expectedCommand && written.command !== options.expectedCommand) {
    throw new StubError("CONTROL_WRITE_VERIFY_FAILED", "current command was lost", {
      expectedCommand: options.expectedCommand,
      actualCommand: written.command,
    });
  }
  for (const [field, value] of Object.entries(current)) {
    if (!Object.hasOwn(patch, field) && written[field] !== value) {
      throw new StubError("CONTROL_WRITE_VERIFY_FAILED", `${field} was not preserved`);
    }
  }
}

/**
 * 打桩唯一控制写入口。
 * 这里只允许写后端拥有的 status 字面值和 save_picture_flag=1；
 * 每次都读最新快照后合并，避免把未知字段、debug_flag、scene_type 覆盖丢。
 */
export function createControlStore(options) {
  const sharedDir = path.resolve(options.sharedDir);
  const controlPath = path.join(sharedDir, CONTROL_FILE);
  const fsOps = options.fsOps ?? fs;
  const queue = options.queue ?? new SerialQueue();
  const logger = options.logger ?? createLogger("info");

  async function read() {
    return readControl(controlPath, fsOps);
  }

  async function patchControl(patch, patchOptions = {}) {
    assertStubPatch(patch);
    return queue.run(async () => {
      const current = await read();
      const merged = { ...current, ...patch };
      const serialized = `${JSON.stringify(merged, null, 2)}\n`;
      await atomicReplaceFile(controlPath, serialized, fsOps);
      const written = await read();
      verifyPatch(current, written, patch, patchOptions);
      logger.info("control patched", {
        fields: Object.keys(patch),
        command: written.command,
        status: written.status,
        save_picture_flag: written.save_picture_flag,
      });
      return written;
    });
  }

  return { controlPath, read, patchControl };
}

/**
 * 方案 B：相对 Initial 的可控改善随机生成。
 * 仅用于本地演示差异；不得表述为真实业务采集结果。
 */
export const METRIC_SPECS = Object.freeze([
  {
    key: "rss",
    initHeatmap: "heatmap_init_rss.txt",
    initKpi: "heatmap_init_kpi_rss.txt",
    caliHeatmap: "heatmap_cali_rss.txt",
    caliKpi: "heatmap_cali_kpi_rss.txt",
  },
  {
    key: "effective_path_num",
    initHeatmap: "heatmap_init_effective_path_num.txt",
    initKpi: "heatmap_init_kpi_effective_path_num.txt",
    caliHeatmap: "heatmap_cali_effective_path_num.txt",
    caliKpi: "heatmap_cali_kpi_effective_path_num.txt",
  },
  {
    key: "first_path_delay",
    initHeatmap: "heatmap_init_first_path_delay.txt",
    initKpi: "heatmap_init_kpi_first_path_delay.txt",
    caliHeatmap: "heatmap_cali_first_path_delay.txt",
    caliKpi: "heatmap_cali_kpi_first_path_delay.txt",
  },
]);

export function createSeededRng(seedText) {
  let state = 0;
  const input = String(seedText);
  for (let i = 0; i < input.length; i += 1) {
    state = (Math.imul(31, state) + input.charCodeAt(i)) >>> 0;
  }
  if (state === 0) state = 0x9e3779b9;
  return function next() {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

export function roundSemanticNumber(value) {
  const rounded =
    Math.sign(value) *
    (Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100);
  return Object.is(rounded, -0) ? 0 : rounded;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function parseHeatmapMatrix(text, filename) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  while (lines.length > 0 && lines.at(-1).trim() === "") lines.pop();
  if (lines.length === 0 || lines.some((line) => line.trim() === "")) {
    throw new StubError("DATA_INVALID", `${filename} must be a non-empty rectangular matrix`);
  }
  const matrix = lines.map((line) =>
    line
      .trim()
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((token) => {
        const value = Number(token);
        if (!Number.isFinite(value)) {
          throw new StubError("DATA_INVALID", `${filename} contains non-finite number`);
        }
        return value;
      }),
  );
  const width = matrix[0]?.length ?? 0;
  if (width === 0 || matrix.some((row) => row.length !== width)) {
    throw new StubError("DATA_INVALID", `${filename} must be rectangular`);
  }
  return matrix;
}

export function parseKpiSamples(text, filename) {
  const tokens = text
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    throw new StubError("DATA_INVALID", `${filename} must contain at least one KPI sample`);
  }
  return tokens.map((token) => {
    const value = Number(token);
    if (!Number.isFinite(value)) {
      throw new StubError("DATA_INVALID", `${filename} contains non-finite number`);
    }
    return value;
  });
}

export function formatHeatmapMatrix(matrix) {
  return `${matrix
    .map((row) => row.map((value) => String(roundSemanticNumber(value))).join(","))
    .join("\n")}\n`;
}

export function formatKpiSamples(samples) {
  return `${samples.map((value) => String(roundSemanticNumber(value))).join("\n")}\n`;
}

function improveValue(value, ratio, noiseAmp, nextRandom, min, max) {
  const noise = (nextRandom() * 2 - 1) * noiseAmp * Math.max(1, Math.abs(value));
  return clamp(roundSemanticNumber(value * ratio + noise), min, max);
}

export function improveHeatmap(matrix, ratio, noiseAmp, nextRandom) {
  return matrix.map((row) =>
    row.map((value) => improveValue(value, ratio, noiseAmp, nextRandom, -200, 200)),
  );
}

export function improveKpi(samples, ratio, noiseAmp, nextRandom) {
  return samples.map((value) =>
    improveValue(value, ratio, noiseAmp, nextRandom, 0, 500),
  );
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Calibrated 发布器。
 * - copy：从 reference 目录复制（回归/可复现样本）
 * - random：相对共享目录 Initial 做可控改善随机生成（演示默认）
 * 日志必须标明 stub/synthetic，不得表述为真实业务采集。
 */
export function createPublisher(options) {
  const sharedDir = path.resolve(options.sharedDir);
  const sourceDir = path.resolve(options.sourceDir);
  const fsOps = options.fsOps ?? fs;
  const logger = options.logger ?? createLogger("info");
  const dataMode = options.dataMode ?? "random";
  const seed = options.seed;
  const improveMin = options.improveMin ?? 0.45;
  const improveMax = options.improveMax ?? 0.65;
  const noise = options.noise ?? 0.05;
  const targetDir = path.join(sharedDir, "case2");

  async function publishByCopy() {
    const published = [];
    for (const fileName of CALIBRATED_FILES) {
      const sourcePath = path.join(sourceDir, fileName);
      const targetPath = path.join(targetDir, fileName);
      const content = await fsOps.readFile(sourcePath);
      await atomicReplaceFile(targetPath, content, fsOps);
      await fsOps.stat(targetPath);
      published.push(targetPath);
    }
    logger.info("published calibrated stub/reference files", {
      mode: "copy",
      sourceDir,
      targetDir,
      count: published.length,
      note: "stub/reference files, not real backend acquisition",
    });
    return published;
  }

  async function readInitialMetric(spec) {
    const heatmapPath = path.join(targetDir, spec.initHeatmap);
    const kpiPath = path.join(targetDir, spec.initKpi);
    let heatmapText;
    let kpiText;
    try {
      heatmapText = await fsOps.readFile(heatmapPath, "utf8");
      kpiText = await fsOps.readFile(kpiPath, "utf8");
    } catch (error) {
      throw new StubError(
        "INITIAL_MISSING",
        `random mode requires initial files for ${spec.key}`,
        { cause: error, metric: spec.key },
      );
    }
    return {
      heatmap: parseHeatmapMatrix(heatmapText, spec.initHeatmap),
      kpi: parseKpiSamples(kpiText, spec.initKpi),
    };
  }

  async function publishByRandom() {
    const resolvedSeed =
      seed === undefined || seed === null || seed === ""
        ? `t${Date.now()}-r${Math.floor(Math.random() * 1e9)}`
        : String(seed);
    const nextRandom = createSeededRng(resolvedSeed);
    // 三指标共用 improve ratio，演示观感更一致
    const ratio = improveMin + (improveMax - improveMin) * nextRandom();
    const published = [];
    const shapes = [];

    for (const spec of METRIC_SPECS) {
      const initial = await readInitialMetric(spec);
      const caliHeatmap = improveHeatmap(initial.heatmap, ratio, noise, nextRandom);
      const caliKpi = improveKpi(initial.kpi, ratio, noise, nextRandom);
      const heatmapPath = path.join(targetDir, spec.caliHeatmap);
      const kpiPath = path.join(targetDir, spec.caliKpi);
      await atomicReplaceFile(heatmapPath, formatHeatmapMatrix(caliHeatmap), fsOps);
      await atomicReplaceFile(kpiPath, formatKpiSamples(caliKpi), fsOps);
      await fsOps.stat(heatmapPath);
      await fsOps.stat(kpiPath);
      published.push(heatmapPath, kpiPath);
      shapes.push({
        metric: spec.key,
        nx: caliHeatmap[0]?.length ?? 0,
        ny: caliHeatmap.length,
        kpiN: caliKpi.length,
        initMean: roundSemanticNumber(mean(initial.kpi)),
        caliMean: roundSemanticNumber(mean(caliKpi)),
      });
    }

    logger.info("published calibrated synthetic files", {
      mode: "random",
      seed: resolvedSeed,
      improveRatio: roundSemanticNumber(ratio),
      noise,
      targetDir,
      count: published.length,
      shapes,
      note: "synthetic relative to Initial; not real backend acquisition",
    });
    return published;
  }

  async function publishCalibratedFiles() {
    await fsOps.mkdir(targetDir, { recursive: true });
    const published =
      dataMode === "copy" ? await publishByCopy() : await publishByRandom();
    for (const fileName of CALIBRATED_FILES) {
      await fsOps.stat(path.join(targetDir, fileName));
    }
    return published;
  }

  return {
    targetDir,
    sourceDir,
    dataMode,
    publishCalibratedFiles,
  };
}

function isStartEdge(control) {
  return (
    control.case === "case2" &&
    control.command === "start" &&
    control.dt_type === "with dt" &&
    control.status === ""
  );
}

function isReinitEdge(control) {
  return control.command === "reinit" && control.status === "";
}

function classifySnapshot(control) {
  if (isStartEdge(control)) return "start-new";
  if (isReinitEdge(control)) return "reinit-new";
  if (control.command === "start" && control.status === "execute success") {
    return "start-recover";
  }
  if (control.command === "reinit" && control.status === "execute success") {
    return "reinit-recover";
  }
  if (control.command === "init" && control.status === "") return "idle";
  if (IDLE_STATUSES.has(control.status)) return "idle";
  return "diagnose";
}

async function assertStillCurrent(controlStore, command) {
  const latest = await controlStore.read();
  if (latest.command !== command || latest.status !== "execute success") {
    throw new StubError("STALE_OPERATION", "operation became stale before terminal status", {
      command,
      latestCommand: latest.command,
      latestStatus: latest.status,
    });
  }
  return latest;
}

async function runStartSuccess(context, isRecovery) {
  const { controlStore, publisher, stepMs, requestPicture, logger } = context;
  if (!isRecovery) {
    await controlStore.patchControl(
      { status: "execute success" },
      { expectedCommand: "start" },
    );
    await delay(stepMs);
  }
  await publisher.publishCalibratedFiles();
  await assertStillCurrent(controlStore, "start");
  const finalPatch = requestPicture
    ? { status: "case complete", save_picture_flag: 1 }
    : { status: "case complete" };
  await controlStore.patchControl(finalPatch, { expectedCommand: "start" });
  logger.info("start operation completed", {
    requestPicture,
    data: "stub/reference files, not real backend acquisition",
  });
}

async function runReinitSuccess(context, isRecovery) {
  const { controlStore, stepMs, logger } = context;
  if (!isRecovery) {
    await controlStore.patchControl(
      { status: "execute success" },
      { expectedCommand: "reinit" },
    );
    await delay(stepMs);
  }
  await assertStillCurrent(controlStore, "reinit");
  await controlStore.patchControl(
    { status: "reinit complete" },
    { expectedCommand: "reinit" },
  );
  logger.info("reinit operation completed");
}

export async function runOperation(context, operation, options = {}) {
  const isRecovery = options.isRecovery === true;
  if (!isRecovery && context.outcome === "fail") {
    await context.controlStore.patchControl(
      { status: "execute fail" },
      { expectedCommand: operation },
    );
    context.logger.warn("operation failed by CASE2_STUB_OUTCOME", { operation });
    return;
  }
  if (operation === "start") {
    await runStartSuccess(context, isRecovery);
    return;
  }
  if (operation === "reinit") {
    await runReinitSuccess(context, isRecovery);
    return;
  }
  throw new StubError("OPERATION_INVALID", `unknown operation ${operation}`);
}

/**
 * 运行期状态机。
 * fs.watch/轮询只负责唤醒；真正接单前每次都重新读取完整控制快照。
 */
export function createStubRunner(options) {
  const logger = options.logger ?? createLogger("info");
  let active = false;
  let stopped = false;
  let timer;
  let watcher;

  const context = {
    controlStore: options.controlStore,
    publisher: options.publisher,
    stepMs: options.stepMs,
    outcome: options.outcome,
    requestPicture: options.requestPicture,
    logger,
  };

  async function evaluate(reason = "manual") {
    if (stopped || active) return;
    let control;
    try {
      control = await context.controlStore.read();
    } catch (error) {
      logger.warn("control snapshot unreadable", {
        reason,
        error: error?.message ?? String(error),
      });
      return;
    }

    const classification = classifySnapshot(control);
    if (classification === "start-new" || classification === "reinit-new") {
      const operation = classification.startsWith("start") ? "start" : "reinit";
      active = true;
      logger.info("accepted new operation", {
        operation,
        reason,
        requestPicture: context.requestPicture,
        outcome: context.outcome,
      });
      try {
        await runOperation(context, operation);
      } catch (error) {
        if (error?.code === "STALE_OPERATION") {
          logger.warn("operation abandoned as stale", error.details);
        } else {
          logger.error("operation failed unexpectedly", {
            operation,
            error: error?.message ?? String(error),
          });
        }
      } finally {
        active = false;
        await evaluate("after-active-operation");
      }
      return;
    }

    // 恢复只在进程启动类 reason 做；after-active/poll 再 recover 会在发布失败时把 execute success 打成死循环。
    if (
      (reason === "startup" || reason.startsWith("startup-")) &&
      (classification === "start-recover" || classification === "reinit-recover")
    ) {
      const operation = classification.startsWith("start") ? "start" : "reinit";
      active = true;
      logger.info("recovering in-flight operation", {
        operation,
        reason,
        requestPicture: context.requestPicture,
        outcome: context.outcome,
      });
      try {
        await runOperation(context, operation, { isRecovery: true });
      } catch (error) {
        if (error?.code === "STALE_OPERATION") {
          logger.warn("recovered operation abandoned as stale", error.details);
        } else {
          logger.error("operation recovery failed", {
            operation,
            error: error?.message ?? String(error),
          });
        }
      } finally {
        active = false;
        await evaluate("after-recovery");
      }
      return;
    }

    if (classification === "diagnose") {
      logger.warn("control snapshot is not actionable", {
        command: control.command,
        status: control.status,
        case: control.case,
        dt_type: control.dt_type,
      });
    }
  }

  async function start() {
    await evaluate("startup");
    timer = setInterval(() => {
      evaluate("poll").catch((error) => {
        logger.warn("poll evaluate failed", { error: error?.message ?? String(error) });
      });
    }, options.pollMs);

    try {
      watcher = fs.watch(path.dirname(context.controlStore.controlPath), (event, fileName) => {
        if (fileName === CONTROL_FILE) {
          evaluate(`fs.watch:${event}`).catch((error) => {
            logger.warn("watch evaluate failed", { error: error?.message ?? String(error) });
          });
        }
      });
    } catch (error) {
      logger.warn("fs.watch unavailable; polling remains active", {
        error: error?.message ?? String(error),
      });
    }
    logger.info("case2 stub backend started", {
      controlPath: context.controlStore.controlPath,
      sharedDir: path.dirname(context.controlStore.controlPath),
      stepMs: context.stepMs,
      pollMs: options.pollMs,
      outcome: context.outcome,
      requestPicture: context.requestPicture,
      dataMode: options.publisher?.dataMode,
    });
  }

  function stop() {
    stopped = true;
    if (timer) clearInterval(timer);
    if (watcher) watcher.close();
  }

  return { start, stop, evaluate };
}

function positiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new StubError("CONFIG_INVALID", `${name} must be a non-negative integer`);
  }
  return parsed;
}

function parseDataMode(rawValue) {
  const value = rawValue === undefined || rawValue === "" ? "random" : rawValue;
  if (value !== "random" && value !== "copy") {
    throw new StubError("CONFIG_INVALID", "CASE2_STUB_DATA_MODE must be random or copy");
  }
  return value;
}

function parseUnitInterval(rawValue, fallback, name) {
  if (rawValue === undefined || rawValue === "") return fallback;
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new StubError("CONFIG_INVALID", `${name} must be a number in [0,1]`);
  }
  return value;
}

export function loadConfig(env = process.env) {
  if (!env.CASE2_SHARED_DIR) {
    throw new StubError("CONFIG_INVALID", "CASE2_SHARED_DIR is required");
  }
  const outcome = env.CASE2_STUB_OUTCOME ?? "success";
  if (outcome !== "success" && outcome !== "fail") {
    throw new StubError("CONFIG_INVALID", "CASE2_STUB_OUTCOME must be success or fail");
  }
  // 演示默认开启截图请求；显式 CASE2_STUB_REQUEST_PICTURE=0 可关闭。
  const requestPicture = parseRequestPicture(env.CASE2_STUB_REQUEST_PICTURE);
  const dataMode = parseDataMode(env.CASE2_STUB_DATA_MODE);
  const improveMin = parseUnitInterval(
    env.CASE2_STUB_IMPROVE_MIN,
    0.45,
    "CASE2_STUB_IMPROVE_MIN",
  );
  const improveMax = parseUnitInterval(
    env.CASE2_STUB_IMPROVE_MAX,
    0.65,
    "CASE2_STUB_IMPROVE_MAX",
  );
  if (improveMin > improveMax) {
    throw new StubError(
      "CONFIG_INVALID",
      "CASE2_STUB_IMPROVE_MIN must be <= CASE2_STUB_IMPROVE_MAX",
    );
  }
  const noise = parseUnitInterval(env.CASE2_STUB_NOISE, 0.05, "CASE2_STUB_NOISE");
  return {
    sharedDir: path.resolve(env.CASE2_SHARED_DIR),
    sourceDir: path.resolve(env.CASE2_STUB_SOURCE_DIR ?? DEFAULT_SOURCE_DIR),
    stepMs: positiveInteger(env.CASE2_STUB_STEP_MS ?? "5000", "CASE2_STUB_STEP_MS"),
    pollMs: positiveInteger(env.CASE2_STUB_POLL_MS ?? "1000", "CASE2_STUB_POLL_MS"),
    outcome,
    requestPicture,
    dataMode,
    seed: env.CASE2_STUB_SEED ?? "",
    improveMin,
    improveMax,
    noise,
    logLevel: env.CASE2_STUB_LOG_LEVEL ?? "info",
  };
}

/**
 * 演示联调默认 requestPicture=true。
 * 仅接受 0/1；未设置时按 1。
 */
export function parseRequestPicture(rawValue) {
  if (rawValue === undefined || rawValue === "") {
    return true;
  }
  if (rawValue === "1") return true;
  if (rawValue === "0") return false;
  throw new StubError(
    "CONFIG_INVALID",
    "CASE2_STUB_REQUEST_PICTURE must be 0 or 1",
  );
}

export function createCase2Stub(config, options = {}) {
  const logger = options.logger ?? createLogger(config.logLevel);
  const controlStore = createControlStore({
    sharedDir: config.sharedDir,
    logger,
  });
  const publisher = createPublisher({
    sharedDir: config.sharedDir,
    sourceDir: config.sourceDir,
    dataMode: config.dataMode,
    seed: config.seed,
    improveMin: config.improveMin,
    improveMax: config.improveMax,
    noise: config.noise,
    logger,
  });
  return createStubRunner({
    controlStore,
    publisher,
    stepMs: config.stepMs,
    pollMs: config.pollMs,
    outcome: config.outcome,
    requestPicture: config.requestPicture,
    logger,
  });
}

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const runner = createCase2Stub(config, { logger });
  await runner.start();

  const shutdown = (signal) => {
    logger.info("case2 stub backend stopping", { signal });
    runner.stop();
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("[case2-stub] fatal", error?.message ?? String(error));
    process.exitCode = 1;
  });
}
