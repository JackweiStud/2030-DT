import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createCase3Stub,
  createControlStore,
  createSilentLogger,
  DEFAULT_FIXTURE_DIR,
  loadFixtureStore,
  loadRuntimeConfig,
  seedInitFiles,
} from "../case3-stub.mjs";
import { SIDE_FILES } from "../src/constants.mjs";

const DEFAULT_CONTROL = Object.freeze({
  case: "case3",
  command: "init",
  dt_type: "",
  status: "",
  save_picture_flag: 0,
  debug_flag: 0,
  scene_type: "U6G",
});

async function createSharedDir(t, control = DEFAULT_CONTROL, write = true) {
  const sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), "case3-stub-"));
  await fs.mkdir(path.join(sharedDir, "case3"), { recursive: true });
  if (write) await writeControl(sharedDir, control);
  t.after(() => fs.rm(sharedDir, { recursive: true, force: true }));
  return sharedDir;
}

async function writeControl(sharedDir, control) {
  await fs.writeFile(
    path.join(sharedDir, "case_control.json"),
    `${JSON.stringify(control, null, 2)}\n`,
  );
}

async function readControl(sharedDir) {
  return JSON.parse(
    await fs.readFile(path.join(sharedDir, "case_control.json"), "utf8"),
  );
}

async function waitFor(predicate, message, timeoutMs = 2500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(message);
}

function testConfig(sharedDir, overrides = {}) {
  return {
    sharedDir,
    pollMs: 5,
    successDwellMs: 5,
    pointMs: 1,
    outcome: "success",
    requestPicture: true,
    seedInit: false,
    logLevel: "info",
    ...overrides,
  };
}

function noWatch() {
  return {
    on() {},
    close() {},
  };
}

async function startStub(t, sharedDir, overrides = {}) {
  const stub = await createCase3Stub({
    config: testConfig(sharedDir, overrides),
    logger: createSilentLogger(),
    watchFactory: noWatch,
    readRetryMs: 1,
  });
  await stub.runner.start();
  t.after(() => stub.runner.stop());
  return stub;
}

async function waitTerminal(sharedDir, status) {
  return waitFor(
    async () => {
      const control = await readControl(sharedDir);
      return control.status === status ? control : null;
    },
    `未等到 ${status}`,
  );
}

function countLines(text) {
  return text.split(/\r?\n/).filter((line) => line.trim() !== "").length;
}

test("正式配置锁定默认值与绝对共享根", async (t) => {
  const sharedDir = await createSharedDir(t);
  const config = await loadRuntimeConfig({ DT_SHARED_DIR: sharedDir });
  assert.deepEqual(
    {
      pollMs: config.pollMs,
      successDwellMs: config.successDwellMs,
      pointMs: config.pointMs,
      outcome: config.outcome,
      requestPicture: config.requestPicture,
      seedInit: config.seedInit,
      logLevel: config.logLevel,
    },
    {
      pollMs: 200,
      successDwellMs: 3000,
      pointMs: 1000,
      outcome: "success",
      requestPicture: true,
      seedInit: true,
      logLevel: "info",
    },
  );
});

test("正式配置拒绝短 dwell、非正间隔和非法枚举/flag", async (t) => {
  const sharedDir = await createSharedDir(t);
  for (const extra of [
    { CASE3_STUB_SUCCESS_DWELL_MS: "2999" },
    { CASE3_STUB_POLL_MS: "0" },
    { CASE3_STUB_POINT_MS: "-1" },
    { CASE3_STUB_OUTCOME: "maybe" },
    { CASE3_STUB_REQUEST_PICTURE: "yes" },
    { CASE3_STUB_SEED_INIT: "2" },
    { CASE3_STUB_LOG_LEVEL: "trace" },
  ]) {
    await assert.rejects(
      loadRuntimeConfig({ DT_SHARED_DIR: sharedDir, ...extra }),
      { code: "CONFIG_INVALID" },
    );
  }
});

test("fixture 独立预检得到两侧各 31 点和本地 Cost override", async () => {
  const fixtureStore = await loadFixtureStore({
    fixtureDir: DEFAULT_FIXTURE_DIR,
  });
  assert.equal(fixtureStore.sides.without.count, 31);
  assert.equal(fixtureStore.sides.with.count, 31);
  assert.equal(fixtureStore.sides.without.costLine, "25");
  assert.equal(fixtureStore.sides.with.costLine, "15");
});

test("fixture 行数错配、scan 重复和错误 Cost 分别快速失败", async (t) => {
  for (const [filename, content] of [
    ["ue_comm_without_dt_sel_beam.txt", "0\n"],
    [
      "ue_comm_without_dt_beams.txt",
      "0,0,2,3,4,5,6,7,8,9,10,11,12,13,14,15\n",
    ],
    ["ue_comm_with_dt_cost.txt", "5\n"],
  ]) {
    const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "case3-fixture-"));
    t.after(() => fs.rm(fixtureDir, { recursive: true, force: true }));
    await fs.cp(DEFAULT_FIXTURE_DIR, fixtureDir, { recursive: true });
    await fs.writeFile(path.join(fixtureDir, filename), content);
    await assert.rejects(loadFixtureStore({ fixtureDir }), {
      code: "FIXTURE_INVALID",
    });
  }
});

test("seed 只创建缺失初始化文件，保留已有合法文件且不写逐点文件", async (t) => {
  const sharedDir = await createSharedDir(t);
  const fixtureStore = await loadFixtureStore({
    fixtureDir: DEFAULT_FIXTURE_DIR,
  });
  const existing = "9,9,9\n";
  await fs.writeFile(
    path.join(sharedDir, "case3", "ue_comm_coordinates_base.txt"),
    existing,
  );
  const actions = await seedInitFiles({
    sharedDir,
    fixtureStore,
    logger: createSilentLogger(),
  });
  assert.deepEqual(actions, {
    baseRoute: "skippedExisting",
    beamAccuracy: "created",
  });
  assert.equal(
    await fs.readFile(
      path.join(sharedDir, "case3", "ue_comm_coordinates_base.txt"),
      "utf8",
    ),
    existing,
  );
  await assert.rejects(
    fs.stat(
      path.join(
        sharedDir,
        "case3",
        SIDE_FILES.without.coordinates,
      ),
    ),
    { code: "ENOENT" },
  );
});

test("seed 遇到已存在非法初始化文件时拒绝覆盖", async (t) => {
  const sharedDir = await createSharedDir(t);
  const fixtureStore = await loadFixtureStore({
    fixtureDir: DEFAULT_FIXTURE_DIR,
  });
  const target = path.join(
    sharedDir,
    "case3",
    "ue_comm_with_dt_beam_accuracy_rate.txt",
  );
  await fs.writeFile(target, "999,1\n");
  await assert.rejects(
    seedInitFiles({
      sharedDir,
      fixtureStore,
      logger: createSilentLogger(),
    }),
    { code: "SEED_TARGET_INVALID" },
  );
  assert.equal(await fs.readFile(target, "utf8"), "999,1\n");
});

test("控制 patch 只写 owned 字段、保留未知字段并复验 ownership", async (t) => {
  const sharedDir = await createSharedDir(t, {
    ...DEFAULT_CONTROL,
    command: "start",
    dt_type: "without dt",
    future_field: { keep: true },
  });
  const store = createControlStore({
    sharedDir,
    logger: createSilentLogger(),
    readRetryMs: 1,
  });
  const task = {
    operationId: "test",
    command: "start",
    side: "without",
    recovery: false,
    signal: new AbortController().signal,
  };
  const written = await store.patch(
    { status: "execute success" },
    task,
    [""],
  );
  assert.deepEqual(written.future_field, { keep: true });
  await assert.rejects(
    store.patch({ save_picture_flag: 0 }, task, ["execute success"]),
    { code: "PATCH_INVALID" },
  );

  await writeControl(sharedDir, {
    ...written,
    case: "case2",
  });
  await assert.rejects(store.assertOwned(task), {
    code: "STALE_OPERATION",
  });
});

test("Without Start 完整逐点发布，只写目标侧并同拍 complete+flag", async (t) => {
  const sharedDir = await createSharedDir(t, {
    ...DEFAULT_CONTROL,
    command: "start",
    dt_type: "without dt",
  });
  await startStub(t, sharedDir);
  const terminal = await waitTerminal(sharedDir, "case complete");
  assert.equal(terminal.save_picture_flag, 1);
  assert.equal(
    countLines(
      await fs.readFile(
        path.join(sharedDir, "case3", SIDE_FILES.without.coordinates),
        "utf8",
      ),
    ),
    31,
  );
  assert.equal(
    await fs.readFile(
      path.join(sharedDir, "case3", SIDE_FILES.without.cost),
      "utf8",
    ),
    "25\n",
  );
  await assert.rejects(
    fs.stat(path.join(sharedDir, "case3", SIDE_FILES.with.coordinates)),
    { code: "ENOENT" },
  );
});

test("With Start no-picture 只写 complete，不置截图 flag", async (t) => {
  const sharedDir = await createSharedDir(t, {
    ...DEFAULT_CONTROL,
    command: "start",
    dt_type: "with dt",
  });
  await startStub(t, sharedDir, { requestPicture: false });
  const terminal = await waitTerminal(sharedDir, "case complete");
  assert.equal(terminal.save_picture_flag, 0);
  assert.equal(
    countLines(
      await fs.readFile(
        path.join(sharedDir, "case3", SIDE_FILES.with.reflection),
        "utf8",
      ),
    ),
    31,
  );
});

test("配置 fail 只写 execute fail，不发布数据或完成终态", async (t) => {
  const sharedDir = await createSharedDir(t, {
    ...DEFAULT_CONTROL,
    command: "start",
    dt_type: "without dt",
  });
  await startStub(t, sharedDir, { outcome: "fail" });
  const terminal = await waitTerminal(sharedDir, "execute fail");
  assert.equal(terminal.save_picture_flag, 0);
  await assert.rejects(
    fs.stat(path.join(sharedDir, "case3", SIDE_FILES.without.coordinates)),
    { code: "ENOENT" },
  );
});

test("ReInit 经过 success 窗口到 reinit complete，永不截图或写数据", async (t) => {
  const sharedDir = await createSharedDir(t, {
    ...DEFAULT_CONTROL,
    command: "reinit",
    dt_type: "with dt",
  });
  await startStub(t, sharedDir);
  const terminal = await waitTerminal(sharedDir, "reinit complete");
  assert.equal(terminal.save_picture_flag, 0);
  await assert.rejects(
    fs.stat(path.join(sharedDir, "case3", SIDE_FILES.with.coordinates)),
    { code: "ENOENT" },
  );
});

test("逐点中途收到 init 后立即撤权，不再追加或覆盖控制", async (t) => {
  const sharedDir = await createSharedDir(t, {
    ...DEFAULT_CONTROL,
    command: "start",
    dt_type: "without dt",
  });
  const stub = await startStub(t, sharedDir, { pointMs: 20 });
  const target = path.join(
    sharedDir,
    "case3",
    SIDE_FILES.without.coordinates,
  );
  await waitFor(
    async () => {
      try {
        return countLines(await fs.readFile(target, "utf8")) >= 1;
      } catch {
        return false;
      }
    },
    "未发布首点",
  );
  await writeControl(sharedDir, DEFAULT_CONTROL);
  await stub.runner.evaluate("test-init");
  await waitFor(() => !stub.runner.isActive(), "旧任务未撤权");
  const stoppedAt = countLines(await fs.readFile(target, "utf8"));
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(countLines(await fs.readFile(target, "utf8")), stoppedAt);
  assert.equal((await readControl(sharedDir)).command, "init");
});

test("启动遇到 Start execute success 时清空半轮并从第 1 点完整重放", async (t) => {
  const sharedDir = await createSharedDir(t, {
    ...DEFAULT_CONTROL,
    command: "start",
    dt_type: "without dt",
    status: "execute success",
  });
  const target = path.join(
    sharedDir,
    "case3",
    SIDE_FILES.without.coordinates,
  );
  await fs.writeFile(target, "999,999,999\n");
  await startStub(t, sharedDir, { requestPicture: false });
  await waitTerminal(sharedDir, "case complete");
  const content = await fs.readFile(target, "utf8");
  assert.equal(countLines(content), 31);
  assert.equal(content.startsWith("1,15,0\n"), true);
  assert.equal(content.includes("999,999,999"), false);
});

test("启动时控制缺失保持运行，文件恢复后可接单", async (t) => {
  const sharedDir = await createSharedDir(t, DEFAULT_CONTROL, false);
  const stub = await startStub(t, sharedDir, { requestPicture: false });
  await writeControl(sharedDir, {
    ...DEFAULT_CONTROL,
    command: "reinit",
    dt_type: "without dt",
  });
  await waitTerminal(sharedDir, "reinit complete");
});

test("启动遇到 ReInit execute success 时重新保持完整 dwell 再完成", async (t) => {
  const sharedDir = await createSharedDir(t, {
    ...DEFAULT_CONTROL,
    command: "reinit",
    dt_type: "with dt",
    status: "execute success",
  });
  const startedAt = Date.now();
  await startStub(t, sharedDir, { successDwellMs: 30 });
  const terminal = await waitTerminal(sharedDir, "reinit complete");
  assert.equal(terminal.save_picture_flag, 0);
  assert.ok(Date.now() - startedAt >= 25);
});

test("stop 撤销在途任务，返回后不再写共享目录", async (t) => {
  const sharedDir = await createSharedDir(t, {
    ...DEFAULT_CONTROL,
    command: "start",
    dt_type: "with dt",
  });
  const stub = await startStub(t, sharedDir, { pointMs: 20 });
  const target = path.join(sharedDir, "case3", SIDE_FILES.with.coordinates);
  await waitFor(
    async () => {
      try {
        return countLines(await fs.readFile(target, "utf8")) >= 1;
      } catch {
        return false;
      }
    },
    "未发布首点",
  );
  await stub.runner.stop();
  const stoppedAt = countLines(await fs.readFile(target, "utf8"));
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(countLines(await fs.readFile(target, "utf8")), stoppedAt);
});
