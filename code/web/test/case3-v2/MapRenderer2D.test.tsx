/**
 * Case3 V2 地图 renderer：reset / prepareCapture。
 */

import { createRef } from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MapRenderer2D } from "../../src/cases/case3-v2/components/map/MapRenderer2D";
import type { Case3RuntimeConfig } from "../../src/cases/case3/config/case3RuntimeConfig";
import type { MapRendererHandle } from "../../src/cases/case3/hooks/useCase3Controller";
import type { Case3Point } from "../../src/cases/case3/types";
import {
  projectBusinessToImage,
  ueBoxFromImagePoint,
} from "../../src/cases/case3-v2/mapProjectionV2";

const route = [
  { no: 1, x: 1, y: 15, z: 0 },
  { no: 2, x: 1, y: 2, z: 0 },
  { no: 3, x: 18, y: 2, z: 0 },
];

const config: Case3RuntimeConfig = {
  pollMs: 500,
  mapOriginX: 905,
  mapOriginY: 445,
  mapUnitsPerPx: 0.11,
  v2MapOriginX: 905,
  v2MapOriginY: 445,
  v2MapUnitsPerPx: 0.11,
  v2MapImageScale: 1,
  v2MapImageRotationDeg: 0,
  v2MapImageOffsetX: 0,
  v2MapImageOffsetY: 0,
  v2DebugShow: true,
};

function setNaturalSize(image: HTMLImageElement): void {
  Object.defineProperty(image, "naturalWidth", {
    configurable: true,
    value: 1920,
  });
  Object.defineProperty(image, "naturalHeight", {
    configurable: true,
    value: 988,
  });
}

describe("Case3V2 MapRenderer2D", () => {
  it("prepareCapture 在图片 load 后完成", async () => {
    const ref = createRef<MapRendererHandle>();
    const view = render(
      <MapRenderer2D
        ref={ref}
        config={config}
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

    setNaturalSize(image);
    fireEvent.load(image);
    await expect(readiness).resolves.toBeUndefined();
    expect(settled).toBe(true);
    expect(view.container.querySelectorAll(".case3v2-pin")).toHaveLength(3);
    const layer = view.container.querySelector(".case3v2-map-transform");
    expect(layer?.querySelector(".case3v2-map-image")).toBeTruthy();
    expect(layer?.querySelector(".case3v2-route-points")).toBeTruthy();
    expect(view.container.querySelector("[data-ue]")).toBeNull();
    expect(view.container.querySelector("[data-walked-inner]")).toBeNull();
  });

  it("地图加载失败时 prepareCapture 明确失败", async () => {
    const ref = createRef<MapRendererHandle>();
    const view = render(
      <MapRenderer2D
        ref={ref}
        config={config}
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

  it("debug 面板实时输出可复制 env，resetView 恢复 env 基线", () => {
    const ref = createRef<MapRendererHandle>();
    const view = render(
      <MapRenderer2D
        ref={ref}
        config={config}
        baseRoute={route}
        stageElementRef={{ current: document.createElement("div") }}
      />,
    );
    const interact = view.container.querySelector(
      ".case3v2-map-interact",
    ) as HTMLDivElement;
    const env = view.container.querySelector(
      ".case3v2-map-debug__env",
    ) as HTMLTextAreaElement;
    expect(env.value).toContain("VITE_CASE3_V2_MAP_IMAGE_SCALE=1");
    fireEvent.wheel(interact, { deltaY: -100, clientX: 200, clientY: 200 });
    const imageLayer = view.container.querySelector(
      ".case3v2-map-image-layer",
    ) as HTMLDivElement;
    expect(imageLayer.style.transform).not.toBe(
      "translate(0px, 0px) rotate(0deg) scale(1)",
    );
    expect(env.value).toContain("VITE_CASE3_V2_MAP_IMAGE_SCALE=1.1");

    act(() => {
      ref.current!.resetView();
    });
    expect(imageLayer.style.transform).toBe(
      "translate(0px, 0px) rotate(0deg) scale(1)",
    );
    expect(env.value).toContain("VITE_CASE3_V2_MAP_IMAGE_SCALE=1");
  });

  it("debug show 为 false 时隐藏调参面板", () => {
    const ref = createRef<MapRendererHandle>();
    const hiddenConfig = { ...config, v2DebugShow: false };
    const view = render(
      <MapRenderer2D
        ref={ref}
        config={hiddenConfig}
        baseRoute={route}
        stageElementRef={{ current: document.createElement("div") }}
      />,
    );
    expect(view.container.querySelector("[data-map-debug]")).toBeNull();
  });

  it("0/1/N 个完整点点亮、UE 与轨迹，数据更新不重置视角", () => {
    const ref = createRef<MapRendererHandle>();
    const stage = { current: document.createElement("div") };
    const live: Case3Point[] = [
      {
        no: 1,
        ue: { x: 1, y: 15, z: 0 },
        selectedBeamId: 4,
        throughputGbps: 8,
        scanBeamIds: [0],
      },
      {
        no: 3,
        ue: { x: 18, y: 2, z: 0 },
        selectedBeamId: 9,
        throughputGbps: 9,
        scanBeamIds: [1],
      },
    ];
    const view = render(
      <MapRenderer2D
        ref={ref}
        config={config}
        baseRoute={route}
        points={[]}
        stageElementRef={stage}
      />,
    );
    const image = view.container.querySelector(
      "img.case3v2-map-image",
    ) as HTMLImageElement;
    setNaturalSize(image);
    fireEvent.load(image);
    const lit = () =>
      [...view.container.querySelectorAll("[data-pin-lit]")].map((el) =>
        el.getAttribute("data-pin-lit"),
      );
    expect(lit()).toEqual(["0", "0", "0"]);
    expect(view.container.querySelector("[data-ue]")).toBeNull();
    expect(view.container.querySelector("[data-walked-inner]")).toBeNull();

    const interact = view.container.querySelector(
      ".case3v2-map-interact",
    ) as HTMLDivElement;
    fireEvent.wheel(interact, { deltaY: -100, clientX: 200, clientY: 200 });
    const imageLayer = view.container.querySelector(
      ".case3v2-map-image-layer",
    ) as HTMLDivElement;
    const zoomed = imageLayer.style.transform;
    expect(zoomed).not.toBe("translate(0px, 0px) rotate(0deg) scale(1)");

    view.rerender(
      <MapRenderer2D
        ref={ref}
        config={config}
        baseRoute={route}
        points={live.slice(0, 1)}
        stageElementRef={stage}
      />,
    );
    expect(lit()).toEqual(["1", "0", "0"]);
    expect(view.container.querySelector("[data-walked-inner]")).toBeNull();
    const ue1 = view.container.querySelector("[data-ue]") as HTMLElement;
    expect(ue1).not.toBeNull();
    const box1 = ueBoxFromImagePoint(projectBusinessToImage(1, 15, config));
    expect(ue1.style.left).toBe(`${box1.left}px`);
    expect(imageLayer.style.transform).toBe(zoomed);

    view.rerender(
      <MapRenderer2D
        ref={ref}
        config={config}
        baseRoute={route}
        points={live}
        stageElementRef={stage}
      />,
    );
    expect(lit()).toEqual(["1", "0", "1"]);
    const walked = view.container
      .querySelector("[data-walked-inner]")
      ?.getAttribute("points");
    expect(walked?.trim().split(/\s+/)).toHaveLength(2);
    const ueN = view.container.querySelector("[data-ue]") as HTMLElement;
    const boxN = ueBoxFromImagePoint(projectBusinessToImage(18, 2, config));
    expect(ueN.style.left).toBe(`${boxN.left}px`);
    expect(imageLayer.style.transform).toBe(zoomed);
  });
});
