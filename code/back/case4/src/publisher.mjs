/**
 * Case4 双指针发布器。
 * 每个独立文件 append 前复验 ownership，并采用 open-append-sync-close 保证立即可见。
 */

import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  BASE_FILE,
  CDF_FILES,
  DYNAMIC_FILES,
  SCHEMES,
  SUMMARY_FILE,
  THROUGHPUT_FILES,
  THR_SIDES,
  TRAJECTORY_FILES,
} from "./constants.mjs";
import { atomicReplace } from "./control-store.mjs";
import { StubError } from "./errors.mjs";
import { recordLines } from "./fixture-store.mjs";
import {
  createRoundDataset,
  datasetLengths,
} from "./kpi-generator.mjs";

async function abortableDelay(milliseconds, signal) {
  try {
    await delay(milliseconds, undefined, { signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new StubError("STALE_OPERATION", "进程停止，任务撤权");
    }
    throw error;
  }
}

/** 在长 dwell/步间隔中持续复验，避免只在延时结束后才发现撤权。 */
export async function waitWhileOwned(options) {
  const {
    milliseconds,
    task,
    controlStore,
    checkEveryMs = 100,
    expectedStatuses = ["execute success"],
  } = options;
  let remaining = milliseconds;
  await controlStore.assertOwned(task, expectedStatuses);
  while (remaining > 0) {
    const slice = Math.min(remaining, checkEveryMs);
    await abortableDelay(slice, task.signal);
    remaining -= slice;
    await controlStore.assertOwned(task, expectedStatuses);
  }
}

async function appendVisible(targetPath, line, fsOps) {
  let handle;
  try {
    handle = await fsOps.open(targetPath, "a", 0o600);
    await handle.writeFile(`${line}\n`);
    await handle.sync();
    await handle.close();
    handle = undefined;
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    throw error;
  }
}

async function truncateVisible(targetPath, fsOps) {
  let handle;
  try {
    handle = await fsOps.open(targetPath, "w", 0o600);
    await handle.sync();
    await handle.close();
    handle = undefined;
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    throw error;
  }
}

async function ensureFileExists(targetPath, fsOps) {
  try {
    await fsOps.stat(targetPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await truncateVisible(targetPath, fsOps);
  }
}

export function createPublisher(options) {
  const fsOps = options.fsOps ?? defaultFs;
  const dataDir = path.join(options.sharedDir, "case4");
  const fixtureStore = options.fixtureStore;
  const controlStore = options.controlStore;
  const logger = options.logger;
  const stepMs = options.stepMs;
  const dataMode = options.dataMode ?? "random";
  const seed = options.seed ?? "";
  const checkEveryMs = Math.max(1, Math.min(options.pollMs ?? 100, 200));
  const createDataset =
    options.createDataset ??
    ((task) =>
      createRoundDataset({
        fixtureStore,
        dataMode,
        seed,
        operationId: task.operationId,
      }));

  async function clearForRecovery(task) {
    await fsOps.mkdir(dataDir, { recursive: true });
    for (const filename of DYNAMIC_FILES) {
      await controlStore.assertOwned(task);
      try {
        await truncateVisible(path.join(dataDir, filename), fsOps);
      } catch (error) {
        throw new StubError("DATA_WRITE_FAILED", `恢复清空失败：${filename}`, {
          cause: error,
        });
      }
    }
  }

  async function appendLine(task, filename, line) {
    await controlStore.assertOwned(task);
    try {
      await appendVisible(path.join(dataDir, filename), line, fsOps);
    } catch (error) {
      throw new StubError("DATA_WRITE_FAILED", `append 失败：${filename}`, {
        cause: error,
      });
    }
  }

  async function writeAtomicFile(task, filename, lines) {
    await controlStore.assertOwned(task);
    const content = lines.length === 0 ? "" : `${lines.join("\n")}\n`;
    try {
      await atomicReplace(path.join(dataDir, filename), content, fsOps, {
        beforeRename: async () => {
          await controlStore.assertOwned(task);
        },
      });
    } catch (error) {
      if (error?.code === "STALE_OPERATION") throw error;
      throw new StubError("DATA_WRITE_FAILED", `统计写入失败：${filename}`, {
        cause: error,
      });
    }
  }

  async function assertCompleteInvariant(dataset) {
    const lengths = datasetLengths(dataset);
    if (
      lengths.traditional < 1 ||
      lengths.traditional !== lengths.commercial ||
      lengths.traditional !== lengths.dt
    ) {
      throw new StubError(
        "TRAJECTORY_PLAN_INVALID",
        "complete 要求三轨迹同长且至少 1 行",
      );
    }
    let baseText;
    try {
      baseText = await fsOps.readFile(path.join(dataDir, BASE_FILE), "utf8");
    } catch (error) {
      throw new StubError("DATA_WRITE_FAILED", "complete 前缺少 base", {
        cause: error,
      });
    }
    const baseCount = recordLines(baseText, BASE_FILE).length;
    if (lengths.traditional > baseCount) {
      throw new StubError(
        "TRAJECTORY_PLAN_INVALID",
        "轨迹行数超过磁盘 base",
      );
    }
  }

  async function publish(task, optionsForPublish = {}) {
    const dataset = optionsForPublish.dataset ?? createDataset(task);
    await fsOps.mkdir(dataDir, { recursive: true });
    if (optionsForPublish.recovery) {
      await clearForRecovery(task);
    }
    for (const side of THR_SIDES) {
      if (dataset.throughputs[side].length === 0) {
        await controlStore.assertOwned(task);
        await ensureFileExists(
          path.join(dataDir, THROUGHPUT_FILES[side]),
          fsOps,
        );
      }
    }

    const lengths = datasetLengths(dataset);
    const totalSteps = Math.max(
      lengths.traditional,
      lengths.commercial,
      lengths.dt,
      lengths.without,
      lengths.with,
    );
    const cursor = {
      traditional: 0,
      commercial: 0,
      dt: 0,
      without: 0,
      with: 0,
    };

    for (let step = 0; step < totalSteps; step += 1) {
      for (const scheme of SCHEMES) {
        if (cursor[scheme] < dataset.trajectories[scheme].length) {
          await appendLine(
            task,
            TRAJECTORY_FILES[scheme],
            dataset.trajectories[scheme][cursor[scheme]],
          );
          cursor[scheme] += 1;
        }
      }
      for (const side of THR_SIDES) {
        if (cursor[side] < dataset.throughputs[side].length) {
          await appendLine(
            task,
            THROUGHPUT_FILES[side],
            dataset.throughputs[side][cursor[side]],
          );
          cursor[side] += 1;
        }
      }
      logger?.debug("step-published", {
        operationId: task.operationId,
        recovery: task.recovery,
        command: task.command,
        dtType: task.dtType,
        event: "step",
        step: step + 1,
        total: totalSteps,
        dataMode: dataset.dataMode,
        dataSource: dataset.dataSource,
        resolvedSeed: dataset.resolvedSeed,
        lengths: datasetLengths(dataset),
      });
      await waitWhileOwned({
        milliseconds: stepMs,
        task,
        controlStore,
        checkEveryMs,
      });
    }

    if (!dataset.trajectoryPlanValid) {
      throw new StubError(
        "TRAJECTORY_PLAN_INVALID",
        "三轨迹计划长度不同或为空，不得 complete",
      );
    }

    await assertCompleteInvariant(dataset);
    for (const scheme of SCHEMES) {
      await writeAtomicFile(
        task,
        CDF_FILES[scheme],
        dataset.statistics.cdf[scheme],
      );
    }
    await writeAtomicFile(task, SUMMARY_FILE, dataset.statistics.summary);
    logger?.info("stats-published", {
      operationId: task.operationId,
      recovery: task.recovery,
      command: task.command,
      dtType: task.dtType,
      event: "stats",
      dataMode: dataset.dataMode,
      dataSource: dataset.dataSource,
      resolvedSeed: dataset.resolvedSeed,
      lengths: datasetLengths(dataset),
    });

    return {
      lengths: datasetLengths(dataset),
      dataMode: dataset.dataMode,
      dataSource: dataset.dataSource,
      resolvedSeed: dataset.resolvedSeed,
      trajectoryPlanValid: true,
    };
  }

  return {
    dataDir,
    clearForRecovery,
    publish,
  };
}
