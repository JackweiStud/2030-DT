/**
 * Case3 REST 客户端：原生 fetch，cache:no-store。
 * API 前缀写死同源 /api/case3；不读 env，不直读写共享目录。
 * Web 只做 envelope/shape/JSON 类型检查，不复验 Node 数值边界。
 */

import type {
  ApiErrorBody,
  BaseRoutePoint,
  BeamAccuracyBaseline,
  Case3Point,
  Case3Side,
  ControlSnapshot,
  SideSnapshot,
  ThroughputSnapshot,
} from "../types";

/** 同源 Case3 API 前缀；不得在组件散落 3102。 */
export const CASE3_API_PREFIX = "/api/case3";

export class Case3ApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.name = "Case3ApiError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

type ApiClientOptions = {
  fetchImpl?: typeof fetch;
  /** 控制/数据超时；用于测试注入，正式默认 5000ms。 */
  requestTimeoutMs?: number;
  /** 截图 POST 超时；用于测试注入，正式默认 20000ms。 */
  screenshotTimeoutMs?: number;
};

/** 控制 / init-data / side 默认超时。 */
export const CASE3_REQUEST_TIMEOUT_MS = 5000;
/** 截图 POST 单独更长超时。 */
export const CASE3_SCREENSHOT_TIMEOUT_MS = 20000;

function resolveApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${CASE3_API_PREFIX}${normalized}`;
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

function assertPoint(value: unknown, side: Case3Side): Case3Point {
  if (!isObject(value)) throw new Error("point must be object");
  const no = assertFiniteNumber(value.no, "point.no");
  if (!isObject(value.ue)) throw new Error("point.ue missing");
  const ue = {
    x: assertFiniteNumber(value.ue.x, "ue.x"),
    y: assertFiniteNumber(value.ue.y, "ue.y"),
    z: assertFiniteNumber(value.ue.z, "ue.z"),
  };
  const selectedBeamId = assertFiniteNumber(
    value.selectedBeamId,
    "selectedBeamId",
  );
  const throughputGbps = assertFiniteNumber(
    value.throughputGbps,
    "throughputGbps",
  );

  const point: Case3Point = { no, ue, selectedBeamId, throughputGbps };

  if (side === "without") {
    if (!Array.isArray(value.scanBeamIds)) {
      throw new Error("without point requires scanBeamIds array");
    }
    point.scanBeamIds = value.scanBeamIds.map((id, i) =>
      assertFiniteNumber(id, `scanBeamIds[${i}]`),
    );
  }

  if (side === "with") {
    if (!isObject(value.reflection)) {
      throw new Error("with point requires reflection object");
    }
    const r = value.reflection;
    if (typeof r.los !== "boolean") {
      throw new Error("reflection.los must be boolean");
    }
    point.reflection = {
      x: assertFiniteNumber(r.x, "reflection.x"),
      y: assertFiniteNumber(r.y, "reflection.y"),
      z: assertFiniteNumber(r.z, "reflection.z"),
      los: r.los,
    };
  }

  return point;
}

function assertThroughputSnapshot(
  body: unknown,
  expectedSide: Case3Side,
): ThroughputSnapshot {
  if (!isObject(body)) throw new Error("throughput body must be object");
  if (body.side !== expectedSide) {
    throw new Error(`side mismatch: expected ${expectedSide}`);
  }
  if (!Array.isArray(body.samples)) throw new Error("samples must be array");
  const samples = body.samples.map((row, index) => {
    if (!isObject(row)) throw new Error(`samples[${index}]`);
    return {
      no: assertFiniteNumber(row.no, `samples[${index}].no`),
      gbps: assertFiniteNumber(row.gbps, `samples[${index}].gbps`),
    };
  });
  if (typeof body.pendingTail !== "boolean") {
    throw new Error("pendingTail must be boolean");
  }
  return { samples, pendingTail: body.pendingTail };
}

function assertSideSnapshot(body: unknown, expectedSide: Case3Side): SideSnapshot {
  if (!isObject(body)) throw new Error("side body must be object");
  if (body.side !== expectedSide) {
    throw new Error(`side mismatch: expected ${expectedSide}`);
  }
  if (!Array.isArray(body.points)) throw new Error("points must be array");
  const points = body.points.map((p) => assertPoint(p, expectedSide));
  const completeCount = assertFiniteNumber(body.completeCount, "completeCount");
  if (typeof body.pendingTail !== "boolean") {
    throw new Error("pendingTail must be boolean");
  }
  let costPct: number | null = null;
  if (body.costPct !== null && body.costPct !== undefined) {
    costPct = assertFiniteNumber(body.costPct, "costPct");
  }
  return {
    side: expectedSide,
    points,
    completeCount,
    pendingTail: body.pendingTail,
    costPct,
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

function assertInitData(body: unknown): {
  baseRoute: BaseRoutePoint[];
  baseline: BeamAccuracyBaseline;
} {
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
  if (!isObject(body.beamAccuracyBaseline)) {
    throw new Error("beamAccuracyBaseline missing");
  }
  const success = assertFiniteNumber(
    body.beamAccuracyBaseline.success,
    "baseline.success",
  );
  const total = assertFiniteNumber(
    body.beamAccuracyBaseline.total,
    "baseline.total",
  );
  if (
    !Number.isInteger(success) ||
    !Number.isInteger(total) ||
    success < 0 ||
    total < 1 ||
    success > total
  ) {
    throw new Error("baseline shape invalid");
  }
  return { baseRoute, baseline: { success, total } };
}

async function parseJson(res: Response): Promise<unknown> {
  return res.json() as Promise<unknown>;
}

/**
 * 创建 Case3 API 客户端。
 */
export function createCase3Api(options: ApiClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestTimeoutMs =
    options.requestTimeoutMs ?? CASE3_REQUEST_TIMEOUT_MS;
  const screenshotTimeoutMs =
    options.screenshotTimeoutMs ?? CASE3_SCREENSHOT_TIMEOUT_MS;

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
        throw new Case3ApiError(
          "CASE3_INVALID_RESPONSE",
          "response is not JSON",
          res.status,
        );
      }
      if (!isObject(body)) {
        throw new Case3ApiError(
          "CASE3_INVALID_RESPONSE",
          "response is not object",
          res.status,
        );
      }
      if (body.ok === true) {
        try {
          return mapOk(body);
        } catch (err) {
          throw new Case3ApiError(
            "CASE3_INVALID_RESPONSE",
            err instanceof Error ? err.message : "invalid ok body",
            res.status,
          );
        }
      }
      const err = body as ApiErrorBody;
      throw new Case3ApiError(
        err.error?.code ?? "UNKNOWN",
        err.error?.message ?? "request failed",
        res.status,
      );
    } catch (err) {
      if (timedOut) {
        throw new Case3ApiError(
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
        | { case: "case3"; command: "start"; dt_type: "without dt" | "with dt" }
        | { case: "case3"; command: "reinit"; dt_type: "without dt" | "with dt" }
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

    async getInitData(signal?: AbortSignal): Promise<{
      baseRoute: BaseRoutePoint[];
      baseline: BeamAccuracyBaseline;
    }> {
      return request("/init-data", { method: "GET", signal }, assertInitData);
    },

    async getSide(side: Case3Side, signal?: AbortSignal): Promise<SideSnapshot> {
      return request(
        `/side?side=${side}`,
        { method: "GET", signal },
        (body) => assertSideSnapshot(body, side),
      );
    },

    async getThroughput(
      side: Case3Side,
      signal?: AbortSignal,
    ): Promise<ThroughputSnapshot> {
      return request(
        `/throughput?side=${side}`,
        { method: "GET", signal },
        (body) => assertThroughputSnapshot(body, side),
      );
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

export type Case3Api = ReturnType<typeof createCase3Api>;
