/**
 * 全进程唯一控制文件存储：负责结构校验、串行 patch、原子替换和跨 Case guard。
 * Case2/Case3/Case4 只能通过本对象修改 case_control.json，避免多套队列覆盖彼此字段。
 */

import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { TextDecoder, isDeepStrictEqual } from "node:util";
import { atomicReplaceFile } from "./atomic-write.mjs";
import { AppError } from "./errors.mjs";
import { SerialQueue } from "./serial-queue.mjs";

const REQUIRED_FIELDS = Object.freeze([
  "case",
  "command",
  "dt_type",
  "status",
  "save_picture_flag",
]);
const STRING_FIELDS = Object.freeze(["case", "command", "dt_type", "status"]);

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assertControlShape(control) {
  if (control === null || Array.isArray(control) || typeof control !== "object") {
    throw new TypeError("control file root must be a JSON object");
  }
  for (const field of REQUIRED_FIELDS) {
    if (!Object.hasOwn(control, field)) {
      throw new TypeError(`control file is missing required field: ${field}`);
    }
  }
  for (const field of STRING_FIELDS) {
    if (typeof control[field] !== "string") {
      throw new TypeError(`control field ${field} must be a string`);
    }
  }
  if (control.save_picture_flag !== 0 && control.save_picture_flag !== 1) {
    throw new TypeError("control field save_picture_flag must be 0 or 1");
  }
  if (
    Object.hasOwn(control, "debug_flag") &&
    !Number.isInteger(control.debug_flag)
  ) {
    throw new TypeError("optional control field debug_flag must be an integer");
  }
  if (
    Object.hasOwn(control, "scene_type") &&
    typeof control.scene_type !== "string"
  ) {
    throw new TypeError("optional control field scene_type must be a string");
  }
  return control;
}

async function readControlDocument(controlPath, fsOps) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const bytes = await fsOps.readFile(controlPath);
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return assertControlShape(JSON.parse(text));
    } catch (error) {
      lastError = error;
      const transient =
        error instanceof SyntaxError ||
        error instanceof TypeError ||
        error?.code === "ERR_ENCODING_INVALID_ENCODED_DATA";
      if (!transient || attempt === 3) break;
      await sleep(50);
    }
  }
  throw lastError;
}

function verifyWrittenDocument(current, written, patch) {
  for (const [field, expected] of Object.entries(patch)) {
    if (!isDeepStrictEqual(written[field], expected)) {
      throw new AppError(
        500,
        "CONTROL_WRITE_FAILED",
        `case_control.json verification failed for ${field}`,
      );
    }
  }
  for (const [field, previous] of Object.entries(current)) {
    if (!Object.hasOwn(patch, field) && !isDeepStrictEqual(written[field], previous)) {
      throw new AppError(
        500,
        "CONTROL_WRITE_FAILED",
        `case_control.json lost unowned field ${field}`,
      );
    }
  }
}

/** 清 flag 时比较写前/写后业务元组；不含 save_picture_flag。 */
export const FLAG_CLEAR_CONFLICT_ATTEMPTS = 3;

function controlTuple(control) {
  return {
    case: control.case,
    command: control.command,
    dt_type: control.dt_type,
    status: control.status,
  };
}

function sameControlTuple(left, right) {
  return (
    left.case === right.case &&
    left.command === right.command &&
    left.dt_type === right.dt_type &&
    left.status === right.status
  );
}

function isFlagClearPatch(patch) {
  const keys = Object.keys(patch);
  return (
    keys.length === 1 &&
    keys[0] === "save_picture_flag" &&
    patch.save_picture_flag === 0
  );
}

/**
 * Start/ReInit 的共享 busy 判定。只有干净 init 或同动作 execute fail 重试可开轮。
 */
export function assertCommandAvailable(current, requested) {
  if (current.command === "init" && current.status === "") return;

  const sameCase =
    current.case === requested.caseId && current.command === requested.command;
  const sameSide =
    requested.caseId === "case2" && requested.command === "reinit"
      ? true
      : current.dt_type === requested.dtType;
  if (sameCase && sameSide && current.status === "execute fail") return;

  throw new AppError(
    409,
    "CONTROL_BUSY",
    "another active or unconsumed control command owns case_control.json",
  );
}

/** 高电平截图只能由对应 Case 的 Start 路由消费。 */
export function assertScreenshotOwnership(control, caseId) {
  if (control.save_picture_flag !== 1) {
    throw new AppError(
      409,
      "SCREENSHOT_NOT_REQUESTED",
      "save_picture_flag is not 1",
    );
  }
  const dtTypeAllowed =
    caseId === "case2"
      ? control.dt_type === "with dt"
      : caseId === "case4"
        ? control.dt_type === "all"
        : caseId === "case3"
          ? control.dt_type === "without dt" || control.dt_type === "with dt"
          : false;
  const valid =
    control.case === caseId &&
    control.command === "start" &&
    dtTypeAllowed;
  if (!valid) {
    throw new AppError(
      409,
      "SCREENSHOT_NOT_REQUESTED",
      `save_picture_flag is not owned by ${caseId}`,
    );
  }
}

export function createControlFileStore(options) {
  const sharedDir = options.sharedDir;
  const fsOps = options.fsOps ?? defaultFs;
  const logger = options.logger;
  const queue = options.queue ?? new SerialQueue();
  const controlPath = path.join(sharedDir, "case_control.json");
  const renameAttempts = options.renameAttempts;
  const renameRetryMs = options.renameRetryMs;
  const sleep = options.sleep;

  async function read() {
    try {
      return await readControlDocument(controlPath, fsOps);
    } catch (error) {
      throw new AppError(
        500,
        "CONTROL_READ_FAILED",
        "failed to read case_control.json",
        { cause: error },
      );
    }
  }

  async function update(optionsForUpdate) {
    const {
      patch,
      guard,
      beforeWrite,
      kind = "patch",
      caseId = "shared",
      rereadBeforeWrite = false,
      tupleConflictRetries = 1,
    } = optionsForUpdate;
    const attempts = rereadBeforeWrite
      ? Math.max(1, tupleConflictRetries)
      : 1;

    return queue.run(async () => {
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        let current = await read();
        guard?.(current);

        if (beforeWrite) {
          await beforeWrite(current);
          current = await read();
          guard?.(current);
        }

        if (rereadBeforeWrite) {
          current = await read();
          guard?.(current);
        }

        if (isFlagClearPatch(patch) && current.save_picture_flag === 0) {
          return current;
        }

        const merged = { ...current, ...patch };
        const serialized = `${JSON.stringify(merged, null, 2)}\n`;
        try {
          await atomicReplaceFile(controlPath, serialized, {
            fsOps,
            logger,
            renameAttempts,
            renameRetryMs,
            sleep,
          });
        } catch (error) {
          throw new AppError(
            500,
            "CONTROL_WRITE_FAILED",
            "failed to atomically write case_control.json",
            { cause: error },
          );
        }

        let written;
        try {
          written = await readControlDocument(controlPath, fsOps);
        } catch (error) {
          throw new AppError(
            500,
            "CONTROL_WRITE_FAILED",
            "case_control.json failed post-write verification",
            { cause: error },
          );
        }

        if (rereadBeforeWrite && !sameControlTuple(current, written)) {
          logger?.warn("control flag clear tuple conflict, retrying", {
            caseId,
            kind,
            attempt,
            attempts,
            expected: controlTuple(current),
            actual: controlTuple(written),
          });
          if (attempt < attempts) continue;
          throw new AppError(
            500,
            "CONTROL_WRITE_FAILED",
            "case_control.json flag clear lost the race after retries",
          );
        }

        verifyWrittenDocument(current, written, patch);

        logger?.info("control file updated", {
          caseId,
          kind,
          fields: Object.keys(patch),
          command: written.command,
          status: written.status,
          save_picture_flag: written.save_picture_flag,
        });
        return written;
      }

      throw new AppError(
        500,
        "CONTROL_WRITE_FAILED",
        "case_control.json flag clear lost the race after retries",
      );
    });
  }

  return {
    controlPath,
    read,
    update,
  };
}
