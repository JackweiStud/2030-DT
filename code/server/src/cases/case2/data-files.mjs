import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";
import { AppError, isAppError } from "../../shared/errors.mjs";
import { METRIC_FILES } from "./constants.mjs";
import { parseHeatmap, parseKpi } from "./numeric-file.mjs";
import { DEFAULT_CASE2_RANGES, rangeForFile } from "./value-ranges.mjs";

// case2 的 data-files 服务只负责读取共享目录中的数据文件并做整批校验。
// Initial 只校验文件本身；Calibrated 额外要做控制快照 A/B 对比，
// 用来避免读到半写完、被并发改写或已经失效的结果批次。
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

function isCase2CalibratedControl(control) {
  return (
    control.case === "case2" &&
    control.command === "start" &&
    control.dt_type === "with dt" &&
    control.status === "case complete"
  );
}

// Calibrated 批次缺文件时不能按普通 404 处理，必须统一视为批次未完成。
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
  // 只取 size 和 mtime，用来判断文件在读取前后是否发生变化。
  try {
    return fileSnapshot(await fsOps.stat(file.path, { bigint: true }));
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw missingError(phase, file.filename, error);
    }
    throw readFailure(file.filename, error);
  }
}

async function readParsed(file, phase, fsOps, ranges, logger) {
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
  const range = rangeForFile(ranges, file.metric, file.kind);
  const parseOptions = {
    onOutOfRange(info) {
      logger.warn("case2 data values out of range", info);
    },
  };
  return file.kind === "heatmap"
    ? parseHeatmap(text, file.filename, range, parseOptions)
    : parseKpi(text, file.filename, range, parseOptions);
}

// 把 6 个文件的解析结果重新组装回每个指标对应的 heatmap/kpi 结构。
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
  const ranges = options.ranges ?? DEFAULT_CASE2_RANGES;

  async function readPhase(phase) {
    // 先拦住非法 phase，避免把错误参数带进文件读逻辑。
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
        // Calibrated 先看控制文件；不是本 Case 本轮完成批次，直接判定批次未完成。
        const firstControl = await controlFile.read();
        if (!isCase2CalibratedControl(firstControl)) {
          throw new AppError(
            409,
            "RESULT_BATCH_INCOMPLETE",
            "calibrated batch is unavailable before case2 start with dt completes",
          );
        }
      }

      // Calibrated 读取前先记一次文件快照，后面用来判断是否被并发改写。
      const firstStats =
        phase === "calibrated"
          ? await Promise.all(files.map((file) => statRequired(file, phase, fsOps)))
          : undefined;

      // 逐个读取并解析 6 个文件；任何读/解析错误都会进入统一错误处理。
      const values = [];
      for (const file of files) {
        values.push(await readParsed(file, phase, fsOps, ranges, logger));
      }

      if (phase === "calibrated") {
        // 读完再记一次快照，和第一次比较，防止读到中途被改写的批次。
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

        // 再读一次控制文件，确认整批读取期间仍然归属 Case2 本轮完成批次。
        const secondControl = await controlFile.read();
        if (!isCase2CalibratedControl(secondControl)) {
          throw new AppError(
            409,
            "RESULT_BATCH_INCOMPLETE",
            "control tuple changed while the calibrated batch was read",
          );
        }
      }

      // 只有通过全部校验后，才把这一批数据返回给前端。
      const metrics = assembleMetrics(files, values);
      const firstHeatmap = metrics.rss?.heatmap ?? [];
      const firstKpi = metrics.rss?.kpi ?? [];
      logger.info("case2 data batch read", {
        phase,
        nx: firstHeatmap[0]?.length ?? 0,
        ny: firstHeatmap.length,
        kpiN: firstKpi.length,
      });
      return {
        ok: true,
        phase,
        metrics,
      };
    } catch (error) {
      const normalized = isAppError(error)
        ? error
        : new AppError(500, "DATA_FILE_READ_FAILED", "failed to read data batch", {
            cause: error,
          });
      // 所有失败都打一条诊断日志，便于追踪缺文件、改写、解析或 I/O 问题。
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
