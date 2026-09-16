/**
 * 进页握手：GET control → POST init → GET init-data。
 */
import { describe, expect, it, vi } from "vitest";
import { Case4ApiError } from "../../src/cases/case4/api/case4Api";
import { runCase4Handshake } from "../../src/cases/case4/hooks/case4Handshake";
import { idleControl, sampleBaseRoute, stubApi } from "./fixtures";

describe("runCase4Handshake", () => {
  it("按 GET → POST init → GET init-data 顺序", async () => {
    const order: string[] = [];
    const api = stubApi({
      getControl: async () => {
        order.push("getControl");
        return idleControl();
      },
      postControl: async (payload) => {
        order.push(`post:${"command" in payload ? payload.command : "?"}`);
        return idleControl();
      },
      getInitData: async () => {
        order.push("init-data");
        return { baseRoute: sampleBaseRoute() };
      },
    });
    const result = await runCase4Handshake(api, new AbortController().signal, 1);
    expect(result.ok).toBe(true);
    expect(order).toEqual(["getControl", "post:init", "init-data"]);
  });

  it("init-data 非法归 init-data 失败，不是适配失败", async () => {
    const api = stubApi({
      getInitData: async () => {
        throw new Case4ApiError("CASE4_INVALID_RESPONSE", "bad", 422);
      },
    });
    const result = await runCase4Handshake(api, new AbortController().signal, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("init-data");
  });

  it("网络失败归 adapter", async () => {
    const api = stubApi({
      getControl: async () => {
        throw new Case4ApiError("REQUEST_TIMEOUT", "timeout", 0);
      },
    });
    const result = await runCase4Handshake(api, new AbortController().signal, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("adapter");
  });

  it("中止时抛出，不把 Abort 当成业务失败", async () => {
    const ac = new AbortController();
    const api = stubApi({
      getControl: async (signal) => {
        ac.abort();
        if (signal?.aborted) {
          throw new DOMException("The operation was aborted", "AbortError");
        }
        return idleControl();
      },
    });
    await expect(runCase4Handshake(api, ac.signal, 1)).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("握手成功不请求 trajectory", async () => {
    const api = stubApi({
      getTrajectory: vi.fn(async () => {
        throw new Error("should not read trajectory");
      }),
    });
    const result = await runCase4Handshake(api, new AbortController().signal, 1);
    expect(result.ok).toBe(true);
    expect(api.getTrajectory).not.toHaveBeenCalled();
  });
});
