import { promises as defaultFs } from "node:fs";
import path from "node:path";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3102;

function parsePort(rawValue, envName) {
  if (rawValue === undefined || rawValue === "") {
    return DEFAULT_PORT;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`${envName} 必须是 1-65535 的十进制整数`);
  }

  const port = Number(rawValue);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${envName} 必须是 1-65535 的十进制整数`);
  }
  return port;
}

/**
 * 启动配置坚持快速失败：共享根必须显式注入且已经存在，
 * 绝不静默回退到仓库参考资料。
 */
export async function loadRuntimeConfig(env = process.env, options = {}) {
  const fsOps = options.fsOps ?? defaultFs;
  const sharedDir = env.DT_SHARED_DIR || env.CASE2_SHARED_DIR;
  const sharedDirEnvName = env.DT_SHARED_DIR ? "DT_SHARED_DIR" : "CASE2_SHARED_DIR";
  if (!sharedDir) {
    throw new Error("缺少必填环境变量 DT_SHARED_DIR");
  }
  if (!path.isAbsolute(sharedDir)) {
    throw new Error(`${sharedDirEnvName} 必须是绝对路径`);
  }

  const resolvedSharedDir = path.resolve(sharedDir);
  const sharedStat = await fsOps.stat(resolvedSharedDir).catch((error) => {
    throw new Error(`${sharedDirEnvName} 不可用：${resolvedSharedDir}`, { cause: error });
  });
  if (!sharedStat.isDirectory()) {
    throw new Error(`${sharedDirEnvName} 不是目录：${resolvedSharedDir}`);
  }

  const controlPath = path.join(resolvedSharedDir, "case_control.json");
  const controlStat = await fsOps.stat(controlPath).catch((error) => {
    throw new Error(`缺少或无法访问控制文件：${controlPath}`, { cause: error });
  });
  if (!controlStat.isFile()) {
    throw new Error(`控制文件不是普通文件：${controlPath}`);
  }

  const portEnvName = env.DT_ADAPTER_PORT ? "DT_ADAPTER_PORT" : "CASE2_ADAPTER_PORT";
  return {
    host: env.DT_ADAPTER_HOST || env.CASE2_ADAPTER_HOST || DEFAULT_HOST,
    port: parsePort(env.DT_ADAPTER_PORT || env.CASE2_ADAPTER_PORT, portEnvName),
    sharedDir: resolvedSharedDir,
  };
}
