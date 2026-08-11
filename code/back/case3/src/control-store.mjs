/**
 * Case3 stub 唯一控制写原语。
 * 只 patch 后端自有 status/flag，并在同一串行队列内复验任务 ownership。
 */

import { promises as defaultFs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { TextDecoder, isDeepStrictEqual } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { CONTROL_FILE, sideFromDtType } from "./constants.mjs";
import { StubError } from "./errors.mjs";

const REQUIRED_FIELDS = Object.freeze([
  "case",
  "command",
  "dt_type",
  "status",
  "save_picture_flag",
]);
const OWNED_STATUSES = new Set([
  "execute success",
  "execute fail",
  "case complete",
  "reinit complete",
]);

class SerialQueue {
  #tail = Promise.resolve();

  run(task) {
    const result = this.#tail.then(task, task);
    this.#tail = result.catch(() => undefined);
    return result;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertControlShape(control) {
  if (!isObject(control)) {
    throw new StubError("CONTROL_INVALID", "控制文件根必须是 JSON object");
  }
  for (const field of REQUIRED_FIELDS) {
    if (!Object.hasOwn(control, field)) {
      throw new StubError("CONTROL_INVALID", `控制文件缺少 ${field}`);
    }
  }
  for (const field of ["case", "command", "dt_type", "status"]) {
    if (typeof control[field] !== "string") {
      throw new StubError("CONTROL_INVALID", `${field} 必须是字符串`);
    }
  }
  if (control.save_picture_flag !== 0 && control.save_picture_flag !== 1) {
    throw new StubError("CONTROL_INVALID", "save_picture_flag 必须是 0 或 1");
  }
  if (
    Object.hasOwn(control, "debug_flag") &&
    !Number.isInteger(control.debug_flag)
  ) {
    throw new StubError("CONTROL_INVALID", "debug_flag 必须是整数");
  }
  if (
    Object.hasOwn(control, "scene_type") &&
    typeof control.scene_type !== "string"
  ) {
    throw new StubError("CONTROL_INVALID", "scene_type 必须是字符串");
  }
  return control;
}

function transientReadError(error) {
  return (
    error?.code === "ENOENT" ||
    error instanceof SyntaxError ||
    error?.code === "ERR_ENCODING_INVALID_ENCODED_DATA"
  );
}

export async function readControlFile(controlPath, options = {}) {
  const fsOps = options.fsOps ?? defaultFs;
  const attempts = options.attempts ?? 3;
  const retryMs = options.retryMs ?? 50;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const bytes = await fsOps.readFile(controlPath);
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return assertControlShape(JSON.parse(text));
    } catch (error) {
      lastError = error;
      if (!transientReadError(error) || attempt === attempts) break;
      await delay(retryMs);
    }
  }
  if (lastError instanceof StubError) throw lastError;
  const code = lastError?.code === "ENOENT" ? "CONTROL_MISSING" : "CONTROL_UNREADABLE";
  throw new StubError(code, "控制文件当前不可读", { cause: lastError });
}

async function atomicReplace(targetPath, content, fsOps) {
  const temporaryPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await fsOps.open(temporaryPath, "wx", 0o600);
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
}

function assertPatch(patch) {
  if (!isObject(patch) || Object.keys(patch).length === 0) {
    throw new StubError("PATCH_INVALID", "控制 patch 不能为空");
  }
  for (const key of Object.keys(patch)) {
    if (key !== "status" && key !== "save_picture_flag") {
      throw new StubError("PATCH_INVALID", `stub 无权写 ${key}`);
    }
  }
  if (
    Object.hasOwn(patch, "status") &&
    !OWNED_STATUSES.has(patch.status)
  ) {
    throw new StubError("PATCH_INVALID", "stub 无权写该 status");
  }
  if (
    Object.hasOwn(patch, "save_picture_flag") &&
    patch.save_picture_flag !== 1
  ) {
    throw new StubError("PATCH_INVALID", "stub 只能置 save_picture_flag=1");
  }
}

/** 校验当前快照仍属于内存任务，并处于允许的前置状态。 */
export function assertTaskOwnership(control, task, expectedStatuses) {
  const side = sideFromDtType(control.dt_type);
  const statusAllowed = expectedStatuses.includes(control.status);
  if (
    control.case !== "case3" ||
    control.command !== task.command ||
    side !== task.side ||
    !statusAllowed
  ) {
    throw new StubError("STALE_OPERATION", "任务已失去共享文件写入权", {
      latest: {
        case: control.case,
        command: control.command,
        dtType: control.dt_type,
        status: control.status,
      },
    });
  }
  return control;
}

function verifyMerge(previous, written, patch) {
  for (const [key, expected] of Object.entries(patch)) {
    if (!isDeepStrictEqual(written[key], expected)) {
      throw new StubError(
        "CONTROL_WRITE_VERIFY_FAILED",
        `${key} patch 未持久化`,
      );
    }
  }
  for (const [key, value] of Object.entries(previous)) {
    if (!Object.hasOwn(patch, key) && !isDeepStrictEqual(written[key], value)) {
      throw new StubError(
        "CONTROL_WRITE_VERIFY_FAILED",
        `控制写丢失未拥有字段 ${key}`,
      );
    }
  }
}

export function createControlStore(options) {
  const fsOps = options.fsOps ?? defaultFs;
  const logger = options.logger;
  const queue = options.queue ?? new SerialQueue();
  const controlPath = path.join(options.sharedDir, CONTROL_FILE);
  const readOptions = {
    fsOps,
    attempts: options.readAttempts ?? 3,
    retryMs: options.readRetryMs ?? 50,
  };

  const read = () => readControlFile(controlPath, readOptions);

  async function assertOwned(task, expectedStatuses = ["execute success"]) {
    if (task.signal?.aborted) {
      throw new StubError("STALE_OPERATION", "进程停止，任务撤权");
    }
    return assertTaskOwnership(await read(), task, expectedStatuses);
  }

  async function patch(patchValue, task, expectedStatuses) {
    assertPatch(patchValue);
    return queue.run(async () => {
      const current = await assertOwned(task, expectedStatuses);
      const merged = { ...current, ...patchValue };
      try {
        await atomicReplace(
          controlPath,
          `${JSON.stringify(merged, null, 2)}\n`,
          fsOps,
        );
      } catch (error) {
        throw new StubError(
          "CONTROL_WRITE_FAILED",
          "控制文件原子写失败",
          { cause: error },
        );
      }
      const written = await read();
      verifyMerge(current, written, patchValue);
      logger?.info("control-patched", {
        operationId: task.operationId,
        recovery: task.recovery,
        command: task.command,
        side: task.side,
        event: "control",
        status: written.status,
        savePictureFlag: written.save_picture_flag,
      });
      return written;
    });
  }

  return {
    controlPath,
    read,
    assertOwned,
    patch,
  };
}
