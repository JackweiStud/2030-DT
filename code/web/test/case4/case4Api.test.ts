/**
 * Case4 API shape 校验。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Case4ApiError,
  createCase4Api,
} from "../../src/cases/case4/api/case4Api";
import { okJson, sampleBaseRoute, sampleStatistics } from "./fixtures";

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

describe("case4Api", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("解析 control 与 init-data 连续点号", async () => {
    const api = createCase4Api({
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("/init-data")) {
          return okJson({ ok: true, baseRoute: sampleBaseRoute(2) });
        }
        return okJson({
          ok: true,
          control: {
            case: "case4",
            command: "init",
            dt_type: "",
            status: "",
            save_picture_flag: 0,
          },
        });
      },
    });
    await expect(api.getControl()).resolves.toMatchObject({ command: "init" });
    await expect(api.getInitData()).resolves.toMatchObject({
      baseRoute: [{ no: 1 }, { no: 2 }],
    });
  });

  it("拒绝点号不从 1 连续的 baseRoute", async () => {
    const api = createCase4Api({
      fetchImpl: async () =>
        okJson({
          ok: true,
          baseRoute: [
            { no: 2, x: 1, y: 1, z: 0 },
            { no: 3, x: 2, y: 2, z: 0 },
          ],
        }),
    });
    await expect(api.getInitData()).rejects.toMatchObject({
      code: "CASE4_INVALID_RESPONSE",
    });
  });

  it("吞吐 side 必须与请求一致", async () => {
    const api = createCase4Api({
      fetchImpl: async () =>
        okJson({
          ok: true,
          side: "with",
          samples: [{ no: 1, gbps: 1 }],
          pendingTail: false,
        }),
    });
    await expect(api.getThroughput("without")).rejects.toBeInstanceOf(
      Case4ApiError,
    );
  });

  it("completeCount 必须等于 points.length", async () => {
    const api = createCase4Api({
      fetchImpl: async () =>
        okJson({
          ok: true,
          points: [
            {
              no: 1,
              traditional: { x: 1, y: 2, z: 0 },
              commercial: { x: 1, y: 2, z: 0 },
              dt: { x: 1, y: 2, z: 0 },
            },
          ],
          completeCount: 2,
          pendingTail: false,
        }),
    });
    await expect(api.getTrajectory()).rejects.toMatchObject({
      code: "CASE4_INVALID_RESPONSE",
    });
  });

  it("透传 CONTROL_BUSY", async () => {
    const api = createCase4Api({
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

  it("超时抛 REQUEST_TIMEOUT", async () => {
    const api = createCase4Api({
      fetchImpl: hangUntilAbort,
      requestTimeoutMs: 20,
    });
    await expect(api.getControl()).rejects.toMatchObject({
      code: "REQUEST_TIMEOUT",
      httpStatus: 0,
    });
  });

  it("接受合法 /result", async () => {
    const stats = sampleStatistics();
    const api = createCase4Api({
      fetchImpl: async () =>
        okJson({
          ok: true,
          trajectory: {
            points: [
              {
                no: 1,
                traditional: { x: 1, y: 2, z: 0 },
                commercial: { x: 1, y: 2, z: 0 },
                dt: { x: 1, y: 2, z: 0 },
              },
            ],
            completeCount: 1,
            pendingTail: false,
          },
          throughput: {
            without: { samples: [], pendingTail: false },
            with: { samples: [{ no: 1, gbps: 8.1 }], pendingTail: false },
          },
          statistics: stats,
        }),
    });
    const result = await api.getResult();
    expect(result.statistics.nlosRatio).toBe(0.897);
    expect(result.throughput.with.samples).toHaveLength(1);
  });
});
