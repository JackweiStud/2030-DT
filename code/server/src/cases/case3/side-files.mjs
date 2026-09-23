/**
 * Case3 单侧多 txt 收编服务。
 * 每次返回连续完整前缀 1..K；最终读取额外执行 complete 门槛。
 */

import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";
import { AppError, isAppError } from "../../shared/errors.mjs";
import {
  CASE3_SIDE_FILES,
  dtTypeForSide,
} from "./constants.mjs";
import {
  parseCoordinateLine,
  parseLatestCost,
  parsePhysicalLines,
  parseReflectionLine,
  parseScanBeamLine,
  parseSelectedBeamLine,
  parseThroughputLine,
} from "./numeric-line.mjs";

const PARSERS = Object.freeze({
  coordinates: parseCoordinateLine,
  scans: parseScanBeamLine,
  selected: parseSelectedBeamLine,
  throughput: parseThroughputLine,
  reflection: parseReflectionLine,
});

function snapshot(stat) {
  return {
    size: stat.size,
    mtimeNs:
      stat.mtimeNs ?? BigInt(Math.trunc(Number(stat.mtimeMs) * 1_000_000)),
  };
}

function sameSnapshot(left, right) {
  return left.size === right.size && left.mtimeNs === right.mtimeNs;
}

function sameControlTuple(left, right) {
  return (
    left.case === right.case &&
    left.command === right.command &&
    left.dt_type === right.dt_type
  );
}

function fileDefinitions(sharedDir, side) {
  const dataDir = path.join(sharedDir, "case3");
  return Object.entries(CASE3_SIDE_FILES[side])
    .filter(([key]) => key !== "optionalMse" && key !== "throughput")
    .map(([key, filename]) => ({
      key,
      filename,
      path: path.join(dataDir, filename),
    }));
}

function missing(file, cause) {
  return new AppError(404, "DATA_FILE_MISSING", `${file.filename} is missing`, {
    cause,
    details: { filename: file.filename },
  });
}

function readFailure(file, cause) {
  return new AppError(
    500,
    "DATA_FILE_READ_FAILED",
    `failed to read ${file.filename}`,
    { cause, details: { filename: file.filename } },
  );
}

async function statRequired(file, fsOps) {
  try {
    return snapshot(await fsOps.stat(file.path, { bigint: true }));
  } catch (error) {
    if (error?.code === "ENOENT") throw missing(file, error);
    throw readFailure(file, error);
  }
}

async function readText(file, fsOps) {
  try {
    const bytes = await fsOps.readFile(file.path);
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      throw new AppError(
        422,
        "SIDE_DATA_INVALID",
        `${file.filename} must be valid UTF-8`,
        { cause: error, details: { filename: file.filename } },
      );
    }
  } catch (error) {
    if (isAppError(error)) throw error;
    if (error?.code === "ENOENT") throw missing(file, error);
    throw readFailure(file, error);
  }
}

function assemble(side, parsed, changed) {
  const pointKeys =
    side === "without"
      ? ["coordinates", "scans", "selected"]
      : ["coordinates", "selected", "reflection"];
  const pointRows = pointKeys.map((key) => parsed[key].complete);
  const count = Math.min(...pointRows.map((rows) => rows.length));
  const unequal = pointRows.some((rows) => rows.length !== count);
  const physicalPending = Object.values(parsed).some(
    (value) => value.hasPendingTail,
  );
  const points = [];

  for (let index = 0; index < count; index += 1) {
    const selectedBeamId = parsed.selected.complete[index];
    const point = {
      no: index + 1,
      ue: parsed.coordinates.complete[index],
      selectedBeamId,
    };
    if (side === "without") {
      const scanBeamIds = parsed.scans.complete[index];
      const beamAbnormal = selectedBeamId === -1 || scanBeamIds.includes(-1);
      if (!beamAbnormal && !scanBeamIds.includes(selectedBeamId)) {
        throw new AppError(
          422,
          "SIDE_DATA_INVALID",
          `${CASE3_SIDE_FILES.without.scans}: row ${index + 1} does not contain selected beam`,
          { details: { filename: CASE3_SIDE_FILES.without.scans } },
        );
      }
      point.scanBeamIds = scanBeamIds;
    } else {
      point.reflection = parsed.reflection.complete[index];
    }
    points.push(point);
  }

  return {
    points,
    completeCount: count,
    pendingTail: changed || unequal || physicalPending,
    costPct: parsed.cost.value,
  };
}

export function createSideFilesService(options) {
  const sharedDir = options.sharedDir;
  const controlFile = options.controlFile;
  const debugJsonl = options.debugJsonl;
  const fsOps = options.fsOps ?? defaultFs;
  const logger = options.logger;

  async function readSide(side) {
    if (side !== "without" && side !== "with") {
      throw new AppError(400, "INVALID_SIDE", "side must be without or with");
    }
    const files = fileDefinitions(sharedDir, side);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const controlBefore = await controlFile.read();
      const before = await Promise.all(files.map((file) => statRequired(file, fsOps)));
      const texts = await Promise.all(files.map((file) => readText(file, fsOps)));
      const after = await Promise.all(files.map((file) => statRequired(file, fsOps)));
      const controlAfter = await controlFile.read();
      const changed = before.some(
        (item, index) => !sameSnapshot(item, after[index]),
      );
      if (changed && attempt < 3) continue;

      const parsed = {};
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        if (file.key === "cost") {
          parsed.cost = parseLatestCost(texts[index], file.filename);
        } else {
          parsed[file.key] = parsePhysicalLines(
            texts[index],
            file.filename,
            PARSERS[file.key],
          );
        }
      }

      const snapshotValue = assemble(side, parsed, changed);
      const isFinalRead =
        controlAfter.case === "case3" &&
        controlAfter.command === "start" &&
        controlAfter.dt_type === dtTypeForSide(side) &&
        controlAfter.status === "case complete";
      const controlDrift = !sameControlTuple(controlBefore, controlAfter);

      if (
        isFinalRead &&
        (snapshotValue.completeCount === 0 ||
          snapshotValue.pendingTail ||
          snapshotValue.costPct === null ||
          controlDrift)
      ) {
        throw new AppError(
          409,
          "RESULT_NOT_READY",
          `final ${side} snapshot is not complete`,
        );
      }

      await debugJsonl?.writeIfChanged(side, snapshotValue.points);
      logger.info("case3 side snapshot read", {
        caseId: "case3",
        side,
        completeCount: snapshotValue.completeCount,
        pendingTail: snapshotValue.pendingTail,
        hasCost: snapshotValue.costPct !== null,
        final: isFinalRead,
      });
      return {
        ok: true,
        side,
        ...snapshotValue,
      };
    }

    throw new AppError(
      500,
      "DATA_FILE_READ_FAILED",
      `failed to read ${side} files`,
    );
  }

  return { readSide };
}
