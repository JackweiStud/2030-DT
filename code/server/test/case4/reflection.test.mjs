import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createLogCollector,
  createSharedDir,
  jsonRequest,
  startTestServer,
} from "../helpers.mjs";
import { createSilentLogger } from "../../src/shared/logger.mjs";
import { createCase4DebugJsonlService } from "../../src/cases/case4/debug-jsonl.mjs";
import {
  writeCase4All,
  writeCase4Reflection,
  writeCase4Trajectory,
  xyzLines,
} from "./helpers.mjs";
import { parseReflectionText } from "../../src/cases/case4/reflection-file.mjs";

const COMPLETE_CONTROL = {
  case: "case4",
  command: "start",
  dt_type: "all",
  status: "case complete",
};

test("反射解析：空白/逗号、65535、半行、非法完整行不改 Pi", () => {
  const space = parseReflectionText(
    "1 2 1.0 2.0 3.0 4.0 5.0 6.0\n0 0\n",
  );
  assert.equal(space.complete.length, 2);
  assert.equal(space.complete[0].kind, "ready");
  assert.equal(space.complete[0].los, true);
  assert.equal(space.complete[0].points.length, 2);
  assert.equal(space.complete[0].points[1].id, 2);
  assert.equal(space.complete[1].los, false);
  assert.equal(space.complete[1].points.length, 0);

  const comma = parseReflectionText("1,0\n");
  assert.equal(comma.complete[0].kind, "ready");
  assert.equal(comma.complete[0].los, true);

  const sentinel = parseReflectionText("65535\n1 1 1 2 3\n");
  assert.equal(sentinel.complete[0].kind, "invalid");
  assert.equal(sentinel.complete[0].reason, "row-sentinel");
  assert.equal(sentinel.complete[1].kind, "ready");
  assert.equal(sentinel.complete[1].points[0].id, 1);

  const skipRi = parseReflectionText("1 2 65535 1 1 4 5 6\n");
  assert.equal(skipRi.complete[0].kind, "ready");
  assert.deepEqual(
    skipRi.complete[0].points.map((point) => point.id),
    [2],
  );
  assert.equal(skipRi.complete[0].skipped[0].id, 1);

  const pending = parseReflectionText("1 2 1.0 2.0");
  assert.equal(pending.complete.length, 0);
  assert.equal(pending.hasPendingTail, true);

  const uncommittedReady = parseReflectionText("1 0");
  assert.equal(uncommittedReady.complete.length, 1);
  assert.equal(uncommittedReady.hasPendingTail, false);

  const committedIllegal = parseReflectionText("not-a-row\n1 0\n");
  assert.equal(committedIllegal.complete.length, 2);
  assert.equal(committedIllegal.complete[0].kind, "invalid");
  assert.equal(committedIllegal.complete[1].kind, "ready");

  for (const raw of ["1,1,1,2,", "1 1 1 2 3e"]) {
    const pendingTail = parseReflectionText(raw);
    assert.equal(pendingTail.complete.length, 0, raw);
    assert.equal(pendingTail.hasPendingTail, true, raw);
    const committed = parseReflectionText(`${raw}\n`);
    assert.equal(committed.complete.length, 1, raw);
    assert.equal(committed.complete[0].kind, "invalid", raw);
  }

  const uncommittedSentinel = parseReflectionText("65535");
  assert.equal(uncommittedSentinel.complete[0].kind, "invalid");
  assert.equal(uncommittedSentinel.complete[0].reason, "row-sentinel");
  assert.equal(uncommittedSentinel.hasPendingTail, false);
});

test("反射开启按四路前缀；关闭保持三轨迹且无反射字段", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase4All(sharedDir);
  await writeCase4Reflection(
    sharedDir,
    ["1 0", "0 1 1 2 3"].join("\n") + "\n",
  );
  const { baseUrl } = await startTestServer(t, { sharedDir });

  const off = await jsonRequest(baseUrl, "/api/case4/trajectory");
  assert.equal(off.status, 200);
  assert.equal(off.body.completeCount, 3);
  assert.equal(off.body.points[0].reflection, undefined);

  const explicitOff = await jsonRequest(
    baseUrl,
    "/api/case4/trajectory?reflection=false",
  );
  assert.equal(explicitOff.status, 200);
  assert.equal(explicitOff.body.completeCount, 3);

  const on = await jsonRequest(baseUrl, "/api/case4/trajectory?reflection=true");
  assert.equal(on.status, 200);
  assert.equal(on.body.completeCount, 2);
  assert.equal(on.body.pendingTail, true);
  assert.equal(on.body.points[0].reflection.state, "ready");
  assert.equal(on.body.points[0].reflection.los, true);
  assert.equal(on.body.points[1].reflection.los, false);
  assert.equal(on.body.points[1].reflection.points[0].id, 1);

  const bad = await jsonRequest(baseUrl, "/api/case4/trajectory?reflection=1");
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, "INVALID_REQUEST");
});

test("反射迟到等待、非法完整行不阻塞、缺失文件前缀为 0", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase4All(sharedDir);
  const { baseUrl } = await startTestServer(t, { sharedDir });

  const missing = await jsonRequest(
    baseUrl,
    "/api/case4/trajectory?reflection=true",
  );
  assert.equal(missing.status, 200);
  assert.equal(missing.body.completeCount, 0);
  assert.equal(missing.body.pendingTail, true);

  await writeCase4Reflection(sharedDir, "1 0\nbad-row\n");
  const two = await jsonRequest(baseUrl, "/api/case4/trajectory?reflection=true");
  assert.equal(two.status, 200);
  assert.equal(two.body.completeCount, 2);
  assert.equal(two.body.points[1].reflection.state, "invalid");

  await writeCase4Reflection(sharedDir, "1 0\nbad-row\n1 2 1.0");
  const pending = await jsonRequest(
    baseUrl,
    "/api/case4/trajectory?reflection=true",
  );
  assert.equal(pending.status, 200);
  assert.equal(pending.body.completeCount, 2);
  assert.equal(pending.body.pendingTail, true);
});

test("最终结果反射尽力附加；30/28 尾点 missing 不挡完成", async (t) => {
  const sharedDir = await createSharedDir(t, COMPLETE_CONTROL);
  await writeCase4All(sharedDir, {
    base: xyzLines(30),
    traditional: xyzLines(30, (no) => [no + 0.02, 15.01, 0]),
    commercial: xyzLines(30, (no) => [no + 0.05, 14.98, 0]),
    dt: xyzLines(30),
  });
  const twentyEight = Array.from({ length: 28 }, () => "1 0").join("\n") + "\n";
  await writeCase4Reflection(sharedDir, twentyEight);
  const { baseUrl, app } = await startTestServer(t, { sharedDir });

  const off = await jsonRequest(baseUrl, "/api/case4/result");
  assert.equal(off.status, 200);
  assert.equal(off.body.trajectory.completeCount, 30);
  assert.equal(off.body.trajectory.points[0].reflection, undefined);

  const on = await jsonRequest(baseUrl, "/api/case4/result?reflection=true");
  assert.equal(on.status, 200);
  assert.equal(on.body.trajectory.completeCount, 30);
  assert.equal(on.body.trajectory.points[27].reflection.state, "ready");
  assert.equal(on.body.trajectory.points[28].reflection.state, "missing");
  assert.equal(on.body.trajectory.points[29].reflection.state, "missing");

  const jsonl = await fs.readFile(app.services.case4.debugJsonl.filePath, "utf8");
  const rows = jsonl.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(rows.length, 30);
  assert.equal(rows[28].reflection.state, "missing");
});

test("同点数反射变化写入 JSONL；最终写后 live 不再覆盖", async (t) => {
  const sharedDir = await createSharedDir(t, COMPLETE_CONTROL);
  await writeCase4All(sharedDir);
  await writeCase4Reflection(sharedDir, "1 0\n1 0\n1 0\n");
  const { baseUrl, app } = await startTestServer(t, { sharedDir });
  const jsonlPath = app.services.case4.debugJsonl.filePath;

  await jsonRequest(baseUrl, "/api/case4/trajectory?reflection=true");
  const first = await fs.readFile(jsonlPath, "utf8");
  assert.match(first, /"state":"ready"/);

  await writeCase4Reflection(sharedDir, "0 0\n1 0\n1 0\n");
  await jsonRequest(baseUrl, "/api/case4/trajectory?reflection=true");
  const second = await fs.readFile(jsonlPath, "utf8");
  assert.notEqual(second, first);
  assert.match(second, /"los":false/);

  await jsonRequest(baseUrl, "/api/case4/result?reflection=true");
  const afterResult = await fs.readFile(jsonlPath, "utf8");
  await writeCase4Trajectory(sharedDir, {
    traditional: xyzLines(2),
    commercial: xyzLines(2),
    dt: xyzLines(2),
  });
  await jsonRequest(baseUrl, "/api/case4/trajectory?reflection=true");
  assert.equal(await fs.readFile(jsonlPath, "utf8"), afterResult);
});

function jsonlPoint(reflection) {
  return {
    no: 1,
    traditional: { x: 1, y: 1, z: 0 },
    commercial: { x: 1, y: 1, z: 0 },
    dt: { x: 1, y: 1, z: 0 },
    reflection,
  };
}

test("JSONL 串行写入：live 在途时 result 封印后不得覆盖", async (t) => {
  const sharedDir = await createSharedDir(t);
  let releaseOpen;
  const holdOpen = new Promise((resolve) => {
    releaseOpen = resolve;
  });
  let startedOpen;
  const started = new Promise((resolve) => {
    startedOpen = resolve;
  });
  let holdNextJsonlOpen = false;
  const fsOps = {
    ...fs,
    mkdir: (...args) => fs.mkdir(...args),
    stat: (...args) => fs.stat(...args),
    unlink: (...args) => fs.unlink(...args),
    rename: (...args) => fs.rename(...args),
    open: async (...args) => {
      if (holdNextJsonlOpen && String(args[0]).includes("trajectory.jsonl")) {
        holdNextJsonlOpen = false;
        startedOpen();
        await holdOpen;
      }
      return fs.open(...args);
    },
  };
  const jsonl = createCase4DebugJsonlService({
    sharedDir,
    fsOps,
    logger: createSilentLogger(),
  });
  await jsonl.clear();
  holdNextJsonlOpen = true;
  const liveP = jsonl.writeIfChanged(
    [jsonlPoint({ state: "ready", los: true, points: [] })],
    { source: "live" },
  );
  await started;
  const resultP = jsonl.writeIfChanged(
    [jsonlPoint({ state: "missing", los: null, points: [] })],
    { source: "result" },
  );
  releaseOpen();
  await Promise.all([liveP, resultP]);
  const after = await fs.readFile(jsonl.filePath, "utf8");
  assert.match(after, /"state":"missing"/);
  await jsonl.writeIfChanged(
    [jsonlPoint({ state: "ready", los: false, points: [] })],
    { source: "live" },
  );
  assert.equal(await fs.readFile(jsonl.filePath, "utf8"), after);
});

test("/result 反射读取期间变化仍 200，warn 后尽力附加", async (t) => {
  const sharedDir = await createSharedDir(t, COMPLETE_CONTROL);
  await writeCase4All(sharedDir);
  await writeCase4Reflection(sharedDir, "1 0\n1 0\n1 0\n");
  let arm = false;
  let reflectionStats = 0;
  const reflectionName = "ue_position_with_dt_coordinates_reflection_point.txt";
  const fsOps = {
    ...fs,
    stat: async (filePath, opts) => {
      if (arm && String(filePath).endsWith(reflectionName)) {
        reflectionStats += 1;
        if (reflectionStats === 1) {
          const previous = await fs.stat(filePath, opts);
          await writeCase4Reflection(sharedDir, "0 0\n1 0\n1 0\n");
          return previous;
        }
      }
      return fs.stat(filePath, opts);
    },
  };
  const logs = createLogCollector();
  const { baseUrl } = await startTestServer(t, {
    sharedDir,
    fsOps,
    logger: logs.logger,
  });
  arm = true;
  const on = await jsonRequest(baseUrl, "/api/case4/result?reflection=true");
  assert.equal(on.status, 200);
  assert.equal(on.body.trajectory.completeCount, 3);
  assert.equal(on.body.trajectory.points[0].reflection.state, "ready");
  assert.equal(on.body.trajectory.points[0].reflection.los, false);
  assert.equal(on.body.trajectory.points[2].reflection.state, "ready");
  assert.equal(reflectionStats, 2);
  assert.equal(
    logs.entries.some(
      (entry) =>
        entry.level === "warn" &&
        entry.message === "case4 reflection result snapshot drifted",
    ),
    true,
  );
});

test("反射读取期间变化则重试后取稳定快照", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase4All(sharedDir);
  await writeCase4Reflection(sharedDir, "1 0\n1 0\n1 0\n");
  let arm = false;
  let reflectionStats = 0;
  const reflectionName = "ue_position_with_dt_coordinates_reflection_point.txt";
  const fsOps = {
    ...fs,
    mkdir: (...args) => fs.mkdir(...args),
    readFile: (...args) => fs.readFile(...args),
    writeFile: (...args) => fs.writeFile(...args),
    rename: (...args) => fs.rename(...args),
    unlink: (...args) => fs.unlink(...args),
    stat: async (filePath, opts) => {
      if (arm && String(filePath).endsWith(reflectionName)) {
        reflectionStats += 1;
        if (reflectionStats === 1) {
          const previous = await fs.stat(filePath, opts);
          await writeCase4Reflection(sharedDir, "0 0\n1 0\n1 0\n");
          return previous;
        }
      }
      return fs.stat(filePath, opts);
    },
  };
  const { baseUrl } = await startTestServer(t, { sharedDir, fsOps });
  arm = true;
  const on = await jsonRequest(baseUrl, "/api/case4/trajectory?reflection=true");
  assert.equal(on.status, 200);
  assert.equal(on.body.points[0].reflection.los, false);
  assert.ok(reflectionStats >= 4);
});
