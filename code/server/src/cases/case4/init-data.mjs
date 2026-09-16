/**
 * Case4 初始化：只稳定读取预期轨迹 base。
 * 连续三次仍变化则 DATA_FILE_READ_FAILED，不返回部分 baseRoute。
 */

import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { AppError } from "../../shared/errors.mjs";
import { CASE4_BASE_FILE } from "./constants.mjs";
import {
  parseBaseRoute,
  readRequiredUtf8,
  sameFileSnapshot,
  statRequiredFile,
} from "./numeric-file.mjs";

export function createCase4InitDataService(options) {
  const dataDir = path.join(options.sharedDir, "case4");
  const fsOps = options.fsOps ?? defaultFs;
  const file = {
    filename: CASE4_BASE_FILE,
    path: path.join(dataDir, CASE4_BASE_FILE),
  };

  async function read() {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const before = await statRequiredFile(file, fsOps);
      const text = await readRequiredUtf8(file, fsOps, "INIT_DATA_INVALID");
      const after = await statRequiredFile(file, fsOps);
      if (!sameFileSnapshot(before, after)) {
        if (attempt < 3) continue;
        throw new AppError(
          500,
          "DATA_FILE_READ_FAILED",
          "init files changed while being read",
        );
      }
      return {
        ok: true,
        baseRoute: parseBaseRoute(text, file.filename),
      };
    }
    throw new AppError(
      500,
      "DATA_FILE_READ_FAILED",
      "case4 init data could not be read",
    );
  }

  return { read };
}
