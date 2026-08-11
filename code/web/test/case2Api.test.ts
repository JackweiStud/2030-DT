import { describe, expect, it } from "vitest";
import { createCase2Api } from "../src/cases/case2/api/case2Api";
import { METRIC_KEYS } from "../src/cases/case2/types";

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
