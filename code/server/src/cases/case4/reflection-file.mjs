/**
 * Case4 反射文件解析。
 * 已换行非法行 → invalid 占位，不 422、不改后续 Pi。
 * 无换行完整合法行或单独 65535 可消费；未完成尾行 pending。
 */

import { isAppError } from "../../shared/errors.mjs";
import { CASE4_REFLECTION_FILE } from "./constants.mjs";
import {
  isCoordinateSentinel,
  parseRawFiniteToken,
  readRequiredUtf8,
  sameOptionalFileSnapshot,
  statOptionalFile,
  stripBom,
} from "./numeric-file.mjs";

const NUMBER_TOKEN =
  /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;

function splitReflectionTokens(line) {
  const trimmed = line.trim();
  if (trimmed.includes(",")) {
    return trimmed.split(",").map((token) => token.trim());
  }
  return trimmed.split(/\s+/).filter((token) => token !== "");
}

function parseIntegerToken(token) {
  if (token === "" || !NUMBER_TOKEN.test(token)) return null;
  const value = Number(token);
  if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
  return value;
}

function invalidRow(raw, reason, extras = {}) {
  return { kind: "invalid", raw, reason, ...extras };
}

function canConsumeUncommitted(classified) {
  return (
    classified.kind === "ready" ||
    (classified.kind === "invalid" && classified.reason === "row-sentinel")
  );
}

function classifyReflectionLine(line) {
  const raw = line;
  const trimmed = line.trim();
  if (trimmed === "") {
    return invalidRow(raw, "empty-row");
  }
  const tokens = splitReflectionTokens(line);
  if (tokens.length === 1 && NUMBER_TOKEN.test(tokens[0])) {
    const value = Number(tokens[0]);
    if (Number.isFinite(value) && isCoordinateSentinel(value)) {
      return invalidRow(raw, "row-sentinel");
    }
  }
  if (tokens.length < 2) {
    return { kind: "incomplete", raw, reason: "truncated-header" };
  }

  const losFlag = parseIntegerToken(tokens[0]);
  const n = parseIntegerToken(tokens[1]);
  if (losFlag === null || (losFlag !== 0 && losFlag !== 1)) {
    return invalidRow(raw, "losFlag", { token: tokens[0] });
  }
  if (n === null || n < 0) {
    return invalidRow(raw, "n", { token: tokens[1] });
  }

  const expected = 2 + 3 * n;
  if (tokens.length < expected) {
    return { kind: "incomplete", raw, reason: "truncated-fields", n, expected };
  }
  if (tokens.length > expected) {
    return invalidRow(raw, "token-count", { n, expected, actual: tokens.length });
  }

  const points = [];
  const skipped = [];
  for (let index = 0; index < n; index += 1) {
    const offset = 2 + index * 3;
    const id = index + 1;
    let x;
    let y;
    let z;
    try {
      x = parseRawFiniteToken(
        tokens[offset],
        CASE4_REFLECTION_FILE,
        `R${id}.x`,
        "REFLECTION_DATA_INVALID",
      );
      y = parseRawFiniteToken(
        tokens[offset + 1],
        CASE4_REFLECTION_FILE,
        `R${id}.y`,
        "REFLECTION_DATA_INVALID",
      );
      z = parseRawFiniteToken(
        tokens[offset + 2],
        CASE4_REFLECTION_FILE,
        `R${id}.z`,
        "REFLECTION_DATA_INVALID",
      );
    } catch (error) {
      return invalidRow(raw, "ri-number", {
        id,
        cause: isAppError(error) ? error.message : String(error),
      });
    }
    if (
      isCoordinateSentinel(x) ||
      isCoordinateSentinel(y) ||
      isCoordinateSentinel(z)
    ) {
      skipped.push({
        id,
        x,
        y,
        z,
        reason: "ri-sentinel",
      });
      continue;
    }
    points.push({ id, x, y, z });
  }

  return {
    kind: "ready",
    raw,
    los: losFlag === 1,
    n,
    points,
    skipped,
  };
}

/**
 * 解析反射文本。行级错误转为 invalid 占位，不抛 422。
 */
export function parseReflectionText(text, filename = CASE4_REFLECTION_FILE) {
  void filename;
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
    const classified = classifyReflectionLine(line);
    if (isUncommittedTail && !canConsumeUncommitted(classified)) {
      return { complete, hasPendingTail: true };
    }
    if (classified.kind === "incomplete") {
      complete.push(invalidRow(line, classified.reason, { n: classified.n }));
      continue;
    }
    complete.push(classified);
  }
  return { complete, hasPendingTail: false };
}

export function toPublicReflection(row) {
  if (!row) {
    return { state: "missing", los: null, points: [] };
  }
  if (row.kind !== "ready") {
    const payload = {
      state: "invalid",
      los: null,
      points: [],
    };
    if (row.raw !== undefined) payload.raw = row.raw;
    if (row.reason) payload.reason = row.reason;
    return payload;
  }
  return {
    state: "ready",
    los: row.los,
    n: row.n,
    points: row.points,
  };
}

export function attachLiveReflection(snapshot, reflectionRead) {
  const reflectionCount = reflectionRead.complete.length;
  const k = Math.min(snapshot.completeCount, reflectionCount);
  const points = snapshot.points.slice(0, k).map((point, index) => ({
    ...point,
    reflection: toPublicReflection(reflectionRead.complete[index]),
  }));
  return {
    ...snapshot,
    points,
    completeCount: points.length,
    pendingTail:
      snapshot.pendingTail ||
      reflectionRead.hasPendingTail ||
      snapshot.completeCount > reflectionCount ||
      Boolean(reflectionRead.missing) ||
      Boolean(reflectionRead.unread),
  };
}

export function attachResultReflection(snapshot, reflectionRead) {
  const points = snapshot.points.map((point, index) => ({
    ...point,
    reflection: toPublicReflection(reflectionRead.complete[index] ?? null),
  }));
  return { ...snapshot, points };
}

export function logReflectionDiagnostics(logger, rows, seen) {
  if (!logger) return;
  for (let index = 0; index < rows.length; index += 1) {
    const no = index + 1;
    const row = rows[index];
    if (row.kind === "invalid") {
      const key = `${no}:invalid:${row.reason}`;
      if (seen.has(key)) continue;
      seen.add(key);
      logger.warn("case4 reflection row invalid", {
        caseId: "case4",
        no,
        reason: row.reason,
        raw: row.raw,
      });
    }
    if (row.kind === "ready") {
      for (const skipped of row.skipped ?? []) {
        const key = `${no}:ri:${skipped.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        logger.warn("case4 reflection Ri skipped", {
          caseId: "case4",
          no,
          id: skipped.id,
          x: skipped.x,
          y: skipped.y,
          z: skipped.z,
          reason: skipped.reason,
        });
      }
    }
  }
}

export function emptyReflectionRead(extras = {}) {
  return {
    missing: false,
    unread: false,
    complete: [],
    hasPendingTail: true,
    ...extras,
  };
}

export async function readOptionalReflectionFile(file, fsOps) {
  const windowed = await readReflectionWindow(file, fsOps);
  return windowed.read;
}

/**
 * 读反射并带 before/after 快照。缺失不算变化；非缺失读失败记 unread。
 */
export async function readReflectionWindow(file, fsOps) {
  const before = await statOptionalFile(file, fsOps);
  try {
    const text = await readRequiredUtf8(
      file,
      fsOps,
      "REFLECTION_DATA_INVALID",
    );
    const after = await statOptionalFile(file, fsOps);
    const parsed = parseReflectionText(text, file.filename);
    return {
      changed: !sameOptionalFileSnapshot(before, after),
      read: {
        missing: false,
        unread: false,
        complete: parsed.complete,
        hasPendingTail: parsed.hasPendingTail,
      },
    };
  } catch (error) {
    const after = await statOptionalFile(file, fsOps);
    const changed = !sameOptionalFileSnapshot(before, after);
    if (isAppError(error) && error.code === "DATA_FILE_MISSING") {
      return {
        changed,
        read: emptyReflectionRead({ missing: true }),
      };
    }
    if (isAppError(error) && error.code === "REFLECTION_DATA_INVALID") {
      return {
        changed,
        read: emptyReflectionRead({ unread: true }),
      };
    }
    throw error;
  }
}
