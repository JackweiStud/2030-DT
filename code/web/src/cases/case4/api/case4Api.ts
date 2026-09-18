/**
 * Case4 REST 客户端：原生 fetch，cache:no-store。
 * API 前缀写死同源 /api/case4；不读 env，不直读写共享目录。
 * Web 只做 envelope/shape/JSON 类型检查，不复验 Node 数值边界、不替换 65535。
 */

import type {
  ApiErrorBody,
  BasePoint,
  ControlSnapshot,
  ReflectionPayload,
  Statistics,
  ThroughputSide,
  ThroughputSnapshot,
  TrajectorySnapshot,
} from "../types";
import { SCHEMES } from "../types";
import {
  CASE4_REQUEST_TIMEOUT_MS,
  CASE4_SCREENSHOT_TIMEOUT_MS,
} from "../config/case4RuntimeConfig";

export { CASE4_REQUEST_TIMEOUT_MS, CASE4_SCREENSHOT_TIMEOUT_MS };

/** 同源 Case4 API 前缀；不得在组件散落 3102。 */
export const CASE4_API_PREFIX = "/api/case4";

export class Case4ApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.name = "Case4ApiError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

type ApiClientOptions = {
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  screenshotTimeoutMs?: number;
};

function resolveApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${CASE4_API_PREFIX}${normalized}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be finite number`);
  }
  return value;
}

function assertXyz(value: unknown, label: string): {
  x: number;
  y: number;
  z: number;
} {
  if (!isObject(value)) throw new Error(`${label} must be object`);
  return {
    x: assertFiniteNumber(value.x, `${label}.x`),
    y: assertFiniteNumber(value.y, `${label}.y`),
    z: assertFiniteNumber(value.z, `${label}.z`),
  };
}

function assertControl(value: unknown): ControlSnapshot {
  if (!isObject(value)) throw new Error("control missing");
  if (typeof value.case !== "string") throw new Error("control.case");
  if (typeof value.command !== "string") throw new Error("control.command");
  if (typeof value.dt_type !== "string") throw new Error("control.dt_type");
  if (typeof value.status !== "string") throw new Error("control.status");
  if (
    typeof value.save_picture_flag !== "number" ||
    !Number.isFinite(value.save_picture_flag)
  ) {
    throw new Error("control.save_picture_flag");
  }
  return value as ControlSnapshot;
}

function assertBaseRoute(body: unknown): BasePoint[] {
  if (!isObject(body)) throw new Error("init-data body");
  if (!Array.isArray(body.baseRoute) || body.baseRoute.length === 0) {
    throw new Error("baseRoute must be non-empty array");
  }
  const baseRoute = body.baseRoute.map((p, i) => {
    if (!isObject(p)) throw new Error(`baseRoute[${i}]`);
    return {
      no: assertFiniteNumber(p.no, `baseRoute[${i}].no`),
      x: assertFiniteNumber(p.x, `baseRoute[${i}].x`),
      y: assertFiniteNumber(p.y, `baseRoute[${i}].y`),
      z: assertFiniteNumber(p.z, `baseRoute[${i}].z`),
    };
  });
  for (let i = 0; i < baseRoute.length; i += 1) {
    const row = baseRoute[i];
    if (!row || row.no !== i + 1) {
      throw new Error("baseRoute no must be consecutive from 1");
    }
  }
  return baseRoute;
}

function assertReflection(
  value: unknown,
  label: string,
): ReflectionPayload {
  if (!isObject(value)) throw new Error(`${label} must be object`);
  if (
    value.state !== "ready" &&
    value.state !== "invalid" &&
    value.state !== "missing"
  ) {
    throw new Error(`${label}.state`);
  }
  if (value.los !== null && typeof value.los !== "boolean") {
    throw new Error(`${label}.los`);
  }
  if (!Array.isArray(value.points)) throw new Error(`${label}.points`);
  const points = value.points.map((item, index) => {
    if (!isObject(item)) throw new Error(`${label}.points[${index}]`);
    return {
      id: assertFiniteNumber(item.id, `${label}.points[${index}].id`),
      x: assertFiniteNumber(item.x, `${label}.points[${index}].x`),
      y: assertFiniteNumber(item.y, `${label}.points[${index}].y`),
      z: assertFiniteNumber(item.z, `${label}.points[${index}].z`),
    };
  });
  if (
    (value.state === "invalid" || value.state === "missing") &&
    (value.los !== null || points.length !== 0)
  ) {
    throw new Error(`${label} invalid/missing must have los=null and empty points`);
  }
  const payload: ReflectionPayload = {
    state: value.state,
    los: value.los,
    points,
  };
  if (typeof value.n === "number") payload.n = value.n;
  if (typeof value.raw === "string") payload.raw = value.raw;
  if (typeof value.reason === "string") payload.reason = value.reason;
  return payload;
}

function assertTrajectoryPoint(
  value: unknown,
  index: number,
  reflectionRequired: boolean,
): TrajectorySnapshot["points"][number] {
  if (!isObject(value)) throw new Error(`points[${index}]`);
  const no = assertFiniteNumber(value.no, `points[${index}].no`);
  const point: TrajectorySnapshot["points"][number] = {
    no,
    traditional: assertXyz(value.traditional, `points[${index}].traditional`),
    commercial: assertXyz(value.commercial, `points[${index}].commercial`),
    dt: assertXyz(value.dt, `points[${index}].dt`),
  };
  if (reflectionRequired) {
    point.reflection = assertReflection(
      value.reflection,
      `points[${index}].reflection`,
    );
  }
  return point;
}

function assertTrajectorySnapshot(
  value: unknown,
  reflectionRequired = false,
): TrajectorySnapshot {
  if (!isObject(value)) throw new Error("trajectory must be object");
  if (!Array.isArray(value.points)) throw new Error("points must be array");
  const points = value.points.map((item, index) =>
    assertTrajectoryPoint(item, index, reflectionRequired),
  );
  const completeCount = assertFiniteNumber(value.completeCount, "completeCount");
  if (typeof value.pendingTail !== "boolean") {
    throw new Error("pendingTail must be boolean");
  }
  if (completeCount !== points.length) {
    throw new Error("completeCount must equal points.length");
  }
  return { points, completeCount, pendingTail: value.pendingTail };
}

function assertThroughputSnapshot(
  value: unknown,
  expectedSide?: ThroughputSide,
): ThroughputSnapshot & { side?: ThroughputSide } {
  if (!isObject(value)) throw new Error("throughput must be object");
  if (expectedSide && value.side !== expectedSide) {
    throw new Error(`side mismatch: expected ${expectedSide}`);
  }
  if (!Array.isArray(value.samples)) throw new Error("samples must be array");
  const samples = value.samples.map((s, i) => {
    if (!isObject(s)) throw new Error(`samples[${i}]`);
    const no = assertFiniteNumber(s.no, `samples[${i}].no`);
    const gbps = assertFiniteNumber(s.gbps, `samples[${i}].gbps`);
    return { no, gbps };
  });
  if (typeof value.pendingTail !== "boolean") {
    throw new Error("pendingTail must be boolean");
  }
  return {
    side: expectedSide,
    samples,
    pendingTail: value.pendingTail,
  };
}

function assertCdfSeries(value: unknown, scheme: string) {
  if (!Array.isArray(value) || value.length < 1) {
    throw new Error(`cdf.${scheme} must be non-empty array`);
  }
  return value.map((p, i) => {
    if (!isObject(p)) throw new Error(`cdf.${scheme}[${i}]`);
    return {
      errorM: assertFiniteNumber(p.errorM, `cdf.${scheme}[${i}].errorM`),
      probability: assertFiniteNumber(
        p.probability,
        `cdf.${scheme}[${i}].probability`,
      ),
    };
  });
}

function assertCepPoint(value: unknown, scheme: string) {
  if (!isObject(value)) throw new Error(`cep.${scheme}`);
  return {
    p50M: assertFiniteNumber(value.p50M, `cep.${scheme}.p50M`),
    p90M: assertFiniteNumber(value.p90M, `cep.${scheme}.p90M`),
  };
}

function assertStatistics(value: unknown): Statistics {
  if (!isObject(value)) throw new Error("statistics must be object");
  if (!isObject(value.cdf)) throw new Error("statistics.cdf");
  if (!isObject(value.cep)) throw new Error("statistics.cep");
  const cdf = {
    traditional: assertCdfSeries(value.cdf.traditional, "traditional"),
    commercial: assertCdfSeries(value.cdf.commercial, "commercial"),
    dt: assertCdfSeries(value.cdf.dt, "dt"),
  };
  const cep = {
    traditional: assertCepPoint(value.cep.traditional, "traditional"),
    commercial: assertCepPoint(value.cep.commercial, "commercial"),
    dt: assertCepPoint(value.cep.dt, "dt"),
  };
  const nlosRatio = assertFiniteNumber(value.nlosRatio, "nlosRatio");
  void SCHEMES;
  return { cdf, cep, nlosRatio };
}

async function parseJson(res: Response): Promise<unknown> {
  return res.json() as Promise<unknown>;
}

/**
 * 创建 Case4 API 客户端。
 */
export function createCase4Api(options: ApiClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestTimeoutMs =
    options.requestTimeoutMs ?? CASE4_REQUEST_TIMEOUT_MS;
  const screenshotTimeoutMs =
    options.screenshotTimeoutMs ?? CASE4_SCREENSHOT_TIMEOUT_MS;

  async function request<T>(
    path: string,
    init: RequestInit,
    mapOk: (body: Record<string, unknown>) => T,
    timeoutMs: number = requestTimeoutMs,
  ): Promise<T> {
    const url = resolveApiUrl(path);
    const requestAbort = new AbortController();
    let timedOut = false;
    let callerAborted = false;
    const callerSignal = init.signal;
    const abortFromCaller = () => {
      callerAborted = true;
      requestAbort.abort(callerSignal?.reason);
    };
    if (callerSignal?.aborted) {
      abortFromCaller();
    } else {
      callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
    }
    const timeoutId = globalThis.setTimeout(() => {
      if (callerAborted) return;
      timedOut = true;
      requestAbort.abort();
    }, timeoutMs);

    try {
      const res = await fetchImpl(url, {
        ...init,
        signal: requestAbort.signal,
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
      });
      let body: unknown;
      try {
        body = await parseJson(res);
      } catch {
        throw new Case4ApiError(
          "CASE4_INVALID_RESPONSE",
          "response is not JSON",
          res.status,
        );
      }
      if (!isObject(body)) {
        throw new Case4ApiError(
          "CASE4_INVALID_RESPONSE",
          "response is not object",
          res.status,
        );
      }
      if (body.ok === true) {
        try {
          return mapOk(body);
        } catch (err) {
          throw new Case4ApiError(
            "CASE4_INVALID_RESPONSE",
            err instanceof Error ? err.message : "invalid ok body",
            res.status,
          );
        }
      }
      const err = body as ApiErrorBody;
      throw new Case4ApiError(
        err.error?.code ?? "UNKNOWN",
        err.error?.message ?? "request failed",
        res.status,
      );
    } catch (err) {
      if (timedOut) {
        throw new Case4ApiError(
          "REQUEST_TIMEOUT",
          `request exceeded ${timeoutMs}ms`,
          0,
        );
      }
      throw err;
    } finally {
      globalThis.clearTimeout(timeoutId);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    }
  }

  return {
    async getControl(signal?: AbortSignal): Promise<ControlSnapshot> {
      return request("/control-file", { method: "GET", signal }, (body) =>
        assertControl(body.control),
      );
    },

    async postControl(
      payload:
        | { command: "init" }
        | { case: "case4"; command: "start"; dt_type: "all" }
        | { case: "case4"; command: "reinit"; dt_type: "all" }
        | { save_picture_flag: 0 },
      signal?: AbortSignal,
      opts?: { keepalive?: boolean },
    ): Promise<ControlSnapshot> {
      return request(
        "/control-file",
        {
          method: "POST",
          body: JSON.stringify(payload),
          signal,
          keepalive: opts?.keepalive,
        },
        (body) => assertControl(body.control),
      );
    },

    async getInitData(signal?: AbortSignal): Promise<{ baseRoute: BasePoint[] }> {
      return request("/init-data", { method: "GET", signal }, (body) => ({
        baseRoute: assertBaseRoute(body),
      }));
    },

    async getTrajectory(
      signal?: AbortSignal,
      reflection = false,
    ): Promise<TrajectorySnapshot> {
      const query = reflection ? "?reflection=true" : "?reflection=false";
      return request(`/trajectory${query}`, { method: "GET", signal }, (body) =>
        assertTrajectorySnapshot(body, reflection),
      );
    },

    async getThroughput(
      side: ThroughputSide,
      signal?: AbortSignal,
    ): Promise<ThroughputSnapshot> {
      return request(
        `/throughput?side=${side}`,
        { method: "GET", signal },
        (body) => {
          const snap = assertThroughputSnapshot(body, side);
          return { samples: snap.samples, pendingTail: snap.pendingTail };
        },
      );
    },

    async getResult(
      signal?: AbortSignal,
      reflection = false,
    ): Promise<{
      trajectory: TrajectorySnapshot;
      throughput: { without: ThroughputSnapshot; with: ThroughputSnapshot };
      statistics: Statistics;
    }> {
      const query = reflection ? "?reflection=true" : "?reflection=false";
      return request(`/result${query}`, { method: "GET", signal }, (body) => {
        const trajectory = assertTrajectorySnapshot(
          body.trajectory,
          reflection,
        );
        if (!isObject(body.throughput)) throw new Error("throughput");
        const without = assertThroughputSnapshot(body.throughput.without);
        const withDt = assertThroughputSnapshot(body.throughput.with);
        return {
          trajectory,
          throughput: {
            without: {
              samples: without.samples,
              pendingTail: without.pendingTail,
            },
            with: {
              samples: withDt.samples,
              pendingTail: withDt.pendingTail,
            },
          },
          statistics: assertStatistics(body.statistics),
        };
      });
    },

    async postScreenshot(
      imageBase64: string,
      signal?: AbortSignal,
    ): Promise<{ path: string; seq: number }> {
      return request(
        "/screenshot",
        {
          method: "POST",
          body: JSON.stringify({ image_base64: imageBase64 }),
          signal,
        },
        (body) => {
          if (typeof body.path !== "string") throw new Error("path");
          const seq = assertFiniteNumber(body.seq, "seq");
          return { path: body.path, seq };
        },
        screenshotTimeoutMs,
      );
    },
  };
}

export type Case4Api = ReturnType<typeof createCase4Api>;
