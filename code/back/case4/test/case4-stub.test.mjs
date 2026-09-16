import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  BASE_FILE,
  CDF_FILES,
  createCase4Stub,
  createControlStore,
  createInjectedDataset,
  createPublisher,
  createRoundDataset,
  createSilentLogger,
  DEFAULTS,
  DEFAULT_FIXTURE_DIR,
  DYNAMIC_FILES,
  loadFixtureStore,
  loadRuntimeConfig,
  roundSemanticNumber,
  seedInitFiles,
  SUMMARY_FILE,
  THROUGHPUT_FILES,
  TRAJECTORY_FILES,
} from "../case4-stub.mjs";

const DEFAULT_CONTROL = Object.freeze({
  case: "case4",
  command: "init",
  dt_type: "",
  status: "",
  save_picture_flag: 0,
  debug_flag: 0,
  scene_type: "U6G",
});

const START_CONTROL = Object.freeze({
  ...DEFAULT_CONTROL,
  command: "start",
  dt_type: "with dt",
  future_field: { keep: true },
});

async function createSharedDir(t, control = DEFAULT_CONTROL, write = true) {
  const sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), "case4-stub-"));
  await fs.mkdir(path.join(sharedDir, "case4"), { recursive: true });
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

async function waitFor(predicate, message, timeoutMs = 20000) {
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
    stepMs: 1,
    outcome: "success",
    requestPicture: true,
    seedInit: false,
    dataMode: "replay",
    seed: "",
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

function countLines(text) {
  return text.split(/\r?\n/).filter((line) => line.trim() !== "").length;
}

async function readCase4(sharedDir, filename) {
  return fs.readFile(path.join(sharedDir, "case4", filename), "utf8");
}

async function copyFixtures(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "case4-fx-"));
  await fs.cp(DEFAULT_FIXTURE_DIR, dir, { recursive: true });
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

async function writeLines(filePath, lines) {
  await fs.writeFile(filePath, lines.length ? `${lines.join("\n")}\n` : "");
}

async function emptyDynamics(sharedDir) {
  const dir = path.join(sharedDir, "case4");
  await fs.mkdir(dir, { recursive: true });
  for (const filename of DYNAMIC_FILES) {
    await fs.writeFile(path.join(dir, filename), "");
  }
}

async function seedBaseFromDefault(sharedDir) {
  const text = await fs.readFile(
    path.join(DEFAULT_FIXTURE_DIR, BASE_FILE),
    "utf8",
  );
  await fs.mkdir(path.join(sharedDir, "case4"), { recursive: true });
  await fs.writeFile(path.join(sharedDir, "case4", BASE_FILE), text);
}

async function startStub(t, sharedDir, overrides = {}) {
  const stub = await createCase4Stub({
    config: testConfig(sharedDir, overrides),
    logger: createSilentLogger(),
    watchFactory: noWatch,
    readRetryMs: 1,
    fixtureDir: overrides.fixtureDir,
    createDataset: overrides.createDataset,
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

test("正式配置锁定默认值与绝对共享根", async (t) => {
  const sharedDir = await createSharedDir(t);
  const config = await loadRuntimeConfig({ DT_SHARED_DIR: sharedDir });
  assert.deepEqual(
    {
      pollMs: config.pollMs,
      successDwellMs: config.successDwellMs,
      stepMs: config.stepMs,
      outcome: config.outcome,
      requestPicture: config.requestPicture,
      seedInit: config.seedInit,
      dataMode: config.dataMode,
      seed: config.seed,
      logLevel: config.logLevel,
    },
    {
      pollMs: DEFAULTS.pollMs,
      successDwellMs: DEFAULTS.successDwellMs,
      stepMs: DEFAULTS.stepMs,
      outcome: DEFAULTS.outcome,
      requestPicture: DEFAULTS.requestPicture,
      seedInit: DEFAULTS.seedInit,
      dataMode: DEFAULTS.dataMode,
      seed: DEFAULTS.seed,
      logLevel: DEFAULTS.logLevel,
    },
  );
});

test("正式配置拒绝短 dwell、非正间隔和非法枚举/flag", async (t) => {
  const sharedDir = await createSharedDir(t);
  for (const extra of [
    { CASE4_STUB_SUCCESS_DWELL_MS: "2999" },
    { CASE4_STUB_POLL_MS: "0" },
    { CASE4_STUB_STEP_MS: "-1" },
    { CASE4_STUB_OUTCOME: "maybe" },
    { CASE4_STUB_REQUEST_PICTURE: "yes" },
    { CASE4_STUB_DATA_MODE: "copy" },
    { CASE4_STUB_LOG_LEVEL: "trace" },
    { DT_SHARED_DIR: "relative" },
  ]) {
    await assert.rejects(
      loadRuntimeConfig({ DT_SHARED_DIR: sharedDir, ...extra }),
      { code: "CONFIG_INVALID" },
    );
  }
});

test("roundSemanticNumber 含 EPSILON 的边界与契约一致", () => {
  assert.equal(roundSemanticNumber(1.005, 2), 1.01);
  assert.equal(roundSemanticNumber(-1.005, 2), -1.01);
  assert.equal(roundSemanticNumber(-0.001, 2), 0);
});

test("默认 fixtures 预检通过且不硬编码发布循环", async () => {
  const store = await loadFixtureStore({ fixtureDir: DEFAULT_FIXTURE_DIR });
  assert.ok(store.base.lines.length >= 1);
  assert.equal(
    store.trajectories.traditional.lines.length,
    store.trajectories.commercial.lines.length,
  );
  assert.equal(
    store.trajectories.traditional.lines.length,
    store.trajectories.dt.lines.length,
  );
  assert.ok(store.trajectories.traditional.lines.length <= store.base.lines.length);
  assert.ok(store.statistics.cdf.traditional.rows.length >= 1);
  assert.equal(store.statistics.summary.rows.length, 4);
});

test("正式入口加载三轨迹 5/3/4 启动失败", async (t) => {
  const dir = await copyFixtures(t);
  const store = await loadFixtureStore({ fixtureDir: DEFAULT_FIXTURE_DIR });
  await writeLines(
    path.join(dir, TRAJECTORY_FILES.traditional),
    store.trajectories.traditional.lines.slice(0, 5),
  );
  await writeLines(
    path.join(dir, TRAJECTORY_FILES.commercial),
    store.trajectories.commercial.lines.slice(0, 3),
  );
  await writeLines(
    path.join(dir, TRAJECTORY_FILES.dt),
    store.trajectories.dt.lines.slice(0, 4),
  );
  await assert.rejects(loadFixtureStore({ fixtureDir: dir }), {
    code: "FIXTURE_INVALID",
  });
});

test("记录中间空行、负吞吐、非单调 CDF、p50>p90、NLOS>1、base 含 65535 分别失败", async (t) => {
  const cases = [
    async (dir) => {
      const text = await fs.readFile(path.join(dir, BASE_FILE), "utf8");
      await fs.writeFile(path.join(dir, BASE_FILE), `1,15,0\n\n2,14,0\n`);
      return text;
    },
    async (dir) => {
      await fs.writeFile(path.join(dir, THROUGHPUT_FILES.without), "-1\n");
    },
    async (dir) => {
      await fs.writeFile(
        path.join(dir, CDF_FILES.traditional),
        "1 0.2\n0.5 0.3\n",
      );
    },
    async (dir) => {
      await fs.writeFile(
        path.join(dir, SUMMARY_FILE),
        "3 1\n1 2\n1 2\n0.1 0\n",
      );
    },
    async (dir) => {
      await fs.writeFile(
        path.join(dir, SUMMARY_FILE),
        "1 2\n1 2\n1 2\n1.5 0\n",
      );
    },
    async (dir) => {
      await fs.writeFile(path.join(dir, BASE_FILE), "65535,15,0\n1,14,0\n");
    },
  ];
  for (const mutate of cases) {
    const dir = await copyFixtures(t);
    await mutate(dir);
    await assert.rejects(loadFixtureStore({ fixtureDir: dir }), {
      code: "FIXTURE_INVALID",
    });
  }
});

test("仅首尾空行的 fixture 预检通过，replay 不发布空记录", async (t) => {
  const dir = await copyFixtures(t);
  for (const filename of [BASE_FILE, TRAJECTORY_FILES.traditional]) {
    const text = await fs.readFile(path.join(dir, filename), "utf8");
    await fs.writeFile(path.join(dir, filename), `\n\n${text}\n\n`);
  }
  const store = await loadFixtureStore({ fixtureDir: dir });
  assert.ok(store.base.lines.every((line) => line.trim() !== ""));
  const sharedDir = await createSharedDir(t, START_CONTROL);
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  await startStub(t, sharedDir, { fixtureDir: dir, dataMode: "replay" });
  await waitTerminal(sharedDir, "case complete");
  const published = await readCase4(
    sharedDir,
    TRAJECTORY_FILES.traditional,
  );
  assert.equal(published.includes("\n\n"), false);
  assert.equal(
    countLines(published),
    store.trajectories.traditional.lines.length,
  );
});

test("random 固定 seed 可复现，不同 seed 有变化，Z/65535/base 不被改", async (t) => {
  const dir = await copyFixtures(t);
  const original = await loadFixtureStore({ fixtureDir: DEFAULT_FIXTURE_DIR });
  const sentinelLine = "65535,15,0.94";
  const traj = [...original.trajectories.traditional.lines];
  traj[0] = sentinelLine;
  for (const scheme of ["traditional", "commercial", "dt"]) {
    await writeLines(path.join(dir, TRAJECTORY_FILES[scheme]), traj);
  }
  const store = await loadFixtureStore({ fixtureDir: dir });
  const a = createRoundDataset({
    fixtureStore: store,
    dataMode: "random",
    seed: "demo-1",
    operationId: "x",
  });
  const b = createRoundDataset({
    fixtureStore: store,
    dataMode: "random",
    seed: "demo-1",
    operationId: "y",
  });
  const c = createRoundDataset({
    fixtureStore: store,
    dataMode: "random",
    seed: "demo-2",
    operationId: "z",
  });
  assert.deepEqual(a.trajectories, b.trajectories);
  assert.deepEqual(a.throughputs, b.throughputs);
  assert.notDeepEqual(a.trajectories, c.trajectories);
  assert.equal(a.trajectories.traditional[0].split(",")[0], "65535");
  assert.equal(
    a.trajectories.traditional[1].split(",")[2],
    store.trajectories.traditional.points[1].tokens[2],
  );

  const sharedDir = await createSharedDir(t, START_CONTROL);
  await seedInitFiles({
    sharedDir,
    fixtureStore: store,
    logger: createSilentLogger(),
  });
  const before = await readCase4(sharedDir, BASE_FILE);
  await emptyDynamics(sharedDir);
  await startStub(t, sharedDir, {
    fixtureDir: dir,
    dataMode: "random",
    seed: "demo-1",
  });
  await waitTerminal(sharedDir, "case complete");
  assert.equal(await readCase4(sharedDir, BASE_FILE), before);
});

test("控制 patch 只写 owned 字段、保留未知字段并复验 ownership", async (t) => {
  const sharedDir = await createSharedDir(t, START_CONTROL);
  const store = createControlStore({
    sharedDir,
    logger: createSilentLogger(),
    readRetryMs: 1,
  });
  const task = {
    operationId: "test",
    command: "start",
    dtType: "with dt",
    recovery: false,
    signal: new AbortController().signal,
  };
  const written = await store.patch({ status: "execute success" }, task, [""]);
  assert.deepEqual(written.future_field, { keep: true });
  await assert.rejects(
    store.patch({ save_picture_flag: 0 }, task, ["execute success"]),
    { code: "PATCH_INVALID" },
  );
  await writeControl(sharedDir, { ...written, case: "case3" });
  await assert.rejects(store.assertOwned(task), { code: "STALE_OPERATION" });
});

test("控制 patch 遇 Windows 瞬时 rename 锁会重试", async (t) => {
  const sharedDir = await createSharedDir(t, START_CONTROL);
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
  const store = createControlStore({
    sharedDir,
    fsOps,
    logger: createSilentLogger(),
    readRetryMs: 1,
    renameAttempts: 3,
    renameRetryMs: 0,
  });
  const task = {
    operationId: "windows-rename-lock",
    command: "start",
    dtType: "with dt",
    recovery: false,
    signal: new AbortController().signal,
  };
  const written = await store.patch({ status: "execute success" }, task, [""]);
  assert.equal(written.status, "execute success");
  assert.equal(renameCalls, 3);
});

async function patchDuringRenameRetry(t, mutateControl) {
  const sharedDir = await createSharedDir(t, START_CONTROL);
  const realFs = fs;
  let renameCalls = 0;
  const abortController = new AbortController();
  const fsOps = {
    ...realFs,
    rename: async (...args) => {
      renameCalls += 1;
      if (renameCalls === 1) {
        await mutateControl({ sharedDir, abortController });
        const error = new Error("simulated Windows sharing violation");
        error.code = "EPERM";
        throw error;
      }
      return realFs.rename(...args);
    },
  };
  const store = createControlStore({
    sharedDir,
    fsOps,
    logger: createSilentLogger(),
    readRetryMs: 1,
    renameAttempts: 3,
    renameRetryMs: 0,
  });
  const task = {
    operationId: "rename-retry-revoke",
    command: "start",
    dtType: "with dt",
    recovery: false,
    signal: abortController.signal,
  };
  await assert.rejects(
    store.patch({ status: "execute success" }, task, [""]),
    { code: "STALE_OPERATION" },
  );
  return { sharedDir, renameCalls };
}

test("rename 重试期间遇到 init 不得提交旧快照", async (t) => {
  const { sharedDir, renameCalls } = await patchDuringRenameRetry(
    t,
    async ({ sharedDir: dir }) => {
      await writeControl(dir, {
        ...DEFAULT_CONTROL,
        observer_field: "keep-init",
      });
    },
  );
  const control = await readControl(sharedDir);
  assert.equal(renameCalls, 1);
  assert.equal(control.command, "init");
  assert.equal(control.status, "");
  assert.equal(control.observer_field, "keep-init");
});

test("rename 重试期间切换 case 不得提交旧快照", async (t) => {
  const { sharedDir, renameCalls } = await patchDuringRenameRetry(
    t,
    async ({ sharedDir: dir }) => {
      await writeControl(dir, {
        ...START_CONTROL,
        case: "case3",
        observer_field: "keep-case3",
      });
    },
  );
  const control = await readControl(sharedDir);
  assert.equal(renameCalls, 1);
  assert.equal(control.case, "case3");
  assert.equal(control.status, "");
  assert.equal(control.observer_field, "keep-case3");
});

test("rename 重试期间进程停止不得继续提交", async (t) => {
  const { sharedDir, renameCalls } = await patchDuringRenameRetry(
    t,
    ({ abortController }) => {
      abortController.abort();
    },
  );
  const control = await readControl(sharedDir);
  assert.equal(renameCalls, 1);
  assert.equal(control.command, "start");
  assert.equal(control.status, "");
});

test("发布失败与新空 status 同时发生时不得把新轮标成 fail", async (t) => {
  const sharedDir = await createSharedDir(t, START_CONTROL);
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  const logger = createSilentLogger();
  const config = testConfig(sharedDir, { dataMode: "replay" });
  const fixtureStore = await loadFixtureStore({
    fixtureDir: DEFAULT_FIXTURE_DIR,
  });
  const controlStore = createControlStore({
    sharedDir,
    logger,
    readRetryMs: 1,
  });
  const inner = createPublisher({
    sharedDir,
    fixtureStore,
    controlStore,
    logger,
    stepMs: config.stepMs,
    pollMs: config.pollMs,
    dataMode: "replay",
  });
  let firstPublishReady;
  const firstPublishStarted = new Promise((resolve) => {
    firstPublishReady = resolve;
  });
  let releaseFail;
  const failGate = new Promise((resolve) => {
    releaseFail = resolve;
  });
  let publishCount = 0;
  const stub = await createCase4Stub({
    config,
    logger,
    watchFactory: noWatch,
    readRetryMs: 1,
    fixtureStore,
    controlStore,
    publisher: {
      publish: async (task, optionsForPublish) => {
        publishCount += 1;
        if (publishCount === 1) {
          firstPublishReady();
          await failGate;
          const error = new Error("simulated publish I/O");
          error.code = "DATA_WRITE_FAILED";
          throw error;
        }
        return inner.publish(task, optionsForPublish);
      },
    },
  });
  await stub.runner.start();
  t.after(() => stub.runner.stop());
  await firstPublishStarted;
  await writeControl(sharedDir, {
    ...START_CONTROL,
    status: "",
    next_round: true,
  });
  releaseFail();
  const terminal = await waitFor(async () => {
    const control = await readControl(sharedDir);
    return control.status === "case complete" && control.next_round === true
      ? control
      : null;
  }, "新轮应继续执行到 complete");
  assert.equal(terminal.save_picture_flag, 1);
  assert.equal(publishCount, 2);
});

test("replay Start 原样回放并同拍 complete+flag", async (t) => {
  const sharedDir = await createSharedDir(t, START_CONTROL);
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  const store = await loadFixtureStore({ fixtureDir: DEFAULT_FIXTURE_DIR });
  await startStub(t, sharedDir, { dataMode: "replay" });
  const terminal = await waitTerminal(sharedDir, "case complete");
  assert.equal(terminal.save_picture_flag, 1);
  assert.deepEqual(terminal.future_field, { keep: true });
  for (const scheme of ["traditional", "commercial", "dt"]) {
    assert.equal(
      (await readCase4(sharedDir, TRAJECTORY_FILES[scheme])).trim(),
      store.trajectories[scheme].lines.join("\n"),
    );
  }
  assert.equal(
    (await readCase4(sharedDir, CDF_FILES.dt)).trim(),
    store.statistics.cdf.dt.lines.join("\n"),
  );
});

test("dwell 结束前不发数据和 complete", async (t) => {
  const sharedDir = await createSharedDir(t, START_CONTROL);
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  await startStub(t, sharedDir, {
    dataMode: "replay",
    successDwellMs: 40,
    stepMs: 1,
  });
  await waitFor(
    async () => (await readControl(sharedDir)).status === "execute success",
    "未见到 execute success",
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(
    countLines(await readCase4(sharedDir, TRAJECTORY_FILES.dt)),
    0,
  );
  assert.equal((await readControl(sharedDir)).status, "execute success");
  await waitTerminal(sharedDir, "case complete");
});

test("no-picture 只写 complete；fail 不写数据", async (t) => {
  const sharedDir = await createSharedDir(t, START_CONTROL);
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  await startStub(t, sharedDir, {
    dataMode: "replay",
    requestPicture: false,
  });
  const terminal = await waitTerminal(sharedDir, "case complete");
  assert.equal(terminal.save_picture_flag, 0);

  const failDir = await createSharedDir(t, START_CONTROL);
  await seedBaseFromDefault(failDir);
  await emptyDynamics(failDir);
  await startStub(t, failDir, { outcome: "fail", dataMode: "replay" });
  await waitTerminal(failDir, "execute fail");
  assert.equal(countLines(await readCase4(failDir, TRAJECTORY_FILES.dt)), 0);
  assert.equal(countLines(await readCase4(failDir, SUMMARY_FILE)), 0);
});

test("相同 command 在 execute fail 后只要 status 再清空即可重新触发", async (t) => {
  const sharedDir = await createSharedDir(t, START_CONTROL);
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  const stub = await startStub(t, sharedDir, { outcome: "fail" });
  await waitTerminal(sharedDir, "execute fail");
  await waitFor(async () => !stub.runner.isActive(), "首轮未释放");
  await writeControl(sharedDir, {
    ...START_CONTROL,
    status: "",
    round: 2,
  });
  await waitFor(async () => {
    const control = await readControl(sharedDir);
    return control.status === "execute fail" && control.round === 2;
  }, "未再次接单并 fail");
});

test("watch 不可用时轮询仍可完成主线", async (t) => {
  const sharedDir = await createSharedDir(t, START_CONTROL);
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  const stub = await createCase4Stub({
    config: testConfig(sharedDir),
    logger: createSilentLogger(),
    watchFactory: () => {
      throw new Error("watch unavailable");
    },
    readRetryMs: 1,
  });
  await stub.runner.start();
  t.after(() => stub.runner.stop());
  await waitTerminal(sharedDir, "case complete");
});

test("控制文件启动时不存在：随后创建后可接单", async (t) => {
  const sharedDir = await createSharedDir(t, START_CONTROL, false);
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  await startStub(t, sharedDir);
  await writeControl(sharedDir, START_CONTROL);
  await waitTerminal(sharedDir, "case complete");
});

test("JSON 短暂非法只等待，恢复后可接单", async (t) => {
  const sharedDir = await createSharedDir(t, START_CONTROL);
  await fs.writeFile(path.join(sharedDir, "case_control.json"), "{");
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  await startStub(t, sharedDir);
  await new Promise((resolve) => setTimeout(resolve, 20));
  await writeControl(sharedDir, START_CONTROL);
  await waitTerminal(sharedDir, "case complete");
});

test("轨迹 30 / 吞吐 38 不被截断；38/12 与单路空、双路空可 complete", async (t) => {
  const store = await loadFixtureStore({ fixtureDir: DEFAULT_FIXTURE_DIR });

  async function runInjected(throughputs, trajCount = 3) {
    const sharedDir = await createSharedDir(t, START_CONTROL);
    await seedBaseFromDefault(sharedDir);
    await emptyDynamics(sharedDir);
    await startStub(t, sharedDir, {
      createDataset: () =>
        createInjectedDataset({
          trajectories: {
            traditional: store.trajectories.traditional.lines.slice(0, trajCount),
            commercial: store.trajectories.commercial.lines.slice(0, trajCount),
            dt: store.trajectories.dt.lines.slice(0, trajCount),
          },
          throughputs,
          statistics: {
            cdf: {
              traditional: store.statistics.cdf.traditional.lines,
              commercial: store.statistics.cdf.commercial.lines,
              dt: store.statistics.cdf.dt.lines,
            },
            summary: store.statistics.summary.lines,
          },
        }),
    });
    await waitTerminal(sharedDir, "case complete");
    return sharedDir;
  }

  const a = await runInjected(
    {
      without: store.throughputs.without.lines,
      with: store.throughputs.with.lines,
    },
    30,
  );
  assert.equal(countLines(await readCase4(a, TRAJECTORY_FILES.dt)), 30);
  assert.equal(
    countLines(await readCase4(a, THROUGHPUT_FILES.without)),
    store.throughputs.without.lines.length,
  );

  const b = await runInjected({
    without: store.throughputs.without.lines,
    with: store.throughputs.with.lines.slice(0, 12),
  });
  assert.equal(
    countLines(await readCase4(b, THROUGHPUT_FILES.without)),
    store.throughputs.without.lines.length,
  );
  assert.equal(countLines(await readCase4(b, THROUGHPUT_FILES.with)), 12);

  const c = await runInjected({
    without: [],
    with: store.throughputs.with.lines.slice(0, 4),
  });
  assert.equal(countLines(await readCase4(c, THROUGHPUT_FILES.without)), 0);
  assert.equal(countLines(await readCase4(c, THROUGHPUT_FILES.with)), 4);

  const d = await runInjected({ without: [], with: [] });
  assert.equal(countLines(await readCase4(d, THROUGHPUT_FILES.without)), 0);
  assert.equal(countLines(await readCase4(d, THROUGHPUT_FILES.with)), 0);
});

test("合法 fixture 目录 base 38 / 三轨迹 30 可 complete", async (t) => {
  const dir = await copyFixtures(t);
  const store = await loadFixtureStore({ fixtureDir: DEFAULT_FIXTURE_DIR });
  for (const scheme of ["traditional", "commercial", "dt"]) {
    await writeLines(
      path.join(dir, TRAJECTORY_FILES[scheme]),
      store.trajectories[scheme].lines.slice(0, 30),
    );
  }
  const sharedDir = await createSharedDir(t, START_CONTROL);
  const loaded = await loadFixtureStore({ fixtureDir: dir });
  await seedInitFiles({
    sharedDir,
    fixtureStore: loaded,
    logger: createSilentLogger(),
  });
  await emptyDynamics(sharedDir);
  await startStub(t, sharedDir, { fixtureDir: dir, dataMode: "replay" });
  await waitTerminal(sharedDir, "case complete");
  assert.equal(countLines(await readCase4(sharedDir, TRAJECTORY_FILES.dt)), 30);
  assert.equal(countLines(await readCase4(sharedDir, BASE_FILE)), store.base.lines.length);
});

test("发布器注入 5/3/4 发完后 execute fail，不写 complete", async (t) => {
  const store = await loadFixtureStore({ fixtureDir: DEFAULT_FIXTURE_DIR });
  const sharedDir = await createSharedDir(t, START_CONTROL);
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  await startStub(t, sharedDir, {
    createDataset: () =>
      createInjectedDataset({
        trajectories: {
          traditional: store.trajectories.traditional.lines.slice(0, 5),
          commercial: store.trajectories.commercial.lines.slice(0, 3),
          dt: store.trajectories.dt.lines.slice(0, 4),
        },
        throughputs: {
          without: store.throughputs.without.lines.slice(0, 2),
          with: store.throughputs.with.lines.slice(0, 2),
        },
        statistics: {
          cdf: {
            traditional: store.statistics.cdf.traditional.lines,
            commercial: store.statistics.cdf.commercial.lines,
            dt: store.statistics.cdf.dt.lines,
          },
          summary: store.statistics.summary.lines,
        },
      }),
  });
  await waitTerminal(sharedDir, "execute fail");
  assert.equal(countLines(await readCase4(sharedDir, TRAJECTORY_FILES.traditional)), 5);
  assert.equal(countLines(await readCase4(sharedDir, TRAJECTORY_FILES.commercial)), 3);
  assert.equal(countLines(await readCase4(sharedDir, TRAJECTORY_FILES.dt)), 4);
  assert.equal(countLines(await readCase4(sharedDir, SUMMARY_FILE)), 0);
});

test("ReInit 经过 success 窗口到 reinit complete，永不截图或写数据", async (t) => {
  const sharedDir = await createSharedDir(t, {
    ...DEFAULT_CONTROL,
    command: "reinit",
    dt_type: "with dt",
  });
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  await startStub(t, sharedDir);
  const terminal = await waitTerminal(sharedDir, "reinit complete");
  assert.equal(terminal.save_picture_flag, 0);
  assert.equal(countLines(await readCase4(sharedDir, TRAJECTORY_FILES.dt)), 0);
});

test("逐点中途收到 init 后立即撤权，不再追加或覆盖控制", async (t) => {
  const sharedDir = await createSharedDir(t, START_CONTROL);
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  await startStub(t, sharedDir, { successDwellMs: 5, stepMs: 20 });
  await waitFor(
    async () => (await readControl(sharedDir)).status === "execute success",
    "未见到 success",
  );
  await waitFor(
    async () => countLines(await readCase4(sharedDir, TRAJECTORY_FILES.dt)) >= 1,
    "未见到首行",
  );
  await writeControl(sharedDir, DEFAULT_CONTROL);
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal((await readControl(sharedDir)).command, "init");
  assert.equal((await readControl(sharedDir)).status, "");
});

test("启动遇到 Start execute success 时清空半轮并从第 1 点完整重放", async (t) => {
  const sharedDir = await createSharedDir(t, {
    ...START_CONTROL,
    status: "execute success",
  });
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  await fs.writeFile(
    path.join(sharedDir, "case4", TRAJECTORY_FILES.dt),
    "9,9,9\n",
  );
  const store = await loadFixtureStore({ fixtureDir: DEFAULT_FIXTURE_DIR });
  await startStub(t, sharedDir, { dataMode: "replay" });
  await waitTerminal(sharedDir, "case complete");
  assert.equal(
    countLines(await readCase4(sharedDir, TRAJECTORY_FILES.dt)),
    store.trajectories.dt.lines.length,
  );
  assert.equal(
    (await readCase4(sharedDir, TRAJECTORY_FILES.dt)).startsWith("9,9,9"),
    false,
  );
});

test("启动遇到 ReInit execute success 时重新保持完整 dwell 再完成", async (t) => {
  const sharedDir = await createSharedDir(t, {
    ...DEFAULT_CONTROL,
    command: "reinit",
    dt_type: "with dt",
    status: "execute success",
  });
  await startStub(t, sharedDir, { successDwellMs: 15 });
  await waitTerminal(sharedDir, "reinit complete");
});

test("启动恢复表：idle/终态/非法 dt_type/reinit+flag1 均不动作", async (t) => {
  const snapshots = [
    DEFAULT_CONTROL,
    { ...START_CONTROL, status: "execute fail" },
    { ...START_CONTROL, status: "case complete" },
    {
      ...DEFAULT_CONTROL,
      command: "reinit",
      dt_type: "with dt",
      status: "reinit complete",
    },
    { ...START_CONTROL, dt_type: "without dt", status: "" },
    {
      ...DEFAULT_CONTROL,
      command: "reinit",
      dt_type: "with dt",
      status: "execute success",
      save_picture_flag: 1,
    },
  ];
  for (const control of snapshots) {
    const sharedDir = await createSharedDir(t, control);
    await seedBaseFromDefault(sharedDir);
    await emptyDynamics(sharedDir);
    await startStub(t, sharedDir);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal((await readControl(sharedDir)).status, control.status);
    assert.equal(countLines(await readCase4(sharedDir, TRAJECTORY_FILES.dt)), 0);
  }
});

test("stop 撤销在途任务，返回后不再写共享目录", async (t) => {
  const sharedDir = await createSharedDir(t, START_CONTROL);
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  const stub = await createCase4Stub({
    config: testConfig(sharedDir, { stepMs: 30, successDwellMs: 5 }),
    logger: createSilentLogger(),
    watchFactory: noWatch,
    readRetryMs: 1,
  });
  await stub.runner.start();
  await waitFor(
    async () => (await readControl(sharedDir)).status === "execute success",
    "未见到 success",
  );
  await stub.runner.stop();
  const afterStop = countLines(await readCase4(sharedDir, TRAJECTORY_FILES.dt));
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(
    countLines(await readCase4(sharedDir, TRAJECTORY_FILES.dt)),
    afterStop,
  );
  assert.notEqual((await readControl(sharedDir)).status, "execute fail");
});

test("第二轮不继承第一轮 append", async (t) => {
  const sharedDir = await createSharedDir(t, START_CONTROL);
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  const stub = await startStub(t, sharedDir, { dataMode: "replay" });
  await waitTerminal(sharedDir, "case complete");
  const first = countLines(await readCase4(sharedDir, TRAJECTORY_FILES.dt));
  await emptyDynamics(sharedDir);
  await writeControl(sharedDir, { ...START_CONTROL, status: "" });
  await waitTerminal(sharedDir, "case complete");
  assert.equal(
    countLines(await readCase4(sharedDir, TRAJECTORY_FILES.dt)),
    first,
  );
  void stub;
});

test("seed 只创建缺失 base；非法或不匹配则退出；不改动态文件", async (t) => {
  const sharedDir = await createSharedDir(t);
  const store = await loadFixtureStore({ fixtureDir: DEFAULT_FIXTURE_DIR });
  await emptyDynamics(sharedDir);
  const created = await seedInitFiles({
    sharedDir,
    fixtureStore: store,
    logger: createSilentLogger(),
  });
  assert.equal(created.base, "created");
  const skipped = await seedInitFiles({
    sharedDir,
    fixtureStore: store,
    logger: createSilentLogger(),
  });
  assert.equal(skipped.base, "skippedExisting");

  await fs.writeFile(path.join(sharedDir, "case4", BASE_FILE), "not-a-coord\n");
  await assert.rejects(
    seedInitFiles({
      sharedDir,
      fixtureStore: store,
      logger: createSilentLogger(),
    }),
    { code: "SEED_TARGET_INVALID" },
  );

  const other = await createSharedDir(t);
  await fs.writeFile(path.join(other, "case4", BASE_FILE), "9,9,9\n8,8,8\n");
  await assert.rejects(
    seedInitFiles({
      sharedDir: other,
      fixtureStore: store,
      logger: createSilentLogger(),
    }),
    { code: "SEED_BASE_MISMATCH" },
  );
  assert.equal(await readCase4(other, BASE_FILE), "9,9,9\n8,8,8\n");
});

test("注入 30/30/31 发完后不得 complete", async (t) => {
  const store = await loadFixtureStore({ fixtureDir: DEFAULT_FIXTURE_DIR });
  const sharedDir = await createSharedDir(t, START_CONTROL);
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  await startStub(t, sharedDir, {
    createDataset: () =>
      createInjectedDataset({
        trajectories: {
          traditional: store.trajectories.traditional.lines.slice(0, 30),
          commercial: store.trajectories.commercial.lines.slice(0, 30),
          dt: store.trajectories.dt.lines.slice(0, 31),
        },
        throughputs: {
          without: store.throughputs.without.lines.slice(0, 2),
          with: store.throughputs.with.lines.slice(0, 2),
        },
        statistics: {
          cdf: {
            traditional: store.statistics.cdf.traditional.lines,
            commercial: store.statistics.cdf.commercial.lines,
            dt: store.statistics.cdf.dt.lines,
          },
          summary: store.statistics.summary.lines,
        },
      }),
  });
  await waitTerminal(sharedDir, "execute fail");
  assert.equal(countLines(await readCase4(sharedDir, TRAJECTORY_FILES.traditional)), 30);
  assert.equal(countLines(await readCase4(sharedDir, TRAJECTORY_FILES.commercial)), 30);
  assert.equal(countLines(await readCase4(sharedDir, TRAJECTORY_FILES.dt)), 31);
  assert.equal((await readControl(sharedDir)).status, "execute fail");
});

test("每轮 random 只构造一次数据集，幅度与统计约束成立", async (t) => {
  const store = await loadFixtureStore({ fixtureDir: DEFAULT_FIXTURE_DIR });
  let calls = 0;
  const sharedDir = await createSharedDir(t, START_CONTROL);
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  await startStub(t, sharedDir, {
    dataMode: "random",
    seed: "amp-1",
    createDataset: (task) => {
      calls += 1;
      return createRoundDataset({
        fixtureStore: store,
        dataMode: "random",
        seed: "amp-1",
        operationId: task.operationId,
      });
    },
  });
  await waitTerminal(sharedDir, "case complete");
  assert.equal(calls, 1);

  const published = (await readCase4(sharedDir, TRAJECTORY_FILES.dt))
    .trim()
    .split("\n");
  for (const [index, line] of published.entries()) {
    const [x, y, z] = line.split(",");
    const original = store.trajectories.dt.points[index];
    assert.equal(z, original.tokens[2]);
    if (original.values[0] === 65535) assert.equal(x, original.tokens[0]);
    else {
      assert.ok(Number(x) >= roundSemanticNumber(original.values[0] - 0.02));
      assert.ok(Number(x) <= roundSemanticNumber(original.values[0] + 0.02));
    }
    if (original.values[1] === 65535) assert.equal(y, original.tokens[1]);
    else {
      assert.ok(Number(y) >= roundSemanticNumber(original.values[1] - 0.02));
      assert.ok(Number(y) <= roundSemanticNumber(original.values[1] + 0.02));
    }
  }

  const cdf = (await readCase4(sharedDir, CDF_FILES.dt)).trim().split("\n");
  let previousError = 0;
  let previousProb = 0;
  for (const [index, line] of cdf.entries()) {
    const [errorToken, probToken] = line.trim().split(/\s+/);
    const errorM = Number(errorToken);
    const probability = Number(probToken);
    assert.ok(errorM >= previousError);
    assert.ok(probability >= previousProb);
    assert.equal(probToken, store.statistics.cdf.dt.rows[index].tokens[1]);
    previousError = errorM;
    previousProb = probability;
  }

  const summary = (await readCase4(sharedDir, SUMMARY_FILE)).trim().split("\n");
  for (let index = 0; index < 3; index += 1) {
    const [p50, p90] = summary[index].trim().split(/\s+/).map(Number);
    assert.ok(p50 <= p90);
    assert.ok(p50 >= 0 && p90 >= 0);
  }
  const nlos = Number(summary[3].trim().split(/\s+/)[0]);
  assert.ok(nlos >= 0 && nlos <= 1);
  assert.ok(
    Math.abs(nlos - store.statistics.summary.rows[3].values[0]) <= 0.005 + 1e-12,
  );
});

test("运行中见到 execute success 不会当成启动恢复", async (t) => {
  const sharedDir = await createSharedDir(t, DEFAULT_CONTROL);
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  await startStub(t, sharedDir, { dataMode: "replay" });
  await writeControl(sharedDir, {
    ...START_CONTROL,
    status: "execute success",
  });
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal((await readControl(sharedDir)).status, "execute success");
  assert.equal(countLines(await readCase4(sharedDir, TRAJECTORY_FILES.dt)), 0);
});

test("启动恢复 Start 不受 fail outcome 反向覆盖，且保留已有 flag=1", async (t) => {
  const sharedDir = await createSharedDir(t, {
    ...START_CONTROL,
    status: "execute success",
    save_picture_flag: 1,
  });
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  await startStub(t, sharedDir, {
    dataMode: "replay",
    outcome: "fail",
    requestPicture: false,
  });
  const terminal = await waitTerminal(sharedDir, "case complete");
  assert.equal(terminal.save_picture_flag, 1);
});

test("seed 不改写九个动态文件", async (t) => {
  const sharedDir = await createSharedDir(t);
  const store = await loadFixtureStore({ fixtureDir: DEFAULT_FIXTURE_DIR });
  await emptyDynamics(sharedDir);
  const marker = "keep-me\n";
  await fs.writeFile(
    path.join(sharedDir, "case4", TRAJECTORY_FILES.dt),
    marker,
  );
  await seedInitFiles({
    sharedDir,
    fixtureStore: store,
    logger: createSilentLogger(),
  });
  assert.equal(await readCase4(sharedDir, TRAJECTORY_FILES.dt), marker);
});

test("complete 后无继续写入；without dt 不接单", async (t) => {
  const sharedDir = await createSharedDir(t, START_CONTROL);
  await seedBaseFromDefault(sharedDir);
  await emptyDynamics(sharedDir);
  await startStub(t, sharedDir, { dataMode: "replay" });
  await waitTerminal(sharedDir, "case complete");
  const before = await readCase4(sharedDir, TRAJECTORY_FILES.dt);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(await readCase4(sharedDir, TRAJECTORY_FILES.dt), before);

  const other = await createSharedDir(t, {
    ...START_CONTROL,
    dt_type: "without dt",
  });
  await seedBaseFromDefault(other);
  await emptyDynamics(other);
  await startStub(t, other);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal((await readControl(other)).status, "");
  assert.equal(countLines(await readCase4(other, TRAJECTORY_FILES.dt)), 0);
});
