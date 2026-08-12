/**
 * Case2 控制 HTTP 语义适配。
 * 实际读写统一委托进程级 ControlFileStore，Case2 只拥有 payload 分类、route guard、
 * 以及 start/reinit 前清空六个 Calibrated 文件（与 Case3 单侧清文件对齐）。
 */

import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { AppError, isAppError } from "../../shared/errors.mjs";
import {
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
      clearCalibrated: true,
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
      clearCalibrated: true,
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

  if (exactKeys(payload, ["command"]) && payload.command === "init") {
    return {
      kind: "entry-init",
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
    "control payload must be exactly start, reinit, init, or save_picture_flag=0",
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

  /** start/reinit 写控制前：清空六个 Calibrated 结果文件；不清 Initial。 */
  async function clearCalibrated(kind) {
    const files = calibratedFilenames();
    try {
      await fsOps.mkdir(dataDir, { recursive: true });
      for (const filename of files) {
        await fsOps.writeFile(path.join(dataDir, filename), "");
      }
      logger.info("case2 calibrated files cleared", {
        caseId: "case2",
        kind,
        files: files.length,
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(
        500,
        "CALIBRATED_CLEAR_FAILED",
        "failed to clear calibrated result files",
        { cause: error },
      );
    }
  }

  async function clearPictureFlag(kind) {
    return store.update({
      caseId: "case2",
      kind,
      patch: { save_picture_flag: 0 },
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
      beforeWrite: operation.clearCalibrated
        ? async () => {
            await clearCalibrated(operation.kind);
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
    clearCalibrated,
    optionalFields: OPTIONAL_CONTROL_FIELDS,
    store,
  };
}
