/**
 * Stub fixture 的独立预检与初始化 seed。
 * 该模块故意不 import Node 适配服务解析器，避免双方同错而测试失真。
 */

import { promises as defaultFs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import process from "node:process";
import {
  BASE_FILE,
  CDF_FILES,
  SCHEMES,
  SUMMARY_FILE,
  THROUGHPUT_FILES,
  THR_SIDES,
  TRAJECTORY_FILES,
} from "./constants.mjs";
import { StubError } from "./errors.mjs";

const NUMBER_TOKEN =
  /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;

function invalid(filename, message) {
  throw new StubError("FIXTURE_INVALID", `${filename}: ${message}`, {
    filename,
  });
}

export function isSentinel(value) {
  return value === 65535;
}

export function recordLines(text, filename, { allowEmpty = false } = {}) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  while (lines.length > 0 && lines.at(-1).trim() === "") lines.pop();
  if (lines.length === 0) {
    if (allowEmpty) return [];
    invalid(filename, "必须包含非空连续行");
  }
  if (lines.some((line) => line.trim() === "")) {
    invalid(filename, "记录中间不能有空行");
  }
  return lines.map((line) => line.trim());
}

function finite(token, filename, label) {
  if (!NUMBER_TOKEN.test(token)) invalid(filename, `${label} 不是合法数值`);
  const value = Number(token);
  if (!Number.isFinite(value)) invalid(filename, `${label} 必须是有限数`);
  return value;
}

function csv3(line, filename) {
  const tokens = line.split(",").map((token) => token.trim());
  if (tokens.length !== 3 || tokens.some((token) => token === "")) {
    invalid(filename, "每行必须恰好 3 个逗号字段");
  }
  return tokens;
}

export function parseCoordinateLine(line, filename) {
  const tokens = csv3(line, filename);
  return {
    tokens,
    values: tokens.map((token, index) =>
      finite(token, filename, `坐标 ${index}`),
    ),
  };
}

function parseThroughputLine(line, filename) {
  const value = finite(line.trim(), filename, "Throughput");
  if (value < 0) invalid(filename, "Throughput 不能为负");
  return value;
}

export function detectSeparator(line) {
  return line.includes(",") ? "comma" : "whitespace";
}

export function splitTwoColumns(line, filename, separator) {
  const tokens =
    separator === "comma"
      ? line.split(",").map((token) => token.trim())
      : line.trim().split(/\s+/);
  if (tokens.length !== 2 || tokens.some((token) => token === "")) {
    invalid(filename, "每行必须恰好 2 列，且文件内分隔符一致");
  }
  if (separator === "whitespace" && line.includes(",")) {
    invalid(filename, "同一文件不得混用逗号与空白分隔符");
  }
  if (separator === "comma" && tokens.length !== 2) {
    invalid(filename, "逗号分隔必须恰好 2 列");
  }
  return tokens;
}

function parseCdf(text, filename) {
  const lines = recordLines(text, filename);
  const separator = detectSeparator(lines[0]);
  const rows = lines.map((line) => {
    const tokens = splitTwoColumns(line, filename, separator);
    const errorM = finite(tokens[0], filename, "errorM");
    const probability = finite(tokens[1], filename, "probability");
    if (errorM < 0) invalid(filename, "errorM 不能为负");
    if (probability < 0 || probability > 1) {
      invalid(filename, "probability 必须在 [0,1]");
    }
    return { line, tokens, errorM, probability };
  });
  for (let index = 1; index < rows.length; index += 1) {
    if (
      rows[index].errorM < rows[index - 1].errorM ||
      rows[index].probability < rows[index - 1].probability
    ) {
      invalid(filename, "CDF 两列必须各自非递减");
    }
  }
  return { filename, separator, lines, rows };
}

function parseSummary(text, filename) {
  const lines = recordLines(text, filename);
  if (lines.length !== 4) invalid(filename, "汇总必须恰好 4 行");
  const separator = detectSeparator(lines[0]);
  const rows = lines.map((line, index) => {
    const tokens = splitTwoColumns(line, filename, separator);
    const left = finite(tokens[0], filename, `汇总 ${index + 1} 列1`);
    const right = finite(tokens[1], filename, `汇总 ${index + 1} 列2`);
    return { line, tokens, values: [left, right] };
  });
  for (let scheme = 0; scheme < 3; scheme += 1) {
    const [p50, p90] = rows[scheme].values;
    if (p50 < 0 || p90 < 0) invalid(filename, "CEP 必须非负");
    if (p50 > p90) invalid(filename, "p50M 必须 ≤ p90M");
  }
  const nlos = rows[3].values[0];
  if (nlos < 0 || nlos > 1) invalid(filename, "NLOS 必须在 [0,1]");
  return { filename, separator, lines, rows };
}

async function readFixture(fixtureDir, filename, fsOps) {
  try {
    return await fsOps.readFile(path.join(fixtureDir, filename), "utf8");
  } catch (error) {
    throw new StubError("FIXTURE_INVALID", `无法读取 fixture ${filename}`, {
      cause: error,
      filename,
    });
  }
}

function parseTrajectory(text, filename) {
  const lines = recordLines(text, filename);
  const points = lines.map((line) => {
    const parsed = parseCoordinateLine(line, filename);
    return { line, ...parsed };
  });
  return { filename, lines, points };
}

function parseBase(text, filename) {
  const parsed = parseTrajectory(text, filename);
  for (const point of parsed.points) {
    if (point.values.some(isSentinel)) {
      invalid(filename, "base 禁止 65535");
    }
  }
  return parsed;
}

function parseThroughput(text, filename) {
  const lines = recordLines(text, filename, { allowEmpty: true });
  const values = lines.map((line) => parseThroughputLine(line, filename));
  return { filename, lines, values };
}

/** 一次性加载并预检全部 fixture，运行中只使用内存快照。 */
export async function loadFixtureStore(options) {
  const fsOps = options.fsOps ?? defaultFs;
  const fixtureDir = path.resolve(options.fixtureDir);

  const baseText = await readFixture(fixtureDir, BASE_FILE, fsOps);
  const base = parseBase(baseText, BASE_FILE);

  const trajectories = {};
  for (const scheme of SCHEMES) {
    const filename = TRAJECTORY_FILES[scheme];
    const text = await readFixture(fixtureDir, filename, fsOps);
    trajectories[scheme] = parseTrajectory(text, filename);
  }

  const trad = trajectories.traditional.lines.length;
  const comm = trajectories.commercial.lines.length;
  const dt = trajectories.dt.lines.length;
  if (trad === 0 || trad !== comm || trad !== dt) {
    invalid(
      TRAJECTORY_FILES.traditional,
      "三轨迹行数必须相同且大于 0",
    );
  }
  if (trad > base.lines.length) {
    invalid(TRAJECTORY_FILES.traditional, "轨迹行数不能超过 base");
  }

  const throughputs = {};
  for (const side of THR_SIDES) {
    const filename = THROUGHPUT_FILES[side];
    const text = await readFixture(fixtureDir, filename, fsOps);
    throughputs[side] = parseThroughput(text, filename);
  }

  const cdf = {};
  for (const scheme of SCHEMES) {
    const filename = CDF_FILES[scheme];
    const text = await readFixture(fixtureDir, filename, fsOps);
    cdf[scheme] = parseCdf(text, filename);
  }

  const summaryText = await readFixture(fixtureDir, SUMMARY_FILE, fsOps);
  const summary = parseSummary(summaryText, SUMMARY_FILE);

  return {
    fixtureDir,
    base,
    trajectories,
    throughputs,
    statistics: { cdf, summary },
    dataSource: "fixture-template",
  };
}

async function writeNewFileAtomically(targetPath, content, fsOps) {
  const temporaryPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await fsOps.open(temporaryPath, "wx", 0o600);
    await handle.writeFile(content);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fsOps.link(temporaryPath, targetPath);
  } finally {
    if (handle) await handle.close().catch(() => undefined);
    await fsOps.unlink(temporaryPath).catch(() => undefined);
  }
}

function baseValuesEqual(left, right) {
  if (left.length !== right.length) return false;
  return left.every((point, index) =>
    point.values.every((value, axis) => value === right[index].values[axis]),
  );
}

/**
 * 只 seed 缺失的 base：已有合法且解析一致则保留，非法或不匹配则退出。
 */
export async function seedInitFiles(options) {
  const fsOps = options.fsOps ?? defaultFs;
  const logger = options.logger;
  const targetDir = path.join(options.sharedDir, "case4");
  await fsOps.mkdir(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, BASE_FILE);
  const fixture = options.fixtureStore.base;
  const content = `${fixture.lines.join("\n")}\n`;

  let existing;
  try {
    existing = await fsOps.readFile(targetPath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw new StubError("SEED_TARGET_INVALID", `无法读取 ${targetPath}`, {
        cause: error,
      });
    }
  }

  if (existing !== undefined) {
    let parsed;
    try {
      parsed = parseBase(existing, BASE_FILE);
    } catch (error) {
      throw new StubError(
        "SEED_TARGET_INVALID",
        `已有初始化文件非法：${BASE_FILE}`,
        { cause: error },
      );
    }
    if (!baseValuesEqual(parsed.points, fixture.points)) {
      throw new StubError(
        "SEED_BASE_MISMATCH",
        "共享 base 与 fixture 解析结果不一致",
      );
    }
    logger?.info("seed-initialization", {
      event: "seed",
      seedAction: "skippedExisting",
      dataSource: "reference-derived",
    });
    return { base: "skippedExisting" };
  }

  try {
    await writeNewFileAtomically(targetPath, content, fsOps);
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw new StubError("SEED_TARGET_INVALID", `seed 失败：${BASE_FILE}`, {
        cause: error,
      });
    }
    const raced = await fsOps.readFile(targetPath, "utf8");
    const parsed = parseBase(raced, BASE_FILE);
    if (!baseValuesEqual(parsed.points, fixture.points)) {
      throw new StubError(
        "SEED_BASE_MISMATCH",
        "共享 base 与 fixture 解析结果不一致",
      );
    }
    logger?.info("seed-initialization", {
      event: "seed",
      seedAction: "skippedExisting",
      dataSource: "reference-derived",
    });
    return { base: "skippedExisting" };
  }

  logger?.info("seed-initialization", {
    event: "seed",
    seedAction: "created",
    dataSource: "reference-derived",
  });
  return { base: "created" };
}

export function parseBaseText(text) {
  return parseBase(text, BASE_FILE);
}
