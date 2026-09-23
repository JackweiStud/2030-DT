import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createCase3ControlFileService } from "../../src/cases/case3/control-file.mjs";
import { CASE3_SIDE_FILES } from "../../src/cases/case3/constants.mjs";
import { createSilentLogger } from "../../src/shared/logger.mjs";
import {
  createSharedDir,
  interceptControlFileFs,
  readControl,
  writeCase3SideFiles,
  writeControl,
} from "../helpers.mjs";

function service(sharedDir, options = {}) {
  return createCase3ControlFileService({
    sharedDir,
    logger: createSilentLogger(),
    ...options,
  });
}

test("Case3 Start 先清目标侧文件，再原子开新轮并保留未知字段", async (t) => {
  const sharedDir = await createSharedDir(t, { future_field: "keep" });
  await writeCase3SideFiles(sharedDir, "without");
  const costPath = path.join(
    sharedDir,
    "case3",
    CASE3_SIDE_FILES.without.cost,
  );
  const costBefore = await fs.readFile(costPath, "utf8");
  const controlFile = service(sharedDir);

  const written = await controlFile.updateFromHttp({
    case: "case3",
    command: "start",
    dt_type: "without dt",
  });
  assert.equal(written.case, "case3");
  assert.equal(written.command, "start");
  assert.equal(written.dt_type, "without dt");
  assert.equal(written.status, "");
  assert.equal(written.save_picture_flag, 0);
  assert.equal(written.future_field, "keep");

  for (const [key, filename] of Object.entries(CASE3_SIDE_FILES.without)) {
    if (key === "optionalMse") continue;
    if (key === "cost") {
      assert.equal(
        await fs.readFile(path.join(sharedDir, "case3", filename), "utf8"),
        costBefore,
      );
      continue;
    }
    assert.equal(
      await fs.readFile(path.join(sharedDir, "case3", filename), "utf8"),
      "",
    );
  }
});

test("Case3 Start 遇 Windows 瞬时 rename 锁会重试并成功写入控制文件", async (t) => {
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
    case: "case3",
    command: "start",
    dt_type: "without dt",
  });

  assert.equal(written.command, "start");
  assert.equal(written.status, "");
  assert.equal(renameCalls, 3);
});

test("Case3 ReInit 仅清目标侧，不清另一侧", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase3SideFiles(sharedDir, "without");
  await writeCase3SideFiles(sharedDir, "with");
  const withFile = path.join(
    sharedDir,
    "case3",
    CASE3_SIDE_FILES.with.coordinates,
  );
  const withBefore = await fs.readFile(withFile, "utf8");
  const withoutCostPath = path.join(
    sharedDir,
    "case3",
    CASE3_SIDE_FILES.without.cost,
  );
  const withoutCostBefore = await fs.readFile(withoutCostPath, "utf8");
  const withCostPath = path.join(
    sharedDir,
    "case3",
    CASE3_SIDE_FILES.with.cost,
  );
  const withCostBefore = await fs.readFile(withCostPath, "utf8");

  await service(sharedDir).updateFromHttp({
    case: "case3",
    command: "reinit",
    dt_type: "without dt",
  });
  assert.equal(
    await fs.readFile(
      path.join(sharedDir, "case3", CASE3_SIDE_FILES.without.coordinates),
      "utf8",
    ),
    "",
  );
  assert.equal(await fs.readFile(withFile, "utf8"), withBefore);
  assert.equal(await fs.readFile(withoutCostPath, "utf8"), withoutCostBefore);
  assert.equal(await fs.readFile(withCostPath, "utf8"), withCostBefore);
});

test("共享控制 busy 拒绝未消费旧轮，execute fail 允许同动作重试", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case2",
    command: "start",
    dt_type: "with dt",
    status: "case complete",
  });
  const controlFile = service(sharedDir);
  await assert.rejects(
    controlFile.updateFromHttp({
      case: "case3",
      command: "start",
      dt_type: "with dt",
    }),
    { code: "CONTROL_BUSY", status: 409 },
  );

  await writeControl(sharedDir, {
    ...(await readControl(sharedDir)),
    case: "case3",
    command: "start",
    dt_type: "with dt",
    status: "execute fail",
  });
  const retried = await controlFile.updateFromHttp({
    case: "case3",
    command: "start",
    dt_type: "with dt",
  });
  assert.equal(retried.status, "");
});

test("Case3 截图清零对 flag=0 幂等，对错误 owner 拒绝", async (t) => {
  const sharedDir = await createSharedDir(t);
  const controlFile = service(sharedDir);
  const unchanged = await controlFile.updateFromHttp({ save_picture_flag: 0 });
  assert.equal(unchanged.save_picture_flag, 0);

  await writeControl(sharedDir, {
    ...(await readControl(sharedDir)),
    case: "case2",
    command: "start",
    dt_type: "with dt",
    save_picture_flag: 1,
  });
  await assert.rejects(
    controlFile.updateFromHttp({ save_picture_flag: 0 }),
    { code: "SCREENSHOT_NOT_REQUESTED", status: 409 },
  );
});

test("Case3 清 flag 写前再读：保留窗口里写入的 case complete 与未知字段", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case3",
    command: "start",
    dt_type: "without dt",
    status: "execute success",
    save_picture_flag: 1,
    future_field: "keep-me",
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
  assert.equal(cleared.case, "case3");
  assert.equal(cleared.command, "start");
  assert.equal(cleared.dt_type, "without dt");
  assert.equal(cleared.status, "case complete");
  assert.equal(cleared.save_picture_flag, 0);
  assert.equal(cleared.future_field, "keep-me");
});
