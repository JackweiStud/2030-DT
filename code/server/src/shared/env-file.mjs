import { promises as defaultFs } from "node:fs";

/**
 * 解析 dotenv 文本：忽略空行与 # 注释；不覆盖调用方已有非空环境变量。
 */
export function parseEnvFile(text) {
  const values = {};
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) {
      throw new Error(`invalid .env line: ${rawLine}`);
    }
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`invalid .env key: ${key}`);
    }
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

/**
 * 若文件存在则合并进 env：已有非空键不覆盖。文件缺失视为未配置。
 */
export async function applyDotenvFile(env, filePath, options = {}) {
  const fsOps = options.fsOps ?? defaultFs;
  let text;
  try {
    text = await fsOps.readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return env;
    throw error;
  }

  const parsed = parseEnvFile(text);
  for (const [key, value] of Object.entries(parsed)) {
    if (env[key] === undefined || env[key] === "") {
      env[key] = value;
    }
  }
  return env;
}
