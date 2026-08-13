import { AppError } from "../../shared/errors.mjs";

const NUMBER_TOKEN = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;

/**
 * 按“绝对值四舍五入后恢复符号”归一到两位，
 * 避免 Math.round 对负数半值向正无穷取整。
 */
export function roundSemanticNumber(value) {
  const rounded =
    Math.sign(value) *
    (Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100);
  return Object.is(rounded, -0) ? 0 : rounded;
}

function assertRange(range, filename) {
  if (
    !range ||
    !Number.isFinite(range.min) ||
    !Number.isFinite(range.max) ||
    range.min > range.max
  ) {
    throw new AppError(
      500,
      "DATA_FILE_READ_FAILED",
      `${filename} is missing a valid numeric range`,
      { details: { filename } },
    );
  }
}

function parseFiniteNumber(token, kind, filename) {
  if (!NUMBER_TOKEN.test(token)) {
    throw new AppError(
      422,
      "DATA_FILE_INVALID",
      `${filename} contains an invalid ${kind} number: ${token}`,
      { details: { filename } },
    );
  }

  const value = Number(token);
  if (!Number.isFinite(value)) {
    throw new AppError(
      422,
      "DATA_FILE_INVALID",
      `${filename} contains a non-finite number`,
      { details: { filename } },
    );
  }

  return roundSemanticNumber(value);
}

function emitOutOfRange(options, info) {
  options.onOutOfRange?.(info);
}

export function parseHeatmap(text, filename, range, options = {}) {
  assertRange(range, filename);
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  while (lines.length > 0 && lines.at(-1).trim() === "") lines.pop();

  if (lines.length === 0 || lines.some((line) => line.trim() === "")) {
    throw new AppError(
      422,
      "DATA_FILE_INVALID",
      `${filename} must be a non-empty rectangular matrix`,
      { details: { filename } },
    );
  }

  let invalidCount = 0;
  const matrix = lines.map((line) =>
    line
      .trim()
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((token) => {
        const normalized = parseFiniteNumber(token, "heatmap", filename);
        if (normalized < range.min) {
          invalidCount += 1;
          return range.min;
        }
        if (normalized > range.max) {
          invalidCount += 1;
          return range.max;
        }
        return normalized;
      }),
  );

  const width = matrix[0]?.length ?? 0;
  if (width === 0 || matrix.some((row) => row.length !== width)) {
    throw new AppError(
      422,
      "DATA_FILE_INVALID",
      `${filename} must be a non-empty rectangular matrix`,
      { details: { filename } },
    );
  }

  if (invalidCount > 0) {
    emitOutOfRange(options, {
      filename,
      kind: "heatmap",
      action: "clamped",
      invalidCount,
      min: range.min,
      max: range.max,
    });
  }
  return matrix;
}

export function parseKpi(text, filename, range, options = {}) {
  assertRange(range, filename);
  const tokens = text
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    throw new AppError(
      422,
      "DATA_FILE_INVALID",
      `${filename} must contain at least one KPI sample`,
      { details: { filename } },
    );
  }

  const samples = [];
  let invalidCount = 0;
  for (const token of tokens) {
    const normalized = parseFiniteNumber(token, "kpi", filename);
    if (normalized < range.min || normalized > range.max) {
      invalidCount += 1;
      continue;
    }
    samples.push(normalized);
  }

  if (invalidCount > 0) {
    emitOutOfRange(options, {
      filename,
      kind: "kpi",
      action: "dropped",
      invalidCount,
      remaining: samples.length,
      min: range.min,
      max: range.max,
    });
  }

  if (samples.length === 0) {
    throw new AppError(
      422,
      "DATA_FILE_INVALID",
      `${filename} has no KPI samples inside [${range.min},${range.max}]`,
      { details: { filename } },
    );
  }
  return samples;
}
