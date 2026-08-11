/**
 * Case3 调试 JSONL：只镜像当前完整点，不参与 REST 成功判定。
 */

import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { atomicReplaceFile } from "../../shared/atomic-write.mjs";

export function createDebugJsonlService(options) {
  const sharedDir = options.sharedDir;
  const fsOps = options.fsOps ?? defaultFs;
  const logger = options.logger;
  const outputDir = path.join(sharedDir, "out", "case3", "points");
  const lastCounts = new Map();

  function filePath(side) {
    return path.join(outputDir, `${side}.jsonl`);
  }

  async function clear(side) {
    await fsOps.mkdir(outputDir, { recursive: true });
    await atomicReplaceFile(filePath(side), "", { fsOps });
    lastCounts.set(side, 0);
  }

  async function writeIfChanged(side, points) {
    if (lastCounts.get(side) === points.length) return;
    const content =
      points.length === 0
        ? ""
        : `${points.map((point) => JSON.stringify(point)).join("\n")}\n`;
    try {
      await fsOps.mkdir(outputDir, { recursive: true });
      await atomicReplaceFile(filePath(side), content, { fsOps });
      lastCounts.set(side, points.length);
    } catch (error) {
      logger.warn("case3 debug JSONL write failed", {
        caseId: "case3",
        side,
        reason: error?.message ?? String(error),
      });
    }
  }

  return {
    outputDir,
    clear,
    writeIfChanged,
  };
}
