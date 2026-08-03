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

  async function initialize() {
    await controlFile.read();
    await screenshot.cleanupTemporaryFiles();
  }

  async function handler(request, response) {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      const handled = await routeCase2(request, response, url);
      if (!handled) {
        sendJson(response, 404, {
          ok: false,
          error: { code: "NOT_FOUND", message: "route not found" },
        });
      }
    } catch (error) {
      if (response.headersSent) {
        response.destroy(error);
        return;
      }

      if (isAppError(error)) {
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
        return;
      }

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
