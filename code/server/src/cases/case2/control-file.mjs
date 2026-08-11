/**
 * Case2 控制 HTTP 语义适配。
 * 实际读写统一委托进程级 ControlFileStore，Case2 只拥有 payload 分类与 route guard。
 */

import { AppError } from "../../shared/errors.mjs";
import {
  assertCommandAvailable,
  assertScreenshotOwnership,
  createControlFileStore,
} from "../../shared/control-file-store.mjs";
import {
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
  const logger = options.logger;
  const store =
    options.store ??
    createControlFileStore({
      sharedDir: options.sharedDir,
      fsOps: options.fsOps,
      logger,
      queue: options.queue,
    });

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
    });
  }

  return {
    controlPath: store.controlPath,
    read: store.read,
    updateFromHttp,
    clearPictureFlag: () => clearPictureFlag("screenshot-saved"),
    assertScreenshotOwnership: (control) =>
      assertScreenshotOwnership(control, "case2"),
    optionalFields: OPTIONAL_CONTROL_FIELDS,
    store,
  };
}
