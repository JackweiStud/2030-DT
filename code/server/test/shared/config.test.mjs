import test from "node:test";
import assert from "node:assert/strict";
import { loadRuntimeConfig } from "../../src/shared/config.mjs";
import { createSharedDir } from "../helpers.mjs";

test("DT_SHARED_DIR 必填且必须为绝对目录", async (t) => {
  await assert.rejects(loadRuntimeConfig({}), /DT_SHARED_DIR/);
  await assert.rejects(
    loadRuntimeConfig({ DT_SHARED_DIR: "relative/path" }),
    /绝对路径/,
  );

  const sharedDir = await createSharedDir(t);
  const config = await loadRuntimeConfig({ DT_SHARED_DIR: sharedDir });
  assert.equal(config.sharedDir, sharedDir);
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 3102);
});

test("CASE2_SHARED_DIR 仅作为旧脚本兼容 fallback", async (t) => {
  const legacySharedDir = await createSharedDir(t);
  const config = await loadRuntimeConfig({ CASE2_SHARED_DIR: legacySharedDir });
  assert.equal(config.sharedDir, legacySharedDir);
});
