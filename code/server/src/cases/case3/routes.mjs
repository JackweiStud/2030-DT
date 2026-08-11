/** Case3 HTTP 路由：只做请求 shape 与服务方法映射。 */

import { AppError } from "../../shared/errors.mjs";
import { readJsonBody, sendJson } from "../../shared/http.mjs";
import { CASE3_API_PREFIX } from "./constants.mjs";

function rejectQuery(url, endpoint) {
  if ([...url.searchParams].length > 0) {
    throw new AppError(400, "INVALID_REQUEST", `${endpoint} does not accept query`);
  }
}

export function createCase3Router(services) {
  return async function routeCase3(request, response, url) {
    if (
      request.method === "GET" &&
      url.pathname === `${CASE3_API_PREFIX}/control-file`
    ) {
      rejectQuery(url, "control-file");
      const control = await services.controlFile.read();
      sendJson(response, 200, { ok: true, control });
      return { handled: true, access: { caseId: "case3", control } };
    }

    if (
      request.method === "POST" &&
      url.pathname === `${CASE3_API_PREFIX}/control-file`
    ) {
      rejectQuery(url, "control-file");
      const payload = await readJsonBody(request);
      const control = await services.controlFile.updateFromHttp(payload);
      sendJson(response, 200, { ok: true, control });
      return { handled: true, access: { caseId: "case3" } };
    }

    if (
      request.method === "GET" &&
      url.pathname === `${CASE3_API_PREFIX}/init-data`
    ) {
      rejectQuery(url, "init-data");
      sendJson(response, 200, await services.initData.read());
      return { handled: true, access: { caseId: "case3" } };
    }

    if (
      request.method === "GET" &&
      url.pathname === `${CASE3_API_PREFIX}/side`
    ) {
      const entries = [...url.searchParams.entries()];
      if (entries.length !== 1 || entries[0][0] !== "side") {
        throw new AppError(
          400,
          "INVALID_REQUEST",
          "side requires exactly one side query",
        );
      }
      const side = entries[0][1];
      if (side !== "without" && side !== "with") {
        throw new AppError(400, "INVALID_SIDE", "side must be without or with");
      }
      sendJson(response, 200, await services.sideFiles.readSide(side));
      return { handled: true, access: { caseId: "case3", side } };
    }

    if (
      request.method === "POST" &&
      url.pathname === `${CASE3_API_PREFIX}/screenshot`
    ) {
      rejectQuery(url, "screenshot");
      const payload = await readJsonBody(request);
      sendJson(response, 200, await services.screenshot.save(payload));
      return { handled: true, access: { caseId: "case3" } };
    }

    return { handled: false };
  };
}
