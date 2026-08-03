import { AppError } from "../../shared/errors.mjs";

const HEATMAP_TOKEN = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
const KPI_TOKEN = /^[+]?(?:\d+(?:\.\d+)?|\.\d+)$/;

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

function parseToken(token, kind, filename) {
  const pattern = kind === "heatmap" ? HEATMAP_TOKEN : KPI_TOKEN;
  if (!pattern.test(token)) {
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

  const normalized = roundSemanticNumber(value);
  const [minimum, maximum] = kind === "heatmap" ? [-200, 200] : [0, 500];
  if (normalized < minimum || normalized > maximum) {
    throw new AppError(
      422,
      "DATA_FILE_INVALID",
      `${filename} contains a value outside [${minimum},${maximum}]`,
      { details: { filename } },
    );
  }
  return normalized;
}

export function parseHeatmap(text, filename) {
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

  const matrix = lines.map((line) =>
    line
      .trim()
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((token) => parseToken(token, "heatmap", filename)),
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
  return matrix;
}

export function parseKpi(text, filename) {
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
  return tokens.map((token) => parseToken(token, "kpi", filename));
}
