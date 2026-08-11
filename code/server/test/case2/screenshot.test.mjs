import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createControlFileService } from "../../src/cases/case2/control-file.mjs";
import { createScreenshotService } from "../../src/cases/case2/screenshot.mjs";
import { createSilentLogger } from "../../src/shared/logger.mjs";
import {
  createSharedDir,
  PNG_BASE64,
  PNG_BYTES,
  readControl,
  writeControl,
} from "../helpers.mjs";

function services(sharedDir) {
  const logger = createSilentLogger();
  const controlFile = createControlFileService({ sharedDir, logger });
  const screenshot = createScreenshotService({ sharedDir, controlFile, logger });
  return { controlFile, screenshot };
}

test("flag=0 时拒绝截图，非法 Base64/PNG 也拒绝", async (t) => {
  const sharedDir = await createSharedDir(t);
  const { screenshot } = services(sharedDir);

  await assert.rejects(screenshot.save({ image_base64: PNG_BASE64 }), {
    code: "SCREENSHOT_NOT_REQUESTED",
    status: 409,
  });
  await assert.rejects(screenshot.save({ image_base64: "not-base64!" }), {
    code: "INVALID_REQUEST",
    status: 400,
  });
  await assert.rejects(
    screenshot.save({ image_base64: Buffer.from("not png").toString("base64") }),
    { code: "INVALID_REQUEST", status: 400 },
  );
});

test("pixelRatio=2 量级大 Base64 不因校验正则栈溢出", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case2",
    command: "start",
    dt_type: "with dt",
    status: "case complete",
    save_picture_flag: 1,
  });
  const { screenshot } = services(sharedDir);
  // ~4 MiB 伪 PNG（仅签名 + 填充），接近 3840×2160 落盘量级
  const largePng = Buffer.concat([
    PNG_BYTES.subarray(0, 8),
    Buffer.alloc(4 * 1024 * 1024, 0x00),
  ]);
  const largeBase64 = largePng.toString("base64");
  assert.ok(largeBase64.length > 5_000_000);

  const saved = await screenshot.save({ image_base64: largeBase64 });
  assert.equal(saved.path, "out/case2/calibrated-000.png");
  assert.equal(
    (await fs.stat(path.join(sharedDir, saved.path))).size,
    largePng.length,
  );
});

test("flag=1 时递增保存 PNG、返回相对路径并成功清零", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case2",
    command: "start",
    dt_type: "with dt",
    status: "case complete",
    save_picture_flag: 1,
  });
  const { screenshot } = services(sharedDir);
  await screenshot.cleanupTemporaryFiles();

  const first = await screenshot.save({ image_base64: PNG_BASE64 });
  assert.deepEqual(first, {
    ok: true,
    path: "out/case2/calibrated-000.png",
    seq: 0,
  });
  assert.deepEqual(
    await fs.readFile(path.join(sharedDir, first.path)),
    PNG_BYTES,
  );
  assert.equal((await readControl(sharedDir)).save_picture_flag, 0);

  const control = await readControl(sharedDir);
  await writeControl(sharedDir, { ...control, save_picture_flag: 1 });
  const second = await screenshot.save({
    image_base64: `data:image/png;base64,${PNG_BASE64}`,
  });
  assert.equal(second.path, "out/case2/calibrated-001.png");
  assert.equal(second.seq, 1);
});

test("启动只清理残留临时 PNG，不删除完成文件", async (t) => {
  const sharedDir = await createSharedDir(t);
  const outputDir = path.join(sharedDir, "out", "case2");
  const temporary = path.join(
    outputDir,
    ".calibrated-002.png.123.123e4567-e89b-12d3-a456-426614174000.tmp",
  );
  const completed = path.join(outputDir, "calibrated-001.png");
  await fs.writeFile(temporary, PNG_BYTES);
  await fs.writeFile(completed, PNG_BYTES);

  const { screenshot } = services(sharedDir);
  assert.equal(await screenshot.cleanupTemporaryFiles(), 1);
  await assert.rejects(fs.stat(temporary), { code: "ENOENT" });
  assert.equal((await fs.stat(completed)).isFile(), true);
});

test("截图序号从已有 009 递增到 010，超过 999 后自然扩展", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case2",
    command: "start",
    dt_type: "with dt",
    save_picture_flag: 1,
  });
  const outputDir = path.join(sharedDir, "out", "case2");
  await fs.writeFile(path.join(outputDir, "calibrated-009.png"), PNG_BYTES);
  const { screenshot } = services(sharedDir);

  const ten = await screenshot.save({ image_base64: PNG_BASE64 });
  assert.equal(ten.path, "out/case2/calibrated-010.png");
  assert.equal(ten.seq, 10);

  await fs.writeFile(path.join(outputDir, "calibrated-999.png"), PNG_BYTES);
  await writeControl(sharedDir, {
    ...(await readControl(sharedDir)),
    save_picture_flag: 1,
  });
  const thousand = await screenshot.save({ image_base64: PNG_BASE64 });
  assert.equal(thousand.path, "out/case2/calibrated-1000.png");
  assert.equal(thousand.seq, 1000);
});

test("PNG 已落盘但清零失败时保留完成文件并返回固定错误", async (t) => {
  const sharedDir = await createSharedDir(t, {
    case: "case2",
    command: "start",
    dt_type: "with dt",
    save_picture_flag: 1,
  });
  const screenshot = createScreenshotService({
    sharedDir,
    logger: createSilentLogger(),
    controlFile: {
      read: async () => ({
        case: "case2",
        command: "start",
        dt_type: "with dt",
        save_picture_flag: 1,
      }),
      assertScreenshotOwnership() {},
      clearPictureFlag: async () => {
        throw new Error("simulated clear failure");
      },
    },
  });

  await assert.rejects(
    screenshot.save({ image_base64: PNG_BASE64 }),
    { code: "SCREENSHOT_SAVE_FAILED", status: 500 },
  );
  const entries = await fs.readdir(path.join(sharedDir, "out", "case2"));
  assert.equal(entries.includes("calibrated-000.png"), true);
  assert.equal(entries.some((name) => name.endsWith(".tmp")), false);
});
