import http from "node:http";
import { promises as defaultFs } from "node:fs";
import { createControlFileService } from "./cases/case2/control-file.mjs";
import { createDataFilesService } from "./cases/case2/data-files.mjs";
import { createCase2Router } from "./cases/case2/routes.mjs";
import { createScreenshotService } from "./cases/case2/screenshot.mjs";
import { isAppError } from "./shared/errors.mjs";
import { sendJson } from "./shared/http.mjs";
import { createLogger } from "./shared/logger.mjs";

/**
 * 组装依赖而不启动监听，便于测试替换文件系统和日志。
 * case3/case4 没有注册路由，因此请求会明确返回 404。
 */
export function createAdapterApp(options) {
  const fsOps = options.fsOps ?? defaultFs;
  const logger = options.logger ?? createLogger();
  const controlFile = createControlFileService({
    sharedDir: options.sharedDir,
    fsOps,
    logger,
  });
  const dataFiles = createDataFilesService({
    sharedDir: options.sharedDir,
    controlFile,
    fsOps,
    logger,
  });
  const screenshot = createScreenshotService({
    sharedDir: options.sharedDir,
    controlFile,
    fsOps,
    logger,
  });
  const routeCase2 = createCase2Router({ controlFile, dataFiles, screenshot });
  // control GET 1Hz 轮询：仅在 status / save_picture_flag 变化时记请求摘要。
  const controlGetSampler = createControlGetSampler();

  async function initialize() {
    await controlFile.read();
    await screenshot.cleanupTemporaryFiles();
  }

  async function handler(request, response) {
    const startedAt = Date.now();
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    let errorCode;
    let accessExtra = {};

    try {
      const result = await routeCase2(request, response, url);
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
          logger.error("case2 adapter request failed", {
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
        logger.error("case2 adapter unexpected error", {
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
    services: { controlFile, dataFiles, screenshot },
  };
}

export function createAdapterServer(app) {
  return http.createServer(app.handler);
}

/**
 * 控制轮询降噪：同一 status + save_picture_flag 连续成功 GET 只记首条。
 */
export function createControlGetSampler() {
  let lastKey = null;
  return {
    shouldLog(control) {
      const key = `${control?.status ?? ""}\u0000${control?.save_picture_flag ?? ""}`;
      if (key === lastKey) return false;
      lastKey = key;
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
  const isQuietControlGet =
    request.method === "GET" &&
    url.pathname === "/api/case2/control-file" &&
    statusCode === 200;

  if (isQuietControlGet) {
    const control = accessExtra.control;
    if (!control || !controlGetSampler.shouldLog(control)) {
      return;
    }
  }

  const context = {
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
  logger[level]("case2 adapter request", context);
}
