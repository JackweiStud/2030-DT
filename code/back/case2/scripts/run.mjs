import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const case2Root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.CASE2_SHARED_DIR) {
  process.env.CASE2_SHARED_DIR = path.resolve(case2Root, "../../comdatafiles");
}

const args = new Set(process.argv.slice(2));
if (args.has("--dev") && !process.env.CASE2_STUB_LOG_LEVEL) {
  process.env.CASE2_STUB_LOG_LEVEL = "debug";
}
if (args.has("--no-picture")) {
  process.env.CASE2_STUB_REQUEST_PICTURE = "0";
}

const stubEntry = path.join(case2Root, "case2-stub.mjs");
const child = spawn(process.execPath, ["--enable-source-maps", stubEntry], {
  cwd: case2Root,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
