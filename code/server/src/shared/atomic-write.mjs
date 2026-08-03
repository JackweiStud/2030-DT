import { promises as defaultFs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";

/**
 * 在目标文件同目录完成临时写入、fsync、关闭和原子替换。
 * 同目录是关键约束：跨目录 rename 可能退化或直接失败。
 */
export async function atomicReplaceFile(targetPath, content, options = {}) {
  const fsOps = options.fsOps ?? defaultFs;
  const directory = path.dirname(targetPath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );

  let handle;
  try {
    let mode = 0o600;
    try {
      const current = await fsOps.stat(targetPath);
      mode = current.mode & 0o777;
    } catch {
      // 新文件使用保守权限；调用方负责判断目标文件是否必须已存在。
    }

    handle = await fsOps.open(temporaryPath, "wx", mode);
    await handle.writeFile(content);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fsOps.rename(temporaryPath, targetPath);
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => undefined);
    }
    await fsOps.unlink(temporaryPath).catch(() => undefined);
    throw error;
  }

  return { temporaryPath };
}
