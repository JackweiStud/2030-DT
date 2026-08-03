import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CALIBRATED_FILES,
  createControlStore,
  createPublisher,
  createStubRunner,
  loadConfig,
  readControl,
  runOperation,
} from "../case2-stub.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CASE2_STUB_DIR = path.resolve(__dirname, "..");
const DEFAULT_CONTROL = Object.freeze({
  case: "case2",
  command: "init",
  dt_type: "",
  status: "",
  save_picture_flag: 0,
  debug_flag: 0,
  scene_type: "U6G",
  future_field: "keep-me",
});

const silentLogger = Object.freeze({
  debug() {},
  info() {},
  warn() {},
  error() {},
});

async function makeTempRoot(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "case2-back-stub-"));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });
  return root;
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function createSharedDir(t, controlPatch = {}) {
  const sharedDir = await makeTempRoot(t);
  await fs.mkdir(path.join(sharedDir, "case2"), { recursive: true });
  await writeJson(path.join(sharedDir, "case_control.json"), {
    ...DEFAULT_CONTROL,
    ...controlPatch,
  });
  return sharedDir;
}

async function createSourceDir(t, omitted = new Set()) {
  const sourceDir = await makeTempRoot(t);
  for (const fileName of CALIBRATED_FILES) {
    if (omitted.has(fileName)) continue;
    await fs.writeFile(path.join(sourceDir, fileName), `1 2 3\n4 5 6\n`, "utf8");
  }
  return sourceDir;
}

async function control(sharedDir) {
  return readControl(path.join(sharedDir, "case_control.json"));
}

function createContext(sharedDir, sourceDir, overrides = {}) {
  return {
    controlStore: createControlStore({ sharedDir, logger: silentLogger }),
    publisher: createPublisher({ sharedDir, sourceDir, logger: silentLogger }),
    stepMs: overrides.stepMs ?? 0,
    outcome: overrides.outcome ?? "success",
    requestPicture: overrides.requestPicture ?? false,
    logger: silentLogger,
  };
}

test("loadConfig 要求 CASE2_SHARED_DIR，并校验 outcome", () => {
  assert.throws(() => loadConfig({}), /CASE2_SHARED_DIR is required/);
  assert.throws(
    () =>
      loadConfig({
        CASE2_SHARED_DIR: "/tmp/shared",
        CASE2_STUB_OUTCOME: "maybe",
      }),
    /CASE2_STUB_OUTCOME must be success or fail/,
  );
  const config = loadConfig({ CASE2_SHARED_DIR: "/tmp/shared" });
  assert.equal(config.outcome, "success");
  assert.equal(config.stepMs, 5000);
  assert.equal(config.sourceDir, path.join(CASE2_STUB_DIR, "back"));
});

test("patchControl 只允许打桩 owned 字段并拒绝空 status / flag=0", async (t) => {
  const sharedDir = await createSharedDir(t);
  const store = createControlStore({ sharedDir, logger: silentLogger });

  await assert.rejects(store.patchControl({ command: "start" }), {
    code: "PATCH_INVALID",
  });
  await assert.rejects(store.patchControl({ status: "" }), {
    code: "PATCH_INVALID",
  });
  await assert.rejects(store.patchControl({ save_picture_flag: 0 }), {
    code: "PATCH_INVALID",
  });

  const written = await store.patchControl({ status: "execute success" });
  assert.equal(written.status, "execute success");
  assert.equal(written.command, "init");
  assert.equal(written.case, "case2");
  assert.equal(written.dt_type, "");
  assert.equal(written.debug_flag, 0);
  assert.equal(written.scene_type, "U6G");
  assert.equal(written.future_field, "keep-me");
});

test("start success 保持 execute success 至少 stepMs 后再 complete 并发布六文件", async (t) => {
  const sharedDir = await createSharedDir(t, {
    command: "start",
    dt_type: "with dt",
    status: "",
  });
  const sourceDir = await createSourceDir(t);
  const context = createContext(sharedDir, sourceDir, { stepMs: 80 });

  const startedAt = Date.now();
  const running = runOperation(context, "start");
  await new Promise((resolve) => setTimeout(resolve, 25));
  const middle = await control(sharedDir);
  assert.equal(middle.status, "execute success");

  await running;
  assert.ok(Date.now() - startedAt >= 80);
  const final = await control(sharedDir);
  assert.equal(final.status, "case complete");
  assert.equal(final.save_picture_flag, 0);
  for (const fileName of CALIBRATED_FILES) {
    assert.equal(
      (await fs.stat(path.join(sharedDir, "case2", fileName))).isFile(),
      true,
    );
  }
});

test("请求截图时最终 patch 同拍合并 complete 和 save_picture_flag=1", async () => {
  const patches = [];
  const store = {
    async read() {
      return { ...DEFAULT_CONTROL, command: "start", status: "execute success" };
    },
    async patchControl(patch) {
      patches.push(patch);
      return { ...DEFAULT_CONTROL, command: "start", ...patch };
    },
  };
  const publisher = { async publishCalibratedFiles() {} };

  await runOperation(
    {
      controlStore: store,
      publisher,
      stepMs: 0,
      outcome: "success",
      requestPicture: true,
      logger: silentLogger,
    },
    "start",
  );

  assert.deepEqual(patches, [
    { status: "execute success" },
    { status: "case complete", save_picture_flag: 1 },
  ]);
});

test("reinit success 不置 save_picture_flag", async (t) => {
  const sharedDir = await createSharedDir(t, {
    command: "reinit",
    status: "",
    save_picture_flag: 0,
  });
  const sourceDir = await createSourceDir(t);
  const context = createContext(sharedDir, sourceDir, { stepMs: 10 });

  await runOperation(context, "reinit");
  const final = await control(sharedDir);
  assert.equal(final.status, "reinit complete");
  assert.equal(final.save_picture_flag, 0);
});

test("fail 模式 start/reinit 只写 execute fail", async (t) => {
  for (const operation of ["start", "reinit"]) {
    await t.test(operation, async (st) => {
      const sharedDir = await createSharedDir(st, {
        command: operation,
        dt_type: operation === "start" ? "with dt" : "",
        status: "",
      });
      const sourceDir = await createSourceDir(st);
      const context = createContext(sharedDir, sourceDir, {
        outcome: "fail",
        requestPicture: true,
      });

      await runOperation(context, operation);
      const final = await control(sharedDir);
      assert.equal(final.status, "execute fail");
      assert.equal(final.save_picture_flag, 0);
    });
  }
});

test("缺任一 Calibrated 源文件时不得写 case complete", async (t) => {
  const sharedDir = await createSharedDir(t, {
    command: "start",
    dt_type: "with dt",
    status: "",
  });
  const sourceDir = await createSourceDir(t, new Set(["heatmap_cali_rss.txt"]));
  const context = createContext(sharedDir, sourceDir);

  await assert.rejects(runOperation(context, "start"));
  const final = await control(sharedDir);
  assert.equal(final.status, "execute success");
});

test("旧 start 任务陈旧后不覆盖新一轮状态", async (t) => {
  const sharedDir = await createSharedDir(t, {
    command: "start",
    dt_type: "with dt",
    status: "",
  });
  const sourceDir = await createSourceDir(t);
  const context = createContext(sharedDir, sourceDir, { stepMs: 40 });

  const running = runOperation(context, "start");
  await new Promise((resolve) => setTimeout(resolve, 10));
  await writeJson(path.join(sharedDir, "case_control.json"), {
    ...DEFAULT_CONTROL,
    command: "reinit",
    status: "",
  });

  await assert.rejects(running, { code: "STALE_OPERATION" });
  const final = await control(sharedDir);
  assert.equal(final.command, "reinit");
  assert.equal(final.status, "");
});

test("相同 command 在 execute fail 后只要 status 再清空即可重新触发", async (t) => {
  const sharedDir = await createSharedDir(t, {
    command: "start",
    dt_type: "with dt",
    status: "",
  });
  const sourceDir = await createSourceDir(t);
  const runner = createStubRunner({
    controlStore: createControlStore({ sharedDir, logger: silentLogger }),
    publisher: createPublisher({ sharedDir, sourceDir, logger: silentLogger }),
    stepMs: 0,
    pollMs: 1000,
    outcome: "fail",
    requestPicture: false,
    logger: silentLogger,
  });

  await runner.evaluate("test-1");
  assert.equal((await control(sharedDir)).status, "execute fail");
  await writeJson(path.join(sharedDir, "case_control.json"), {
    ...DEFAULT_CONTROL,
    command: "start",
    dt_type: "with dt",
    status: "",
  });
  await runner.evaluate("test-2");
  assert.equal((await control(sharedDir)).status, "execute fail");
});

test("自己写出的 status 引发 evaluate 不会重复接单", async (t) => {
  const sharedDir = await createSharedDir(t, {
    command: "start",
    dt_type: "with dt",
    status: "",
  });
  const sourceDir = await createSourceDir(t);
  const runner = createStubRunner({
    controlStore: createControlStore({ sharedDir, logger: silentLogger }),
    publisher: createPublisher({ sharedDir, sourceDir, logger: silentLogger }),
    stepMs: 0,
    pollMs: 1000,
    outcome: "success",
    requestPicture: false,
    logger: silentLogger,
  });

  await runner.evaluate("first");
  const afterFirst = await control(sharedDir);
  assert.equal(afterFirst.status, "case complete");
  await runner.evaluate("self-write");
  const afterSecond = await control(sharedDir);
  assert.equal(afterSecond.status, "case complete");
});

test("重启恢复：execute success 的 start/reinit 按成功路径收尾", async (t) => {
  for (const operation of ["start", "reinit"]) {
    await t.test(operation, async (st) => {
      const sharedDir = await createSharedDir(st, {
        command: operation,
        dt_type: operation === "start" ? "with dt" : "",
        status: "execute success",
      });
      const sourceDir = await createSourceDir(st);
      const runner = createStubRunner({
        controlStore: createControlStore({ sharedDir, logger: silentLogger }),
        publisher: createPublisher({ sharedDir, sourceDir, logger: silentLogger }),
        stepMs: 0,
        pollMs: 1000,
        outcome: "fail",
        requestPicture: operation === "start",
        logger: silentLogger,
      });

      await runner.evaluate("startup-recovery");
      const final = await control(sharedDir);
      assert.equal(
        final.status,
        operation === "start" ? "case complete" : "reinit complete",
      );
      assert.equal(final.save_picture_flag, operation === "start" ? 1 : 0);
    });
  }
});

test("重启恢复：idle、已失败、已完成、未知状态均不动作", async (t) => {
  const cases = [
    { command: "init", status: "" },
    { command: "start", status: "execute fail" },
    { command: "start", status: "case complete" },
    { command: "reinit", status: "reinit complete" },
    { command: "start", status: "future status" },
  ];

  for (const snapshot of cases) {
    await t.test(`${snapshot.command}:${snapshot.status}`, async (st) => {
      const sharedDir = await createSharedDir(st, {
        ...snapshot,
        dt_type: snapshot.command === "start" ? "with dt" : "",
      });
      const sourceDir = await createSourceDir(st);
      const runner = createStubRunner({
        controlStore: createControlStore({ sharedDir, logger: silentLogger }),
        publisher: createPublisher({ sharedDir, sourceDir, logger: silentLogger }),
        stepMs: 0,
        pollMs: 1000,
        outcome: "success",
        requestPicture: true,
        logger: silentLogger,
      });

      await runner.evaluate("startup-noop");
      assert.deepEqual(await control(sharedDir), {
        ...DEFAULT_CONTROL,
        ...snapshot,
        dt_type: snapshot.command === "start" ? "with dt" : "",
      });
    });
  }
});
