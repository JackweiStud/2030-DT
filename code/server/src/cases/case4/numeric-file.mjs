/**
 * Case4 词法与数值解析。
 * 禁止 import case2/case3 解析器。65535 必须在 round 之前用原始有限数判定。
 */

import { TextDecoder } from "node:util";
import { AppError, isAppError } from "../../shared/errors.mjs";

const NUMBER_TOKEN =
  /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;
const SENTINEL = 65535;
const COMPONENTS = Object.freeze(["x", "y", "z"]);

export function roundSemanticNumber(value, digits) {
  const factor = 10 ** digits;
  const rounded =
    Math.sign(value) *
    (Math.round((Math.abs(value) + Number.EPSILON) * factor) / factor);
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function isCoordinateSentinel(value) {
  return value === SENTINEL;
}

export function fileSnapshot(stat) {
  return {
    size: stat.size,
    mtimeNs:
      stat.mtimeNs ?? BigInt(Math.trunc(Number(stat.mtimeMs) * 1_000_000)),
  };
}

export function sameFileSnapshot(left, right) {
  return left.size === right.size && left.mtimeNs === right.mtimeNs;
}

export function dataMissing(filename, cause) {
  return new AppError(404, "DATA_FILE_MISSING", `${filename} is missing`, {
    cause,
    details: { filename },
  });
}

export function dataReadFailed(filename, cause) {
  return new AppError(
    500,
    "DATA_FILE_READ_FAILED",
    `failed to read ${filename}`,
    { cause, details: { filename } },
  );
}

export async function statRequiredFile(file, fsOps) {
  try {
    return fileSnapshot(await fsOps.stat(file.path, { bigint: true }));
  } catch (error) {
    if (error?.code === "ENOENT") throw dataMissing(file.filename, error);
    throw dataReadFailed(file.filename, error);
  }
}

export async function readRequiredUtf8(file, fsOps, invalidCode) {
  try {
    const bytes = await fsOps.readFile(file.path);
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      throw invalidData(
        invalidCode,
        file.filename,
        "file must be valid UTF-8",
        error,
      );
    }
  } catch (error) {
    if (isAppError(error)) throw error;
    if (error?.code === "ENOENT") throw dataMissing(file.filename, error);
    throw dataReadFailed(file.filename, error);
  }
}

export function invalidData(code, filename, message, cause) {
  return new AppError(422, code, `${filename}: ${message}`, {
    cause,
    details: { filename },
  });
}

export function stripBom(text) {
  return text.startsWith("\uFEFF") ? text.slice(1) : text;
}

export function parseRawFiniteToken(token, filename, label, code) {
  if (!NUMBER_TOKEN.test(token)) {
    throw invalidData(code, filename, `${label} contains invalid number ${token}`);
  }
  const value = Number(token);
  if (!Number.isFinite(value)) {
    throw invalidData(code, filename, `${label} must be finite`);
  }
  return value;
}

/**
 * 已换行的行视为已提交，非法即 422；无换行尾段解析失败视为物理 pending。
 * 记录间空行是格式错误，不删空行重编号。
 * 文件末尾纯空白（额外换行、最后换行后的空格）忽略，不当成 pending 或空记录。
 */
export function parsePhysicalLines(text, filename, parseLine, emptyCode) {
  const normalized = stripBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (normalized === "") return { complete: [], hasPendingTail: false };
  const endsWithNewline = normalized.endsWith("\n");
  const segments = normalized.split("\n");
  if (endsWithNewline) segments.pop();

  let droppedTrailingBlank = false;
  while (segments.length > 0 && segments.at(-1).trim() === "") {
    segments.pop();
    droppedTrailingBlank = true;
  }
  if (segments.length === 0) {
    return { complete: [], hasPendingTail: false };
  }

  const lastIsUncommitted = !endsWithNewline && !droppedTrailingBlank;
  const complete = [];
  for (let index = 0; index < segments.length; index += 1) {
    const line = segments[index];
    const isUncommittedTail = lastIsUncommitted && index === segments.length - 1;
    if (line.trim() === "") {
      if (isUncommittedTail) return { complete, hasPendingTail: true };
      throw invalidData(
        emptyCode ?? inferCodeFromParser(parseLine),
        filename,
        `row ${index + 1} is empty`,
      );
    }
    try {
      complete.push(parseLine(line, filename, index + 1));
    } catch (error) {
      if (isUncommittedTail && isAppError(error) && error.status === 422) {
        return { complete, hasPendingTail: true };
      }
      throw error;
    }
  }
  return { complete, hasPendingTail: false };
}

function inferCodeFromParser(parseLine) {
  return parseLine.invalidCode ?? "TRAJECTORY_DATA_INVALID";
}

function splitTrajectoryCoordinateTokens(line) {
  if (line.includes(",")) {
    return line.split(",").map((token) => token.trim());
  }
  return line.trim().split(/\s+/);
}

export function parseCoordinateRaw(line, filename, code = "TRAJECTORY_DATA_INVALID") {
  const tokens =
    code === "INIT_DATA_INVALID"
      ? line.split(",").map((token) => token.trim())
      : splitTrajectoryCoordinateTokens(line);
  if (tokens.length === 1 && tokens[0] !== "" && NUMBER_TOKEN.test(tokens[0])) {
    const value = parseRawFiniteToken(tokens[0], filename, "coordinate", code);
    if (isCoordinateSentinel(value)) {
      return { x: SENTINEL, y: SENTINEL, z: SENTINEL };
    }
  }
  if (tokens.length !== 3 || tokens.some((token) => token === "")) {
    throw invalidData(code, filename, "coordinate row must contain exactly x,y,z");
  }
  return {
    x: parseRawFiniteToken(tokens[0], filename, "x", code),
    y: parseRawFiniteToken(tokens[1], filename, "y", code),
    z: parseRawFiniteToken(tokens[2], filename, "z", code),
  };
}

export function parseThroughputRaw(line, filename) {
  const token = line.trim();
  if (token === "" || token.includes(",") || /\s/.test(token)) {
    throw invalidData(
      "THROUGHPUT_DATA_INVALID",
      filename,
      "throughput row must contain one number",
    );
  }
  const value = parseRawFiniteToken(
    token,
    filename,
    "throughput",
    "THROUGHPUT_DATA_INVALID",
  );
  if (value < 0) {
    throw invalidData(
      "THROUGHPUT_DATA_INVALID",
      filename,
      "throughput must be non-negative",
    );
  }
  return roundSemanticNumber(value, 2);
}

function detectTwoColDelimiter(line, filename) {
  if (line.includes(",")) return "comma";
  const tokens = line.trim().split(/\s+/);
  if (tokens.length === 2) return "whitespace";
  throw invalidData(
    "STATISTICS_DATA_INVALID",
    filename,
    "two-column row must use comma or whitespace delimiter",
  );
}

function splitTwoCol(line, delimiter, filename) {
  const hasComma = line.includes(",");
  if (delimiter === "comma" && !hasComma) {
    throw invalidData(
      "STATISTICS_DATA_INVALID",
      filename,
      "mixed two-column delimiters in the same file",
    );
  }
  if (delimiter === "whitespace" && hasComma) {
    throw invalidData(
      "STATISTICS_DATA_INVALID",
      filename,
      "mixed two-column delimiters in the same file",
    );
  }
  const tokens =
    delimiter === "comma"
      ? line.split(",").map((token) => token.trim())
      : line.trim().split(/\s+/);
  if (tokens.length !== 2 || tokens.some((token) => token === "")) {
    throw invalidData(
      "STATISTICS_DATA_INVALID",
      filename,
      "row must contain exactly two columns",
    );
  }
  return tokens;
}

export function parseTwoColumnRecords(text, filename, mapRecord) {
  let delimiter = null;
  const parser = (line, currentFilename, row) => {
    if (!delimiter) delimiter = detectTwoColDelimiter(line, currentFilename);
    const tokens = splitTwoCol(line, delimiter, currentFilename);
    const left = parseRawFiniteToken(
      tokens[0],
      currentFilename,
      `col1 row ${row}`,
      "STATISTICS_DATA_INVALID",
    );
    const right = parseRawFiniteToken(
      tokens[1],
      currentFilename,
      `col2 row ${row}`,
      "STATISTICS_DATA_INVALID",
    );
    return mapRecord(left, right, row);
  };
  parser.invalidCode = "STATISTICS_DATA_INVALID";
  return parsePhysicalLines(
    text,
    filename,
    parser,
    "STATISTICS_DATA_INVALID",
  );
}

export function parseCdfFile(text, filename) {
  const parsed = parseTwoColumnRecords(text, filename, (errorM, probability) => {
    if (errorM < 0) {
      throw invalidData(
        "STATISTICS_DATA_INVALID",
        filename,
        "CDF errorM must be non-negative",
      );
    }
    if (probability < 0 || probability > 1) {
      throw invalidData(
        "STATISTICS_DATA_INVALID",
        filename,
        "CDF probability must be in [0,1]",
      );
    }
    return { errorM, probability };
  });
  if (parsed.complete.length === 0 && !parsed.hasPendingTail) {
    throw invalidData(
      "STATISTICS_DATA_INVALID",
      filename,
      "CDF must contain at least one point",
    );
  }
  for (let index = 1; index < parsed.complete.length; index += 1) {
    const previous = parsed.complete[index - 1];
    const current = parsed.complete[index];
    if (current.errorM < previous.errorM || current.probability < previous.probability) {
      throw invalidData(
        "STATISTICS_DATA_INVALID",
        filename,
        `CDF columns must be non-decreasing at row ${index + 1}`,
      );
    }
  }
  return parsed;
}

export function parseSummaryFile(text, filename) {
  const parsed = parseTwoColumnRecords(text, filename, (left, right) => ({
    left,
    right,
  }));
  return parsed;
}

export function interpretSummaryRecords(records, filename) {
  if (records.length !== 4) {
    throw invalidData(
      "STATISTICS_DATA_INVALID",
      filename,
      "CEP/NLOS summary must contain exactly 4 rows",
    );
  }
  const schemes = ["traditional", "commercial", "dt"];
  const cep = {};
  for (let index = 0; index < 3; index += 1) {
    const row = records[index];
    if (row.left < 0 || row.right < 0) {
      throw invalidData(
        "STATISTICS_DATA_INVALID",
        filename,
        `CEP values must be non-negative at row ${index + 1}`,
      );
    }
    if (row.left > row.right) {
      throw invalidData(
        "STATISTICS_DATA_INVALID",
        filename,
        `p50M must be <= p90M at row ${index + 1}`,
      );
    }
    cep[schemes[index]] = { p50M: row.left, p90M: row.right };
  }
  const nlos = records[3];
  if (nlos.left < 0 || nlos.left > 1) {
    throw invalidData(
      "STATISTICS_DATA_INVALID",
      filename,
      "nlosRatio must be in [0,1]",
    );
  }
  if (!Number.isFinite(nlos.right)) {
    throw invalidData(
      "STATISTICS_DATA_INVALID",
      filename,
      "summary row 4 column 2 must be finite",
    );
  }
  return { cep, nlosRatio: nlos.left };
}

export function roundXyz(raw) {
  return {
    x: roundSemanticNumber(raw.x, 2),
    y: roundSemanticNumber(raw.y, 2),
    z: roundSemanticNumber(raw.z, 2),
  };
}

export function parseBaseRoute(text, filename) {
  const parser = (line, currentFilename) =>
    parseCoordinateRaw(line, currentFilename, "INIT_DATA_INVALID");
  parser.invalidCode = "INIT_DATA_INVALID";
  const parsed = parsePhysicalLines(
    text,
    filename,
    parser,
    "INIT_DATA_INVALID",
  );
  if (parsed.hasPendingTail || parsed.complete.length === 0) {
    throw invalidData(
      "INIT_DATA_INVALID",
      filename,
      parsed.complete.length === 0 ? "base route is empty" : "base route has a pending tail",
    );
  }
  return parsed.complete.map((raw, index) => {
    for (const component of COMPONENTS) {
      if (isCoordinateSentinel(raw[component])) {
        throw invalidData(
          "INIT_DATA_INVALID",
          filename,
          `base row ${index + 1} ${component} is the 65535 sentinel`,
        );
      }
    }
    return { no: index + 1, ...roundXyz(raw) };
  });
}

export function createSubstitutionLogger(logger) {
  const seen = new Set();
  return function logSubstitution(entry) {
    const key = [
      entry.filename,
      entry.scheme,
      entry.no,
      entry.component,
      entry.original,
      entry.substitute,
      entry.source,
    ].join("\0");
    if (seen.has(key)) return;
    seen.add(key);
    logger.warn("case4 invalid coordinate substituted", {
      caseId: "case4",
      filename: entry.filename,
      scheme: entry.scheme,
      no: entry.no,
      component: entry.component,
      original: entry.original,
      substitute: entry.substitute,
      source: entry.source,
    });
  };
}

export function normalizeSchemePoint(raw, previous, basePoint, meta) {
  const xyz = {};
  for (const component of COMPONENTS) {
    const original = raw[component];
    if (isCoordinateSentinel(original)) {
      const source = previous ? "previous" : "base";
      const substitute = previous
        ? previous[component]
        : basePoint[component];
      meta.logSubstitution?.({
        filename: meta.filename,
        scheme: meta.scheme,
        no: meta.no,
        component,
        original,
        substitute,
        source,
      });
      xyz[component] = substitute;
    } else {
      xyz[component] = roundSemanticNumber(original, 2);
    }
  }
  return xyz;
}

export function assembleTrajectory(basePoints, schemeParsed, options = {}) {
  const names = ["traditional", "commercial", "dt"];
  for (const name of names) {
    const file = schemeParsed[name];
    if (file.complete.length > basePoints.length) {
      throw invalidData(
        "TRAJECTORY_DATA_INVALID",
        file.filename,
        "complete rows exceed base route length",
      );
    }
  }

  const lengths = names.map((name) => schemeParsed[name].complete.length);
  const completeCount = Math.min(...lengths);
  const unequal = lengths.some((length) => length !== completeCount);
  const physicalPending = names.some(
    (name) => schemeParsed[name].hasPendingTail,
  );
  const previous = {
    traditional: null,
    commercial: null,
    dt: null,
  };
  const points = [];

  for (let index = 0; index < completeCount; index += 1) {
    const point = { no: index + 1 };
    for (const name of names) {
      point[name] = normalizeSchemePoint(
        schemeParsed[name].complete[index],
        previous[name],
        basePoints[index],
        {
          filename: schemeParsed[name].filename,
          scheme: name,
          no: index + 1,
          logSubstitution: options.logSubstitution,
        },
      );
      previous[name] = point[name];
    }
    points.push(point);
  }

  return {
    points,
    completeCount,
    pendingTail: Boolean(options.changed || unequal || physicalPending),
  };
}

export function assembleThroughput(side, parsed, changed) {
  return {
    side,
    samples: parsed.complete.map((gbps, index) => ({
      no: index + 1,
      gbps,
    })),
    pendingTail: Boolean(changed || parsed.hasPendingTail),
  };
}
