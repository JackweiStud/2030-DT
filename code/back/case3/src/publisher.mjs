/**
 * Case3 逐点发布器。
 * 每个独立文件 append 前复验 ownership，并采用 open-append-sync-close 保证立即可见。
 */

import { promises as defaultFs } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { POINT_KEYS, SIDE_FILES } from "./constants.mjs";
import { StubError } from "./errors.mjs";

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

/** 在长 dwell/点间隔中持续复验，避免只在延时结束后才发现撤权。 */
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

export function createPublisher(options) {
  const fsOps = options.fsOps ?? defaultFs;
  const dataDir = path.join(options.sharedDir, "case3");
  const fixtureStore = options.fixtureStore;
  const controlStore = options.controlStore;
  const logger = options.logger;
  const pointMs = options.pointMs;
  const checkEveryMs = Math.max(1, Math.min(options.pollMs ?? 100, 200));

  async function clearForRecovery(task) {
    await fsOps.mkdir(dataDir, { recursive: true });
    for (const filename of Object.values(SIDE_FILES[task.side])) {
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

  async function appendFixtureLine(task, key, line) {
    await controlStore.assertOwned(task);
    const filename = SIDE_FILES[task.side][key];
    try {
      await appendVisible(path.join(dataDir, filename), line, fsOps);
    } catch (error) {
      throw new StubError("DATA_WRITE_FAILED", `append 失败：${filename}`, {
        cause: error,
      });
    }
  }

  async function publish(task, optionsForPublish = {}) {
    const fixture = fixtureStore.sides[task.side];
    await fsOps.mkdir(dataDir, { recursive: true });
    if (optionsForPublish.recovery) {
      await clearForRecovery(task);
    }

    for (let index = 0; index < fixture.count; index += 1) {
      for (const key of POINT_KEYS[task.side]) {
        await appendFixtureLine(task, key, fixture.rows[key][index]);
      }
      if (index === 0) {
        await appendFixtureLine(task, "cost", fixture.costLine);
      }
      logger.debug("point-published", {
        operationId: task.operationId,
        recovery: task.recovery,
        command: task.command,
        side: task.side,
        event: "point",
        point: index + 1,
        total: fixture.count,
        dataSource: fixtureStore.dataSource,
      });
      await waitWhileOwned({
        milliseconds: pointMs,
        task,
        controlStore,
        checkEveryMs,
      });
    }

    return {
      pointCount: fixture.count,
      cost: Number(fixture.costLine),
    };
  }

  return {
    dataDir,
    clearForRecovery,
    publish,
  };
}
