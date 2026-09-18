/**
 * Case4 调试 JSONL：原子覆盖完整快照，不是追加日志。
 * 变更判断含反射内容；最终快照必写；写/清失败只告警。
 */

import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { atomicReplaceFile } from "../../shared/atomic-write.mjs";

function jsonlRows(points) {
  return points.map((point) => {
    const row = {
      no: point.no,
      traditional: point.traditional,
      commercial: point.commercial,
      dt: point.dt,
    };
    if (point.reflection) row.reflection = point.reflection;
    return row;
  });
}

export function createCase4DebugJsonlService(options) {
  const sharedDir = options.sharedDir;
  const fsOps = options.fsOps ?? defaultFs;
  const logger = options.logger;
  const outputDir = path.join(sharedDir, "out", "case4", "points");
  const targetPath = path.join(outputDir, "trajectory.jsonl");
  let lastFingerprint = null;
  let sealed = false;
  let writeGeneration = 0;
  let writeChain = Promise.resolve();

  function enqueue(task) {
    const run = writeChain.then(task, task);
    writeChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function warn(error) {
    logger?.warn("case4 debug JSONL write failed", {
      caseId: "case4",
      reason: error?.message ?? String(error),
    });
  }

  async function clear() {
    writeGeneration += 1;
    return enqueue(async () => {
      try {
        await fsOps.mkdir(outputDir, { recursive: true });
        await atomicReplaceFile(targetPath, "", { fsOps });
        lastFingerprint = null;
        sealed = false;
      } catch (error) {
        await warn(error);
      }
    });
  }

  async function writeIfChanged(points, optionsForWrite = {}) {
    const source = optionsForWrite.source ?? "live";
    const rows = jsonlRows(points);
    const fingerprint = JSON.stringify(rows);
    const generation = writeGeneration;
    return enqueue(async () => {
      if (source === "live" && (sealed || generation !== writeGeneration)) {
        return;
      }
      if (source === "live" && fingerprint === lastFingerprint) return;
      const content =
        rows.length === 0
          ? ""
          : `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
      try {
        await fsOps.mkdir(outputDir, { recursive: true });
        if (source === "live" && (sealed || generation !== writeGeneration)) {
          return;
        }
        await atomicReplaceFile(targetPath, content, { fsOps });
        if (source === "live" && (sealed || generation !== writeGeneration)) {
          return;
        }
        lastFingerprint = fingerprint;
        if (source === "result") sealed = true;
      } catch (error) {
        await warn(error);
      }
    });
  }

  return {
    outputDir,
    filePath: targetPath,
    clear,
    writeIfChanged,
  };
}
