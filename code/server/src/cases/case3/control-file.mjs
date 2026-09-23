/**
 * Case3 控制请求：精确 payload、跨 Case busy、单侧清文件和截图清零。
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
import {
  CASE3_SIDE_FILES,
  dtTypeForSide,
} from "./constants.mjs";

function exactKeys(payload, expected) {
  const actual = Object.keys(payload).sort();
  const wanted = [...expected].sort();
  return (
    actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index])
  );
}

function sideFromDtType(dtType) {
  if (dtType === "without dt") return "without";
  if (dtType === "with dt") return "with";
  return null;
}

function classifyPayload(payload) {
  if (exactKeys(payload, ["command"]) && payload.command === "init") {
    return {
      kind: "entry-init",
      patch: {
        case: "case3",
        command: "init",
        dt_type: "",
        status: "",
        save_picture_flag: 0,
      },
    };
  }

  if (
    exactKeys(payload, ["case", "command", "dt_type"]) &&
    payload.case === "case3" &&
    (payload.command === "start" || payload.command === "reinit")
  ) {
    const side = sideFromDtType(payload.dt_type);
    if (side) {
      return {
        kind: payload.command,
        side,
        descriptor: {
          caseId: "case3",
          command: payload.command,
          dtType: payload.dt_type,
        },
        patch: {
          case: "case3",
          command: payload.command,
          dt_type: payload.dt_type,
          status: "",
          save_picture_flag: 0,
        },
      };
    }
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
    "control payload must be exactly init, case3 start/reinit, or save_picture_flag=0",
  );
}

export function createCase3ControlFileService(options) {
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
  const dataDir = path.join(sharedDir, "case3");

  async function clearSide(side) {
    const files = CASE3_SIDE_FILES[side];
    try {
      await fsOps.mkdir(dataDir, { recursive: true });
      for (const [key, filename] of Object.entries(files)) {
        if (key === "cost") continue;
        const target = path.join(dataDir, filename);
        if (key === "optionalMse") {
          await fsOps.truncate(target, 0).catch((error) => {
            if (error?.code !== "ENOENT") throw error;
          });
        } else {
          await fsOps.writeFile(target, "");
        }
      }
      await debugJsonl?.clear(side);
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(
        500,
        "SIDE_CLEAR_FAILED",
        `failed to clear ${side} side files`,
        { cause: error, details: { side } },
      );
    }
  }

  async function clearPictureFlag(kind) {
    return store.update({
      caseId: "case3",
      kind,
      patch: { save_picture_flag: 0 },
      rereadBeforeWrite: true,
      tupleConflictRetries: FLAG_CLEAR_CONFLICT_ATTEMPTS,
      guard(current) {
        if (current.save_picture_flag === 0) return;
        assertScreenshotOwnership(current, "case3");
      },
    });
  }

  async function updateFromHttp(payload) {
    const operation = classifyPayload(payload);
    if (operation.kind === "clear-picture") {
      logger.warn("case3 screenshot request cleared by Web after finite retries", {
        caseId: "case3",
        code: "SCREENSHOT_DROPPED_AFTER_RETRIES",
      });
      return clearPictureFlag("screenshot-abandoned");
    }

    return store.update({
      caseId: "case3",
      kind: operation.kind,
      patch: operation.patch,
      guard: operation.descriptor
        ? (current) => assertCommandAvailable(current, operation.descriptor)
        : undefined,
      beforeWrite: operation.side
        ? async () => {
            await clearSide(operation.side);
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
      assertScreenshotOwnership(control, "case3"),
    clearSide,
    dtTypeForSide,
    store,
  };
}
