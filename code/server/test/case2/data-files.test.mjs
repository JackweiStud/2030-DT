import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createControlFileService } from "../../src/cases/case2/control-file.mjs";
import { createDataFilesService } from "../../src/cases/case2/data-files.mjs";
import { createSilentLogger } from "../../src/shared/logger.mjs";
import {
  createLogCollector,
  createSharedDir,
  writeControl,
  writePhaseFiles,
  DEFAULT_CONTROL,
} from "../helpers.mjs";

function services(sharedDir, options = {}) {
  const logger = options.logger ?? createSilentLogger();
  const controlFile = createControlFileService({
    sharedDir,
    fsOps: options.fsOps,
    logger,
  });
  const dataFiles = createDataFilesService({
    sharedDir,
    controlFile,
    fsOps: options.fsOps,
    logger,
  });
  return { controlFile, dataFiles };
}

test("Initial 整批返回动态矩阵和动态 KPI", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writePhaseFiles(sharedDir, "initial", {
    heatmap: "1.235 2 3\n4 5 6\n",
    kpi: "1.235,2\n3\n",
  });

  const result = await services(sharedDir).dataFiles.readPhase("initial");
  assert.equal(result.phase, "initial");
  assert.deepEqual(result.metrics.rss.heatmap, [
    [1.24, 2, 3],
    [4, 5, 6],
  ]);
  assert.deepEqual(result.metrics.first_path_delay.kpi, [1.24, 2, 3]);
});

test("Calibrated 六文件稳定且 Case2 start complete 时整批成功", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case2",
    command: "start",
    dt_type: "with dt",
    status: "case complete",
  });
  await writePhaseFiles(sharedDir, "calibrated");
  const result = await services(sharedDir).dataFiles.readPhase("calibrated");
  assert.equal(Object.keys(result.metrics).length, 3);
});

test("Calibrated 缺失、非法或读取期间变化时整批拒绝并记录诊断", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case2",
    command: "start",
    dt_type: "with dt",
    status: "case complete",
  });
  await writePhaseFiles(sharedDir, "calibrated");
  const target = path.join(sharedDir, "case2", "heatmap_cali_rss.txt");
  const logs = createLogCollector();

  await fs.unlink(target);
  await assert.rejects(
    services(sharedDir, { logger: logs.logger }).dataFiles.readPhase("calibrated"),
    { code: "RESULT_BATCH_INCOMPLETE", status: 409 },
  );
  assert.equal(logs.entries.at(-1).context.filename, "heatmap_cali_rss.txt");

  await fs.writeFile(target, "1 2\n3\n");
  await assert.rejects(
    services(sharedDir, { logger: logs.logger }).dataFiles.readPhase("calibrated"),
    { code: "DATA_FILE_INVALID", status: 422 },
  );

  await fs.writeFile(target, "1 2\n3 4\n");
  let targetStats = 0;
  const changingFs = {
    readFile: fs.readFile,
    stat: async (filename, options) => {
      const stat = await fs.stat(filename, options);
      if (filename === target) {
        targetStats += 1;
        if (targetStats === 2) {
          return { ...stat, mtimeNs: stat.mtimeNs + 1n };
        }
      }
      return stat;
    },
  };
  await assert.rejects(
    services(sharedDir, {
      fsOps: changingFs,
      logger: logs.logger,
    }).dataFiles.readPhase("calibrated"),
    { code: "RESULT_BATCH_INCOMPLETE", status: 409 },
  );
});

test("Calibrated 不接受 Case3 的 case complete 控制归属", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case3",
    command: "start",
    dt_type: "with dt",
    status: "case complete",
  });
  await writePhaseFiles(sharedDir, "calibrated");
  await assert.rejects(
    services(sharedDir).dataFiles.readPhase("calibrated"),
    { code: "RESULT_BATCH_INCOMPLETE", status: 409 },
  );
});

test("Calibrated 不接受 init 叠加 case complete 的控制状态", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case2",
    command: "init",
    dt_type: "",
    status: "case complete",
  });
  await writePhaseFiles(sharedDir, "calibrated");
  await assert.rejects(
    services(sharedDir).dataFiles.readPhase("calibrated"),
    { code: "RESULT_BATCH_INCOMPLETE", status: 409 },
  );
});

test("Calibrated 读取期间控制归属变化即使 status 仍 complete 也拒绝", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case2",
    command: "start",
    dt_type: "with dt",
    status: "case complete",
  });
  await writePhaseFiles(sharedDir, "calibrated");
  let reads = 0;
  const controlFile = {
    read: async () => {
      reads += 1;
      if (reads === 1) {
        return {
          ...DEFAULT_CONTROL,
          case: "case2",
          command: "start",
          dt_type: "with dt",
          status: "case complete",
        };
      }
      return {
        ...DEFAULT_CONTROL,
        case: "case3",
        command: "start",
        dt_type: "with dt",
        status: "case complete",
      };
    },
  };
  const dataFiles = createDataFilesService({
    sharedDir,
    controlFile,
    logger: createSilentLogger(),
  });

  await assert.rejects(
    dataFiles.readPhase("calibrated"),
    { code: "RESULT_BATCH_INCOMPLETE", status: 409 },
  );
});

test("Calibrated 非 complete 时先返回批次未完成，不被文件缺失覆盖", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeControl(sharedDir, { ...DEFAULT_CONTROL, status: "execute success" });
  await assert.rejects(
    services(sharedDir).dataFiles.readPhase("calibrated"),
    { code: "RESULT_BATCH_INCOMPLETE", status: 409 },
  );
});

test("Initial 任一文件缺失时返回 DATA_FILE_MISSING", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writePhaseFiles(sharedDir, "initial");
  await fs.unlink(path.join(sharedDir, "case2", "heatmap_init_kpi_rss.txt"));
  await assert.rejects(
    services(sharedDir).dataFiles.readPhase("initial"),
    { code: "DATA_FILE_MISSING", status: 404 },
  );
});
