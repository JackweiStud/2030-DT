/**
 * Case4 控制请求：精确 payload、九文件白名单清理、截图清零。
 * JSONL 清理解耦：开轮成功后再清，失败不得挡住 Start/ReInit。
 */

import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { AppError, isAppError } from "../../shared/errors.mjs";
import {
  FLAG_CLEAR_CONFLICT_ATTEMPTS,
  assertCommandAvailable,
  assertScreenshotOwnership,
  createControlFileStore,
} from "../../shared/control-file-store.mjs";
import { CASE4_DYNAMIC_FILES } from "./constants.mjs";

function exactKeys(payload, expected) {
  const actual = Object.keys(payload).sort();
  const wanted = [...expected].sort();
  return (
    actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index])
  );
}

function classifyPayload(payload) {
  if (exactKeys(payload, ["command"]) && payload.command === "init") {
    return {
      kind: "entry-init",
      patch: {
        case: "case4",
        command: "init",
        dt_type: "",
        status: "",
        save_picture_flag: 0,
      },
    };
  }

  if (
    exactKeys(payload, ["case", "command", "dt_type"]) &&
    payload.case === "case4" &&
    (payload.command === "start" || payload.command === "reinit") &&
    payload.dt_type === "with dt"
  ) {
    return {
      kind: payload.command,
      descriptor: {
        caseId: "case4",
        command: payload.command,
        dtType: "with dt",
      },
      patch: {
        case: "case4",
        command: payload.command,
        dt_type: "with dt",
        status: "",
        save_picture_flag: 0,
      },
    };
  }

  if (
    exactKeys(payload, ["save_picture_flag"]) &&
    payload.save_picture_flag === 0
  ) {
    return {
      kind: "clear-picture",
      patch: { save_picture_flag: 0 },
    };
  }

  throw new AppError(
    400,
    "INVALID_REQUEST",
    "control payload must be exactly init, case4 start/reinit with dt, or save_picture_flag=0",
  );
}

export function createCase4ControlFileService(options) {
  const sharedDir = options.sharedDir;
  const fsOps = options.fsOps ?? defaultFs;
  const logger = options.logger;
  const debugJsonl = options.debugJsonl;
  const store =
    options.store ??
    createControlFileStore({
      sharedDir,
      fsOps,
      logger,
      queue: options.queue,
      renameAttempts: options.renameAttempts,
      renameRetryMs: options.renameRetryMs,
    });
  const dataDir = path.join(sharedDir, "case4");

  async function clearDynamicFiles() {
    try {
      await fsOps.mkdir(dataDir, { recursive: true });
      for (const filename of CASE4_DYNAMIC_FILES) {
        await fsOps.writeFile(path.join(dataDir, filename), "");
      }
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(
        500,
        "DATA_CLEAR_FAILED",
        "failed to clear case4 dynamic files",
        { cause: error },
      );
    }
  }

  async function clearPictureFlag(kind) {
    return store.update({
      caseId: "case4",
      kind,
      patch: { save_picture_flag: 0 },
      rereadBeforeWrite: true,
      tupleConflictRetries: FLAG_CLEAR_CONFLICT_ATTEMPTS,
      guard(current) {
        if (current.save_picture_flag === 0) return;
        assertScreenshotOwnership(current, "case4");
      },
    });
  }

  async function updateFromHttp(payload) {
    const operation = classifyPayload(payload);
    if (operation.kind === "clear-picture") {
      logger.warn(
        "case4 screenshot request cleared by Web after finite retries",
        {
          caseId: "case4",
          code: "SCREENSHOT_DROPPED_AFTER_RETRIES",
        },
      );
      return clearPictureFlag("screenshot-abandoned");
    }

    const written = await store.update({
      caseId: "case4",
      kind: operation.kind,
      patch: operation.patch,
      guard: operation.descriptor
        ? (current) => assertCommandAvailable(current, operation.descriptor)
        : undefined,
      beforeWrite:
        operation.kind === "start" || operation.kind === "reinit"
          ? async () => {
              await clearDynamicFiles();
            }
          : undefined,
    });

    if (operation.kind === "start" || operation.kind === "reinit") {
      await debugJsonl?.clear();
    }
    return written;
  }

  return {
    controlPath: store.controlPath,
    read: store.read,
    updateFromHttp,
    clearPictureFlag: () => clearPictureFlag("screenshot-saved"),
    assertScreenshotOwnership: (control) =>
      assertScreenshotOwnership(control, "case4"),
    clearDynamicFiles,
    store,
  };
}
