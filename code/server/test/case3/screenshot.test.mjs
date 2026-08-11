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

test("Case3 截图按 case3-{seq}.png 保存并清零", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case3",
    command: "start",
    dt_type: "without dt",
    status: "case complete",
    save_picture_flag: 1,
  });
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const response = await jsonRequest(baseUrl, "/api/case3/screenshot", {
    method: "POST",
    body: { image_base64: PNG_BASE64 },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    ok: true,
    path: "out/case3/case3-000.png",
    seq: 0,
  });
  assert.equal(
    (
      await fs.stat(
        path.join(sharedDir, "out", "case3", "case3-000.png"),
      )
    ).isFile(),
    true,
  );
  assert.equal((await readControl(sharedDir)).save_picture_flag, 0);
});

test("Case2 与 Case3 截图 owner 对称隔离", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case3",
    command: "start",
    dt_type: "with dt",
    status: "execute success",
    save_picture_flag: 1,
  });
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const wrongCase = await jsonRequest(baseUrl, "/api/case2/screenshot", {
    method: "POST",
    body: { image_base64: PNG_BASE64 },
  });
  assert.equal(wrongCase.status, 409);
  assert.equal(wrongCase.body.error.code, "SCREENSHOT_NOT_REQUESTED");
  assert.equal((await readControl(sharedDir)).save_picture_flag, 1);

  const rightCase = await jsonRequest(baseUrl, "/api/case3/screenshot", {
    method: "POST",
    body: { image_base64: PNG_BASE64 },
  });
  assert.equal(rightCase.status, 200);
});
