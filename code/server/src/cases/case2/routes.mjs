import { AppError } from "../../shared/errors.mjs";
import { readJsonBody, sendJson } from "../../shared/http.mjs";
import { CASE2_API_PREFIX } from "./constants.mjs";

/**
 * case2 路由只做 HTTP 与服务方法的映射，不在这里解释业务 status。
 * 返回 { handled, access? }，供 app 层做请求摘要与 control GET 降噪。
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
      const control = await services.controlFile.read();
      sendJson(response, 200, { ok: true, control });
      return { handled: true, access: { control } };
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
      return { handled: true };
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
      return { handled: true };
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
      return { handled: true };
    }

    return { handled: false };
  };
}
