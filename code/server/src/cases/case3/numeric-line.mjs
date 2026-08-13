/**
 * Case3 单行词法与数值解析。
 * Node 是业务数值边界的唯一权威方；Web 只消费这里归一后的结果。
 */

import { AppError } from "../../shared/errors.mjs";

const NUMBER_TOKEN =
  /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;
const INTEGER_TOKEN = /^[+-]?\d+$/;

function invalid(filename, message) {
  return new AppError(422, "SIDE_DATA_INVALID", `${filename}: ${message}`, {
    details: { filename },
  });
}

export function roundSemanticNumber(value, digits) {
  const factor = 10 ** digits;
  const rounded =
    Math.sign(value) *
    (Math.round((Math.abs(value) + Number.EPSILON) * factor) / factor);
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function parseFiniteToken(token, filename, label, digits = 2) {
  if (!NUMBER_TOKEN.test(token)) {
    throw invalid(filename, `${label} contains invalid number ${token}`);
  }
  const value = Number(token);
  if (!Number.isFinite(value)) {
    throw invalid(filename, `${label} must be finite`);
  }
  return roundSemanticNumber(value, digits);
}

export function parseIntegerToken(token, filename, label) {
  if (!INTEGER_TOKEN.test(token)) {
    throw invalid(filename, `${label} must be a decimal integer`);
  }
  const value = Number(token);
  if (!Number.isSafeInteger(value)) {
    throw invalid(filename, `${label} must be a safe integer`);
  }
  return value;
}

function splitCsv(line) {
  return line.split(",").map((token) => token.trim());
}

export function parseCoordinateLine(line, filename) {
  const tokens = splitCsv(line);
  if (tokens.length !== 3 || tokens.some((token) => token === "")) {
    throw invalid(filename, "coordinate row must contain exactly x,y,z");
  }
  return {
    x: parseFiniteToken(tokens[0], filename, "x"),
    y: parseFiniteToken(tokens[1], filename, "y"),
    z: parseFiniteToken(tokens[2], filename, "z"),
  };
}

export function parseSelectedBeamLine(line, filename) {
  const tokens = splitCsv(line);
  if (tokens.length !== 1 || tokens[0] === "") {
    throw invalid(filename, "selected beam row must contain one integer");
  }
  const value = parseIntegerToken(tokens[0], filename, "selected beam");
  if (value < 0 || value > 255) {
    throw invalid(filename, "selected beam must be in [0,255]");
  }
  return value;
}

export function parseScanBeamLine(line, filename) {
  const tokens = splitCsv(line);
  if (tokens.length < 1 || tokens.some((token) => token === "")) {
    throw invalid(filename, "scan beam row must contain at least one integer");
  }
  return tokens.map((token, index) => {
    const value = parseIntegerToken(token, filename, `scan beam ${index}`);
    if (value < 0 || value > 255) {
      throw invalid(filename, "scan beams must be in [0,255]");
    }
    return value;
  });
}

export function parseThroughputLine(line, filename) {
  const tokens = splitCsv(line);
  if (tokens.length !== 1 || tokens[0] === "") {
    throw invalid(filename, "throughput row must contain one number");
  }
  const value = parseFiniteToken(tokens[0], filename, "throughput");
  if (value < 0) throw invalid(filename, "throughput must be non-negative");
  return value;
}

export function parseReflectionLine(line, filename) {
  const tokens = splitCsv(line);
  if (tokens.length !== 4 || tokens.some((token) => token === "")) {
    throw invalid(filename, "reflection row must contain x,y,z,flag");
  }
  const flag = parseIntegerToken(tokens[3], filename, "reflection flag");
  if (flag !== 0 && flag !== 1) {
    throw invalid(filename, "reflection flag must be 0 or 1");
  }
  return {
    x: parseFiniteToken(tokens[0], filename, "reflection x"),
    y: parseFiniteToken(tokens[1], filename, "reflection y"),
    z: parseFiniteToken(tokens[2], filename, "reflection z"),
    los: flag === 1,
  };
}

export function parseCostLine(line, filename) {
  const tokens = splitCsv(line);
  if (tokens.length !== 1 || tokens[0] === "") {
    throw invalid(filename, "cost row must contain one number");
  }
  const value = parseFiniteToken(tokens[0], filename, "cost", 1);
  if (value < 0 || value > 100) {
    throw invalid(filename, "cost must be in [0,100]");
  }
  return value;
}

/**
 * 已换行的行视为已提交，非法即 422；无换行尾段解析失败视为物理 pending。
 */
export function parsePhysicalLines(text, filename, parseLine) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (normalized === "") return { complete: [], hasPendingTail: false };
  const endsWithNewline = normalized.endsWith("\n");
  const segments = normalized.split("\n");
  if (endsWithNewline) segments.pop();

  const complete = [];
  for (let index = 0; index < segments.length; index += 1) {
    const line = segments[index];
    const isUncommittedTail = !endsWithNewline && index === segments.length - 1;
    if (line.trim() === "") {
      if (isUncommittedTail) return { complete, hasPendingTail: true };
      throw invalid(filename, `row ${index + 1} is empty`);
    }
    try {
      complete.push(parseLine(line, filename));
    } catch (error) {
      if (isUncommittedTail && error?.code === "SIDE_DATA_INVALID") {
        return { complete, hasPendingTail: true };
      }
      throw error;
    }
  }
  return { complete, hasPendingTail: false };
}

export function parseLatestCost(text, filename) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const nonEmpty = lines
    .map((line) => line.trim())
    .filter((line) => line !== "");
  if (nonEmpty.length === 0) {
    return { value: null, hasPendingTail: false };
  }
  const last = nonEmpty.at(-1);
  const rawEndsWithNewline = normalized.endsWith("\n");
  try {
    return { value: parseCostLine(last, filename), hasPendingTail: false };
  } catch (error) {
    if (!rawEndsWithNewline && error?.code === "SIDE_DATA_INVALID") {
      return { value: null, hasPendingTail: true };
    }
    throw error;
  }
}
