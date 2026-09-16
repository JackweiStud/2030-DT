/**
 * Case4 stub 状态机：轮询/watch 只唤醒，完整控制快照才决定是否接单。
 * 启动恢复只分类一次；运行中异常不会被 poll 自动重复恢复。
 */

import { randomUUID } from "node:crypto";
import { watch as defaultWatch } from "node:fs";
import { CASE_ID, isRequiredDtType } from "./constants.mjs";
import { waitWhileOwned } from "./publisher.mjs";

const TERMINAL_STATUSES = new Set([
  "execute fail",
  "case complete",
  "reinit complete",
]);

function validCase4Tuple(control) {
  return (
    control.case === CASE_ID &&
    (control.command === "start" || control.command === "reinit") &&
    isRequiredDtType(control.dt_type)
  );
}

function classifyStartup(control) {
  if (control.command === "init" && control.status === "") {
    return { kind: "idle" };
  }
  if (!validCase4Tuple(control)) return { kind: "diagnose" };
  if (control.status === "") {
    return {
      kind: "new",
      command: control.command,
      dtType: control.dt_type,
    };
  }
  if (control.command === "start" && control.status === "execute success") {
    return {
      kind: "recover-start",
      command: "start",
      dtType: control.dt_type,
    };
  }
  if (
    control.command === "reinit" &&
    control.status === "execute success" &&
    control.save_picture_flag === 0
  ) {
    return {
      kind: "recover-reinit",
      command: "reinit",
      dtType: control.dt_type,
    };
  }
  if (TERMINAL_STATUSES.has(control.status)) return { kind: "terminal" };
  return { kind: "diagnose" };
}

function classifyLive(control) {
  if (!validCase4Tuple(control) || control.status !== "") return null;
  return {
    kind: "new",
    command: control.command,
    dtType: control.dt_type,
  };
}

function taskContext(operation, abortController) {
  const recovery = operation.kind.startsWith("recover-");
  return {
    operationId: randomUUID(),
    command: operation.command,
    dtType: operation.dtType,
    recovery,
    confirmedSuccess: recovery,
    signal: abortController.signal,
  };
}

export function createStubRunner(options) {
  const {
    sharedDir,
    controlStore,
    publisher,
    logger,
    outcome,
    requestPicture,
    successDwellMs,
    pollMs,
    dataMode,
  } = options;
  const checkEveryMs = Math.max(1, Math.min(pollMs, 200));
  const watchFactory = options.watchFactory ?? defaultWatch;
  let stopped = false;
  let activeTask = null;
  let activePromise = null;
  let abortController = null;
  let pollTimer = null;
  let watcher = null;
  let evaluating = false;
  let reevaluate = false;
  let startupClassified = false;
  let lastReadErrorCode = null;
  let lastDiagnosticKey = null;

  function taskLog(task, event, extra = {}) {
    return {
      operationId: task.operationId,
      recovery: task.recovery,
      command: task.command,
      dtType: task.dtType,
      event,
      ...(task.command === "start" ? { requestPicture } : {}),
      ...extra,
    };
  }

  async function patchFailureIfOwned(task, error) {
    const expectedStatuses = task.confirmedSuccess
      ? ["execute success"]
      : [""];
    try {
      await controlStore.patch(
        { status: "execute fail" },
        task,
        expectedStatuses,
      );
      logger.warn("operation-failed", taskLog(task, "fail", {
        code: error?.code ?? "UNEXPECTED_ERROR",
        reason: error?.message ?? String(error),
      }));
    } catch (patchError) {
      if (patchError?.code === "STALE_OPERATION") {
        logger.info("operation-revoked", taskLog(task, "revoked", {
          reason: "failure-status-not-owned",
          originalCode: error?.code ?? "UNEXPECTED_ERROR",
        }));
        return;
      }
      logger.error("operation-failure-status-not-written", taskLog(task, "fail", {
        code: patchError?.code ?? "UNEXPECTED_ERROR",
        reason: patchError?.message ?? String(patchError),
      }));
    }
  }

  async function runStart(task) {
    if (!task.recovery) {
      if (outcome === "fail") {
        await controlStore.patch({ status: "execute fail" }, task, [""]);
        logger.warn(
          "operation-failed-by-config",
          taskLog(task, "fail", { code: "CONFIGURED_FAILURE" }),
        );
        return;
      }
      await controlStore.patch({ status: "execute success" }, task, [""]);
      task.confirmedSuccess = true;
      logger.info("start-success", taskLog(task, "success"));
      await waitWhileOwned({
        milliseconds: successDwellMs,
        task,
        controlStore,
        checkEveryMs,
      });
    }

    const published = await publisher.publish(task, {
      recovery: task.recovery,
    });
    await controlStore.assertOwned(task);
    const current = await controlStore.read();
    const finalPatch =
      requestPicture || current.save_picture_flag === 1
        ? { status: "case complete", save_picture_flag: 1 }
        : { status: "case complete" };
    await controlStore.patch(finalPatch, task, ["execute success"]);
    logger.info("start-complete", taskLog(task, "complete", {
      lengths: published.lengths,
      dataMode: published.dataMode,
      dataSource: published.dataSource,
      resolvedSeed: published.resolvedSeed,
    }));
  }

  async function runReinit(task) {
    if (!task.recovery) {
      if (outcome === "fail") {
        await controlStore.patch({ status: "execute fail" }, task, [""]);
        logger.warn(
          "operation-failed-by-config",
          taskLog(task, "fail", { code: "CONFIGURED_FAILURE" }),
        );
        return;
      }
      await controlStore.patch({ status: "execute success" }, task, [""]);
      task.confirmedSuccess = true;
    }
    await waitWhileOwned({
      milliseconds: successDwellMs,
      task,
      controlStore,
      checkEveryMs,
    });
    await controlStore.patch(
      { status: "reinit complete" },
      task,
      ["execute success"],
    );
    logger.info("reinit-complete", taskLog(task, "complete"));
  }

  async function execute(operation) {
    abortController = new AbortController();
    const task = taskContext(operation, abortController);
    activeTask = task;
    logger.info("operation-accepted", taskLog(task, "accepted", {
      outcome,
      dataMode: task.command === "start" ? dataMode : undefined,
    }));

    try {
      if (task.command === "start") await runStart(task);
      else await runReinit(task);
    } catch (error) {
      if (error?.code === "STALE_OPERATION" || task.signal.aborted) {
        logger.info("operation-revoked", taskLog(task, "revoked", {
          reason: error?.message ?? "stopped",
        }));
      } else {
        logger.error("operation-error", taskLog(task, "fail", {
          code: error?.code ?? "UNEXPECTED_ERROR",
          reason: error?.message ?? String(error),
        }));
        await patchFailureIfOwned(task, error);
      }
    } finally {
      activeTask = null;
      abortController = null;
      activePromise = null;
      if (!stopped) void evaluate("task-finished");
    }
  }

  async function evaluate(reason = "manual") {
    if (stopped) return;
    if (evaluating) {
      reevaluate = true;
      return;
    }
    evaluating = true;
    try {
      if (activeTask) return;
      let control;
      try {
        control = await controlStore.read();
        if (lastReadErrorCode !== null) {
          logger.info("control-read-recovered", {
            event: "control-recovered",
            previousCode: lastReadErrorCode,
          });
          lastReadErrorCode = null;
        }
      } catch (error) {
        const code = error?.code ?? "CONTROL_UNREADABLE";
        if (code !== lastReadErrorCode) {
          logger.warn("control-read-waiting", {
            event: "control-wait",
            code,
            reason: error?.message ?? String(error),
          });
          lastReadErrorCode = code;
        }
        return;
      }

      const operation = startupClassified
        ? classifyLive(control)
        : classifyStartup(control);
      startupClassified = true;
      if (!operation || ["idle", "terminal"].includes(operation.kind)) return;
      if (operation.kind === "diagnose") {
        const diagnosticKey = [
          control.case,
          control.command,
          control.dt_type,
          control.status,
          control.save_picture_flag,
        ].join("\u0000");
        if (diagnosticKey !== lastDiagnosticKey) {
          lastDiagnosticKey = diagnosticKey;
          logger.warn("control-snapshot-ignored", {
            event: "diagnose",
            reason,
            command: control.command,
            status: control.status,
            dtType: control.dt_type,
            savePictureFlag: control.save_picture_flag,
          });
        }
        return;
      }

      lastDiagnosticKey = null;
      activePromise = execute(operation);
      void activePromise;
    } finally {
      evaluating = false;
      if (reevaluate && !stopped) {
        reevaluate = false;
        queueMicrotask(() => void evaluate("queued"));
      }
    }
  }

  async function start() {
    if (pollTimer) return;
    try {
      watcher = watchFactory(sharedDir, () => void evaluate("watch"));
      watcher.on?.("error", (error) => {
        logger.warn("watch-error-polling-continues", {
          event: "watch-error",
          reason: error?.message ?? String(error),
        });
      });
    } catch (error) {
      logger.warn("watch-unavailable-polling-continues", {
        event: "watch-unavailable",
        reason: error?.message ?? String(error),
      });
    }
    pollTimer = setInterval(() => void evaluate("poll"), pollMs);
    await evaluate("startup");
  }

  async function stop() {
    if (stopped) return;
    stopped = true;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    watcher?.close?.();
    watcher = null;
    abortController?.abort();
    if (activePromise) await activePromise;
  }

  return {
    start,
    stop,
    evaluate,
    isActive: () => activeTask !== null,
  };
}
