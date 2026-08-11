/**
 * Case3 初始化数据服务：稳定读取 base route 与 Beam Accuracy baseline。
 */

import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";
import { AppError, isAppError } from "../../shared/errors.mjs";
import { CASE3_INIT_FILES } from "./constants.mjs";
import {
  parseCoordinateLine,
  parseIntegerToken,
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

function initInvalid(filename, message, cause) {
  return new AppError(422, "INIT_DATA_INVALID", `${filename}: ${message}`, {
    cause,
    details: { filename },
  });
}

async function statRequired(file, fsOps) {
  try {
    return snapshot(await fsOps.stat(file.path, { bigint: true }));
  } catch (error) {
    if (error?.code === "ENOENT") throw missing(file.filename, error);
    throw readFailure(file.filename, error);
  }
}

async function readText(file, fsOps) {
  try {
    const bytes = await fsOps.readFile(file.path);
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      throw initInvalid(file.filename, "file must be valid UTF-8", error);
    }
  } catch (error) {
    if (isAppError(error)) throw error;
    if (error?.code === "ENOENT") throw missing(file.filename, error);
    throw readFailure(file.filename, error);
  }
}

function parseBaseRoute(text, filename) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "");
  if (lines.length === 0) throw initInvalid(filename, "base route is empty");
  return lines.map((line, index) => {
    try {
      return { no: index + 1, ...parseCoordinateLine(line, filename) };
    } catch (error) {
      throw initInvalid(filename, `invalid route row ${index + 1}`, error);
    }
  });
}

function parseBaseline(text, filename) {
  const first = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line !== "");
  if (!first) throw initInvalid(filename, "baseline is empty");
  const tokens = first.split(",").map((token) => token.trim());
  if (tokens.length !== 2 || tokens.some((token) => token === "")) {
    throw initInvalid(filename, "baseline must contain success,total");
  }
  let success;
  let total;
  try {
    success = parseIntegerToken(tokens[0], filename, "success");
    total = parseIntegerToken(tokens[1], filename, "total");
  } catch (error) {
    throw initInvalid(filename, "baseline must contain two integers", error);
  }
  if (success < 0 || total < 1 || success > total) {
    throw initInvalid(filename, "baseline requires 0 <= success <= total and total > 0");
  }
  return { success, total };
}

export function createInitDataService(options) {
  const dataDir = path.join(options.sharedDir, "case3");
  const fsOps = options.fsOps ?? defaultFs;
  const files = [
    {
      key: "baseRoute",
      filename: CASE3_INIT_FILES.baseRoute,
      path: path.join(dataDir, CASE3_INIT_FILES.baseRoute),
    },
    {
      key: "beamAccuracy",
      filename: CASE3_INIT_FILES.beamAccuracy,
      path: path.join(dataDir, CASE3_INIT_FILES.beamAccuracy),
    },
  ];

  async function read() {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const before = await Promise.all(files.map((file) => statRequired(file, fsOps)));
      const texts = await Promise.all(files.map((file) => readText(file, fsOps)));
      const after = await Promise.all(files.map((file) => statRequired(file, fsOps)));
      const stable = before.every((item, index) =>
        sameSnapshot(item, after[index]),
      );
      if (!stable) {
        if (attempt < 3) continue;
        throw new AppError(
          500,
          "DATA_FILE_READ_FAILED",
          "case3 init files changed while being read",
        );
      }
      return {
        ok: true,
        baseRoute: parseBaseRoute(texts[0], files[0].filename),
        beamAccuracyBaseline: parseBaseline(texts[1], files[1].filename),
      };
    }
    throw new AppError(
      500,
      "DATA_FILE_READ_FAILED",
      "case3 init data could not be read",
    );
  }

  return { read };
}
