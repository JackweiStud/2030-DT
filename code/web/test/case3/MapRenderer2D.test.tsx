/**
 * Case3 2D 地图截图就绪测试。
 * 覆盖“调用 prepareCapture 时图片尚未完成加载”的竞态。
 */

import { createRef } from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MapRenderer2D } from "../../src/cases/case3/components/map/MapRenderer2D";
import type { Case3RuntimeConfig } from "../../src/cases/case3/config/case3RuntimeConfig";
import type { MapRendererHandle } from "../../src/cases/case3/hooks/useCase3Controller";

const config: Case3RuntimeConfig = {
  pollMs: 500,
  mapOriginX: 905,
  mapOriginY: 445,
  mapUnitsPerPx: 0.11,
};

function setNaturalSize(image: HTMLImageElement): void {
  Object.defineProperty(image, "naturalWidth", {
    configurable: true,
    value: 1974,
  });
  Object.defineProperty(image, "naturalHeight", {
    configurable: true,
    value: 1100,
  });
}

describe("MapRenderer2D", () => {
  it("prepareCapture 在图片 load 后完成，不读取旧 ready 闭包", async () => {
    const ref = createRef<MapRendererHandle>();
    const stage = document.createElement("div");
    const view = render(
      <MapRenderer2D
        ref={ref}
        config={config}
        baseRoute={[]}
        points={[]}
        stageElementRef={{ current: stage }}
      />,
    );
    const image = view.container.querySelector(
      "img.case3-map-img",
    ) as HTMLImageElement;

    let readiness!: Promise<void>;
    let settled = false;
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
    expect(
      view.container
        .querySelector(".case3-route-layer")
        ?.getAttribute("preserveAspectRatio"),
    ).toBe("xMidYMid meet");
  });

  it("地图加载失败时 prepareCapture 明确失败而不是永久等待", async () => {
    const ref = createRef<MapRendererHandle>();
    const view = render(
      <MapRenderer2D
        ref={ref}
        config={config}
        baseRoute={[]}
        points={[]}
        stageElementRef={{ current: document.createElement("div") }}
      />,
    );
    const image = view.container.querySelector(
      "img.case3-map-img",
    ) as HTMLImageElement;

    const readiness = ref.current!.prepareCapture();
    fireEvent.error(image);
    await expect(readiness).rejects.toThrow("map image failed to load");
  });
});
