/**
 * Case4 最终结果：一次读取 base + 九个动态文件。
 * 仅本接口执行 complete 控制上下文与稳定性门槛。
 * 反射不进入该门槛：九文件快照成功后再尽力附加。
 */

import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { AppError } from "../../shared/errors.mjs";
import {
  CASE4_BASE_FILE,
  CASE4_CDF_FILES,
  CASE4_REFLECTION_FILE,
  CASE4_SCHEMES,
  CASE4_SUMMARY_FILE,
  CASE4_THROUGHPUT_FILES,
  CASE4_TRAJECTORY_FILES,
} from "./constants.mjs";
import {
  attachResultReflection,
  emptyReflectionRead,
  logReflectionDiagnostics,
  readReflectionWindow,
  toPublicReflection,
} from "./reflection-file.mjs";
import {
  assembleThroughput,
  assembleTrajectory,
  interpretSummaryRecords,
  parseBaseRoute,
  parseCdfFile,
  parseCoordinateRaw,
  parsePhysicalLines,
  parseSummaryFile,
  parseThroughputRaw,
  readRequiredUtf8,
  sameFileSnapshot,
  statRequiredFile,
} from "./numeric-file.mjs";

function notReady(message) {
  return new AppError(409, "RESULT_NOT_READY", message);
}

function isCompleteContext(control) {
  return (
    control.case === "case4" &&
    control.command === "start" &&
    control.dt_type === "all" &&
    control.status === "case complete"
  );
}

function sameControlWindow(left, right) {
  return (
    left.case === right.case &&
    left.command === right.command &&
    left.dt_type === right.dt_type &&
    left.status === right.status
  );
}

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

function parseThroughputFile(text, filename) {
  const parser = (line, currentFilename) =>
    parseThroughputRaw(line, currentFilename);
  parser.invalidCode = "THROUGHPUT_DATA_INVALID";
  return parsePhysicalLines(
    text,
    filename,
    parser,
    "THROUGHPUT_DATA_INVALID",
  );
}

export function createCase4ResultService(options) {
  const sharedDir = options.sharedDir;
  const controlFile = options.controlFile;
  const fsOps = options.fsOps ?? defaultFs;
  const logger = options.logger;
  const debugJsonl = options.debugJsonl;
  const logSubstitution = options.logSubstitution;
  const dataDir = path.join(sharedDir, "case4");
  const seenReflection = new Set();
  const reflectionFile = {
    filename: CASE4_REFLECTION_FILE,
    path: path.join(dataDir, CASE4_REFLECTION_FILE),
  };

  const files = [
    { key: "base", filename: CASE4_BASE_FILE, invalidCode: "INIT_DATA_INVALID" },
    ...CASE4_SCHEMES.map((scheme) => ({
      key: `traj:${scheme}`,
      filename: CASE4_TRAJECTORY_FILES[scheme],
      invalidCode: "TRAJECTORY_DATA_INVALID",
    })),
    {
      key: "thrp:without",
      filename: CASE4_THROUGHPUT_FILES.without,
      invalidCode: "THROUGHPUT_DATA_INVALID",
    },
    {
      key: "thrp:with",
      filename: CASE4_THROUGHPUT_FILES.with,
      invalidCode: "THROUGHPUT_DATA_INVALID",
    },
    ...CASE4_SCHEMES.map((scheme) => ({
      key: `cdf:${scheme}`,
      filename: CASE4_CDF_FILES[scheme],
      invalidCode: "STATISTICS_DATA_INVALID",
    })),
    {
      key: "summary",
      filename: CASE4_SUMMARY_FILE,
      invalidCode: "STATISTICS_DATA_INVALID",
    },
  ].map((file) => ({
    ...file,
    path: path.join(dataDir, file.filename),
  }));

  async function readReflectionInWindow() {
    try {
      return await readReflectionWindow(reflectionFile, fsOps);
    } catch (error) {
      logger?.warn("case4 reflection result attach failed", {
        caseId: "case4",
        reason: error?.message ?? String(error),
      });
      return {
        changed: false,
        read: emptyReflectionRead({ unread: true }),
      };
    }
  }

  async function attachReflectionBestEffort(trajectory, reflectionRead) {
    try {
      logReflectionDiagnostics(logger, reflectionRead.complete, seenReflection);
      return attachResultReflection(trajectory, reflectionRead);
    } catch (error) {
      logger?.warn("case4 reflection result attach failed", {
        caseId: "case4",
        reason: error?.message ?? String(error),
      });
      return {
        ...trajectory,
        points: trajectory.points.map((point) => ({
          ...point,
          reflection: toPublicReflection(null),
        })),
      };
    }
  }

  async function read(optionsForRead = {}) {
    const reflectionEnabled = Boolean(optionsForRead.reflection);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const controlBefore = await controlFile.read();
      const before = await Promise.all(
        files.map((file) => statRequiredFile(file, fsOps)),
      );
      const texts = await Promise.all(
        files.map((file) => readRequiredUtf8(file, fsOps, file.invalidCode)),
      );
      const after = await Promise.all(
        files.map((file) => statRequiredFile(file, fsOps)),
      );
      const controlAfter = await controlFile.read();
      const filesChanged = before.some(
        (item, index) => !sameFileSnapshot(item, after[index]),
      );
      const controlChanged = !sameControlWindow(controlBefore, controlAfter);
      if ((filesChanged || controlChanged) && attempt < 3) {
        continue;
      }
      if (filesChanged || controlChanged) {
        throw notReady("final case4 snapshot changed while being read");
      }
      if (!isCompleteContext(controlBefore) || !isCompleteContext(controlAfter)) {
        throw notReady("final case4 control context is not case complete");
      }

      const byKey = Object.fromEntries(
        files.map((file, index) => [file.key, texts[index]]),
      );
      const basePoints = parseBaseRoute(byKey.base, CASE4_BASE_FILE);
      const schemeParsed = {};
      for (const scheme of CASE4_SCHEMES) {
        schemeParsed[scheme] = {
          filename: CASE4_TRAJECTORY_FILES[scheme],
          ...parseRealtime(byKey[`traj:${scheme}`], CASE4_TRAJECTORY_FILES[scheme]),
        };
      }
      const trajectory = assembleTrajectory(basePoints, schemeParsed, {
        changed: false,
        logSubstitution,
      });
      if (
        trajectory.completeCount === 0 ||
        trajectory.pendingTail ||
        CASE4_SCHEMES.some(
          (scheme) =>
            schemeParsed[scheme].complete.length !== trajectory.completeCount,
        )
      ) {
        throw notReady("final trajectory is empty, pending, or unequal");
      }

      const withoutThrp = assembleThroughput(
        "without",
        parseThroughputFile(
          byKey["thrp:without"],
          CASE4_THROUGHPUT_FILES.without,
        ),
        false,
      );
      const withThrp = assembleThroughput(
        "with",
        parseThroughputFile(byKey["thrp:with"], CASE4_THROUGHPUT_FILES.with),
        false,
      );
      if (withoutThrp.pendingTail || withThrp.pendingTail) {
        throw notReady("final throughput has a pending tail");
      }

      const cdf = {};
      for (const scheme of CASE4_SCHEMES) {
        const parsed = parseCdfFile(byKey[`cdf:${scheme}`], CASE4_CDF_FILES[scheme]);
        if (parsed.hasPendingTail || parsed.complete.length === 0) {
          throw notReady(`final ${scheme} CDF is pending or empty`);
        }
        cdf[scheme] = parsed.complete;
      }

      const summaryParsed = parseSummaryFile(byKey.summary, CASE4_SUMMARY_FILE);
      if (summaryParsed.hasPendingTail) {
        throw notReady("final CEP/NLOS summary has a pending tail");
      }
      const summary = interpretSummaryRecords(
        summaryParsed.complete,
        CASE4_SUMMARY_FILE,
      );

      let finalTrajectory = trajectory;
      if (reflectionEnabled) {
        const reflectionWindow = await readReflectionInWindow();
        if (reflectionWindow.changed) {
          logger?.warn("case4 reflection result snapshot drifted", {
            caseId: "case4",
            reason: "reflection file changed while being read",
          });
        }
        finalTrajectory = await attachReflectionBestEffort(
          trajectory,
          reflectionWindow.read,
        );
      }
      await debugJsonl?.writeIfChanged(finalTrajectory.points, {
        source: "result",
      });
      logger?.info("case4 result snapshot read", {
        caseId: "case4",
        completeCount: finalTrajectory.completeCount,
        thrpWithout: withoutThrp.samples.length,
        thrpWith: withThrp.samples.length,
        reflection: reflectionEnabled,
        final: true,
      });
      return {
        ok: true,
        trajectory: finalTrajectory,
        throughput: {
          without: {
            samples: withoutThrp.samples,
            pendingTail: withoutThrp.pendingTail,
          },
          with: {
            samples: withThrp.samples,
            pendingTail: withThrp.pendingTail,
          },
        },
        statistics: {
          cdf,
          cep: summary.cep,
          nlosRatio: summary.nlosRatio,
        },
      };
    }

    throw new AppError(
      500,
      "DATA_FILE_READ_FAILED",
      "failed to read case4 result files",
    );
  }

  return { read };
}
