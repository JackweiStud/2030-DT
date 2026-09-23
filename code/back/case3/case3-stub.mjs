/**
 * Case3 本地模拟后端组装入口。
 * 它只监听共享控制并发布 synthetic/reference-derived 文件，绝不提供 REST。
 */

import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRuntimeConfig } from "./src/config.mjs";
import { createControlStore } from "./src/control-store.mjs";
import { loadFixtureStore, seedInitFiles } from "./src/fixture-store.mjs";
import { createLogger } from "./src/logger.mjs";
import { createPublisher } from "./src/publisher.mjs";
import { createStubRunner } from "./src/runner.mjs";

const case3Root = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_FIXTURE_DIR = path.join(case3Root, "fixtures");

export async function createCase3Stub(options) {
  const config = options.config;
  const logger = options.logger ?? createLogger(config.logLevel);
  const fixtureStore =
    options.fixtureStore ??
    (await loadFixtureStore({
      fixtureDir: options.fixtureDir ?? DEFAULT_FIXTURE_DIR,
      fsOps: options.fsOps,
    }));

  if (config.seedInit) {
    await seedInitFiles({
      sharedDir: config.sharedDir,
      fixtureStore,
      fsOps: options.fsOps,
      logger,
    });
  }

  const controlStore =
    options.controlStore ??
    createControlStore({
      sharedDir: config.sharedDir,
      fsOps: options.fsOps,
      logger,
      readAttempts: options.readAttempts,
      readRetryMs: options.readRetryMs,
    });
  const publisher =
    options.publisher ??
    createPublisher({
      sharedDir: config.sharedDir,
      fixtureStore,
      controlStore,
      fsOps: options.fsOps,
      logger,
      pointMs: config.pointMs,
      pollMs: config.pollMs,
      dataMode: config.dataMode,
      seed: config.seed,
      throughputJitter: config.throughputJitter,
    });
  const runner = createStubRunner({
    sharedDir: config.sharedDir,
    controlStore,
    publisher,
    logger,
    outcome: config.outcome,
    requestPicture: config.requestPicture,
    successDwellMs: config.successDwellMs,
    pollMs: config.pollMs,
    watchFactory: options.watchFactory,
  });
  return { runner, controlStore, publisher, fixtureStore, logger };
}

export async function runMain(env = process.env) {
  const config = await loadRuntimeConfig(env);
  const logger = createLogger(config.logLevel);
  const stub = await createCase3Stub({ config, logger });
  await stub.runner.start();
  logger.info("stub-started", {
    event: "started",
    sharedDir: config.sharedDir,
    fixtureDir: stub.fixtureStore.fixtureDir,
    pollMs: config.pollMs,
    successDwellMs: config.successDwellMs,
    pointMs: config.pointMs,
    outcome: config.outcome,
    requestPicture: config.requestPicture,
    seedInit: config.seedInit,
    dataMode: config.dataMode,
    seedConfigured: config.seed !== "",
    throughputJitter: config.throughputJitter,
    dataSource:
      config.dataMode === "random"
        ? "synthetic-kpi+fixture-structure"
        : "fixture-replay",
  });

  await new Promise((resolve) => {
    const stop = (signal) => {
      logger.info("stub-stopping", { event: "stopping", signal });
      resolve();
    };
    process.once("SIGINT", () => stop("SIGINT"));
    process.once("SIGTERM", () => stop("SIGTERM"));
  });
  await stub.runner.stop();
}

const isDirect =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirect) {
  runMain().catch((error) => {
    console.error(
      `[case3-stub] error startup-failed ${JSON.stringify({
        caseId: "case3",
        event: "startup-failed",
        code: error?.code ?? "UNEXPECTED_ERROR",
        reason: error?.message ?? String(error),
      })}`,
    );
    process.exitCode = 1;
  });
}

export { loadRuntimeConfig } from "./src/config.mjs";
export {
  assertTaskOwnership,
  createControlStore,
  readControlFile,
} from "./src/control-store.mjs";
export {
  loadFixtureStore,
  seedInitFiles,
  validateInitContent,
} from "./src/fixture-store.mjs";
export { createSilentLogger } from "./src/logger.mjs";
export {
  createRoundDataset,
  createSeededRng,
} from "./src/kpi-generator.mjs";
