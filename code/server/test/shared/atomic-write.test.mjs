import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { atomicReplaceFile } from "../../src/shared/atomic-write.mjs";

test("atomicReplaceFile retries transient Windows rename locks", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "atomic-write-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const targetPath = path.join(directory, "case_control.json");
  await fs.writeFile(targetPath, "old\n");

  let renameCalls = 0;
  const warnings = [];
  const fsOps = {
    ...fs,
    rename: async (...args) => {
      renameCalls += 1;
      if (renameCalls <= 2) {
        const error = new Error("simulated Windows sharing violation");
        error.code = "EPERM";
        throw error;
      }
      return fs.rename(...args);
    },
  };

  await atomicReplaceFile(targetPath, "new\n", {
    fsOps,
    renameAttempts: 3,
    renameRetryMs: 0,
    sleep: async () => {},
    logger: {
      warn(event, data) {
        warnings.push({ event, data });
      },
    },
  });

  assert.equal(renameCalls, 3);
  assert.equal(await fs.readFile(targetPath, "utf8"), "new\n");
  assert.equal(warnings.length, 2);
  assert.equal(warnings[0].event, "atomic rename transient failure; retrying");
  assert.equal(warnings[0].data.code, "EPERM");
  assert.equal(warnings[0].data.attempt, 1);
  assert.equal(warnings[1].data.attempt, 2);
});

test("atomicReplaceFile does not retry non-lock rename errors", async () => {
  let renameCalls = 0;
  const fsOps = {
    stat: async () => ({ mode: 0o600 }),
    open: async () => ({
      writeFile: async () => {},
      sync: async () => {},
      close: async () => {},
    }),
    rename: async () => {
      renameCalls += 1;
      const error = new Error("simulated cross-device rename");
      error.code = "EXDEV";
      throw error;
    },
    unlink: async () => {},
  };

  await assert.rejects(
    atomicReplaceFile("/tmp/case-control-target", "new\n", {
      fsOps,
      renameAttempts: 3,
      renameRetryMs: 0,
      sleep: async () => {},
    }),
    { code: "EXDEV" },
  );
  assert.equal(renameCalls, 1);
});
