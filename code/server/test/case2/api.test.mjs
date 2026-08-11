import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import {
  createSharedDir,
  jsonRequest,
  PNG_BASE64,
  readControl,
  startTestServer,
  writeControl,
  writePhaseFiles,
} from "../helpers.mjs";
import { MAX_BODY_BYTES } from "../../src/shared/http.mjs";

test("四个 case2 REST 成功路径可联通", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writePhaseFiles(sharedDir, "initial");
  const { baseUrl } = await startTestServer(t, { sharedDir });

  const controlGet = await jsonRequest(baseUrl, "/api/case2/control-file");
  assert.equal(controlGet.status, 200);
  assert.equal(controlGet.body.control.command, "init");
  assert.equal(controlGet.headers.get("cache-control"), "no-store");

  const controlPost = await jsonRequest(baseUrl, "/api/case2/control-file", {
    method: "POST",
    body: { case: "case2", command: "start", dt_type: "with dt" },
  });
  assert.equal(controlPost.status, 200);
  assert.equal(controlPost.body.control.status, "");

  const entryInitPost = await jsonRequest(baseUrl, "/api/case2/control-file", {
    method: "POST",
    body: { command: "init" },
  });
  assert.equal(entryInitPost.status, 200);
  assert.equal(entryInitPost.body.control.command, "init");
  assert.equal(entryInitPost.body.control.status, "");

  const dataGet = await jsonRequest(
    baseUrl,
    "/api/case2/data-files?phase=initial",
  );
  assert.equal(dataGet.status, 200);
  assert.equal(dataGet.body.metrics.rss.heatmap.length, 2);

  await writeControl(sharedDir, {
    ...(await readControl(sharedDir)),
    case: "case2",
    command: "start",
    dt_type: "with dt",
    status: "case complete",
    save_picture_flag: 1,
  });
  const screenshotPost = await jsonRequest(baseUrl, "/api/case2/screenshot", {
    method: "POST",
    body: { image_base64: PNG_BASE64 },
  });
  assert.equal(screenshotPost.status, 200);
  assert.equal(screenshotPost.body.path, "out/case2/calibrated-000.png");
  assert.equal((await readControl(sharedDir)).save_picture_flag, 0);
});

test("未知 status 通过 HTTP 200 原样透传，非法控制文件返回固定错误", async (t) => {
  const sharedDir = await createSharedDir(t, { status: "future-status" });
  const { baseUrl } = await startTestServer(t, { sharedDir });

  const unknown = await jsonRequest(baseUrl, "/api/case2/control-file");
  assert.equal(unknown.status, 200);
  assert.equal(unknown.body.control.status, "future-status");

  const control = await readControl(sharedDir);
  await writeControl(sharedDir, { ...control, save_picture_flag: 2 });
  const invalid = await jsonRequest(baseUrl, "/api/case2/control-file");
  assert.equal(invalid.status, 500);
  assert.equal(invalid.body.error.code, "CONTROL_READ_FAILED");
});

test("Calibrated 非法时 HTTP 整批拒绝且不返回部分 metrics", async (t) => {
  const sharedDir = await createSharedDir(t, { status: "case complete" });
  await writePhaseFiles(sharedDir, "calibrated");
  await fs.writeFile(
    `${sharedDir}/case2/heatmap_cali_rss.txt`,
    "1 2\n3\n",
  );
  const { baseUrl } = await startTestServer(t, { sharedDir });

  const response = await jsonRequest(
    baseUrl,
    "/api/case2/data-files?phase=calibrated",
  );
  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, "DATA_FILE_INVALID");
  assert.equal(Object.hasOwn(response.body, "metrics"), false);
});

test("超过 20 MiB 的两个 POST 路由均拒绝", async (t) => {
  const sharedDir = await createSharedDir(t);
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const oversized = JSON.stringify({
    image_base64: "A".repeat(MAX_BODY_BYTES),
  });

  for (const pathname of [
    "/api/case2/control-file",
    "/api/case2/screenshot",
  ]) {
    const response = await jsonRequest(baseUrl, pathname, {
      method: "POST",
      body: oversized,
    });
    assert.equal(response.status, 413);
    assert.equal(response.body.error.code, "PAYLOAD_TOO_LARGE");
  }
});

test("Case3 控制路由已注册，Case4 仍返回 404", async (t) => {
  const sharedDir = await createSharedDir(t);
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const case3 = await jsonRequest(baseUrl, "/api/case3/control-file");
  assert.equal(case3.status, 200);
  assert.equal(case3.body.control.command, "init");

  const case4 = await jsonRequest(
    baseUrl,
    "/api/case4/data-files?phase=initial",
  );
  assert.equal(case4.status, 404);
  assert.equal(case4.body.error.code, "NOT_FOUND");
});
