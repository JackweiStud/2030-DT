/**
 * Case3 运行中吞吐：每次只读指定侧 thrp 文件。
 * 不等待坐标/波束/reflection，不比较两路长度。
 */

import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";
import { AppError, isAppError } from "../../shared/errors.mjs";
import { CASE3_SIDE_FILES } from "./constants.mjs";
import {
  parsePhysicalLines,
  parseThroughputLine,
} from "./numeric-line.mjs";

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

function missing(filename, cause) {
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

async function statRequired(filePath, filename, fsOps) {
  try {
    return snapshot(await fsOps.stat(filePath, { bigint: true }));
  } catch (error) {
    if (error?.code === "ENOENT") throw missing(filename, error);
    throw readFailure(filename, error);
  }
}

async function readText(filePath, filename, fsOps) {
  try {
    const bytes = await fsOps.readFile(filePath);
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      throw new AppError(
        422,
        "SIDE_DATA_INVALID",
        `${filename} must be valid UTF-8`,
        { cause: error, details: { filename } },
      );
    }
  } catch (error) {
    if (isAppError(error)) throw error;
    if (error?.code === "ENOENT") throw missing(filename, error);
    throw readFailure(filename, error);
  }
}

function assembleThroughput(side, parsed, changed) {
  return {
    side,
    samples: parsed.complete.map((gbps, index) => ({
      no: index + 1,
      gbps,
    })),
    pendingTail: Boolean(changed || parsed.hasPendingTail),
  };
}

export function createCase3ThroughputService(options) {
  const sharedDir = options.sharedDir;
  const fsOps = options.fsOps ?? defaultFs;
  const logger = options.logger;
  const dataDir = path.join(sharedDir, "case3");

  async function read(side) {
    if (side !== "without" && side !== "with") {
      throw new AppError(400, "INVALID_SIDE", "side must be without or with");
    }
    const filename = CASE3_SIDE_FILES[side].throughput;
    const filePath = path.join(dataDir, filename);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const before = await statRequired(filePath, filename, fsOps);
      const text = await readText(filePath, filename, fsOps);
      const after = await statRequired(filePath, filename, fsOps);
      const changed = !sameSnapshot(before, after);
      if (changed && attempt < 3) continue;

      const parsed = parsePhysicalLines(text, filename, parseThroughputLine);
      const snapshotValue = assembleThroughput(side, parsed, changed);
      logger?.info("case3 throughput snapshot read", {
        caseId: "case3",
        side,
        sampleCount: snapshotValue.samples.length,
        pendingTail: snapshotValue.pendingTail,
      });
      return {
        ok: true,
        ...snapshotValue,
      };
    }

    throw new AppError(
      500,
      "DATA_FILE_READ_FAILED",
      `failed to read ${filename}`,
    );
  }

  return { read };
}
