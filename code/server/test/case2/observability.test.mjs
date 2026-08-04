import test from "node:test";
import assert from "node:assert/strict";
import { createControlFileService } from "../../src/cases/case2/control-file.mjs";
import { createDataFilesService } from "../../src/cases/case2/data-files.mjs";
import {
  createLogCollector,
  createSharedDir,
  jsonRequest,
  readControl,
  startTestServer,
  writeControl,
  writePhaseFiles,
} from "../helpers.mjs";

test("控制写成功日志附带 command/status/save_picture_flag 快照", async (t) => {
  const sharedDir = await createSharedDir(t, { status: "execute fail" });
  const logs = createLogCollector();
  const controlFile = createControlFileService({
    sharedDir,
    logger: logs.logger,
  });

  await controlFile.updateFromHttp({
    case: "case2",
    command: "start",
    dt_type: "with dt",
  });

  const entry = logs.entries.find(
    (item) => item.message === "case2 control file updated",
  );
  assert.ok(entry);
  assert.equal(entry.context.kind, "start");
  assert.equal(entry.context.command, "start");
  assert.equal(entry.context.status, "");
  assert.equal(entry.context.save_picture_flag, 0);
});

test("data-files 成功读取时记录 phase/nx/ny/kpiN", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writePhaseFiles(sharedDir, "initial", {
    heatmap: "1 2 3\n4 5 6\n",
    kpi: "1\n2\n3\n4\n",
  });
  const logs = createLogCollector();
  const controlFile = createControlFileService({
    sharedDir,
    logger: logs.logger,
  });
  const dataFiles = createDataFilesService({
    sharedDir,
    controlFile,
    logger: logs.logger,
  });

  await dataFiles.readPhase("initial");
  const entry = logs.entries.find(
    (item) => item.message === "case2 data batch read",
  );
  assert.ok(entry);
  assert.deepEqual(entry.context, {
    phase: "initial",
    nx: 3,
    ny: 2,
    kpiN: 4,
  });
});

test("请求摘要：4xx 记 warn；control GET 仅在 status/flag 变化时记", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writePhaseFiles(sharedDir, "initial");
  const logs = createLogCollector();
  const { baseUrl } = await startTestServer(t, {
    sharedDir,
    logger: logs.logger,
  });

  const first = await jsonRequest(baseUrl, "/api/case2/control-file");
  assert.equal(first.status, 200);
  const second = await jsonRequest(baseUrl, "/api/case2/control-file");
  assert.equal(second.status, 200);

  let controlGetInfos = logs.entries.filter(
    (item) =>
      item.message === "case2 adapter request" &&
      item.context.path === "/api/case2/control-file" &&
      item.context.method === "GET" &&
      item.level === "info",
  );
  assert.equal(controlGetInfos.length, 1);
  assert.equal(controlGetInfos[0].context.statusCode, 200);
  assert.equal(controlGetInfos[0].context.status, "");
  assert.equal(controlGetInfos[0].context.save_picture_flag, 0);
  assert.equal(typeof controlGetInfos[0].context.durationMs, "number");

  await writeControl(sharedDir, {
    ...(await readControl(sharedDir)),
    status: "execute success",
  });
  const third = await jsonRequest(baseUrl, "/api/case2/control-file");
  assert.equal(third.status, 200);

  controlGetInfos = logs.entries.filter(
    (item) =>
      item.message === "case2 adapter request" &&
      item.context.path === "/api/case2/control-file" &&
      item.context.method === "GET" &&
      item.level === "info",
  );
  assert.equal(controlGetInfos.length, 2);
  assert.equal(controlGetInfos[1].context.status, "execute success");

  const bad = await jsonRequest(baseUrl, "/api/case2/control-file", {
    method: "POST",
    body: { command: "start" },
  });
  assert.equal(bad.status, 400);
  const warn = logs.entries.find(
    (item) =>
      item.level === "warn" &&
      item.message === "case2 adapter request" &&
      item.context.code === "INVALID_REQUEST",
  );
  assert.ok(warn);
  assert.equal(warn.context.method, "POST");
  assert.equal(warn.context.statusCode, 400);

  const data = await jsonRequest(baseUrl, "/api/case2/data-files?phase=initial");
  assert.equal(data.status, 200);
  const dataAccess = logs.entries.find(
    (item) =>
      item.message === "case2 adapter request" &&
      item.context.path === "/api/case2/data-files?phase=initial",
  );
  assert.ok(dataAccess);
  assert.equal(dataAccess.context.statusCode, 200);
  const dataRead = logs.entries.find(
    (item) => item.message === "case2 data batch read",
  );
  assert.ok(dataRead);
});
