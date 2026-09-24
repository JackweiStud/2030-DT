import http from "node:http";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAdapterApp } from "../src/app.mjs";
import { METRIC_FILES } from "../src/cases/case2/constants.mjs";
import {
  CASE3_INIT_FILES,
  CASE3_SIDE_FILES,
} from "../src/cases/case3/constants.mjs";
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
  await fs.mkdir(path.join(sharedDir, "case2", "backCali"), { recursive: true });
  await fs.mkdir(path.join(sharedDir, "case3"), { recursive: true });
  await fs.mkdir(path.join(sharedDir, "case4"), { recursive: true });
  await fs.mkdir(path.join(sharedDir, "out", "case2"), { recursive: true });
  await fs.mkdir(path.join(sharedDir, "out", "case3"), { recursive: true });
  await fs.mkdir(path.join(sharedDir, "out", "case4"), { recursive: true });
  for (const phases of Object.values(METRIC_FILES)) {
    await fs.writeFile(
      path.join(sharedDir, "case2", "backCali", phases.calibrated.heatmap),
      "0,0\n0,0\n",
    );
    await fs.writeFile(
      path.join(sharedDir, "case2", "backCali", phases.calibrated.kpi),
      "0\n",
    );
  }
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

/** 拦截控制文件读/rename，用于模拟真实后端在适配层 RMW 窗口里改文件。 */
export function interceptControlFileFs(realFs, hooks = {}) {
  let controlReads = 0;
  let controlRenames = 0;
  const fsOps = {
    ...realFs,
    readFile: async (filePath, ...args) => {
      const result = await realFs.readFile(filePath, ...args);
      if (String(filePath).endsWith("case_control.json")) {
        controlReads += 1;
        await hooks.afterControlRead?.(controlReads, result);
      }
      return result;
    },
    rename: async (from, to, ...args) => {
      const result = await realFs.rename(from, to, ...args);
      if (String(to).endsWith("case_control.json")) {
        controlRenames += 1;
        await hooks.afterControlRename?.(controlRenames);
      }
      return result;
    },
  };
  return {
    fsOps,
    getCounts: () => ({ controlReads, controlRenames }),
  };
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

export async function writeCase3InitFiles(sharedDir, options = {}) {
  const dataDir = path.join(sharedDir, "case3");
  await fs.writeFile(
    path.join(dataDir, CASE3_INIT_FILES.baseRoute),
    options.baseRoute ?? "1.005,-2.005,0\n3,4,5\n",
  );
  await fs.writeFile(
    path.join(dataDir, CASE3_INIT_FILES.beamAccuracy),
    options.beamAccuracy ?? "222,235\n",
  );
}

export async function writeCase3SideFiles(sharedDir, side, options = {}) {
  const dataDir = path.join(sharedDir, "case3");
  const files = CASE3_SIDE_FILES[side];
  const common = {
    coordinates: options.coordinates ?? "1.005,15.014,0\n2,16,0\n",
    selected: options.selected ?? "4\n5\n",
    throughput: options.throughput ?? "8.555\n9\n",
    cost: options.cost ?? (side === "without" ? "25\n" : "15\n"),
  };
  if (side === "without") {
    common.scans =
      options.scans ??
      "0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15\n0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15\n";
  } else {
    common.reflection =
      options.reflection ?? "5,7,0,1\n6.005,8.005,0,0\n";
  }
  for (const [key, content] of Object.entries(common)) {
    await fs.writeFile(path.join(dataDir, files[key]), content);
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
