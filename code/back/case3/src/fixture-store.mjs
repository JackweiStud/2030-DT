/**
 * Stub fixture 的独立预检与初始化 seed。
 * 该模块故意不 import Node 适配服务解析器，避免双方同错而测试失真。
 */

import { promises as defaultFs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { INIT_FILES, POINT_KEYS, SIDE_FILES } from "./constants.mjs";
import { StubError } from "./errors.mjs";

const NUMBER_TOKEN =
  /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;
const INTEGER_TOKEN = /^[+-]?\d+$/;
const LOCAL_COST = Object.freeze({ without: 25, with: 15 });

function invalid(filename, message) {
  throw new StubError("FIXTURE_INVALID", `${filename}: ${message}`, {
    filename,
  });
}

function linesOf(text, filename) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  while (lines.length > 0 && lines.at(-1).trim() === "") lines.pop();
  if (lines.length === 0 || lines.some((line) => line.trim() === "")) {
    invalid(filename, "必须包含非空连续行");
  }
  return lines.map((line) => line.trim());
}

function optionalLinesOf(text, filename) {
  if (text.trim() === "") return [];
  return linesOf(text, filename);
}

function finite(token, filename, label) {
  if (!NUMBER_TOKEN.test(token)) invalid(filename, `${label} 不是合法数值`);
  const value = Number(token);
  if (!Number.isFinite(value)) invalid(filename, `${label} 必须是有限数`);
  return value;
}

function integer(token, filename, label) {
  if (!INTEGER_TOKEN.test(token)) invalid(filename, `${label} 必须是整数`);
  const value = Number(token);
  if (!Number.isSafeInteger(value)) invalid(filename, `${label} 超出安全整数`);
  return value;
}

function csv(line) {
  return line.split(",").map((token) => token.trim());
}

function coordinate(line, filename, expected = 3) {
  const tokens = csv(line);
  if (tokens.length !== expected || tokens.some((token) => token === "")) {
    invalid(filename, `每行必须恰好 ${expected} 列`);
  }
  return tokens.slice(0, 3).map((token, index) =>
    finite(token, filename, `坐标 ${index}`),
  );
}

function selected(line, filename) {
  const value = integer(line, filename, "selected beam");
  if (value < 0 || value > 255) invalid(filename, "selected beam 越界");
  return value;
}

function throughput(line, filename) {
  const value = finite(line, filename, "Throughput");
  if (value < 0) invalid(filename, "Throughput 不能为负");
  return value;
}

function scan(line, filename) {
  const tokens = csv(line);
  if (tokens.length !== 16) invalid(filename, "scan 必须恰好 16 项");
  const values = tokens.map((token) => {
    const value = integer(token, filename, "scan beam");
    if (value < 0 || value > 255) invalid(filename, "scan beam 越界");
    return value;
  });
  if (new Set(values).size !== 16) invalid(filename, "scan beam 必须互不重复");
  return values;
}

function reflection(line, filename) {
  coordinate(line, filename, 4);
  const flag = integer(csv(line)[3], filename, "Reflection flag");
  if (flag !== 0 && flag !== 1) invalid(filename, "Reflection flag 只能是 0/1");
}

export function validateInitContent(kind, text, filename) {
  const lines = linesOf(text, filename);
  if (kind === "baseRoute") {
    lines.forEach((line) => coordinate(line, filename));
    return;
  }
  const tokens = csv(lines[0]);
  if (lines.length !== 1 || tokens.length !== 2) {
    invalid(filename, "Beam Accuracy 必须是 success,total");
  }
  const success = integer(tokens[0], filename, "success");
  const total = integer(tokens[1], filename, "total");
  if (success < 0 || total < 1 || success > total) {
    invalid(filename, "Beam Accuracy 必须满足 0<=success<=total 且 total>0");
  }
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

function validateSide(side, contents) {
  const files = SIDE_FILES[side];
  const rows = {};
  const throughputLines = optionalLinesOf(
    contents.throughput,
    files.throughput,
  );
  const throughputValues = throughputLines.map((line) =>
    throughput(line, files.throughput),
  );
  for (const key of POINT_KEYS[side]) {
    rows[key] = linesOf(contents[key], files[key]);
  }
  const count = rows[POINT_KEYS[side][0]].length;
  if (
    count === 0 ||
    POINT_KEYS[side].some((key) => rows[key].length !== count)
  ) {
    invalid(files.coordinates, `${side} 结构文件行数必须一致且大于 0`);
  }

  for (let index = 0; index < count; index += 1) {
    coordinate(rows.coordinates[index], files.coordinates);
    const selectedBeam = selected(rows.selected[index], files.selected);
    if (side === "without") {
      const scanBeams = scan(rows.scans[index], files.scans);
      if (!scanBeams.includes(selectedBeam)) {
        invalid(files.scans, `第 ${index + 1} 行不包含同索引 selected beam`);
      }
    } else {
      reflection(rows.reflection[index], files.reflection);
    }
  }

  const costLines = linesOf(contents.cost, files.cost);
  if (costLines.length !== 1) invalid(files.cost, "Cost fixture 必须只有一行");
  const cost = finite(costLines[0], files.cost, "Cost");
  if (cost !== LOCAL_COST[side]) {
    invalid(files.cost, `本地 Cost override 必须精确为 ${LOCAL_COST[side]}`);
  }
  return {
    rows,
    throughputLines,
    throughputValues,
    cost,
    costLine: costLines[0],
    count,
  };
}

/** 一次性加载并预检全部 fixture，运行中只使用内存快照。 */
export async function loadFixtureStore(options) {
  const fsOps = options.fsOps ?? defaultFs;
  const fixtureDir = path.resolve(options.fixtureDir);
  const init = {};

  for (const [kind, filename] of Object.entries(INIT_FILES)) {
    const text = await readFixture(fixtureDir, filename, fsOps);
    validateInitContent(kind, text, filename);
    init[kind] = { filename, text };
  }

  const sides = {};
  for (const side of ["without", "with"]) {
    const contents = {};
    for (const [key, filename] of Object.entries(SIDE_FILES[side])) {
      contents[key] = await readFixture(fixtureDir, filename, fsOps);
    }
    sides[side] = validateSide(side, contents);
  }

  return {
    fixtureDir,
    init,
    sides,
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

/**
 * 只 seed 两个初始化文件：缺失才创建，已有合法文件绝不覆盖。
 */
export async function seedInitFiles(options) {
  const fsOps = options.fsOps ?? defaultFs;
  const logger = options.logger;
  const targetDir = path.join(options.sharedDir, "case3");
  await fsOps.mkdir(targetDir, { recursive: true });
  const actions = {};

  for (const [kind, fixture] of Object.entries(options.fixtureStore.init)) {
    const targetPath = path.join(targetDir, fixture.filename);
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
      try {
        validateInitContent(kind, existing, fixture.filename);
      } catch (error) {
        throw new StubError(
          "SEED_TARGET_INVALID",
          `已有初始化文件非法：${fixture.filename}`,
          { cause: error },
        );
      }
      actions[kind] = "skippedExisting";
      continue;
    }

    try {
      await writeNewFileAtomically(targetPath, fixture.text, fsOps);
      actions[kind] = "created";
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw new StubError("SEED_TARGET_INVALID", `seed 失败：${fixture.filename}`, {
          cause: error,
        });
      }
      const raced = await fsOps.readFile(targetPath, "utf8");
      validateInitContent(kind, raced, fixture.filename);
      actions[kind] = "skippedExisting";
    }
  }

  logger?.info("seed-initialization", {
    event: "seed",
    seedAction: actions,
    dataSource: "reference-derived",
  });
  return actions;
}
