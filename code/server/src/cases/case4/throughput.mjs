/**
 * Case4 运行中吞吐：每次只读指定一路。
 * 不比较两路长度，不读轨迹。
 */

import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { AppError } from "../../shared/errors.mjs";
import { CASE4_THROUGHPUT_FILES } from "./constants.mjs";
import {
  assembleThroughput,
  parsePhysicalLines,
  parseThroughputRaw,
  readRequiredUtf8,
  sameFileSnapshot,
  statRequiredFile,
} from "./numeric-file.mjs";

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

export function createCase4ThroughputService(options) {
  const sharedDir = options.sharedDir;
  const fsOps = options.fsOps ?? defaultFs;
  const logger = options.logger;
  const dataDir = path.join(sharedDir, "case4");

  async function read(side) {
    if (side !== "without" && side !== "with") {
      throw new AppError(400, "INVALID_SIDE", "side must be without or with");
    }
    const file = {
      filename: CASE4_THROUGHPUT_FILES[side],
      path: path.join(dataDir, CASE4_THROUGHPUT_FILES[side]),
    };

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const before = await statRequiredFile(file, fsOps);
      const text = await readRequiredUtf8(
        file,
        fsOps,
        "THROUGHPUT_DATA_INVALID",
      );
      const after = await statRequiredFile(file, fsOps);
      const changed = !sameFileSnapshot(before, after);
      if (changed && attempt < 3) continue;

      const parsed = parseThroughputFile(text, file.filename);
      const snapshotValue = assembleThroughput(side, parsed, changed);
      logger?.info("case4 throughput snapshot read", {
        caseId: "case4",
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
      `failed to read ${file.filename}`,
    );
  }

  return { read };
}
