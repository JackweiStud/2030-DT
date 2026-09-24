/**
 * Case2 控制 HTTP 语义适配。
 * 实际读写统一委托进程级 ControlFileStore，Case2 只拥有 payload 分类、route guard、
 * 以及 init/reinit 前从 backCali 恢复六个 Calibrated 文件。
 */

import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { AppError } from "../../shared/errors.mjs";
import {
  FLAG_CLEAR_CONFLICT_ATTEMPTS,
  assertCommandAvailable,
  assertScreenshotOwnership,
  createControlFileStore,
} from "../../shared/control-file-store.mjs";
import {
  METRIC_FILES,
  OPTIONAL_CONTROL_FIELDS,
} from "./constants.mjs";

function exactKeys(payload, expected) {
  const actual = Object.keys(payload).sort();
  const wanted = [...expected].sort();
  return (
    actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index])
  );
}

function calibratedFilenames() {
  const names = [];
  for (const phases of Object.values(METRIC_FILES)) {
    names.push(phases.calibrated.heatmap, phases.calibrated.kpi);
  }
  return names;
}

function classifyPayload(payload) {
  if (
    exactKeys(payload, ["case", "command", "dt_type"]) &&
    payload.case === "case2" &&
    payload.command === "start" &&
    payload.dt_type === "with dt"
  ) {
    return {
      kind: "start",
      descriptor: {
        caseId: "case2",
        command: "start",
        dtType: "with dt",
      },
      patch: {
        case: "case2",
        command: "start",
        dt_type: "with dt",
        status: "",
        save_picture_flag: 0,
      },
    };
  }

  if (exactKeys(payload, ["command"]) && payload.command === "reinit") {
    return {
      kind: "reinit",
      restoreCalibrated: true,
      descriptor: {
        caseId: "case2",
        command: "reinit",
        dtType: undefined,
      },
      patch: {
        case: "case2",
        command: "reinit",
        status: "",
        save_picture_flag: 0,
      },
    };
  }

  if (
    exactKeys(payload, ["command", "restore_calibrated"]) &&
    payload.command === "init" &&
    payload.restore_calibrated === false
  ) {
    return {
      kind: "completion-init",
      patch: {
        case: "case2",
        command: "init",
        dt_type: "",
        status: "",
        save_picture_flag: 0,
      },
    };
  }

  if (exactKeys(payload, ["command"]) && payload.command === "init") {
    return {
      kind: "entry-init",
      restoreCalibrated: true,
      patch: {
        case: "case2",
        command: "init",
        dt_type: "",
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
    "control payload must be exactly start, reinit, entry init, completion init, or save_picture_flag=0",
  );
}

export function createControlFileService(options) {
  const sharedDir = options.sharedDir;
  const fsOps = options.fsOps ?? defaultFs;
  const logger = options.logger;
  const store =
    options.store ??
    createControlFileStore({
      sharedDir,
      fsOps,
      logger,
      queue: options.queue,
      renameAttempts: options.renameAttempts,
      renameRetryMs: options.renameRetryMs,
      sleep: options.sleep,
    });
  const dataDir = path.join(sharedDir, "case2");

  /** init/reinit 写控制前逐个恢复六个 Calibrated 文件；失败时重试整批，不回滚部分写入。 */
  async function restoreCalibratedFromBackCali(kind) {
    const files = calibratedFilenames();
    const backCaliDir = path.join(dataDir, "backCali");
    let lastFailure;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      let currentFile = files[0] ?? "case2";
      try {
        await fsOps.mkdir(dataDir, { recursive: true });
        for (const filename of files) {
          currentFile = filename;
          const source = path.join(backCaliDir, filename);
          const destination = path.join(dataDir, filename);
          await fsOps.copyFile(source, destination);
        }
        logger.info("case2 calibrated files restored from backCali", {
          caseId: "case2",
          kind,
          files: files.length,
          attempts: attempt,
        });
        return;
      } catch (error) {
        lastFailure = new Error(
          `${currentFile}: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
        logger.warn("case2 calibrated restore batch failed", {
          caseId: "case2",
          kind,
          attempt,
          maxAttempts: 3,
          reason: lastFailure.message,
        });
      }
    }

    throw new AppError(
      500,
      "CALIBRATED_RESTORE_FAILED",
      `failed to restore calibrated files from backCali after 3 attempts: ${lastFailure?.message ?? "unknown error"}`,
      { cause: lastFailure },
    );
  }

  async function clearPictureFlag(kind) {
    return store.update({
      caseId: "case2",
      kind,
      patch: { save_picture_flag: 0 },
      rereadBeforeWrite: true,
      tupleConflictRetries: FLAG_CLEAR_CONFLICT_ATTEMPTS,
      guard(current) {
        if (current.save_picture_flag === 0) return;
        assertScreenshotOwnership(current, "case2");
      },
    });
  }

  async function updateFromHttp(payload) {
    const operation = classifyPayload(payload);
    if (operation.kind === "clear-picture") {
      logger.warn("case2 screenshot request cleared by Web after finite retries", {
        code: "SCREENSHOT_DROPPED_AFTER_RETRIES",
      });
      return clearPictureFlag("screenshot-abandoned");
    }

    return store.update({
      caseId: "case2",
      kind: operation.kind,
      patch: operation.patch,
      guard: operation.descriptor
        ? (current) => assertCommandAvailable(current, operation.descriptor)
        : undefined,
      beforeWrite: operation.restoreCalibrated
        ? async () => {
            await restoreCalibratedFromBackCali(operation.kind);
          }
        : undefined,
    });
  }

  return {
    controlPath: store.controlPath,
    read: store.read,
    updateFromHttp,
    clearPictureFlag: () => clearPictureFlag("screenshot-saved"),
    assertScreenshotOwnership: (control) =>
      assertScreenshotOwnership(control, "case2"),
    restoreCalibratedFromBackCali,
    optionalFields: OPTIONAL_CONTROL_FIELDS,
    store,
  };
}
