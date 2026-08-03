import { TextDecoder } from "node:util";
import { AppError } from "./errors.mjs";

export const MAX_BODY_BYTES = 20 * 1024 * 1024;

export function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

/**
 * 以原始 HTTP 请求体字节数执行 20 MiB 上限。
 * 超限后继续排空请求流，避免本机 keep-alive 连接被粗暴中断。
 */
export async function readJsonBody(request, limit = MAX_BODY_BYTES) {
  const chunks = [];
  let total = 0;
  let tooLarge = false;

  for await (const chunk of request) {
    total += chunk.length;
    if (total > limit) {
      tooLarge = true;
      continue;
    }
    chunks.push(chunk);
  }

  if (tooLarge) {
    throw new AppError(413, "PAYLOAD_TOO_LARGE", `request body exceeds ${limit} bytes`);
  }

  if (total === 0) {
    throw new AppError(400, "INVALID_REQUEST", "request body must be a JSON object");
  }

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } catch (error) {
    throw new AppError(400, "INVALID_REQUEST", "request body must be valid UTF-8", {
      cause: error,
    });
  }

  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new AppError(400, "INVALID_REQUEST", "request body must be valid JSON", {
      cause: error,
    });
  }

  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new AppError(400, "INVALID_REQUEST", "request body must be a JSON object");
  }
  return value;
}
