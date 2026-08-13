import test from "node:test";
import assert from "node:assert/strict";
import { applyDotenvFile, parseEnvFile } from "../../src/shared/env-file.mjs";

test("parseEnvFile 忽略注释且支持引号", () => {
  const parsed = parseEnvFile(
    "# comment\nCASE2_RANGE_HEATMAP_RSS=-500,500\nEMPTY=\nQUOTED=\"0,1\"\n",
  );
  assert.equal(parsed.CASE2_RANGE_HEATMAP_RSS, "-500,500");
  assert.equal(parsed.EMPTY, "");
  assert.equal(parsed.QUOTED, "0,1");
});

test("applyDotenvFile 不覆盖已有非空环境变量", async () => {
  const env = { KEEP: "old", EMPTY: "" };
  const fsOps = {
    readFile: async () => "KEEP=new\nEMPTY=filled\nADDED=yes\n",
  };
  await applyDotenvFile(env, "/tmp/.env", { fsOps });
  assert.equal(env.KEEP, "old");
  assert.equal(env.EMPTY, "filled");
  assert.equal(env.ADDED, "yes");
});
