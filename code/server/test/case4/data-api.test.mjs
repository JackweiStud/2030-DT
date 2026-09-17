import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  CASE4_BASE_FILE,
  CASE4_CDF_FILES,
} from "../../src/cases/case4/constants.mjs";
import { createLogCollector, createSharedDir, interceptControlFileFs, jsonRequest, startTestServer, writeControl } from "../helpers.mjs";
import {
  writeCase4All,
  writeCase4Base,
  writeCase4Statistics,
  writeCase4Throughput,
  writeCase4Trajectory,
  xyzLines,
} from "./helpers.mjs";

test("init-data 返回连续编号 base，不含实时文件", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase4Base(sharedDir, "1.005,15.014,0\n2,16,0\n");
  await writeCase4Trajectory(sharedDir, {
    traditional: xyzLines(5),
    commercial: xyzLines(5),
    dt: xyzLines(5),
  });
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const response = await jsonRequest(baseUrl, "/api/case4/init-data");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.baseRoute, [
    { no: 1, x: 1.01, y: 15.01, z: 0 },
    { no: 2, x: 2, y: 16, z: 0 },
  ]);
  assert.equal(response.body.baseRoute.length, 2);
});

test("init-data 连续三次不稳定返回 DATA_FILE_READ_FAILED 且无 baseRoute", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase4Base(sharedDir);
  const realFs = fs;
  let ticks = 0n;
  const fsOps = {
    ...realFs,
    stat: async (filePath, options) => {
      const stat = await realFs.stat(filePath, options);
      if (String(filePath).endsWith(CASE4_BASE_FILE)) {
        ticks += 1n;
        return {
          ...stat,
          size: stat.size,
          mtimeNs: ticks,
          mtimeMs: Number(ticks),
        };
      }
      return stat;
    },
  };
  const { baseUrl } = await startTestServer(t, { sharedDir, fsOps });
  const response = await jsonRequest(baseUrl, "/api/case4/init-data");
  assert.equal(response.status, 500);
  assert.equal(response.body.error.code, "DATA_FILE_READ_FAILED");
  assert.equal(response.body.baseRoute, undefined);
  assert.equal("baseRoute" in response.body, false);
});

test("运行中 5/3/4 返回前 3 点 pending，不看 complete", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case4",
    command: "start",
    dt_type: "all",
    status: "",
  });
  await writeCase4Base(sharedDir, xyzLines(5));
  await writeCase4Trajectory(sharedDir, {
    traditional: xyzLines(5),
    commercial: xyzLines(3),
    dt: xyzLines(4),
  });
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const response = await jsonRequest(baseUrl, "/api/case4/trajectory");
  assert.equal(response.status, 200);
  assert.equal(response.body.completeCount, 3);
  assert.equal(response.body.points.length, 3);
  assert.equal(response.body.pendingTail, true);
  assert.equal(response.body.points[0].no, 1);
  assert.ok(response.body.points[0].traditional);
  assert.ok(response.body.points[0].commercial);
  assert.ok(response.body.points[0].dt);
});

test("K=0 空轨迹 live 200；超 base 422", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase4Base(sharedDir, xyzLines(1));
  await writeCase4Trajectory(sharedDir, {
    traditional: "",
    commercial: "",
    dt: "",
  });
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const empty = await jsonRequest(baseUrl, "/api/case4/trajectory");
  assert.equal(empty.status, 200);
  assert.equal(empty.body.completeCount, 0);
  assert.deepEqual(empty.body.points, []);

  await writeCase4Trajectory(sharedDir, {
    traditional: xyzLines(2),
    commercial: xyzLines(1),
    dt: xyzLines(1),
  });
  const overflow = await jsonRequest(baseUrl, "/api/case4/trajectory");
  assert.equal(overflow.status, 422);
  assert.equal(overflow.body.error.code, "TRAJECTORY_DATA_INVALID");
});

test("吞吐两路独立、可空、可不等长；缺文件 404；非法完整行 422", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase4Base(sharedDir);
  await writeCase4Throughput(sharedDir, {
    without: "8.5\n9.1\n10\n",
    with: "",
  });
  const { baseUrl } = await startTestServer(t, { sharedDir });

  const without = await jsonRequest(baseUrl, "/api/case4/throughput?side=without");
  assert.equal(without.status, 200);
  assert.equal(without.body.side, "without");
  assert.equal(without.body.samples.length, 3);
  assert.equal(without.body.samples[0].no, 1);

  const withDt = await jsonRequest(baseUrl, "/api/case4/throughput?side=with");
  assert.equal(withDt.status, 200);
  assert.deepEqual(withDt.body.samples, []);
  assert.equal(withDt.body.pendingTail, false);

  const missingSide = await jsonRequest(baseUrl, "/api/case4/throughput");
  assert.equal(missingSide.status, 400);
  assert.equal(missingSide.body.error.code, "INVALID_SIDE");

  const extra = await jsonRequest(baseUrl, "/api/case4/throughput?side=with&extra=1");
  assert.equal(extra.status, 400);
  assert.equal(extra.body.error.code, "INVALID_SIDE");

  await fs.unlink(path.join(sharedDir, "case4", "ue_position_without_dt_thrp.txt"));
  const missingFile = await jsonRequest(baseUrl, "/api/case4/throughput?side=without");
  assert.equal(missingFile.status, 404);
  assert.equal(missingFile.body.error.code, "DATA_FILE_MISSING");

  await writeCase4Throughput(sharedDir, { without: "8.5\nbad\n", with: "1\n" });
  const invalid = await jsonRequest(baseUrl, "/api/case4/throughput?side=without");
  assert.equal(invalid.status, 422);
  assert.equal(invalid.body.error.code, "THROUGHPUT_DATA_INVALID");
});

test("半写尾行 live pending；已换行非法行 422", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase4Base(sharedDir, xyzLines(3));
  await writeCase4Trajectory(sharedDir, {
    traditional: "1,15,0\n2,16",
    commercial: xyzLines(1),
    dt: xyzLines(1),
  });
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const pending = await jsonRequest(baseUrl, "/api/case4/trajectory");
  assert.equal(pending.status, 200);
  assert.equal(pending.body.completeCount, 1);
  assert.equal(pending.body.pendingTail, true);

  await writeCase4Trajectory(sharedDir, {
    traditional: "1,15,0\n2,16\n",
    commercial: xyzLines(1),
    dt: xyzLines(1),
  });
  const invalid = await jsonRequest(baseUrl, "/api/case4/trajectory");
  assert.equal(invalid.status, 422);
  assert.equal(invalid.body.error.code, "TRAJECTORY_DATA_INVALID");
});

test("/result：38/30 同长通过，30/30/31 拒绝，双空吞吐通过", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case4",
    command: "start",
    dt_type: "all",
    status: "case complete",
  });
  await writeCase4Base(sharedDir, xyzLines(38));
  await writeCase4Trajectory(sharedDir, {
    traditional: xyzLines(30),
    commercial: xyzLines(30),
    dt: xyzLines(30),
  });
  await writeCase4Throughput(sharedDir, { without: "", with: "" });
  await writeCase4Statistics(sharedDir);
  const { baseUrl } = await startTestServer(t, { sharedDir });

  const ok = await jsonRequest(baseUrl, "/api/case4/result");
  assert.equal(ok.status, 200);
  assert.equal(ok.body.trajectory.completeCount, 30);
  assert.equal(ok.body.trajectory.pendingTail, false);
  assert.deepEqual(ok.body.throughput.without.samples, []);
  assert.deepEqual(ok.body.throughput.with.samples, []);
  assert.equal(ok.body.statistics.cdf.traditional.length, 3);
  assert.equal(ok.body.statistics.cdf.commercial.length, 2);
  assert.equal(ok.body.statistics.cdf.dt[0].errorM, 5.71e-5);
  assert.equal(ok.body.statistics.nlosRatio, 0.897);

  await writeCase4Trajectory(sharedDir, {
    traditional: xyzLines(30),
    commercial: xyzLines(30),
    dt: xyzLines(31),
  });
  const unequal = await jsonRequest(baseUrl, "/api/case4/result");
  assert.equal(unequal.status, 409);
  assert.equal(unequal.body.error.code, "RESULT_NOT_READY");
  assert.equal(unequal.body.trajectory, undefined);
});

test("/result 空轨迹、非 complete、缺 CDF 分别 409/409/404", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case4",
    command: "start",
    dt_type: "all",
    status: "execute success",
  });
  await writeCase4All(sharedDir, {
    traditional: "",
    commercial: "",
    dt: "",
  });
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const notComplete = await jsonRequest(baseUrl, "/api/case4/result");
  assert.equal(notComplete.status, 409);
  assert.equal(notComplete.body.error.code, "RESULT_NOT_READY");

  await writeControl(sharedDir, {
    case: "case4",
    command: "start",
    dt_type: "all",
    status: "case complete",
    save_picture_flag: 0,
  });
  const empty = await jsonRequest(baseUrl, "/api/case4/result");
  assert.equal(empty.status, 409);
  assert.equal(empty.body.error.code, "RESULT_NOT_READY");

  await writeCase4Trajectory(sharedDir);
  await fs.unlink(path.join(sharedDir, "case4", CASE4_CDF_FILES.dt));
  const missing = await jsonRequest(baseUrl, "/api/case4/result");
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, "DATA_FILE_MISSING");
});

test("live 接口在 status 为空时仍 200，query 非法被拒绝", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase4All(sharedDir);
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const trajectory = await jsonRequest(baseUrl, "/api/case4/trajectory?x=1");
  assert.equal(trajectory.status, 400);
  assert.equal(trajectory.body.error.code, "INVALID_REQUEST");

  const live = await jsonRequest(baseUrl, "/api/case4/trajectory");
  assert.equal(live.status, 200);
  const control = await jsonRequest(baseUrl, "/api/case4/control-file");
  assert.equal(control.status, 200);
  assert.equal(control.body.control.status, "");
});

test("/result 吞吐半行 pending 为 409，已换行非法为 422", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case4",
    command: "start",
    dt_type: "all",
    status: "case complete",
  });
  await writeCase4All(sharedDir, { without: "8.5\n9," });
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const pending = await jsonRequest(baseUrl, "/api/case4/result");
  assert.equal(pending.status, 409);
  assert.equal(pending.body.error.code, "RESULT_NOT_READY");

  await writeCase4Throughput(sharedDir, { without: "8.5\nbad\n", with: "" });
  const invalid = await jsonRequest(baseUrl, "/api/case4/result");
  assert.equal(invalid.status, 422);
  assert.equal(invalid.body.error.code, "THROUGHPUT_DATA_INVALID");
});

test("/result 吞吐文件尾空白仍可完成，记录间空行仍 422", async (t) => {
  const complete = {
    case: "case4",
    command: "start",
    dt_type: "all",
    status: "case complete",
  };
  const sharedDir = await createSharedDir(t, complete);
  await writeCase4All(sharedDir, { without: "8.5\n9.1\n  ", with: "9.2\n\n" });
  const { baseUrl } = await startTestServer(t, { sharedDir });
  const ok = await jsonRequest(baseUrl, "/api/case4/result");
  assert.equal(ok.status, 200);
  assert.equal(ok.body.throughput.without.samples.length, 2);
  assert.equal(ok.body.throughput.with.samples.length, 1);
  assert.equal(ok.body.throughput.without.pendingTail, false);
  assert.equal(ok.body.trajectory.pendingTail, false);

  await writeCase4Throughput(sharedDir, { without: "8.5\n\n9.1\n", with: "" });
  const between = await jsonRequest(baseUrl, "/api/case4/result");
  assert.equal(between.status, 422);
  assert.equal(between.body.error.code, "THROUGHPUT_DATA_INVALID");
  assert.equal(between.body.trajectory, undefined);
});

test("JSONL 随 completeCount 写出归一点；start 后清空；写失败不影响 REST", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase4Base(sharedDir, xyzLines(3));
  await writeCase4Trajectory(sharedDir, {
    traditional: "65535,15,0\n2,16,0\n3,17,0\n",
    commercial: xyzLines(3),
    dt: xyzLines(3),
  });
  const logs = createLogCollector();
  const { baseUrl, app } = await startTestServer(t, {
    sharedDir,
    logger: logs.logger,
  });
  const first = await jsonRequest(baseUrl, "/api/case4/trajectory");
  assert.equal(first.status, 200);
  assert.equal(first.body.points[0].traditional.x, 1);
  const jsonlPath = app.services.case4.debugJsonl.filePath;
  const jsonl = await fs.readFile(jsonlPath, "utf8");
  const rows = jsonl.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(rows.length, 3);
  assert.equal(rows[0].traditional.x, 1);
  assert.equal(Object.hasOwn(rows[0], "gbps"), false);

  const mtime = (await fs.stat(jsonlPath)).mtimeMs;
  await jsonRequest(baseUrl, "/api/case4/trajectory");
  assert.equal((await fs.stat(jsonlPath)).mtimeMs, mtime);

  await jsonRequest(baseUrl, "/api/case4/control-file", {
    method: "POST",
    body: { case: "case4", command: "start", dt_type: "all" },
  });
  assert.equal(await fs.readFile(jsonlPath, "utf8"), "");

  const realFs = fs;
  const fsOps = {
    ...realFs,
    mkdir: async (dir, options) => {
      if (String(dir).includes(`${path.sep}points`)) {
        throw new Error("jsonl mkdir failed");
      }
      return realFs.mkdir(dir, options);
    },
  };
  const sharedDir2 = await createSharedDir(t);
  await writeCase4All(sharedDir2);
  const logs2 = createLogCollector();
  const second = await startTestServer(t, {
    sharedDir: sharedDir2,
    fsOps,
    logger: logs2.logger,
  });
  const live = await jsonRequest(second.baseUrl, "/api/case4/trajectory");
  assert.equal(live.status, 200);
  const started = await jsonRequest(second.baseUrl, "/api/case4/control-file", {
    method: "POST",
    body: { case: "case4", command: "start", dt_type: "all" },
  });
  assert.equal(started.status, 200);
  assert.equal(started.body.control.command, "start");
  assert.ok(
    logs2.entries.some(
      (entry) => entry.message === "case4 debug JSONL write failed",
    ),
  );
});

test("65535 替换日志按事件去重", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase4Base(sharedDir, xyzLines(1));
  await writeCase4Trajectory(sharedDir, {
    traditional: "65535,15,0\n",
    commercial: xyzLines(1),
    dt: xyzLines(1),
  });
  const logs = createLogCollector();
  const { baseUrl } = await startTestServer(t, { sharedDir, logger: logs.logger });
  await jsonRequest(baseUrl, "/api/case4/trajectory");
  await jsonRequest(baseUrl, "/api/case4/trajectory");
  const subs = logs.entries.filter(
    (entry) => entry.message === "case4 invalid coordinate substituted",
  );
  assert.equal(subs.length, 1);
  assert.equal(subs[0].context.scheme, "traditional");
  assert.equal(subs[0].context.component, "x");
  assert.equal(subs[0].context.source, "base");
});

test("/result 读取期间文件或控制漂移返回 409 且无部分结果", async (t) => {
  const complete = {
    case: "case4",
    command: "start",
    dt_type: "all",
    status: "case complete",
    save_picture_flag: 0,
  };
  const sharedDir = await createSharedDir(t, complete);
  await writeCase4All(sharedDir);
  const realFs = fs;
  let ticks = 0n;
  const fsOps = {
    ...realFs,
    stat: async (filePath, options) => {
      const stat = await realFs.stat(filePath, options);
      if (String(filePath).includes("ue_position_gaode_coordinates_realtime.txt")) {
        ticks += 1n;
        return {
          ...stat,
          mtimeNs: ticks,
          mtimeMs: Number(ticks),
        };
      }
      return stat;
    },
  };
  const { baseUrl } = await startTestServer(t, { sharedDir, fsOps });
  const fileDrift = await jsonRequest(baseUrl, "/api/case4/result");
  assert.equal(fileDrift.status, 409);
  assert.equal(fileDrift.body.error.code, "RESULT_NOT_READY");
  assert.equal(fileDrift.body.trajectory, undefined);

  const sharedDir2 = await createSharedDir(t, complete);
  await writeCase4All(sharedDir2);
  const { fsOps: controlFs } = interceptControlFileFs(fs, {
    afterControlRead: async (controlReads) => {
      const nextStatus = controlReads % 2 === 1 ? "execute success" : "case complete";
      await writeControl(sharedDir2, { ...complete, status: nextStatus });
    },
  });
  const second = await startTestServer(t, { sharedDir: sharedDir2, fsOps: controlFs });
  const controlDrift = await jsonRequest(second.baseUrl, "/api/case4/result");
  assert.equal(controlDrift.status, 409);
  assert.equal(controlDrift.body.error.code, "RESULT_NOT_READY");
  assert.equal(controlDrift.body.statistics, undefined);
});
