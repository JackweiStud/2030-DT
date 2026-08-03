import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";
import { atomicReplaceFile } from "../../shared/atomic-write.mjs";
import { AppError } from "../../shared/errors.mjs";
import { SerialQueue } from "../../shared/serial-queue.mjs";
import {
  OPTIONAL_CONTROL_FIELDS,
  REQUIRED_CONTROL_FIELDS,
} from "./constants.mjs";

const STRING_FIELDS = new Set(["case", "command", "dt_type", "status"]);

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assertControlShape(control) {
  if (control === null || Array.isArray(control) || typeof control !== "object") {
    throw new TypeError("control file root must be a JSON object");
  }

  for (const field of REQUIRED_CONTROL_FIELDS) {
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
      if (!(error instanceof SyntaxError) || attempt === 3) {
        break;
      }
      await sleep(50);
    }
  }
  throw lastError;
}

function classifyPayload(payload) {
  const keys = Object.keys(payload).sort();
  const exactKeys = (...expected) =>
    keys.length === expected.length &&
    keys.every((key, index) => key === [...expected].sort()[index]);

  if (
    exactKeys("case", "command", "dt_type") &&
    payload.case === "case2" &&
    payload.command === "start" &&
    payload.dt_type === "with dt"
  ) {
    return {
      kind: "start",
      patch: { case: "case2", command: "start", dt_type: "with dt", status: "" },
    };
  }

  if (exactKeys("command") && payload.command === "reinit") {
    return { kind: "reinit", patch: { command: "reinit", status: "" } };
  }

  if (
    exactKeys("save_picture_flag") &&
    payload.save_picture_flag === 0
  ) {
    return { kind: "clear-picture", patch: { save_picture_flag: 0 } };
  }

  throw new AppError(
    400,
    "INVALID_REQUEST",
    "control payload must be exactly start, reinit, or save_picture_flag=0",
  );
}

/**
 * case2 控制文件服务。
 * 五个核心字段必填；debug_flag/scene_type 可选但存在时校验类型。
 * GET 不解释枚举字面值，未知 status 和未来未知字段都原样透传。
 */
export function createControlFileService(options) {
  const sharedDir = options.sharedDir;
  const fsOps = options.fsOps ?? defaultFs;
  const logger = options.logger;
  const queue = options.queue ?? new SerialQueue();
  const controlPath = path.join(sharedDir, "case_control.json");

  async function read() {
    try {
      return await readControlDocument(controlPath, fsOps);
    } catch (error) {
      throw new AppError(500, "CONTROL_READ_FAILED", "failed to read case_control.json", {
        cause: error,
      });
    }
  }

  async function writePatch(patch, kind) {
    return queue.run(async () => {
      const current = await read();
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

      for (const [field, expected] of Object.entries(patch)) {
        if (written[field] !== expected) {
          throw new AppError(
            500,
            "CONTROL_WRITE_FAILED",
            `case_control.json verification failed for ${field}`,
          );
        }
      }

      logger.info("case2 control file updated", {
        kind,
        fields: Object.keys(patch),
      });
      return written;
    });
  }

  async function updateFromHttp(payload) {
    const operation = classifyPayload(payload);
    if (operation.kind === "clear-picture") {
      logger.warn("case2 screenshot request cleared by Web after finite retries", {
        code: "SCREENSHOT_DROPPED_AFTER_RETRIES",
      });
    }
    return writePatch(operation.patch, operation.kind);
  }

  return {
    controlPath,
    read,
    updateFromHttp,
    clearPictureFlag: () =>
      writePatch({ save_picture_flag: 0 }, "screenshot-saved"),
    optionalFields: OPTIONAL_CONTROL_FIELDS,
  };
}
