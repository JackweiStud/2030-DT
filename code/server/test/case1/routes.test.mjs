import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createCase1Router,
  parseScalar,
  parseMatrix,
} from "../../src/cases/case1/routes.mjs";

test("offline parser rejects missing cells, nonfinite and invalid ratio; heatmap clamps to range", () => {
  const range = { min: -500, max: 500 };
  assert.deepEqual(parseMatrix("1,2,3\n4,5,6", range), [
    [1, 2, 3],
    [4, 5, 6],
  ]);
  assert.deepEqual(parseMatrix("600,-600\n0,1", range), [
    [500, -500],
    [0, 1],
  ]);
  for (const value of ["", "1,2\n3", "1,NaN", "1,,2", "1,2,", "1,Infinity"])
    assert.throws(() => parseMatrix(value, range), value);
  assert.throws(() => parseMatrix("1,2", null), /有效数值范围/);
  for (const value of ["", "NaN", "Infinity", "-0.2", "1.01", "0.8 0.9"])
    assert.throws(() => parseScalar(value, true), value);
  assert.equal(parseScalar("1.2", false), 1.2);
});

test("fixed read-only routes: valid data, binary, invalid and missing files, no control dependency", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "case1-api-"));
  const dataDir = path.join(dir, "case1");
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(dataDir);
  await writeFile(
    path.join(dataDir, "model_geonetry_kpi_ge_fidelity_rf_off.txt"),
    "0.85",
  );
  await writeFile(
    path.join(dataDir, "model_geonetry_kpi_ge_fidelity_rf_on.txt"),
    "0.90",
  );
  await writeFile(
    path.join(dataDir, "model_geonetry_kpi_ge_recon_rate_rf_off.txt"),
    "0.82",
  );
  await writeFile(
    path.join(dataDir, "model_geonetry_kpi_ge_recon_rate_rf_on.txt"),
    "0.91",
  );
  const route = createCase1Router({
    sharedDir: dir,
    case1Ranges: { heatmapRss: { min: -500, max: 500 } },
  });
  const server = http.createServer(
    (req, res) => void route(req, res, new URL(req.url, "http://local")),
  );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(
    () =>
      new Promise((r) => {
        server.closeAllConnections();
        server.close(r);
      }),
  );
  const url = `http://127.0.0.1:${server.address().port}/api/case1`;
  const result = await (await fetch(url + "/data/geometry")).json();
  assert.deepEqual(result.kpis, [
    { id: "fidelity", off: 0.85, on: 0.9 },
    { id: "recon", off: 0.82, on: 0.91 },
  ]);
  const model = await fetch(url + "/models/geometry");
  assert.equal(model.status, 200);
  assert.equal(model.headers.get("content-type"), "model/gltf-binary");
  assert.ok(Number(model.headers.get("content-length")) > 0);
  await model.body?.cancel();
  assert.equal((await fetch(url + "/data/material")).status, 404);
  assert.equal((await fetch(url + "/models/rf")).status, 404);
  assert.equal((await fetch(url + "/data/unknown")).status, 404);
  assert.equal(
    (await fetch(url + "/data/geometry", { method: "POST" })).status,
    405,
  );
  await writeFile(
    path.join(dataDir, "model_geonetry_kpi_ge_fidelity_rf_on.txt"),
    "NaN",
  );
  const bad = await fetch(url + "/data/geometry");
  assert.equal(bad.status, 422);
  assert.equal((await bad.json()).error.code, "INVALID_DATA");
});
