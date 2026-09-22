import { afterEach, it, expect, vi } from "vitest";
import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import { Group, Mesh, BoxGeometry, MeshBasicMaterial } from "three";
import { useModels } from "../../src/cases/case1/models";
const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    parseAsync = parse;
  },
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function setup() {
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) =>
    window.setTimeout(() => fn(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  const geometry = new BoxGeometry(),
    material = new MeshBasicMaterial();
  const scene = new Group();
  scene.add(new Mesh(geometry, material));
  return { scene, dispose: vi.spyOn(geometry, "dispose") };
}
it("case exit aborts network and disposes late parsed model without starting second model", async () => {
  const { scene, dispose } = setup();
  let resolve!: (value: { scene: Group }) => void;
  parse.mockReturnValue(new Promise((r) => (resolve = r)));
  const fetcher = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    });
  vi.stubGlobal("fetch", fetcher);
  const hook = renderHook(() => useModels());
  await waitFor(() => expect(parse).toHaveBeenCalledTimes(1));
  const signal = fetcher.mock.calls[0]![1].signal as AbortSignal;
  hook.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => resolve({ scene }));
  await waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("prepares sequentially, isolates material failure and releases successful model on exit", async () => {
  const { scene, dispose } = setup();
  parse.mockResolvedValue({ scene });
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    })
    .mockResolvedValueOnce({ ok: false });
  vi.stubGlobal("fetch", fetcher);
  const { result, unmount } = renderHook(() => useModels());
  await waitFor(() => expect(result.current.errors.material).toBeDefined());
  expect(result.current.models.geometry).toBe(scene);
  expect(result.current.errors.geometry).toBeUndefined();
  expect(fetcher.mock.calls.map((c) => c[0])).toEqual([
    "/api/case1/models/geometry",
    "/api/case1/models/material",
  ]);
  unmount();
  expect(dispose).toHaveBeenCalledTimes(1);
});
