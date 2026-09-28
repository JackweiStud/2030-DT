/** Case3 HTTP 路由：只做请求 shape 与服务方法映射。 */

import { AppError } from "../../shared/errors.mjs";
import { readJsonBody, sendJson } from "../../shared/http.mjs";
import { CASE3_API_PREFIX } from "./constants.mjs";
import { createReadStream, promises as fs } from "node:fs";
import { pipeline } from "node:stream/promises";
const geometryFile = new URL("../../../../web/assets/case3-v2/3D/Beijing_Geometry.glb", import.meta.url);

function rejectQuery(url, endpoint) {
  if ([...url.searchParams].length > 0) {
    throw new AppError(400, "INVALID_REQUEST", `${endpoint} does not accept query`);
  }
}

export function createCase3Router(services) {
  return async function routeCase3(request, response, url) {
    if (url.pathname === `${CASE3_API_PREFIX}/models/geometry`) {
      rejectQuery(url, "models/geometry");
      if (request.method !== "GET") {
        response.setHeader("Allow", "GET");
        throw new AppError(405, "METHOD_NOT_ALLOWED", "只支持 GET");
      }
      let stat;
      try { stat = await fs.stat(geometryFile); }
      catch { throw new AppError(404, "FILE_NOT_FOUND", "Case3 模型不存在"); }
      response.writeHead(200, { "Content-Type": "model/gltf-binary", "Content-Length": stat.size, "Cache-Control": "no-cache" });
      await pipeline(createReadStream(geometryFile), response);
      return { handled: true, access: { caseId: "case3" } };
    }
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
      url.pathname === `${CASE3_API_PREFIX}/throughput`
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
      return { handled: true, access: { caseId: "case3", side } };
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
