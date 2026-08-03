import { promises as defaultFs } from "node:fs";
import path from "node:path";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3102;

function parsePort(rawValue) {
  if (rawValue === undefined || rawValue === "") {
    return DEFAULT_PORT;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error("CASE2_ADAPTER_PORT 必须是 1-65535 的十进制整数");
  }

  const port = Number(rawValue);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("CASE2_ADAPTER_PORT 必须是 1-65535 的十进制整数");
  }
  return port;
}

/**
 * 启动配置坚持快速失败：共享根必须显式注入且已经存在，
 * 绝不静默回退到仓库参考资料。
 */
export async function loadRuntimeConfig(env = process.env, options = {}) {
  const fsOps = options.fsOps ?? defaultFs;
  const sharedDir = env.CASE2_SHARED_DIR;
  if (!sharedDir) {
    throw new Error("缺少必填环境变量 CASE2_SHARED_DIR");
  }
  if (!path.isAbsolute(sharedDir)) {
    throw new Error("CASE2_SHARED_DIR 必须是绝对路径");
  }

  const resolvedSharedDir = path.resolve(sharedDir);
  const sharedStat = await fsOps.stat(resolvedSharedDir).catch((error) => {
    throw new Error(`CASE2_SHARED_DIR 不可用：${resolvedSharedDir}`, { cause: error });
  });
  if (!sharedStat.isDirectory()) {
    throw new Error(`CASE2_SHARED_DIR 不是目录：${resolvedSharedDir}`);
  }

  const controlPath = path.join(resolvedSharedDir, "case_control.json");
  const controlStat = await fsOps.stat(controlPath).catch((error) => {
    throw new Error(`缺少或无法访问控制文件：${controlPath}`, { cause: error });
  });
  if (!controlStat.isFile()) {
    throw new Error(`控制文件不是普通文件：${controlPath}`);
  }

  return {
    host: env.CASE2_ADAPTER_HOST || DEFAULT_HOST,
    port: parsePort(env.CASE2_ADAPTER_PORT),
    sharedDir: resolvedSharedDir,
  };
}
