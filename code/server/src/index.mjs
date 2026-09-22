import { createAdapterApp, createAdapterServer } from "./app.mjs";
import { loadRuntimeConfig } from "./shared/config.mjs";
import { createLogger } from "./shared/logger.mjs";

const logger = createLogger();

/**
 * 正式入口只启动文件适配服务，不包含模拟后端或业务 status 推进。
 */
async function main() {
  const config = await loadRuntimeConfig();
  const app = createAdapterApp({
    sharedDir: config.sharedDir,
    logger,
    case1Ranges: config.case1Ranges,
    case2Ranges: config.case2Ranges,
  });
  await app.initialize();

  const server = createAdapterServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, resolve);
  });

  logger.info("dt adapter started", {
    host: config.host,
    port: config.port,
    sharedDir: config.sharedDir,
  });

  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    logger.info("dt adapter stopping", { signal });
    server.close((error) => {
      if (error) {
        logger.error("dt adapter shutdown failed", { reason: error.message });
        process.exitCode = 1;
      }
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error) => {
  logger.error("dt adapter failed to start", {
    reason: error?.message ?? String(error),
  });
  process.exitCode = 1;
});
