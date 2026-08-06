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
  createSeededRng,
  createStubRunner,
  formatHeatmapMatrix,
  formatKpiSamples,
  improveHeatmap,
  improveKpi,
  loadConfig,
  parseHeatmapMatrix,
  parseKpiSamples,
  parseRequestPicture,
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
    publisher: createPublisher({
      sharedDir,
      sourceDir,
      logger: silentLogger,
      dataMode: overrides.dataMode ?? "copy",
      seed: overrides.seed,
      improveMin: overrides.improveMin,
      improveMax: overrides.improveMax,
      noise: overrides.noise,
    }),
    stepMs: overrides.stepMs ?? 0,
    outcome: overrides.outcome ?? "success",
    requestPicture: overrides.requestPicture ?? false,
    logger: silentLogger,
  };
}

async function writeInitialFiles(sharedDir, options = {}) {
  const heatmap = options.heatmap ?? "10 20 30\n40 50 60\n";
  const kpi = options.kpi ?? "10\n20\n30\n40\n";
  const dir = path.join(sharedDir, "case2");
  await fs.mkdir(dir, { recursive: true });
  const files = [
    "heatmap_init_rss.txt",
    "heatmap_init_effective_path_num.txt",
    "heatmap_init_first_path_delay.txt",
    "heatmap_init_kpi_rss.txt",
    "heatmap_init_kpi_effective_path_num.txt",
    "heatmap_init_kpi_first_path_delay.txt",
  ];
  for (const name of files) {
    const content = name.includes("_kpi_") ? kpi : heatmap;
    await fs.writeFile(path.join(dir, name), content, "utf8");
  }
}

test("loadConfig 要求 DT_SHARED_DIR，并兼容 CASE2_SHARED_DIR", () => {
  assert.throws(() => loadConfig({}), /DT_SHARED_DIR is required/);
  assert.throws(
    () =>
      loadConfig({
        DT_SHARED_DIR: "/tmp/shared",
        CASE2_STUB_OUTCOME: "maybe",
      }),
    /CASE2_STUB_OUTCOME must be success or fail/,
  );
  const config = loadConfig({ DT_SHARED_DIR: "/tmp/shared" });
  assert.equal(config.outcome, "success");
  assert.equal(config.stepMs, 5000);
  assert.equal(config.requestPicture, true);
  assert.equal(config.dataMode, "random");
  assert.equal(config.improveMin, 0.45);
  assert.equal(config.improveMax, 0.65);
  assert.equal(config.noise, 0.05);
  assert.equal(config.sourceDir, path.join(CASE2_STUB_DIR, "back"));
  assert.equal(loadConfig({ CASE2_SHARED_DIR: "/tmp/legacy" }).sharedDir, "/tmp/legacy");
  assert.equal(
    loadConfig({
      DT_SHARED_DIR: "/tmp/shared",
      CASE2_STUB_DATA_MODE: "copy",
    }).dataMode,
    "copy",
  );

  assert.equal(
    loadConfig({
      DT_SHARED_DIR: "/tmp/shared",
      CASE2_STUB_REQUEST_PICTURE: "0",
    }).requestPicture,
    false,
  );
  assert.equal(
    loadConfig({
      DT_SHARED_DIR: "/tmp/shared",
      CASE2_STUB_REQUEST_PICTURE: "1",
    }).requestPicture,
    true,
  );
  assert.throws(
    () =>
      loadConfig({
        DT_SHARED_DIR: "/tmp/shared",
        CASE2_STUB_REQUEST_PICTURE: "yes",
      }),
    /CASE2_STUB_REQUEST_PICTURE must be 0 or 1/,
  );
  assert.equal(parseRequestPicture(undefined), true);
  assert.equal(parseRequestPicture("0"), false);
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
  // 显式关闭截图，验证非截图分支仍只写 case complete。
  const context = createContext(sharedDir, sourceDir, {
    stepMs: 80,
    requestPicture: false,
  });

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

test("演示默认 requestPicture=true 时 start 同拍 complete + flag=1", async (t) => {
  const sharedDir = await createSharedDir(t, {
    command: "start",
    dt_type: "with dt",
    status: "",
  });
  const sourceDir = await createSourceDir(t);
  const config = loadConfig({ DT_SHARED_DIR: sharedDir });
  assert.equal(config.requestPicture, true);
  const context = createContext(sharedDir, sourceDir, {
    stepMs: 0,
    requestPicture: config.requestPicture,
  });
  await runOperation(context, "start");
  const final = await control(sharedDir);
  assert.equal(final.status, "case complete");
  assert.equal(final.save_picture_flag, 1);
});

test("patchControl 成功以 INFO 记录 command/status/flag", async (t) => {
  const sharedDir = await createSharedDir(t, {
    command: "start",
    dt_type: "with dt",
    status: "execute success",
  });
  const entries = [];
  const logger = {
    debug() {},
    info(message, meta) {
      entries.push({ message, meta });
    },
    warn() {},
    error() {},
  };
  const store = createControlStore({ sharedDir, logger });
  await store.patchControl({
    status: "case complete",
    save_picture_flag: 1,
  });
  const entry = entries.find((item) => item.message === "control patched");
  assert.ok(entry);
  assert.equal(entry.meta.command, "start");
  assert.equal(entry.meta.status, "case complete");
  assert.equal(entry.meta.save_picture_flag, 1);
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
    publisher: createPublisher({ sharedDir, sourceDir, logger: silentLogger, dataMode: "copy" }),
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
    publisher: createPublisher({ sharedDir, sourceDir, logger: silentLogger, dataMode: "copy" }),
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
        publisher: createPublisher({ sharedDir, sourceDir, logger: silentLogger, dataMode: "copy" }),
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
        publisher: createPublisher({ sharedDir, sourceDir, logger: silentLogger, dataMode: "copy" }),
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

test("接单日志包含本轮 requestPicture 与 outcome", async (t) => {
  const sharedDir = await createSharedDir(t, {
    command: "start",
    dt_type: "with dt",
    status: "",
  });
  const sourceDir = await createSourceDir(t);
  const entries = [];
  const logger = {
    debug() {},
    info(message, meta) {
      entries.push({ message, meta });
    },
    warn() {},
    error() {},
  };
  const runner = createStubRunner({
    controlStore: createControlStore({ sharedDir, logger }),
    publisher: createPublisher({ sharedDir, sourceDir, logger: silentLogger, dataMode: "copy" }),
    stepMs: 0,
    pollMs: 1000,
    outcome: "success",
    requestPicture: true,
    logger,
  });
  await runner.evaluate("test-accept");
  const accepted = entries.find((item) => item.message === "accepted new operation");
  assert.ok(accepted);
  assert.equal(accepted.meta.operation, "start");
  assert.equal(accepted.meta.requestPicture, true);
  assert.equal(accepted.meta.outcome, "success");
});

test("random 模式：相对 Initial 改善生成且 seed 可复现", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeInitialFiles(sharedDir, {
    heatmap: "10 20\n30 40\n",
    kpi: "100\n200\n300\n",
  });
  const sourceDir = await createSourceDir(t); // copy fallback unused
  const first = createPublisher({
    sharedDir,
    sourceDir,
    logger: silentLogger,
    dataMode: "random",
    seed: "demo-seed",
    improveMin: 0.5,
    improveMax: 0.5,
    noise: 0,
  });
  await first.publishCalibratedFiles();
  const once = await fs.readFile(
    path.join(sharedDir, "case2", "heatmap_cali_kpi_rss.txt"),
    "utf8",
  );
  const second = createPublisher({
    sharedDir,
    sourceDir,
    logger: silentLogger,
    dataMode: "random",
    seed: "demo-seed",
    improveMin: 0.5,
    improveMax: 0.5,
    noise: 0,
  });
  await second.publishCalibratedFiles();
  const twice = await fs.readFile(
    path.join(sharedDir, "case2", "heatmap_cali_kpi_rss.txt"),
    "utf8",
  );
  assert.equal(once, twice);

  const samples = parseKpiSamples(once, "heatmap_cali_kpi_rss.txt");
  assert.deepEqual(samples, [50, 100, 150]);
  const matrix = parseHeatmapMatrix(
    await fs.readFile(path.join(sharedDir, "case2", "heatmap_cali_rss.txt"), "utf8"),
    "heatmap_cali_rss.txt",
  );
  assert.deepEqual(matrix, [
    [5, 10],
    [15, 20],
  ]);
});

test("random 模式：不同 seed 生成不同内容，且均值不高于 Initial", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeInitialFiles(sharedDir, {
    heatmap: "20 40\n60 80\n",
    kpi: "100\n200\n300\n400\n",
  });
  const sourceDir = await createSourceDir(t);
  const a = createPublisher({
    sharedDir,
    sourceDir,
    logger: silentLogger,
    dataMode: "random",
    seed: "seed-a",
    improveMin: 0.5,
    improveMax: 0.6,
    noise: 0.02,
  });
  await a.publishCalibratedFiles();
  const textA = await fs.readFile(
    path.join(sharedDir, "case2", "heatmap_cali_kpi_rss.txt"),
    "utf8",
  );
  const b = createPublisher({
    sharedDir,
    sourceDir,
    logger: silentLogger,
    dataMode: "random",
    seed: "seed-b",
    improveMin: 0.5,
    improveMax: 0.6,
    noise: 0.02,
  });
  await b.publishCalibratedFiles();
  const textB = await fs.readFile(
    path.join(sharedDir, "case2", "heatmap_cali_kpi_rss.txt"),
    "utf8",
  );
  assert.notEqual(textA, textB);

  const init = [100, 200, 300, 400];
  const cali = parseKpiSamples(textB, "heatmap_cali_kpi_rss.txt");
  const initMean = init.reduce((s, v) => s + v, 0) / init.length;
  const caliMean = cali.reduce((s, v) => s + v, 0) / cali.length;
  assert.ok(caliMean < initMean);
  for (const value of cali) {
    assert.ok(value >= 0 && value <= 500);
  }
});

test("improve helpers 保持范围与两位小数", () => {
  const next = createSeededRng("range-seed");
  const matrix = improveHeatmap(
    [
      [-200, 0],
      [100, 200],
    ],
    0.5,
    0.2,
    next,
  );
  for (const row of matrix) {
    for (const value of row) {
      assert.ok(value >= -200 && value <= 200);
      assert.equal(value, Number(value.toFixed(2)));
    }
  }
  const kpi = improveKpi([0, 250, 500], 0.5, 0.2, createSeededRng("kpi-seed"));
  for (const value of kpi) {
    assert.ok(value >= 0 && value <= 500);
    assert.equal(value, Number(value.toFixed(2)));
  }
  assert.match(formatHeatmapMatrix(matrix), /\n$/);
  assert.match(formatKpiSamples(kpi), /\n$/);
});

test("random 模式缺少 Initial 时失败且不写 complete 文件半套", async (t) => {
  const sharedDir = await createSharedDir(t, {
    command: "start",
    dt_type: "with dt",
    status: "",
  });
  // 不写 initial
  const sourceDir = await createSourceDir(t);
  const context = createContext(sharedDir, sourceDir, {
    dataMode: "random",
    seed: "x",
    stepMs: 0,
  });
  await assert.rejects(runOperation(context, "start"), {
    code: "INITIAL_MISSING",
  });
  await assert.rejects(
    fs.stat(path.join(sharedDir, "case2", "heatmap_cali_rss.txt")),
    { code: "ENOENT" },
  );
  assert.equal((await control(sharedDir)).status, "execute success");
});
