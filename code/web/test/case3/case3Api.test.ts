/**
 * Case3 API shape 校验测试。
 */
import { describe, expect, it } from "vitest";
import { createCase3Api, Case3ApiError } from "../../src/cases/case3/api/case3Api";

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("case3Api", () => {
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
              throughputGbps: 1,
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
              throughputGbps: 1.5,
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
});
