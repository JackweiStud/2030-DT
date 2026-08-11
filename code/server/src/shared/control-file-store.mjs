/**
 * 全进程唯一控制文件存储：负责结构校验、串行 patch、原子替换和跨 Case guard。
 * Case2/Case3 只能通过本对象修改 case_control.json，避免两套队列覆盖彼此字段。
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
  const valid =
    control.case === caseId &&
    control.command === "start" &&
    (caseId === "case2"
      ? control.dt_type === "with dt"
      : control.dt_type === "without dt" || control.dt_type === "with dt");
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
    } = optionsForUpdate;

    return queue.run(async () => {
      let current = await read();
      guard?.(current);

      if (beforeWrite) {
        await beforeWrite(current);
        current = await read();
        guard?.(current);
      }

      const merged = { ...current, ...patch };
      const serialized = `${JSON.stringify(merged, null, 2)}\n`;
      try {
        await atomicReplaceFile(controlPath, serialized, { fsOps });
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
    });
  }

  return {
    controlPath,
    read,
    update,
  };
}
