import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyDotenvFile } from "../src/shared/env-file.mjs";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await applyDotenvFile(process.env, path.join(serverRoot, ".env"));

if (!process.env.DT_SHARED_DIR) {
  process.env.DT_SHARED_DIR =
    process.env.CASE2_SHARED_DIR ?? path.resolve(serverRoot, "../comdatafiles");
}

await import("../src/index.mjs");
