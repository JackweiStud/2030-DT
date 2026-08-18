/**
 * Case3 stub 本地运行包装器：只在未注入共享根时回退到 code/comdatafiles。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBackEnv } from "../../src/env-file.mjs";

const case3Root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const backRoot = path.resolve(case3Root, "..");
const env = await loadBackEnv(backRoot);

if (!env.DT_SHARED_DIR) {
  env.DT_SHARED_DIR = path.resolve(backRoot, "../comdatafiles");
}

const { runMain } = await import("../case3-stub.mjs");
await runMain(env);
