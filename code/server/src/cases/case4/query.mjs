/**
 * Case4 GET query：trajectory/result 仅允许 reflection=true|false。
 */

import { AppError } from "../../shared/errors.mjs";

/**
 * 解析可选 reflection query。缺省 false；非法或多余键 400。
 */
export function parseReflectionQuery(url, endpoint) {
  const entries = [...url.searchParams.entries()];
  if (entries.length === 0) return false;
  if (entries.length === 1 && entries[0][0] === "reflection") {
    if (entries[0][1] === "true") return true;
    if (entries[0][1] === "false") return false;
  }
  throw new AppError(
    400,
    "INVALID_REQUEST",
    `${endpoint} query must be empty or reflection=true|false`,
  );
}
