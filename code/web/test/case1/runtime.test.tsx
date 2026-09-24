import { afterEach, describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { loadConfig } from "../../src/cases/case1/config";
import {
  kpiComparison,
  useLayerData,
  type View,
} from "../../src/cases/case1/data";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("case1 runtime", () => {
  it("validates camera coordinates and reset-free default config", () => {
    expect(loadConfig({}).debug).toBe(false);
    expect(loadConfig({}).rfViewDebug).toBe(false);
    expect(loadConfig({}).rfView).toEqual({
      scale: 1,
      rotation: 0,
      offsetX: 0,
      offsetY: 0,
    });
    expect(
      loadConfig({ VITE_CASE1_GEOMETRY_CAMERA_POSITION: "2,3,4" }).geometry
        .position,
    ).toEqual([2, 3, 4]);
    for (const env of [
      { VITE_CASE1_GEOMETRY_CAMERA_POSITION: "0,0,0" },
      { VITE_CASE1_DEBUG: "yes" },
      { VITE_CASE1_MATERIAL_MODEL_SCALE: "0" },
      { VITE_CASE1_HEATMAP_ALPHA: "1.2" },
      { VITE_CASE1_HEATMAP_X1: "1" },
      { VITE_CASE1_HEATMAP_INVALID_A: "" },
      { VITE_CASE1_HEATMAP_INVALID_R: "256" },
    ])
      expect(() => loadConfig(env)).toThrow();
  });
  it("uses actual KPI delta and scales RSS beyond 1; zero/equal have no badge", () => {
    expect(
      kpiComparison({ id: "rss", off: 1.2, on: 0.8 }, false).top,
    ).toBeGreaterThan(1.2);
    expect(
      kpiComparison({ id: "rss", off: 1.2, on: 0.8 }, false).delta,
    ).toBeCloseTo(-33.333);
    expect(
      kpiComparison({ id: "fidelity", off: 0.85, on: 0.9 }, true).delta,
    ).toBeCloseTo(5.882);
    expect(kpiComparison({ id: "x", off: 0, on: 1 }, true).delta).toBeNull();
    expect(kpiComparison({ id: "x", off: 1, on: 1 }, true).delta).toBeNull();
  });
  it("reads only selected layer, caches success during stay, remount discards cache", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          kpis: [{ id: "fidelity", off: 0.85, on: 0.9 }],
        }),
      });
    vi.stubGlobal("fetch", fetcher);
    const { result, rerender, unmount } = renderHook(
      ({ view }: { view: View }) => useLayerData(view),
      { initialProps: { view: "home" as View } },
    );
    expect(fetcher).not.toHaveBeenCalled();
    rerender({ view: "geometry" });
    await waitFor(() => expect(result.current.data.geometry).toBeDefined());
    rerender({ view: "home" });
    rerender({ view: "geometry" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    unmount();
    renderHook(() => useLayerData("geometry"));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });
  it("aborts stale request and permits reentering failed layer without polling", async () => {
    let signal: AbortSignal | undefined;
    const fetcher = vi
      .fn()
      .mockImplementationOnce((_url, options) => {
        signal = options.signal;
        return new Promise(() => {});
      })
      .mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: "文件不存在" } }),
      });
    vi.stubGlobal("fetch", fetcher);
    const { result, rerender } = renderHook(
      ({ view }: { view: View }) => useLayerData(view),
      { initialProps: { view: "geometry" as View } },
    );
    rerender({ view: "rf" });
    expect(signal?.aborted).toBe(true);
    await waitFor(() => expect(result.current.errors.rf).toBe("文件不存在"));
    expect(result.current.errors.geometry).toBeUndefined();
    rerender({ view: "home" });
    rerender({ view: "rf" });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  });
});
