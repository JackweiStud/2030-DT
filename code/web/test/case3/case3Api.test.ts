/**
 * Case3 API shape 校验测试。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CASE3_REQUEST_TIMEOUT_MS,
  CASE3_SCREENSHOT_TIMEOUT_MS,
  Case3ApiError,
  createCase3Api,
} from "../../src/cases/case3/api/case3Api";

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

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("case3Api", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("解析 control", async () => {
    const api = createCase3Api({
      fetchImpl: async () =>
        ok({
          ok: true,
          control: {
            case: "case3",
            command: "init",
            dt_type: "",
            status: "",
            save_picture_flag: 0,
          },
        }),
    });
    await expect(api.getControl()).resolves.toMatchObject({ command: "init" });
  });

  it("解析吞吐快照", async () => {
    const api = createCase3Api({
      fetchImpl: async () =>
        ok({
          ok: true,
          side: "without",
          samples: [{ no: 1, gbps: 8.5 }],
          pendingTail: true,
        }),
    });
    await expect(api.getThroughput("without")).resolves.toEqual({
      samples: [{ no: 1, gbps: 8.5 }],
      pendingTail: true,
    });
  });

  it("拒绝 side 不匹配的吞吐响应", async () => {
    const api = createCase3Api({
      fetchImpl: async () =>
        ok({
          ok: true,
          side: "with",
          samples: [{ no: 1, gbps: 8.5 }],
          pendingTail: false,
        }),
    });
    await expect(api.getThroughput("without")).rejects.toBeInstanceOf(
      Case3ApiError,
    );
  });

  it("拒绝无 reflection 的 with 点", async () => {
    const api = createCase3Api({
      fetchImpl: async () =>
        ok({
          ok: true,
          side: "with",
          points: [
            {
              no: 1,
              ue: { x: 1, y: 2, z: 0 },
              selectedBeamId: 1,
            },
          ],
          completeCount: 1,
          pendingTail: false,
          costPct: 10,
        }),
    });
    await expect(api.getSide("with")).rejects.toBeInstanceOf(Case3ApiError);
  });

  it("接受合法 without side", async () => {
    const api = createCase3Api({
      fetchImpl: async () =>
        ok({
          ok: true,
          side: "without",
          points: [
            {
              no: 1,
              ue: { x: 1, y: 2, z: 0 },
              selectedBeamId: 3,
              scanBeamIds: Array.from({ length: 16 }, (_, i) => i),
            },
          ],
          completeCount: 1,
          pendingTail: false,
          costPct: 25,
        }),
    });
    const side = await api.getSide("without");
    expect(side.costPct).toBe(25);
    expect(side.points[0]?.scanBeamIds).toHaveLength(16);
  });

  it("透传错误码", async () => {
    const api = createCase3Api({
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: "CONTROL_BUSY", message: "busy" },
          }),
          { status: 409 },
        ),
    });
    await expect(api.getControl()).rejects.toMatchObject({
      code: "CONTROL_BUSY",
      httpStatus: 409,
    });
  });

  it("单次请求超过时限时中止 fetch 并返回 REQUEST_TIMEOUT", async () => {
    let observedAbort = false;
    const api = createCase3Api({
      requestTimeoutMs: 10,
      fetchImpl: async (_input, init) => {
        const signal = init?.signal;
        await new Promise<never>((_, reject) => {
          signal?.addEventListener(
            "abort",
            () => {
              observedAbort = signal.aborted;
              reject(
                new DOMException("The operation was aborted", "AbortError"),
              );
            },
            { once: true },
          );
        });
        throw new Error("unreachable");
      },
    });

    await expect(api.getControl()).rejects.toMatchObject({
      code: "REQUEST_TIMEOUT",
      httpStatus: 0,
    });
    expect(observedAbort).toBe(true);
  });

  it("调用方 abort 不当成 REQUEST_TIMEOUT", async () => {
    const caller = new AbortController();
    const api = createCase3Api({
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

  it("普通 GET 默认 5s，screenshot 默认 20s", async () => {
    vi.useFakeTimers();
    const api = createCase3Api({ fetchImpl: hangUntilAbort });

    const controlPending = api.getControl();
    await vi.advanceTimersByTimeAsync(CASE3_REQUEST_TIMEOUT_MS - 1);
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
      message: `request exceeded ${CASE3_REQUEST_TIMEOUT_MS}ms`,
    });

    const shotPending = api.postScreenshot("xx");
    await vi.advanceTimersByTimeAsync(CASE3_SCREENSHOT_TIMEOUT_MS - 1);
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
      message: `request exceeded ${CASE3_SCREENSHOT_TIMEOUT_MS}ms`,
    });
  });
});
