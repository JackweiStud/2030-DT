/**
 * Case3 stub 本地运行包装器：只在未注入共享根时回退到 code/comdatafiles。
 */

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const case3Root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const args = new Set(process.argv.slice(2));

if (!process.env.DT_SHARED_DIR) {
  process.env.DT_SHARED_DIR =
    process.env.CASE2_SHARED_DIR ??
    path.resolve(case3Root, "../../comdatafiles");
}
if (args.has("--dev")) process.env.CASE3_STUB_LOG_LEVEL = "debug";
if (args.has("--no-picture")) {
  process.env.CASE3_STUB_REQUEST_PICTURE = "0";
}

const { runMain } = await import("../case3-stub.mjs");
await runMain();
