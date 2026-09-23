import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { CASE3_SIDE_FILES } from "../../src/cases/case3/constants.mjs";
import {
  createSharedDir,
  jsonRequest,
  startTestServer,
  writeCase3InitFiles,
  writeCase3SideFiles,
  writeControl,
} from "../helpers.mjs";

test("init-data 返回归一化路线和 Beam Accuracy 基线", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase3InitFiles(sharedDir);
  const { baseUrl } = await startTestServer(t, { sharedDir });

  const response = await jsonRequest(baseUrl, "/api/case3/init-data");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.baseRoute[0], {
    no: 1,
    x: 1.01,
    y: -2.01,
    z: 0,
  });
  assert.deepEqual(response.body.beamAccuracyBaseline, {
    success: 222,
    total: 235,
  });
});

test("Without/With side 返回全量完整前缀和冻结映射", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase3SideFiles(sharedDir, "without");
  await writeCase3SideFiles(sharedDir, "with");
  const { baseUrl } = await startTestServer(t, { sharedDir });

  const without = await jsonRequest(
    baseUrl,
    "/api/case3/side?side=without",
  );
  assert.equal(without.status, 200);
  assert.equal(without.body.completeCount, 2);
  assert.equal(without.body.pendingTail, false);
  assert.equal(without.body.costPct, 25);
  assert.equal("throughputGbps" in without.body.points[0], false);
  assert.equal(without.body.points[0].scanBeamIds.length, 16);
  assert.equal(without.body.points[0].selectedBeamId, 4);
  assert.equal(without.body.points[0].scanBeamIds.includes(4), true);

  const withDt = await jsonRequest(baseUrl, "/api/case3/side?side=with");
  assert.equal(withDt.status, 200);
  assert.equal(withDt.body.completeCount, 2);
  assert.equal(withDt.body.costPct, 15);
  assert.equal(withDt.body.points[0].reflection.los, true);
  assert.equal(withDt.body.points[1].reflection.los, false);
});

test("运行中多文件不齐只返回完整前缀并标记 pending", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase3SideFiles(sharedDir, "without", {
    selected: "4\n",
  });
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const response = await jsonRequest(
    baseUrl,
    "/api/case3/side?side=without",
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.completeCount, 1);
  assert.equal(response.body.points.length, 1);
  assert.equal(response.body.pendingTail, true);
});

test("side 点位完整度不依赖吞吐文件长度或内容", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case3",
    command: "start",
    dt_type: "without dt",
    status: "case complete",
  });
  await writeCase3SideFiles(sharedDir, "without", {
    throughput: "bad\n9\n10\n",
  });
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const response = await jsonRequest(
    baseUrl,
    "/api/case3/side?side=without",
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.completeCount, 2);
  assert.equal(response.body.pendingTail, false);
  assert.equal("throughputGbps" in response.body.points[0], false);
  await fs.unlink(
    path.join(sharedDir, "case3", CASE3_SIDE_FILES.without.throughput),
  );
  const withoutThroughput = await jsonRequest(
    baseUrl,
    "/api/case3/side?side=without",
  );
  assert.equal(withoutThroughput.status, 200);
  assert.equal(withoutThroughput.body.completeCount, 2);
});

test("complete 最终读取缺点、pending 或 Cost 时返回 RESULT_NOT_READY", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case3",
    command: "start",
    dt_type: "without dt",
    status: "case complete",
  });
  await writeCase3SideFiles(sharedDir, "without", {
    selected: "4\n",
    cost: "",
  });
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const response = await jsonRequest(
    baseUrl,
    "/api/case3/side?side=without",
  );
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, "RESULT_NOT_READY");
});

test("非目标侧读取不套最终门槛，已提交非法行整次 422", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case3",
    command: "start",
    dt_type: "with dt",
    status: "case complete",
  });
  await writeCase3SideFiles(sharedDir, "without", {
    coordinates: "",
    scans: "",
    selected: "",
    throughput: "",
    cost: "",
  });
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const nonTarget = await jsonRequest(
    baseUrl,
    "/api/case3/side?side=without",
  );
  assert.equal(nonTarget.status, 200);
  assert.equal(nonTarget.body.completeCount, 0);

  await fs.writeFile(
    path.join(
      sharedDir,
      "case3",
      CASE3_SIDE_FILES.without.coordinates,
    ),
    "1,2\n",
  );
  const invalid = await jsonRequest(
    baseUrl,
    "/api/case3/side?side=without",
  );
  assert.equal(invalid.status, 422);
  assert.equal(invalid.body.error.code, "SIDE_DATA_INVALID");
});

test("Without scan 可变长度且允许重复，但必须包含该行 selected", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase3SideFiles(sharedDir, "without", {
    scans: "16, 17\n18, 18, 19\n",
    selected: "17\n18\n",
  });
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const accepted = await jsonRequest(
    baseUrl,
    "/api/case3/side?side=without",
  );
  assert.equal(accepted.status, 200);
  assert.deepEqual(accepted.body.points[0].scanBeamIds, [16, 17]);
  assert.equal(accepted.body.points[0].selectedBeamId, 17);
  assert.deepEqual(accepted.body.points[1].scanBeamIds, [18, 18, 19]);
  assert.equal(accepted.body.points[1].selectedBeamId, 18);

  await writeCase3SideFiles(sharedDir, "without", {
    scans: "16, 17\n18, 19\n",
    selected: "17\n4\n",
  });
  const rejected = await jsonRequest(
    baseUrl,
    "/api/case3/side?side=without",
  );
  assert.equal(rejected.status, 422);
  assert.equal(rejected.body.error.code, "SIDE_DATA_INVALID");
});

test("缺失必需文件返回 DATA_FILE_MISSING，query 严格校验", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase3SideFiles(sharedDir, "with");
  await fs.unlink(
    path.join(sharedDir, "case3", CASE3_SIDE_FILES.with.reflection),
  );
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const missing = await jsonRequest(baseUrl, "/api/case3/side?side=with");
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, "DATA_FILE_MISSING");

  const invalid = await jsonRequest(
    baseUrl,
    "/api/case3/side?side=with&extra=1",
  );
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, "INVALID_REQUEST");
});

test("Case3 控制 POST 清目标文件且可恢复 init", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase3SideFiles(sharedDir, "with");
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const started = await jsonRequest(baseUrl, "/api/case3/control-file", {
    method: "POST",
    body: { case: "case3", command: "start", dt_type: "with dt" },
  });
  assert.equal(started.status, 200);
  assert.equal(started.body.control.command, "start");

  const idle = await jsonRequest(baseUrl, "/api/case3/control-file", {
    method: "POST",
    body: { command: "init" },
  });
  assert.equal(idle.status, 200);
  assert.equal(idle.body.control.command, "init");
  await writeControl(sharedDir, idle.body.control);
});
