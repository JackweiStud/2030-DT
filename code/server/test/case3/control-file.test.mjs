import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createCase3ControlFileService } from "../../src/cases/case3/control-file.mjs";
import { CASE3_SIDE_FILES } from "../../src/cases/case3/constants.mjs";
import { createSilentLogger } from "../../src/shared/logger.mjs";
import {
  createSharedDir,
  readControl,
  writeCase3SideFiles,
  writeControl,
} from "../helpers.mjs";

function service(sharedDir) {
  return createCase3ControlFileService({
    sharedDir,
    logger: createSilentLogger(),
  });
}

test("Case3 Start 先清目标侧文件，再原子开新轮并保留未知字段", async (t) => {
  const sharedDir = await createSharedDir(t, { future_field: "keep" });
  await writeCase3SideFiles(sharedDir, "without");
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
    assert.equal(
      await fs.readFile(path.join(sharedDir, "case3", filename), "utf8"),
      "",
    );
  }
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
