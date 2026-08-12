import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createControlFileService } from "../../src/cases/case2/control-file.mjs";
import { createSilentLogger } from "../../src/shared/logger.mjs";
import {
  createSharedDir,
  DEFAULT_CONTROL,
  readControl,
  writeControl,
  writePhaseFiles,
} from "../helpers.mjs";

function service(sharedDir, options = {}) {
  return createControlFileService({
    sharedDir,
    logger: createSilentLogger(),
    ...options,
  });
}

test("五个核心字段必填，两个部署字段可选，未知 status 和字段透传", async (t) => {
  const sharedDir = await createSharedDir(t, {
    status: "future backend status",
    future_field: { enabled: true },
  });
  const control = { ...(await readControl(sharedDir)) };
  delete control.debug_flag;
  delete control.scene_type;
  await writeControl(sharedDir, control);

  const snapshot = await service(sharedDir).read();
  assert.equal(snapshot.status, "future backend status");
  assert.deepEqual(snapshot.future_field, { enabled: true });
  assert.equal(Object.hasOwn(snapshot, "debug_flag"), false);
});

test("缺失核心字段或可选字段类型错误时拒绝控制文件", async (t) => {
  const sharedDir = await createSharedDir(t);
  const missing = { ...DEFAULT_CONTROL };
  delete missing.status;
  await writeControl(sharedDir, missing);
  await assert.rejects(service(sharedDir).read(), {
    code: "CONTROL_READ_FAILED",
    status: 500,
  });

  await writeControl(sharedDir, { ...DEFAULT_CONTROL, debug_flag: "0" });
  await assert.rejects(service(sharedDir).read(), {
    code: "CONTROL_READ_FAILED",
    status: 500,
  });
});

test("start、reinit 和进页 init 合并最新快照、清空 status 并保留未知字段", async (t) => {
  const sharedDir = await createSharedDir(t, {
    save_picture_flag: 1,
    future_field: "keep-me",
  });
  const controlFile = service(sharedDir);

  const started = await controlFile.updateFromHttp({
    case: "case2",
    command: "start",
    dt_type: "with dt",
  });
  assert.equal(started.status, "");
  assert.equal(started.command, "start");
  assert.equal(started.future_field, "keep-me");

  await controlFile.updateFromHttp({ command: "init" });
  const reset = await controlFile.updateFromHttp({ command: "reinit" });
  assert.equal(reset.status, "");
  assert.equal(reset.command, "reinit");
  assert.equal(reset.future_field, "keep-me");

  await writeControl(sharedDir, {
    ...reset,
    status: "case complete",
    save_picture_flag: 1,
  });
  const idle = await controlFile.updateFromHttp({ command: "init" });
  assert.equal(idle.case, "case2");
  assert.equal(idle.command, "init");
  assert.equal(idle.dt_type, "");
  assert.equal(idle.status, "");
  assert.equal(idle.save_picture_flag, 0);
  assert.equal(idle.future_field, "keep-me");
});

test("Case2 Start 遇 Windows 瞬时 rename 锁会重试并成功写入控制文件", async (t) => {
  const sharedDir = await createSharedDir(t);
  const realFs = fs;
  let renameCalls = 0;
  const fsOps = {
    ...realFs,
    rename: async (...args) => {
      renameCalls += 1;
      if (renameCalls <= 2) {
        const error = new Error("simulated Windows sharing violation");
        error.code = "EPERM";
        throw error;
      }
      return realFs.rename(...args);
    },
  };

  const written = await service(sharedDir, {
    fsOps,
    renameAttempts: 3,
    renameRetryMs: 0,
  }).updateFromHttp({
    case: "case2",
    command: "start",
    dt_type: "with dt",
  });

  assert.equal(written.command, "start");
  assert.equal(written.status, "");
  assert.equal(renameCalls, 3);
});

test("start 与 reinit 写控制前清空六个 Calibrated 文件，不清 Initial", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writePhaseFiles(sharedDir, "initial");
  await writePhaseFiles(sharedDir, "calibrated", {
    heatmap: "9,9\n9,9\n",
    kpi: "9\n8\n",
  });
  const controlFile = service(sharedDir);
  const case2Dir = path.join(sharedDir, "case2");

  await controlFile.updateFromHttp({
    case: "case2",
    command: "start",
    dt_type: "with dt",
  });
  assert.equal(
    await fs.readFile(path.join(case2Dir, "heatmap_cali_rss.txt"), "utf8"),
    "",
  );
  assert.equal(
    await fs.readFile(
      path.join(case2Dir, "heatmap_cali_kpi_first_path_delay.txt"),
      "utf8",
    ),
    "",
  );
  assert.match(
    await fs.readFile(path.join(case2Dir, "heatmap_init_rss.txt"), "utf8"),
    /1\.235/,
  );

  await writePhaseFiles(sharedDir, "calibrated", {
    heatmap: "7,7\n7,7\n",
    kpi: "7\n",
  });
  await controlFile.updateFromHttp({ command: "init" });
  await controlFile.updateFromHttp({ command: "reinit" });
  assert.equal(
    await fs.readFile(
      path.join(case2Dir, "heatmap_cali_effective_path_num.txt"),
      "utf8",
    ),
    "",
  );
  assert.equal(
    await fs.readFile(
      path.join(case2Dir, "heatmap_cali_kpi_rss.txt"),
      "utf8",
    ),
    "",
  );
  assert.match(
    await fs.readFile(
      path.join(case2Dir, "heatmap_init_kpi_rss.txt"),
      "utf8",
    ),
    /1\.235/,
  );
});

test("控制写入进程内串行，清 flag 不修改 status", async (t) => {
  const sharedDir = await createSharedDir(t);
  const controlFile = service(sharedDir);

  const first = controlFile.updateFromHttp({
    case: "case2",
    command: "start",
    dt_type: "with dt",
  });
  const second = controlFile.updateFromHttp({ command: "reinit" });
  const [firstResult, secondResult] = await Promise.allSettled([first, second]);
  assert.equal(firstResult.status, "fulfilled");
  assert.equal(secondResult.status, "rejected");
  assert.equal(secondResult.reason.code, "CONTROL_BUSY");
  const finalAfterCommands = await readControl(sharedDir);
  assert.equal(finalAfterCommands.command, "start");
  assert.equal(finalAfterCommands.status, "");

  await writeControl(sharedDir, {
    ...finalAfterCommands,
    case: "case2",
    command: "start",
    dt_type: "with dt",
    status: "case complete",
    save_picture_flag: 1,
  });
  const cleared = await controlFile.updateFromHttp({ save_picture_flag: 0 });
  assert.equal(cleared.status, "case complete");
  assert.equal(cleared.save_picture_flag, 0);

  const leftovers = (await fs.readdir(sharedDir)).filter((name) =>
    name.startsWith(".case_control.json."),
  );
  assert.deepEqual(leftovers, []);
});

test("POST 控制 payload 必须严格匹配四种 shape", async (t) => {
  const sharedDir = await createSharedDir(t);
  const controlFile = service(sharedDir);
  await assert.rejects(
    controlFile.updateFromHttp({
      case: "case2",
      command: "start",
      dt_type: "with dt",
      status: "",
    }),
    { code: "INVALID_REQUEST", status: 400 },
  );
  assert.equal(
    (await fs.stat(path.join(sharedDir, "case_control.json"))).isFile(),
    true,
  );
});
