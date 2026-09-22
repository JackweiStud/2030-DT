import { createCase1Router } from './cases/case1/routes.mjs';
import http from "node:http";
import { promises as defaultFs } from "node:fs";
import { createControlFileService as createCase2ControlFileService } from "./cases/case2/control-file.mjs";
import { createDataFilesService } from "./cases/case2/data-files.mjs";
import { createCase2Router } from "./cases/case2/routes.mjs";
import { createScreenshotService as createCase2ScreenshotService } from "./cases/case2/screenshot.mjs";
import { createCase3ControlFileService } from "./cases/case3/control-file.mjs";
import { createDebugJsonlService } from "./cases/case3/debug-jsonl.mjs";
import { createInitDataService } from "./cases/case3/init-data.mjs";
import { createCase3Router } from "./cases/case3/routes.mjs";
import { createCase3ScreenshotService } from "./cases/case3/screenshot.mjs";
import { createSideFilesService } from "./cases/case3/side-files.mjs";
import { createCase3ThroughputService } from "./cases/case3/throughput.mjs";
import { createCase4ControlFileService } from "./cases/case4/control-file.mjs";
import { createCase4DebugJsonlService } from "./cases/case4/debug-jsonl.mjs";
import { createCase4InitDataService } from "./cases/case4/init-data.mjs";
import { createSubstitutionLogger } from "./cases/case4/numeric-file.mjs";
import { createCase4ResultService } from "./cases/case4/result.mjs";
import { createCase4Router } from "./cases/case4/routes.mjs";
import { createCase4ScreenshotService } from "./cases/case4/screenshot.mjs";
import { createCase4ThroughputService } from "./cases/case4/throughput.mjs";
import { createCase4TrajectoryService } from "./cases/case4/trajectory.mjs";
import { createControlFileStore } from "./shared/control-file-store.mjs";
import { isAppError } from "./shared/errors.mjs";
import { sendJson } from "./shared/http.mjs";
import { createLogger } from "./shared/logger.mjs";

/**
 * 组装 Case2 + Case3 + Case4 适配依赖而不启动监听。
 * 三个 Case 共享同一个控制文件 store 和串行写队列，避免跨 Case 覆盖。
 */
export function createAdapterApp(options) {
  const routeCase1 = createCase1Router(options);
  const fsOps = options.fsOps ?? defaultFs;
  const logger = options.logger ?? createLogger();
  const controlStore = createControlFileStore({
    sharedDir: options.sharedDir,
    fsOps,
    logger,
  });
  const case2ControlFile = createCase2ControlFileService({
    sharedDir: options.sharedDir,
    store: controlStore,
    fsOps,
    logger,
  });
  const case2DataFiles = createDataFilesService({
    sharedDir: options.sharedDir,
    controlFile: case2ControlFile,
    fsOps,
    logger,
    ranges: options.case2Ranges,
  });
  const case2Screenshot = createCase2ScreenshotService({
    sharedDir: options.sharedDir,
    controlFile: case2ControlFile,
    fsOps,
    logger,
  });
  const routeCase2 = createCase2Router({
    controlFile: case2ControlFile,
    dataFiles: case2DataFiles,
    screenshot: case2Screenshot,
  });

  const case3DebugJsonl = createDebugJsonlService({
    sharedDir: options.sharedDir,
    fsOps,
    logger,
  });
  const case3ControlFile = createCase3ControlFileService({
    sharedDir: options.sharedDir,
    store: controlStore,
    debugJsonl: case3DebugJsonl,
    fsOps,
    logger,
  });
  const case3InitData = createInitDataService({
    sharedDir: options.sharedDir,
    fsOps,
  });
  const case3SideFiles = createSideFilesService({
    sharedDir: options.sharedDir,
    controlFile: case3ControlFile,
    debugJsonl: case3DebugJsonl,
    fsOps,
    logger,
  });
  const case3Throughput = createCase3ThroughputService({
    sharedDir: options.sharedDir,
    fsOps,
    logger,
  });
  const case3Screenshot = createCase3ScreenshotService({
    sharedDir: options.sharedDir,
    controlFile: case3ControlFile,
    fsOps,
    logger,
  });
  const routeCase3 = createCase3Router({
    controlFile: case3ControlFile,
    initData: case3InitData,
    sideFiles: case3SideFiles,
    throughput: case3Throughput,
    screenshot: case3Screenshot,
  });

  const case4DebugJsonl = createCase4DebugJsonlService({
    sharedDir: options.sharedDir,
    fsOps,
    logger,
  });
  const case4ControlFile = createCase4ControlFileService({
    sharedDir: options.sharedDir,
    store: controlStore,
    debugJsonl: case4DebugJsonl,
    fsOps,
    logger,
  });
  const case4SubstitutionLog = createSubstitutionLogger(logger);
  const case4InitData = createCase4InitDataService({
    sharedDir: options.sharedDir,
    fsOps,
  });
  const case4Trajectory = createCase4TrajectoryService({
    sharedDir: options.sharedDir,
    debugJsonl: case4DebugJsonl,
    logSubstitution: case4SubstitutionLog,
    fsOps,
    logger,
  });
  const case4Throughput = createCase4ThroughputService({
    sharedDir: options.sharedDir,
    fsOps,
    logger,
  });
  const case4Result = createCase4ResultService({
    sharedDir: options.sharedDir,
    controlFile: case4ControlFile,
    debugJsonl: case4DebugJsonl,
    logSubstitution: case4SubstitutionLog,
    fsOps,
    logger,
  });
  const case4Screenshot = createCase4ScreenshotService({
    sharedDir: options.sharedDir,
    controlFile: case4ControlFile,
    fsOps,
    logger,
  });
  const routeCase4 = createCase4Router({
    controlFile: case4ControlFile,
    initData: case4InitData,
    trajectory: case4Trajectory,
    throughput: case4Throughput,
    result: case4Result,
    screenshot: case4Screenshot,
  });

  // 高频 control GET 仅在状态或截图标志变化时记录摘要。
  const controlGetSampler = createControlGetSampler();

  async function initialize() {
    await controlStore.read();
    await Promise.all([
      case2Screenshot.cleanupTemporaryFiles(),
      case3Screenshot.cleanupTemporaryFiles(),
      case4Screenshot.cleanupTemporaryFiles(),
    ]);
  }

  async function handler(request, response) {
    const startedAt = Date.now();
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    let errorCode;
    let accessExtra = {};

    try {
      let result = await routeCase1(request, response, url);
      if (!result?.handled) result = await routeCase2(request, response, url);
      if (!result?.handled) {
        result = await routeCase3(request, response, url);
      }
      if (!result?.handled) {
        result = await routeCase4(request, response, url);
      }
      if (!result?.handled) {
        sendJson(response, 404, {
          ok: false,
          error: { code: "NOT_FOUND", message: "route not found" },
        });
        errorCode = "NOT_FOUND";
      } else if (result.access) {
        accessExtra = result.access;
      }
    } catch (error) {
      if (response.headersSent) {
        response.destroy(error);
      } else if (isAppError(error)) {
        errorCode = error.code;
        if (error.status >= 500) {
          logger.error("dt adapter request failed", {
            method: request.method,
            url: request.url,
            code: error.code,
            reason: error.message,
          });
        }
        sendJson(response, error.status, {
          ok: false,
          error: { code: error.code, message: error.message },
        });
      } else {
        errorCode = "INTERNAL_ERROR";
        logger.error("dt adapter unexpected error", {
          method: request.method,
          url: request.url,
          reason: error?.message ?? String(error),
        });
        sendJson(response, 500, {
          ok: false,
          error: { code: "INTERNAL_ERROR", message: "unexpected adapter error" },
        });
      }
    } finally {
      logRequestSummary({
        logger,
        request,
        response,
        url,
        startedAt,
        errorCode,
        accessExtra,
        controlGetSampler,
      });
    }
  }

  return {
    handler,
    initialize,
    services: {
      controlStore,
      case2: {
        controlFile: case2ControlFile,
        dataFiles: case2DataFiles,
        screenshot: case2Screenshot,
      },
      case3: {
        controlFile: case3ControlFile,
        initData: case3InitData,
        sideFiles: case3SideFiles,
        throughput: case3Throughput,
        screenshot: case3Screenshot,
        debugJsonl: case3DebugJsonl,
      },
      case4: {
        controlFile: case4ControlFile,
        initData: case4InitData,
        trajectory: case4Trajectory,
        throughput: case4Throughput,
        result: case4Result,
        screenshot: case4Screenshot,
        debugJsonl: case4DebugJsonl,
      },
    },
  };
}

export function createAdapterServer(app) {
  return http.createServer(app.handler);
}

/**
 * 控制轮询降噪：同一 status + save_picture_flag 连续成功 GET 只记首条。
 */
export function createControlGetSampler() {
  const lastKeys = new Map();
  return {
    shouldLog(caseId, control) {
      const key = `${control?.status ?? ""}\u0000${control?.save_picture_flag ?? ""}`;
      if (key === lastKeys.get(caseId)) return false;
      lastKeys.set(caseId, key);
      return true;
    },
  };
}

function logRequestSummary(options) {
  const {
    logger,
    request,
    response,
    url,
    startedAt,
    errorCode,
    accessExtra,
    controlGetSampler,
  } = options;

  if (!response.headersSent) {
    return;
  }

  const statusCode = response.statusCode || 0;
  const durationMs = Math.max(0, Date.now() - startedAt);
  const path = `${url.pathname}${url.search}`;
  const caseId =
    accessExtra.caseId ?? caseIdFromPath(url.pathname);
  const isQuietControlGet =
    request.method === "GET" &&
    (url.pathname === "/api/case2/control-file" ||
      url.pathname === "/api/case3/control-file" ||
      url.pathname === "/api/case4/control-file") &&
    statusCode === 200;

  if (isQuietControlGet) {
    const control = accessExtra.control;
    if (!control || !controlGetSampler.shouldLog(caseId, control)) {
      return;
    }
  }

  const context = {
    caseId,
    method: request.method,
    path,
    statusCode,
    durationMs,
  };
  if (errorCode) {
    context.code = errorCode;
  }
  if (isQuietControlGet && accessExtra.control) {
    context.command = accessExtra.control.command;
    context.status = accessExtra.control.status;
    context.save_picture_flag = accessExtra.control.save_picture_flag;
  }

  const level =
    statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
  logger[level]("dt adapter request", context);
}

function caseIdFromPath(pathname) {
  if (pathname.startsWith("/api/case4/")) return "case4";
  if (pathname.startsWith("/api/case3/")) return "case3";
  if (pathname.startsWith("/api/case2/")) return "case2";
  return "shared";
}
