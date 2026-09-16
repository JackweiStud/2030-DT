/**
 * Case4 调试 JSONL：只镜像归一后的共同轨迹点。
 * 写/清失败只记警告，不得把 REST 或开轮改成失败。
 */

import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { atomicReplaceFile } from "../../shared/atomic-write.mjs";

export function createCase4DebugJsonlService(options) {
  const sharedDir = options.sharedDir;
  const fsOps = options.fsOps ?? defaultFs;
  const logger = options.logger;
  const outputDir = path.join(sharedDir, "out", "case4", "points");
  const targetPath = path.join(outputDir, "trajectory.jsonl");
  let lastCompleteCount;

  async function warn(error) {
    logger?.warn("case4 debug JSONL write failed", {
      caseId: "case4",
      reason: error?.message ?? String(error),
    });
  }

  async function clear() {
    try {
      await fsOps.mkdir(outputDir, { recursive: true });
      await atomicReplaceFile(targetPath, "", { fsOps });
      lastCompleteCount = 0;
    } catch (error) {
      await warn(error);
    }
  }

  async function writeIfChanged(points) {
    const completeCount = points.length;
    if (lastCompleteCount === completeCount) return;
    const content =
      completeCount === 0
        ? ""
        : `${points.map((point) => JSON.stringify(point)).join("\n")}\n`;
    try {
      await fsOps.mkdir(outputDir, { recursive: true });
      await atomicReplaceFile(targetPath, content, { fsOps });
      lastCompleteCount = completeCount;
    } catch (error) {
      await warn(error);
    }
  }

  return {
    outputDir,
    filePath: targetPath,
    clear,
    writeIfChanged,
  };
}
