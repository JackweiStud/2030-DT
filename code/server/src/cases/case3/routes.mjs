/** Case3 HTTP 路由：只做请求 shape 与服务方法映射。 */

import { AppError } from "../../shared/errors.mjs";
import { readJsonBody, sendJson } from "../../shared/http.mjs";
import { CASE3_API_PREFIX } from "./constants.mjs";
import { createReadStream, promises as fs } from "node:fs";
import { pipeline } from "node:stream/promises";
const geometryFile = new URL("../../../../web/assets/case1/3D/Beijing_Geometry.glb", import.meta.url);

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
      // 允许浏览器缓存 75 MB 模型：每次进入仍向服务端确认（no-cache），
      // 文件未变时只回 304，不再重复传输；文件替换后 size/mtime 变化，ETag 随之失效。
      const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
      const lastModified = new Date(Math.floor(stat.mtimeMs / 1000) * 1000).toUTCString();
      const cacheHeaders = { "Cache-Control": "no-cache", ETag: etag, "Last-Modified": lastModified };
      const ifNoneMatch = request.headers["if-none-match"];
      const ifModifiedSince = request.headers["if-modified-since"];
      const notModified = ifNoneMatch
        ? ifNoneMatch.split(",").some((tag) => tag.trim() === etag || tag.trim() === "*")
        : Boolean(ifModifiedSince) && Date.parse(ifModifiedSince) >= Date.parse(lastModified);
      if (notModified) {
        response.writeHead(304, cacheHeaders);
        response.end();
        return { handled: true, access: { caseId: "case3" } };
      }
      response.writeHead(200, { "Content-Type": "model/gltf-binary", "Content-Length": stat.size, ...cacheHeaders });
      try { await pipeline(createReadStream(geometryFile), response); }
      catch (error) {
        // 客户端切页或关闭连接后，流已销毁，不能再发送 JSON 错误响应。
        if (!response.destroyed) throw error;
      }
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
