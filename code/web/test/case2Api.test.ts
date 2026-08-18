import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CASE2_REQUEST_TIMEOUT_MS,
  CASE2_SCREENSHOT_TIMEOUT_MS,
  Case2ApiError,
  createCase2Api,
} from "../src/cases/case2/api/case2Api";
import { METRIC_KEYS } from "../src/cases/case2/types";

async function hangUntilAbort(
  _input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const signal = init?.signal;
  await new Promise<never>((_, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The operation was aborted", "AbortError"));
      return;
    }
    signal?.addEventListener(
      "abort",
      () => {
        reject(new DOMException("The operation was aborted", "AbortError"));
      },
      { once: true },
    );
  });
  throw new Error("unreachable");
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function metrics(overrides: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {};
  for (const key of METRIC_KEYS) {
    base[key] = { heatmap: [[1, 2], [3, 4]], kpi: [1, 2, 3] };
  }
  return { ...base, ...overrides };
}

describe("case2Api metrics validation", () => {
  it("接受非空矩形 heatmap 和有限数 KPI", async () => {
    const api = createCase2Api({
      fetchImpl: async () => okResponse({ ok: true, metrics: metrics() }),
    });

    await expect(api.getDataFiles("initial")).resolves.toMatchObject({
      rss: { heatmap: [[1, 2], [3, 4]], kpi: [1, 2, 3] },
    });
  });

  it("拒绝非矩形 heatmap", async () => {
    const api = createCase2Api({
      fetchImpl: async () =>
        okResponse({
          ok: true,
          metrics: metrics({
            rss: { heatmap: [[1], [2, 3]], kpi: [1] },
          }),
        }),
    });

    await expect(api.getDataFiles("initial")).rejects.toThrow("rectangular");
  });

  it("拒绝非有限数 KPI", async () => {
    const api = createCase2Api({
      fetchImpl: async () =>
        okResponse({
          ok: true,
          metrics: metrics({
            rss: { heatmap: [[1]], kpi: [Number.NaN] },
          }),
        }),
    });

    await expect(api.getDataFiles("initial")).rejects.toThrow("finite number");
  });
});

describe("case2Api timeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("假 fetch 永不返回时控制请求超时抛 REQUEST_TIMEOUT", async () => {
    const api = createCase2Api({
      requestTimeoutMs: 10,
      fetchImpl: hangUntilAbort,
    });
    const err = await api.getControl().catch((e) => e);
    expect(err).toMatchObject({
      name: "Case2ApiError",
      code: "REQUEST_TIMEOUT",
      httpStatus: 0,
    });
    expect(err).toBeInstanceOf(Case2ApiError);
    expect(err.name).not.toBe("AbortError");
  });

  it("默认控制 8s、截图 20s", async () => {
    vi.useFakeTimers();
    const api = createCase2Api({ fetchImpl: hangUntilAbort });

    const controlPending = api.getControl();
    await vi.advanceTimersByTimeAsync(CASE2_REQUEST_TIMEOUT_MS - 1);
    let controlSettled = false;
    void controlPending.then(
      () => {
        controlSettled = true;
      },
      () => {
        controlSettled = true;
      },
    );
    await Promise.resolve();
    expect(controlSettled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(controlPending).rejects.toMatchObject({
      code: "REQUEST_TIMEOUT",
      message: `request exceeded ${CASE2_REQUEST_TIMEOUT_MS}ms`,
    });

    const shotPending = api.postScreenshot("xx");
    await vi.advanceTimersByTimeAsync(CASE2_SCREENSHOT_TIMEOUT_MS - 1);
    let shotSettled = false;
    void shotPending.then(
      () => {
        shotSettled = true;
      },
      () => {
        shotSettled = true;
      },
    );
    await Promise.resolve();
    expect(shotSettled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(shotPending).rejects.toMatchObject({
      code: "REQUEST_TIMEOUT",
      message: `request exceeded ${CASE2_SCREENSHOT_TIMEOUT_MS}ms`,
    });
  });

  it("调用方 abort 不当成 REQUEST_TIMEOUT", async () => {
    const caller = new AbortController();
    const api = createCase2Api({
      requestTimeoutMs: 500,
      fetchImpl: hangUntilAbort,
    });
    const pending = api.getControl(caller.signal);
    await Promise.resolve();
    caller.abort();
    const err = await pending.catch((e) => e);
    expect(err).toMatchObject({ name: "AbortError" });
    expect(err).not.toMatchObject({ code: "REQUEST_TIMEOUT" });
  });
});
