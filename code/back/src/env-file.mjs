import { promises as defaultFs } from "node:fs";
import path from "node:path";

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

export async function loadBackEnv(backRoot, options = {}) {
  const fsOps = options.fsOps ?? defaultFs;
  const envPath = path.join(backRoot, ".env");
  let text;
  try {
    text = await fsOps.readFile(envPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
  return parseEnvFile(text);
}
