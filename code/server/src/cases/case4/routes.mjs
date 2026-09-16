/** Case4 HTTP 路由：只做请求 shape 与服务方法映射。 */

import { AppError } from "../../shared/errors.mjs";
import { readJsonBody, sendJson } from "../../shared/http.mjs";
import { CASE4_API_PREFIX } from "./constants.mjs";

function rejectQuery(url, endpoint) {
  if ([...url.searchParams].length > 0) {
    throw new AppError(
      400,
      "INVALID_REQUEST",
      `${endpoint} does not accept query`,
    );
  }
}

export function createCase4Router(services) {
  return async function routeCase4(request, response, url) {
    if (
      request.method === "GET" &&
      url.pathname === `${CASE4_API_PREFIX}/control-file`
    ) {
      rejectQuery(url, "control-file");
      const control = await services.controlFile.read();
      sendJson(response, 200, { ok: true, control });
      return { handled: true, access: { caseId: "case4", control } };
    }

    if (
      request.method === "POST" &&
      url.pathname === `${CASE4_API_PREFIX}/control-file`
    ) {
      rejectQuery(url, "control-file");
      const payload = await readJsonBody(request);
      const control = await services.controlFile.updateFromHttp(payload);
      sendJson(response, 200, { ok: true, control });
      return { handled: true, access: { caseId: "case4" } };
    }

    if (
      request.method === "GET" &&
      url.pathname === `${CASE4_API_PREFIX}/init-data`
    ) {
      rejectQuery(url, "init-data");
      sendJson(response, 200, await services.initData.read());
      return { handled: true, access: { caseId: "case4" } };
    }

    if (
      request.method === "GET" &&
      url.pathname === `${CASE4_API_PREFIX}/trajectory`
    ) {
      rejectQuery(url, "trajectory");
      sendJson(response, 200, await services.trajectory.read());
      return { handled: true, access: { caseId: "case4" } };
    }

    if (
      request.method === "GET" &&
      url.pathname === `${CASE4_API_PREFIX}/throughput`
    ) {
      const entries = [...url.searchParams.entries()];
      if (entries.length !== 1 || entries[0][0] !== "side") {
        throw new AppError(
          400,
          "INVALID_SIDE",
          "throughput requires exactly one side query",
        );
      }
      const side = entries[0][1];
      if (side !== "without" && side !== "with") {
        throw new AppError(400, "INVALID_SIDE", "side must be without or with");
      }
      sendJson(response, 200, await services.throughput.read(side));
      return { handled: true, access: { caseId: "case4", side } };
    }

    if (
      request.method === "GET" &&
      url.pathname === `${CASE4_API_PREFIX}/result`
    ) {
      rejectQuery(url, "result");
      sendJson(response, 200, await services.result.read());
      return { handled: true, access: { caseId: "case4" } };
    }

    if (
      request.method === "POST" &&
      url.pathname === `${CASE4_API_PREFIX}/screenshot`
    ) {
      rejectQuery(url, "screenshot");
      const payload = await readJsonBody(request);
      sendJson(response, 200, await services.screenshot.save(payload));
      return { handled: true, access: { caseId: "case4" } };
    }

    return { handled: false };
  };
}
