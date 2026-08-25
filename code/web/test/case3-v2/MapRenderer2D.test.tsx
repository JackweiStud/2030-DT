/**
 * Case3 V2 地图 renderer：reset / prepareCapture。
 */

import { createRef } from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MapRenderer2D } from "../../src/cases/case3-v2/components/map/MapRenderer2D";
import type { MapRendererHandle } from "../../src/cases/case3/hooks/useCase3Controller";

const route = [
  { no: 1, x: 1, y: 15, z: 0 },
  { no: 2, x: 1, y: 2, z: 0 },
  { no: 3, x: 18, y: 2, z: 0 },
];

describe("Case3V2 MapRenderer2D", () => {
  it("prepareCapture 在图片 load 后完成", async () => {
    const ref = createRef<MapRendererHandle>();
    const view = render(
      <MapRenderer2D
        ref={ref}
        baseRoute={route}
        stageElementRef={{ current: document.createElement("div") }}
      />,
    );
    const image = view.container.querySelector(
      "img.case3v2-map-image",
    ) as HTMLImageElement;

    let settled = false;
    let readiness!: Promise<void>;
    act(() => {
      readiness = ref.current!.prepareCapture();
      void readiness.then(() => {
        settled = true;
      });
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    fireEvent.load(image);
    await expect(readiness).resolves.toBeUndefined();
    expect(settled).toBe(true);
    expect(view.container.querySelectorAll(".case3v2-pin")).toHaveLength(3);
    const layer = view.container.querySelector(".case3v2-map-transform");
    expect(layer?.querySelector(".case3v2-map-image")).toBeTruthy();
    expect(layer?.querySelector(".case3v2-route-points")).toBeTruthy();
  });

  it("地图加载失败时 prepareCapture 明确失败", async () => {
    const ref = createRef<MapRendererHandle>();
    const view = render(
      <MapRenderer2D
        ref={ref}
        baseRoute={route}
        stageElementRef={{ current: document.createElement("div") }}
      />,
    );
    const image = view.container.querySelector(
      "img.case3v2-map-image",
    ) as HTMLImageElement;
    const readiness = ref.current!.prepareCapture();
    fireEvent.error(image);
    await expect(readiness).rejects.toThrow("case3-v2 map image failed to load");
  });

  it("resetView 恢复 identity transform", () => {
    const ref = createRef<MapRendererHandle>();
    const view = render(
      <MapRenderer2D
        ref={ref}
        baseRoute={route}
        stageElementRef={{ current: document.createElement("div") }}
      />,
    );
    const interact = view.container.querySelector(
      ".case3v2-map-interact",
    ) as HTMLDivElement;
    fireEvent.wheel(interact, { deltaY: -100, clientX: 200, clientY: 200 });
    const layer = view.container.querySelector(
      ".case3v2-map-transform",
    ) as HTMLDivElement;
    expect(layer.style.transform).not.toBe(
      "translate(0px, 0px) rotate(0deg) scale(1)",
    );

    act(() => {
      ref.current!.resetView();
    });
    expect(layer.style.transform).toBe(
      "translate(0px, 0px) rotate(0deg) scale(1)",
    );
  });
});
