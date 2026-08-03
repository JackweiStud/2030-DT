import { promises as defaultFs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { AppError, isAppError } from "../../shared/errors.mjs";
import { SerialQueue } from "../../shared/serial-queue.mjs";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const FINISHED_PATTERN = /^calibrated-(\d+)\.png$/;
const TEMPORARY_PATTERN = /^\.calibrated-\d+\.png\.\d+\.[a-f0-9-]+\.tmp$/;
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function decodePngBase64(rawValue) {
  if (typeof rawValue !== "string") {
    throw new AppError(400, "INVALID_REQUEST", "image_base64 must be a string");
  }

  const encoded = rawValue.startsWith("data:image/png;base64,")
    ? rawValue.slice("data:image/png;base64,".length)
    : rawValue;

  if (!encoded || !BASE64_PATTERN.test(encoded)) {
    throw new AppError(400, "INVALID_REQUEST", "image_base64 is not valid Base64");
  }

  const bytes = Buffer.from(encoded, "base64");
  if (
    bytes.length < PNG_SIGNATURE.length ||
    !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    throw new AppError(400, "INVALID_REQUEST", "image_base64 is not a PNG");
  }
  return bytes;
}

function validateScreenshotPayload(payload) {
  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== "image_base64") {
    throw new AppError(
      400,
      "INVALID_REQUEST",
      "screenshot payload must contain only image_base64",
    );
  }
  return decodePngBase64(payload.image_base64);
}

/**
 * 截图服务只保证单进程内串行、原子落盘和不覆盖。
 * 按定稿不引入事务目录、哈希去重或重启恢复。
 */
export function createScreenshotService(options) {
  const sharedDir = options.sharedDir;
  const controlFile = options.controlFile;
  const fsOps = options.fsOps ?? defaultFs;
  const logger = options.logger;
  const queue = options.queue ?? new SerialQueue();
  const outputDir = path.join(sharedDir, "out", "case2");

  async function cleanupTemporaryFiles() {
    await fsOps.mkdir(outputDir, { recursive: true });
    const entries = await fsOps.readdir(outputDir, { withFileTypes: true });
    let deleted = 0;
    for (const entry of entries) {
      if (entry.isFile() && TEMPORARY_PATTERN.test(entry.name)) {
        await fsOps.unlink(path.join(outputDir, entry.name)).catch(() => undefined);
        deleted += 1;
      }
    }
    if (deleted > 0) {
      logger.warn("case2 screenshot temporary files cleaned", { deleted });
    }
    return deleted;
  }

  async function nextSequence() {
    const entries = await fsOps.readdir(outputDir, { withFileTypes: true });
    let maximum = -1;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const match = FINISHED_PATTERN.exec(entry.name);
      if (match) maximum = Math.max(maximum, Number(match[1]));
    }
    return maximum + 1;
  }

  async function save(payload) {
    const png = validateScreenshotPayload(payload);
    return queue.run(async () => {
      const control = await controlFile.read();
      if (control.save_picture_flag !== 1) {
        throw new AppError(
          409,
          "SCREENSHOT_NOT_REQUESTED",
          "save_picture_flag is not 1",
        );
      }

      await fsOps.mkdir(outputDir, { recursive: true });
      let sequence = await nextSequence();

      while (true) {
        const padded = String(sequence).padStart(3, "0");
        const filename = `calibrated-${padded}.png`;
        const finalPath = path.join(outputDir, filename);
        const temporaryPath = path.join(
          outputDir,
          `.${filename}.${process.pid}.${randomUUID()}.tmp`,
        );

        let handle;
        try {
          try {
            await fsOps.access(finalPath);
            sequence = await nextSequence();
            continue;
          } catch (error) {
            if (error?.code !== "ENOENT") throw error;
          }

          handle = await fsOps.open(temporaryPath, "wx", 0o600);
          await handle.writeFile(png);
          await handle.sync();
          await handle.close();
          handle = undefined;
          await fsOps.rename(temporaryPath, finalPath);
          const written = await fsOps.stat(finalPath);
          if (!written.isFile() || written.size !== png.length) {
            throw new Error("saved PNG failed final stat verification");
          }

          try {
            await controlFile.clearPictureFlag();
          } catch (error) {
            throw new AppError(
              500,
              "SCREENSHOT_SAVE_FAILED",
              "PNG was saved but save_picture_flag could not be cleared",
              { cause: error },
            );
          }

          logger.info("case2 screenshot saved", {
            path: finalPath,
            seq: sequence,
          });
          return {
            ok: true,
            path: path.posix.join("out", "case2", filename),
            seq: sequence,
          };
        } catch (error) {
          if (handle) {
            await handle.close().catch(() => undefined);
          }
          await fsOps.unlink(temporaryPath).catch(() => undefined);
          if (isAppError(error)) throw error;
          throw new AppError(
            500,
            "SCREENSHOT_SAVE_FAILED",
            "failed to save screenshot PNG",
            { cause: error },
          );
        }
      }
    });
  }

  return {
    outputDir,
    cleanupTemporaryFiles,
    save,
  };
}
