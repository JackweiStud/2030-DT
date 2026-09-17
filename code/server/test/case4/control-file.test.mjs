import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createCase4ControlFileService } from "../../src/cases/case4/control-file.mjs";
import { CASE4_BASE_FILE, CASE4_DYNAMIC_FILES } from "../../src/cases/case4/constants.mjs";
import { createSilentLogger } from "../../src/shared/logger.mjs";
import {
  createSharedDir,
  interceptControlFileFs,
  readControl,
  writeControl,
} from "../helpers.mjs";
import { writeCase4All, writeCase4Base } from "./helpers.mjs";

function service(sharedDir, options = {}) {
  return createCase4ControlFileService({
    sharedDir,
    logger: options.logger ?? createSilentLogger(),
    ...options,
  });
}

test("Case4 四种精确 payload；多余字段和错 dt_type 拒绝", async (t) => {
  const sharedDir = await createSharedDir(t, { future_field: "keep" });
  const controlFile = service(sharedDir);

  const init = await controlFile.updateFromHttp({ command: "init" });
  assert.equal(init.case, "case4");
  assert.equal(init.command, "init");
  assert.equal(init.dt_type, "");
  assert.equal(init.status, "");
  assert.equal(init.future_field, "keep");

  await writeCase4All(sharedDir);
  const started = await controlFile.updateFromHttp({
    case: "case4",
    command: "start",
    dt_type: "all",
  });
  assert.equal(started.command, "start");
  assert.equal(started.dt_type, "all");
  assert.equal(started.status, "");

  await assert.rejects(
    controlFile.updateFromHttp({
      case: "case4",
      command: "start",
      dt_type: "without dt",
    }),
    { code: "INVALID_REQUEST", status: 400 },
  );
  await assert.rejects(
    controlFile.updateFromHttp({
      case: "case4",
      command: "start",
      dt_type: "with dt",
    }),
    { code: "INVALID_REQUEST", status: 400 },
  );
  await assert.rejects(
    controlFile.updateFromHttp({ command: "init", extra: 1 }),
    { code: "INVALID_REQUEST", status: 400 },
  );
  await assert.rejects(
    controlFile.updateFromHttp({ save_picture_flag: 1 }),
    { code: "INVALID_REQUEST", status: 400 },
  );
});

test("Start 先清九文件再写命令；base 与白名单外文件保留", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase4All(sharedDir);
  const basePath = path.join(sharedDir, "case4", CASE4_BASE_FILE);
  const reflection = path.join(
    sharedDir,
    "case4",
    "ue_position_with_dt_coordinates_reflection_point.txt",
  );
  await fs.writeFile(reflection, "keep-me\n");
  const baseBefore = await fs.readFile(basePath, "utf8");

  await service(sharedDir).updateFromHttp({
    case: "case4",
    command: "start",
    dt_type: "all",
  });

  assert.equal(await fs.readFile(basePath, "utf8"), baseBefore);
  assert.equal(await fs.readFile(reflection, "utf8"), "keep-me\n");
  for (const filename of CASE4_DYNAMIC_FILES) {
    assert.equal(await fs.readFile(path.join(sharedDir, "case4", filename), "utf8"), "");
  }
});

test("init 不清动态文件；ReInit 同样只清白名单", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase4All(sharedDir);
  const samplePath = path.join(sharedDir, "case4", CASE4_DYNAMIC_FILES[0]);
  const basePath = path.join(sharedDir, "case4", CASE4_BASE_FILE);
  const beforeSample = await fs.readFile(samplePath, "utf8");
  const beforeBase = await fs.readFile(basePath, "utf8");
  assert.notEqual(beforeSample, "");

  await service(sharedDir).updateFromHttp({ command: "init" });
  assert.equal(await fs.readFile(samplePath, "utf8"), beforeSample);
  assert.equal((await readControl(sharedDir)).command, "init");

  await service(sharedDir).updateFromHttp({
    case: "case4",
    command: "reinit",
    dt_type: "all",
  });
  for (const filename of CASE4_DYNAMIC_FILES) {
    assert.equal(await fs.readFile(path.join(sharedDir, "case4", filename), "utf8"), "");
  }
  assert.equal(await fs.readFile(basePath, "utf8"), beforeBase);
});

test("清理失败不写新命令", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case4",
    command: "init",
  });
  await writeCase4Base(sharedDir);
  const realFs = fs;
  const fsOps = {
    ...realFs,
    writeFile: async (filePath, ...args) => {
      if (String(filePath).includes("ue_position_with_dt_thrp.txt")) {
        const error = new Error("simulated clear failure");
        error.code = "EACCES";
        throw error;
      }
      return realFs.writeFile(filePath, ...args);
    },
  };
  await assert.rejects(
    service(sharedDir, { fsOps }).updateFromHttp({
      case: "case4",
      command: "start",
      dt_type: "all",
    }),
    { code: "DATA_CLEAR_FAILED", status: 500 },
  );
  const control = await readControl(sharedDir);
  assert.equal(control.command, "init");
});

test("跨 Case busy；case4 execute fail 同动作可重试；init 撤权", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case2",
    command: "start",
    dt_type: "all",
    status: "case complete",
  });
  const controlFile = service(sharedDir);
  await assert.rejects(
    controlFile.updateFromHttp({
      case: "case4",
      command: "start",
      dt_type: "all",
    }),
    { code: "CONTROL_BUSY", status: 409 },
  );

  await writeControl(sharedDir, {
    ...(await readControl(sharedDir)),
    case: "case4",
    command: "start",
    dt_type: "all",
    status: "execute fail",
  });
  const retried = await controlFile.updateFromHttp({
    case: "case4",
    command: "start",
    dt_type: "all",
  });
  assert.equal(retried.status, "");
  assert.equal(retried.command, "start");

  const idle = await controlFile.updateFromHttp({ command: "init" });
  assert.equal(idle.command, "init");
  assert.equal(idle.status, "");
});

test("截图清零 flag=0 幂等，错误 owner 拒绝；未知字段保留", async (t) => {
  const sharedDir = await createSharedDir(t, { future_field: "keep" });
  const controlFile = service(sharedDir);
  const unchanged = await controlFile.updateFromHttp({ save_picture_flag: 0 });
  assert.equal(unchanged.save_picture_flag, 0);

  await writeControl(sharedDir, {
    ...(await readControl(sharedDir)),
    case: "case3",
    command: "start",
    dt_type: "all",
    save_picture_flag: 1,
  });
  await assert.rejects(
    controlFile.updateFromHttp({ save_picture_flag: 0 }),
    { code: "SCREENSHOT_NOT_REQUESTED", status: 409 },
  );

  await writeControl(sharedDir, {
    case: "case4",
    command: "start",
    dt_type: "all",
    status: "execute success",
    save_picture_flag: 1,
    future_field: "keep",
  });
  const { fsOps } = interceptControlFileFs(fs, {
    afterControlRead: async (controlReads) => {
      if (controlReads !== 1) return;
      await writeControl(sharedDir, {
        ...(await readControl(sharedDir)),
        status: "case complete",
        save_picture_flag: 1,
      });
    },
  });
  const cleared = await service(sharedDir, { fsOps }).clearPictureFlag();
  assert.equal(cleared.status, "case complete");
  assert.equal(cleared.save_picture_flag, 0);
  assert.equal(cleared.future_field, "keep");
});

test("debug_flag 非整数使控制读取失败", async (t) => {
  const sharedDir = await createSharedDir(t, { debug_flag: 0.5 });
  await assert.rejects(service(sharedDir).read(), {
    code: "CONTROL_READ_FAILED",
    status: 500,
  });
});
