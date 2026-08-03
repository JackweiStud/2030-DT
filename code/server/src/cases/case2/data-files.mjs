import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";
import { AppError, isAppError } from "../../shared/errors.mjs";
import { METRIC_FILES } from "./constants.mjs";
import { parseHeatmap, parseKpi } from "./numeric-file.mjs";

function fileDefinitions(phase, sharedDir) {
  const dataDir = path.join(sharedDir, "case2");
  return Object.entries(METRIC_FILES).flatMap(([metric, phases]) => [
    {
      metric,
      kind: "heatmap",
      filename: phases[phase].heatmap,
      path: path.join(dataDir, phases[phase].heatmap),
    },
    {
      metric,
      kind: "kpi",
      filename: phases[phase].kpi,
      path: path.join(dataDir, phases[phase].kpi),
    },
  ]);
}

function fileSnapshot(stat) {
  return {
    size: stat.size,
    mtimeNs:
      stat.mtimeNs ??
      BigInt(Math.trunc(Number(stat.mtimeMs) * 1_000_000)),
  };
}

function sameSnapshot(left, right) {
  return left.size === right.size && left.mtimeNs === right.mtimeNs;
}

function missingError(phase, filename, cause) {
  if (phase === "calibrated") {
    return new AppError(
      409,
      "RESULT_BATCH_INCOMPLETE",
      `${filename} is missing from the calibrated batch`,
      { cause, details: { filename } },
    );
  }
  return new AppError(404, "DATA_FILE_MISSING", `${filename} is missing`, {
    cause,
    details: { filename },
  });
}

function readFailure(filename, cause) {
  return new AppError(
    500,
    "DATA_FILE_READ_FAILED",
    `failed to read ${filename}`,
    { cause, details: { filename } },
  );
}

async function statRequired(file, phase, fsOps) {
  try {
    return fileSnapshot(await fsOps.stat(file.path, { bigint: true }));
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw missingError(phase, file.filename, error);
    }
    throw readFailure(file.filename, error);
  }
}

async function readParsed(file, phase, fsOps) {
  let bytes;
  try {
    bytes = await fsOps.readFile(file.path);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw missingError(phase, file.filename, error);
    }
    throw readFailure(file.filename, error);
  }

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new AppError(
      422,
      "DATA_FILE_INVALID",
      `${file.filename} must be valid UTF-8 text`,
      { cause: error, details: { filename: file.filename } },
    );
  }
  return file.kind === "heatmap"
    ? parseHeatmap(text, file.filename)
    : parseKpi(text, file.filename);
}

function assembleMetrics(files, values) {
  const metrics = {};
  files.forEach((file, index) => {
    metrics[file.metric] ??= {};
    metrics[file.metric][file.kind] = values[index];
  });
  return metrics;
}

/**
 * 读取 Initial 时做完整六文件校验；读取 Calibrated 时额外执行
 * “控制快照 A -> 文件快照 A -> 读取 -> 文件快照 B -> 控制快照 B”。
 */
export function createDataFilesService(options) {
  const sharedDir = options.sharedDir;
  const controlFile = options.controlFile;
  const fsOps = options.fsOps ?? defaultFs;
  const logger = options.logger;

  async function readPhase(phase) {
    if (phase !== "initial" && phase !== "calibrated") {
      throw new AppError(
        400,
        "INVALID_REQUEST",
        "phase must be initial or calibrated",
      );
    }

    const files = fileDefinitions(phase, sharedDir);
    try {
      if (phase === "calibrated") {
        const firstControl = await controlFile.read();
        if (firstControl.status !== "case complete") {
          throw new AppError(
            409,
            "RESULT_BATCH_INCOMPLETE",
            'calibrated batch is unavailable before status="case complete"',
          );
        }
      }

      const firstStats =
        phase === "calibrated"
          ? await Promise.all(files.map((file) => statRequired(file, phase, fsOps)))
          : undefined;

      const values = [];
      for (const file of files) {
        values.push(await readParsed(file, phase, fsOps));
      }

      if (phase === "calibrated") {
        const secondStats = await Promise.all(
          files.map((file) => statRequired(file, phase, fsOps)),
        );
        const changedIndex = firstStats.findIndex(
          (snapshot, index) => !sameSnapshot(snapshot, secondStats[index]),
        );
        if (changedIndex !== -1) {
          throw new AppError(
            409,
            "RESULT_BATCH_INCOMPLETE",
            `${files[changedIndex].filename} changed while the batch was read`,
            { details: { filename: files[changedIndex].filename } },
          );
        }

        const secondControl = await controlFile.read();
        if (secondControl.status !== "case complete") {
          throw new AppError(
            409,
            "RESULT_BATCH_INCOMPLETE",
            "control status changed while the calibrated batch was read",
          );
        }
      }

      return {
        ok: true,
        phase,
        metrics: assembleMetrics(files, values),
      };
    } catch (error) {
      const normalized = isAppError(error)
        ? error
        : new AppError(500, "DATA_FILE_READ_FAILED", "failed to read data batch", {
            cause: error,
          });
      logger.error("case2 data batch rejected", {
        phase,
        filename: normalized.details?.filename,
        code: normalized.code,
        reason: normalized.message,
      });
      throw normalized;
    }
  }

  return { readPhase };
}
