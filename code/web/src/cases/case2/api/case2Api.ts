/**
 * case2 REST 客户端：原生 fetch，cache: no-store。
 * 浏览器只打本机适配服务，不直读写共享目录。
 */

import { resolveApiUrl } from "../metrics/heatmapConfig";
import type {
  ApiErrorResponse,
  ControlFileResponse,
  ControlSnapshot,
  DataFilesResponse,
  DataPhase,
  MetricsBundle,
  MetricKey,
  ScreenshotResponse,
} from "../types";
import { METRIC_KEYS } from "../types";

export class Case2ApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.name = "Case2ApiError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

type ApiClientOptions = {
  apiBase: string;
  fetchImpl?: typeof fetch;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be finite number`);
  }
  return value;
}

function assertHeatmap(value: unknown, label: string): number[][] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} heatmap must be non-empty array`);
  }
  const firstRow = value[0];
  if (!Array.isArray(firstRow) || firstRow.length === 0) {
    throw new Error(`${label} heatmap rows must be non-empty arrays`);
  }
  const cols = firstRow.length;
  return value.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== cols) {
      throw new Error(`${label} heatmap must be rectangular`);
    }
    return row.map((cell, colIndex) =>
      assertFiniteNumber(cell, `${label} heatmap[${rowIndex}][${colIndex}]`),
    );
  });
}

function assertKpi(value: unknown, label: string): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} kpi must be non-empty array`);
  }
  return value.map((sample, index) =>
    assertFiniteNumber(sample, `${label} kpi[${index}]`),
  );
}

function assertMetrics(metrics: unknown): MetricsBundle {
  if (!isObject(metrics)) throw new Error("metrics must be object");
  const out = {} as MetricsBundle;
  for (const key of METRIC_KEYS) {
    const item = metrics[key];
    if (!isObject(item)) throw new Error(`missing metric ${key}`);
    const heatmap = item.heatmap;
    const kpi = item.kpi;
    if (!Array.isArray(heatmap) || !Array.isArray(kpi)) {
      throw new Error(`metric ${key} shape invalid`);
    }
    out[key as MetricKey] = {
      heatmap: assertHeatmap(heatmap, key),
      kpi: assertKpi(kpi, key),
    };
  }
  return out;
}

async function parseJson(res: Response): Promise<unknown> {
  return res.json() as Promise<unknown>;
}

/**
 * 创建 case2 API 客户端。
 * @param options.apiBase 空则同源 `/api/case2`
 */
export function createCase2Api(options: ApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request<T>(
    path: string,
    init: RequestInit,
    mapOk: (body: unknown) => T,
  ): Promise<T> {
    const url = resolveApiUrl(options.apiBase, path);
    const res = await fetchImpl(url, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    const body = await parseJson(res);
    if (!isObject(body)) {
      throw new Case2ApiError("INVALID_RESPONSE", "response is not object", res.status);
    }
    if (body.ok === true) {
      return mapOk(body);
    }
    const err = body as ApiErrorResponse;
    const code = err.error?.code ?? "UNKNOWN";
    const message = err.error?.message ?? "request failed";
    throw new Case2ApiError(code, message, res.status);
  }

  return {
    async getControl(signal?: AbortSignal): Promise<ControlSnapshot> {
      const data = await request<ControlFileResponse>(
        "/control-file",
        { method: "GET", signal },
        (body) => body as ControlFileResponse,
      );
      if (!isObject(data.control)) {
        throw new Case2ApiError("INVALID_RESPONSE", "control missing", 200);
      }
      return data.control as ControlSnapshot;
    },

    async postControl(
      payload:
        | { case: "case2"; command: "start"; dt_type: "with dt" }
        | { command: "reinit" }
        | { command: "init" }
        | { save_picture_flag: 0 },
      signal?: AbortSignal,
    ): Promise<ControlSnapshot> {
      const data = await request<ControlFileResponse>(
        "/control-file",
        {
          method: "POST",
          body: JSON.stringify(payload),
          signal,
        },
        (body) => body as ControlFileResponse,
      );
      return data.control as ControlSnapshot;
    },

    async getDataFiles(
      phase: DataPhase,
      signal?: AbortSignal,
    ): Promise<MetricsBundle> {
      const data = await request<DataFilesResponse>(
        `/data-files?phase=${phase}`,
        { method: "GET", signal },
        (body) => body as DataFilesResponse,
      );
      return assertMetrics(data.metrics);
    },

    async postScreenshot(
      imageBase64: string,
      signal?: AbortSignal,
    ): Promise<ScreenshotResponse> {
      return request<ScreenshotResponse>(
        "/screenshot",
        {
          method: "POST",
          body: JSON.stringify({ image_base64: imageBase64 }),
          signal,
        },
        (body) => body as ScreenshotResponse,
      );
    },
  };
}

export type Case2Api = ReturnType<typeof createCase2Api>;
