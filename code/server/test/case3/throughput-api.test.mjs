import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { CASE3_SIDE_FILES } from "../../src/cases/case3/constants.mjs";
import {
  createSharedDir,
  jsonRequest,
  startTestServer,
  writeCase3SideFiles,
} from "../helpers.mjs";

test("GET /api/case3/throughput 独立返回样点，不等待坐标", async (t) => {
  const sharedDir = await createSharedDir(t);
  await writeCase3SideFiles(sharedDir, "without", {
    coordinates: "",
    scans: "",
    selected: "",
    throughput: "8.50\n9.10\n",
    cost: "25.0\n",
  });
  const { baseUrl } = await startTestServer(t, { sharedDir });

  const response = await jsonRequest(
    baseUrl,
    "/api/case3/throughput?side=without",
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.side, "without");
  assert.deepEqual(response.body.samples, [
    { no: 1, gbps: 8.5 },
    { no: 2, gbps: 9.1 },
  ]);
  assert.equal(response.body.pendingTail, false);
});

test("GET /api/case3/throughput 半行尾 pending", async (t) => {
  const sharedDir = await createSharedDir(t);
  const file = CASE3_SIDE_FILES.without.throughput;
  await fs.mkdir(path.join(sharedDir, "case3"), { recursive: true });
  await fs.writeFile(
    path.join(sharedDir, "case3", file),
    "8.50\n9..1",
    "utf8",
  );
  const { baseUrl } = await startTestServer(t, { sharedDir });

  const response = await jsonRequest(
    baseUrl,
    "/api/case3/throughput?side=without",
  );
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.samples, [{ no: 1, gbps: 8.5 }]);
  assert.equal(response.body.pendingTail, true);
});

test("GET /api/case3/throughput 拒绝非法 query", async (t) => {
  const sharedDir = await createSharedDir(t);
  const { baseUrl } = await startTestServer(t, { sharedDir });

  const missing = await jsonRequest(baseUrl, "/api/case3/throughput");
  assert.equal(missing.status, 400);

  const extra = await jsonRequest(
    baseUrl,
    "/api/case3/throughput?side=with&extra=1",
  );
  assert.equal(extra.status, 400);
});
