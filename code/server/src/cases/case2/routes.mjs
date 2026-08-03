import { AppError } from "../../shared/errors.mjs";
import { readJsonBody, sendJson } from "../../shared/http.mjs";
import { CASE2_API_PREFIX } from "./constants.mjs";

/**
 * case2 路由只做 HTTP 与服务方法的映射，不在这里解释业务 status。
 */
export function createCase2Router(services) {
  return async function routeCase2(request, response, url) {
    if (
      request.method === "GET" &&
      url.pathname === `${CASE2_API_PREFIX}/control-file`
    ) {
      if ([...url.searchParams].length > 0) {
        throw new AppError(400, "INVALID_REQUEST", "control-file does not accept query");
      }
      sendJson(response, 200, { ok: true, control: await services.controlFile.read() });
      return true;
    }

    if (
      request.method === "POST" &&
      url.pathname === `${CASE2_API_PREFIX}/control-file`
    ) {
      if ([...url.searchParams].length > 0) {
        throw new AppError(400, "INVALID_REQUEST", "control-file does not accept query");
      }
      const payload = await readJsonBody(request);
      const control = await services.controlFile.updateFromHttp(payload);
      sendJson(response, 200, { ok: true, control });
      return true;
    }

    if (
      request.method === "GET" &&
      url.pathname === `${CASE2_API_PREFIX}/data-files`
    ) {
      const entries = [...url.searchParams.entries()];
      if (entries.length !== 1 || entries[0][0] !== "phase") {
        throw new AppError(
          400,
          "INVALID_REQUEST",
          "data-files requires exactly one phase query",
        );
      }
      sendJson(response, 200, await services.dataFiles.readPhase(entries[0][1]));
      return true;
    }

    if (
      request.method === "POST" &&
      url.pathname === `${CASE2_API_PREFIX}/screenshot`
    ) {
      if ([...url.searchParams].length > 0) {
        throw new AppError(400, "INVALID_REQUEST", "screenshot does not accept query");
      }
      const payload = await readJsonBody(request);
      sendJson(response, 200, await services.screenshot.save(payload));
      return true;
    }

    return false;
  };
}
