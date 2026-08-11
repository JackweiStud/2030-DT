/**
 * Case2/Case3 共用 PNG 截图原语。
 * 负责 Base64/PNG 校验、串行编号、原子落盘和成功后受控清 flag。
 */

import { promises as defaultFs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { AppError, isAppError } from "./errors.mjs";
import { SerialQueue } from "./serial-queue.mjs";

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodePngBase64(rawValue) {
  if (typeof rawValue !== "string") {
    throw new AppError(400, "INVALID_REQUEST", "image_base64 must be a string");
  }
  const encoded = rawValue.startsWith("data:image/png;base64,")
    ? rawValue.slice("data:image/png;base64,".length)
    : rawValue;
  const valid =
    encoded.length > 0 &&
    encoded.length % 4 === 0 &&
    BASE64_PATTERN.test(encoded);
  if (!valid) {
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

function validatePayload(payload) {
  if (payload === null || Array.isArray(payload) || typeof payload !== "object") {
    throw new AppError(400, "INVALID_REQUEST", "screenshot payload must be an object");
  }
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

export function createPngScreenshotService(options) {
  const {
    sharedDir,
    caseId,
    filenamePrefix,
    outputSegments,
    controlFile,
    logger,
  } = options;
  const fsOps = options.fsOps ?? defaultFs;
  const queue = options.queue ?? new SerialQueue();
  const outputDir = path.join(sharedDir, ...outputSegments);
  const escapedPrefix = escapeRegex(filenamePrefix);
  const finishedPattern = new RegExp(`^${escapedPrefix}-(\\d+)\\.png$`);
  const temporaryPattern = new RegExp(
    `^\\.${escapedPrefix}-\\d+\\.png\\.\\d+\\.[a-f0-9-]+\\.tmp$`,
  );

  async function cleanupTemporaryFiles() {
    await fsOps.mkdir(outputDir, { recursive: true });
    const entries = await fsOps.readdir(outputDir, { withFileTypes: true });
    let deleted = 0;
    for (const entry of entries) {
      if (entry.isFile() && temporaryPattern.test(entry.name)) {
        await fsOps.unlink(path.join(outputDir, entry.name)).catch(() => undefined);
        deleted += 1;
      }
    }
    if (deleted > 0) {
      logger.warn(`${caseId} screenshot temporary files cleaned`, { deleted });
    }
    return deleted;
  }

  async function nextSequence() {
    const entries = await fsOps.readdir(outputDir, { withFileTypes: true });
    let maximum = -1;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const match = finishedPattern.exec(entry.name);
      if (match) maximum = Math.max(maximum, Number(match[1]));
    }
    return maximum + 1;
  }

  async function save(payload) {
    const png = validatePayload(payload);
    logger.info(`${caseId} screenshot request accepted`, { bytes: png.length });

    return queue.run(async () => {
      const control = await controlFile.read();
      controlFile.assertScreenshotOwnership(control);
      await fsOps.mkdir(outputDir, { recursive: true });
      let sequence = await nextSequence();

      while (true) {
        const padded = String(sequence).padStart(3, "0");
        const filename = `${filenamePrefix}-${padded}.png`;
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

          logger.info(`${caseId} screenshot saved`, {
            path: finalPath,
            seq: sequence,
            bytes: png.length,
          });
          return {
            ok: true,
            path: path.posix.join(...outputSegments, filename),
            seq: sequence,
          };
        } catch (error) {
          if (handle) await handle.close().catch(() => undefined);
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
