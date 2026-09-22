import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs, createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { sendJson } from "../../shared/http.mjs";
import { DEFAULT_CASE1_RANGE_HEATMAP_RSS } from "./value-ranges.mjs";

const modelDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../web/assets/case1/3D",
);
const models = {
  geometry: path.join(modelDir, "Beijing_Geometry.glb"),
  material: path.join(modelDir, "Beijing_Material.glb"),
};

const files = {
  geometry: [
    ["fidelity", "model_geonetry_kpi_ge_fidelity"],
    ["recon", "model_geonetry_kpi_ge_recon_rate"],
  ],
  material: [["fidelity", "model_material_kpi_em_fidelity"]],
  rf: [["rss", "heatmap_kpi_rss"]],
};
function clampHeat(value, range) {
  if (value < range.min) return range.min;
  if (value > range.max) return range.max;
  return value;
}

export function parseMatrix(text, range) {
  const lines = text.trim().split(/\r?\n/);
  if (!text.trim()) throw new Error("空矩阵");
  if (
    !range ||
    !Number.isFinite(range.min) ||
    !Number.isFinite(range.max) ||
    range.min > range.max
  ) {
    throw new Error("热力矩阵缺少有效数值范围");
  }
  const rows = lines.map((line) => {
    const tokens = line.includes(",")
      ? line.split(",").map((v) => v.trim())
      : line.trim().split(/\s+/);
    if (tokens.some((v) => !v)) throw new Error("缺失矩阵单元");
    return tokens.map((token) => {
      const value = Number(token);
      if (!Number.isFinite(value)) throw new Error("矩阵必须为有限数值的矩形");
      return clampHeat(value, range);
    });
  });
  if (rows.some((row) => row.length !== rows[0].length))
    throw new Error("矩阵必须为有限数值的矩形");
  return rows;
}
export function parseScalar(text, ratio) {
  if (!text.trim()) throw new Error("空 KPI");
  const value = Number(text.trim());
  if (!Number.isFinite(value) || value < 0 || (ratio && value > 1))
    throw new Error("KPI 范围或格式错误");
  return value;
}
export function createCase1Router({ sharedDir, case1Ranges }) {
  const dataDir = path.join(sharedDir, "case1");
  const heatmapRssRange =
    case1Ranges?.heatmapRss ?? DEFAULT_CASE1_RANGE_HEATMAP_RSS;
  return async (req, res, url) => {
    if (!url.pathname.startsWith("/api/case1/")) return { handled: false };
    const fail = (status, code, message) =>
      sendJson(res, status, { ok: false, error: { code, message } });
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      fail(405, "METHOD_NOT_ALLOWED", "只支持 GET");
      return { handled: true };
    }
    const match = /^\/api\/case1\/(data|models)\/(geometry|material|rf)$/.exec(
      url.pathname,
    );
    if (!match || (match[1] === "models" && match[2] === "rf")) {
      fail(404, "NOT_FOUND", "资源不存在");
      return { handled: true };
    }
    const [, kind, layer] = match;
    try {
      if (kind === "models") {
        const filename = models[layer];
        const stat = await fs.stat(filename);
        if (!stat.isFile()) {
          const e = new Error("not file");
          e.code = "ENOENT";
          throw e;
        }
        res.writeHead(200, {
          "Content-Type": "model/gltf-binary",
          "Content-Length": stat.size,
          "Cache-Control": "no-store",
        });
        await pipeline(createReadStream(filename), res);
      } else {
        const kpis = await Promise.all(
          files[layer].map(async ([id, stem]) => ({
            id,
            off: parseScalar(
              await fs.readFile(
                path.join(dataDir, `${stem}_rf_off.txt`),
                "utf8",
              ),
              layer !== "rf",
            ),
            on: parseScalar(
              await fs.readFile(
                path.join(dataDir, `${stem}_rf_on.txt`),
                "utf8",
              ),
              layer !== "rf",
            ),
          })),
        );
        const matrix =
          layer === "rf"
            ? parseMatrix(
                await fs.readFile(
                  path.join(dataDir, "heatmap_rss.txt"),
                  "utf8",
                ),
                heatmapRssRange,
              )
            : undefined;
        sendJson(res, 200, { ok: true, kpis, ...(matrix ? { matrix } : {}) });
      }
    } catch (error) {
      if (!res.headersSent && !res.destroyed)
        fail(
          error.code === "ENOENT" ? 404 : 422,
          error.code === "ENOENT" ? "FILE_NOT_FOUND" : "INVALID_DATA",
          error.code === "ENOENT"
            ? "当前层离线文件未配置或不存在"
            : "当前层离线文件无法读取或格式错误",
        );
    }
    return { handled: true };
  };
}
