import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createSharedDir,
  jsonRequest,
  PNG_BASE64,
  readControl,
  startTestServer,
} from "../helpers.mjs";

test("Case4 截图按 case4-{seq}.png 保存并清零", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case4",
    command: "start",
    dt_type: "all",
    status: "case complete",
    save_picture_flag: 1,
  });
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const response = await jsonRequest(baseUrl, "/api/case4/screenshot", {
    method: "POST",
    body: { image_base64: PNG_BASE64 },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    ok: true,
    path: "out/case4/case4-000.png",
    seq: 0,
  });
  assert.equal(
    (await fs.stat(path.join(sharedDir, "out", "case4", "case4-000.png"))).isFile(),
    true,
  );
  assert.equal((await readControl(sharedDir)).save_picture_flag, 0);
});

test("Case2/Case3 不能消费 case4 的 flag=1，反之亦然", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case4",
    command: "start",
    dt_type: "all",
    status: "execute success",
    save_picture_flag: 1,
  });
  const { baseUrl } = await startTestServer(t, { sharedDir });

  const asCase2 = await jsonRequest(baseUrl, "/api/case2/screenshot", {
    method: "POST",
    body: { image_base64: PNG_BASE64 },
  });
  assert.equal(asCase2.status, 409);
  assert.equal(asCase2.body.error.code, "SCREENSHOT_NOT_REQUESTED");

  const asCase3 = await jsonRequest(baseUrl, "/api/case3/screenshot", {
    method: "POST",
    body: { image_base64: PNG_BASE64 },
  });
  assert.equal(asCase3.status, 409);
  assert.equal(asCase3.body.error.code, "SCREENSHOT_NOT_REQUESTED");
  assert.equal((await readControl(sharedDir)).save_picture_flag, 1);

  const own = await jsonRequest(baseUrl, "/api/case4/screenshot", {
    method: "POST",
    body: { image_base64: PNG_BASE64 },
  });
  assert.equal(own.status, 200);
});

test("case3 flag=1 时 case4 截图拒绝", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case3",
    command: "start",
    dt_type: "all",
    status: "execute success",
    save_picture_flag: 1,
  });
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const response = await jsonRequest(baseUrl, "/api/case4/screenshot", {
    method: "POST",
    body: { image_base64: PNG_BASE64 },
  });
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, "SCREENSHOT_NOT_REQUESTED");
});

test("Case4 截图序号不覆盖已有文件", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case4",
    command: "start",
    dt_type: "all",
    status: "execute success",
    save_picture_flag: 1,
  });
  await fs.writeFile(path.join(sharedDir, "out", "case4", "case4-000.png"), "old");
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const response = await jsonRequest(baseUrl, "/api/case4/screenshot", {
    method: "POST",
    body: { image_base64: PNG_BASE64 },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.path, "out/case4/case4-001.png");
  assert.equal(response.body.seq, 1);
  assert.equal(
    await fs.readFile(path.join(sharedDir, "out", "case4", "case4-000.png"), "utf8"),
    "old",
  );
});
