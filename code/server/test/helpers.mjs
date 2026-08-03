import http from "node:http";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAdapterApp } from "../src/app.mjs";
import { METRIC_FILES } from "../src/cases/case2/constants.mjs";
import { createSilentLogger } from "../src/shared/logger.mjs";

export const DEFAULT_CONTROL = Object.freeze({
  case: "case2",
  command: "init",
  dt_type: "",
  status: "",
  save_picture_flag: 0,
  debug_flag: 0,
  scene_type: "U6G",
});

export const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01,
]);
export const PNG_BASE64 = PNG_BYTES.toString("base64");

export async function createSharedDir(testContext, control = {}) {
  const sharedDir = await fs.mkdtemp(path.join(os.tmpdir(), "case2-adapter-"));
  await fs.mkdir(path.join(sharedDir, "case2"), { recursive: true });
  await fs.mkdir(path.join(sharedDir, "out", "case2"), { recursive: true });
  await writeControl(sharedDir, { ...DEFAULT_CONTROL, ...control });
  testContext.after(() => fs.rm(sharedDir, { recursive: true, force: true }));
  return sharedDir;
}

export async function writeControl(sharedDir, control) {
  await fs.writeFile(
    path.join(sharedDir, "case_control.json"),
    `${JSON.stringify(control, null, 2)}\n`,
  );
}

export async function readControl(sharedDir) {
  return JSON.parse(
    await fs.readFile(path.join(sharedDir, "case_control.json"), "utf8"),
  );
}

export async function writePhaseFiles(sharedDir, phase, options = {}) {
  const heatmap = options.heatmap ?? "1.235, 2, 3\n4, 5, 6\n";
  const kpi = options.kpi ?? "1.235\n2\n3\n";
  for (const phases of Object.values(METRIC_FILES)) {
    await fs.writeFile(
      path.join(sharedDir, "case2", phases[phase].heatmap),
      heatmap,
    );
    await fs.writeFile(
      path.join(sharedDir, "case2", phases[phase].kpi),
      kpi,
    );
  }
}

export function createLogCollector() {
  const entries = [];
  return {
    entries,
    logger: {
      info: (message, context) => entries.push({ level: "info", message, context }),
      warn: (message, context) => entries.push({ level: "warn", message, context }),
      error: (message, context) => entries.push({ level: "error", message, context }),
    },
  };
}

export async function startTestServer(testContext, options) {
  const app = createAdapterApp({
    sharedDir: options.sharedDir,
    fsOps: options.fsOps,
    logger: options.logger ?? createSilentLogger(),
  });
  await app.initialize();
  const server = http.createServer(app.handler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  testContext.after(
    () => new Promise((resolve) => server.close(() => resolve())),
  );
  const address = server.address();
  return {
    app,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

export async function jsonRequest(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers:
      options.body === undefined
        ? undefined
        : { "Content-Type": "application/json" },
    body:
      options.body === undefined
        ? undefined
        : typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body),
  });
  return {
    status: response.status,
    headers: response.headers,
    body: await response.json(),
  };
}
