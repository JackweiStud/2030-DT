import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBackEnv } from "../../src/env-file.mjs";

const case2Root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backRoot = path.resolve(case2Root, "..");
const env = await loadBackEnv(backRoot);

if (!env.DT_SHARED_DIR) {
  env.DT_SHARED_DIR = path.resolve(backRoot, "../comdatafiles");
}

const { runMain } = await import("../case2-stub.mjs");
await runMain(env);
