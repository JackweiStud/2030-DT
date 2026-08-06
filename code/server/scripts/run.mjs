import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.DT_SHARED_DIR) {
  process.env.DT_SHARED_DIR =
    process.env.CASE2_SHARED_DIR ?? path.resolve(serverRoot, "../comdatafiles");
}

await import("../src/index.mjs");
