/**
 * Case4 运行中轨迹：base + 三路 realtime 的共同完整前缀。
 * 无 complete 门槛，不得返回 RESULT_NOT_READY。
 * reflection=true 时再与反射完整行取共同前缀。
 */

import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { AppError, isAppError } from "../../shared/errors.mjs";
import {
  CASE4_BASE_FILE,
  CASE4_REFLECTION_FILE,
  CASE4_SCHEMES,
  CASE4_TRAJECTORY_FILES,
} from "./constants.mjs";
import {
  assembleTrajectory,
  parseBaseRoute,
  parseCoordinateRaw,
  parsePhysicalLines,
  readRequiredUtf8,
  sameFileSnapshot,
  statRequiredFile,
} from "./numeric-file.mjs";
import {
  attachLiveReflection,
  logReflectionDiagnostics,
  readReflectionWindow,
} from "./reflection-file.mjs";

function parseRealtime(text, filename) {
  const parser = (line, currentFilename) =>
    parseCoordinateRaw(line, currentFilename, "TRAJECTORY_DATA_INVALID");
  parser.invalidCode = "TRAJECTORY_DATA_INVALID";
  return parsePhysicalLines(
    text,
    filename,
    parser,
    "TRAJECTORY_DATA_INVALID",
  );
}

export function createCase4TrajectoryService(options) {
  const sharedDir = options.sharedDir;
  const fsOps = options.fsOps ?? defaultFs;
  const logger = options.logger;
  const debugJsonl = options.debugJsonl;
  const logSubstitution = options.logSubstitution;
  const dataDir = path.join(sharedDir, "case4");
  const seenReflection = new Set();
  const files = [
    { key: "base", filename: CASE4_BASE_FILE, invalidCode: "INIT_DATA_INVALID" },
    ...CASE4_SCHEMES.map((scheme) => ({
      key: scheme,
      filename: CASE4_TRAJECTORY_FILES[scheme],
      invalidCode: "TRAJECTORY_DATA_INVALID",
    })),
  ].map((file) => ({
    ...file,
    path: path.join(dataDir, file.filename),
  }));
  const reflectionFile = {
    filename: CASE4_REFLECTION_FILE,
    path: path.join(dataDir, CASE4_REFLECTION_FILE),
  };

  async function readLiveReflectionWindow() {
    try {
      return await readReflectionWindow(reflectionFile, fsOps);
    } catch (error) {
      logger?.warn("case4 reflection live read failed", {
        caseId: "case4",
        reason: error?.message ?? String(error),
        code: isAppError(error) ? error.code : undefined,
      });
      return {
        changed: false,
        read: {
          missing: false,
          unread: true,
          complete: [],
          hasPendingTail: true,
        },
      };
    }
  }

  async function read(optionsForRead = {}) {
    const reflectionEnabled = Boolean(optionsForRead.reflection);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const before = await Promise.all(
        files.map((file) => statRequiredFile(file, fsOps)),
      );
      const texts = await Promise.all(
        files.map((file) => readRequiredUtf8(file, fsOps, file.invalidCode)),
      );
      const after = await Promise.all(
        files.map((file) => statRequiredFile(file, fsOps)),
      );
      const changed = before.some(
        (item, index) => !sameFileSnapshot(item, after[index]),
      );
      let reflectionWindow = null;
      if (reflectionEnabled) {
        reflectionWindow = await readLiveReflectionWindow();
      }
      if ((changed || reflectionWindow?.changed) && attempt < 3) continue;

      const basePoints = parseBaseRoute(texts[0], files[0].filename);
      const schemeParsed = {};
      for (let index = 1; index < files.length; index += 1) {
        const file = files[index];
        schemeParsed[file.key] = {
          filename: file.filename,
          ...parseRealtime(texts[index], file.filename),
        };
      }

      let snapshotValue = assembleTrajectory(basePoints, schemeParsed, {
        changed,
        logSubstitution,
      });
      if (reflectionEnabled) {
        logReflectionDiagnostics(
          logger,
          reflectionWindow.read.complete,
          seenReflection,
        );
        snapshotValue = attachLiveReflection(
          snapshotValue,
          reflectionWindow.read,
        );
      }
      await debugJsonl?.writeIfChanged(snapshotValue.points, { source: "live" });
      logger?.info("case4 trajectory snapshot read", {
        caseId: "case4",
        completeCount: snapshotValue.completeCount,
        pendingTail: snapshotValue.pendingTail,
        reflection: reflectionEnabled,
      });
      return {
        ok: true,
        ...snapshotValue,
      };
    }

    throw new AppError(
      500,
      "DATA_FILE_READ_FAILED",
      "failed to read case4 trajectory files",
    );
  }

  return { read };
}
