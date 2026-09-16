/**
 * Case4 地图：38 预期 / 30 完成不补点；复位钮仅在偏离 config 时出现。
 */
import { createRef } from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MapRenderer2D } from "../../src/cases/case4/components/map/MapRenderer2D";
import {
  CASE4_MAP_STAGE,
  CASE4_PIN_SIZE,
} from "../../src/cases/case4/config/case4RuntimeConfig";
import type { MapRendererHandle } from "../../src/cases/case4/hooks/useCase4Controller";
import { projectBusinessToImage } from "../../src/cases/case3-v2/mapProjectionV2";
import { CASE4_TEST_CONFIG, basePoint, trajPoint } from "./fixtures";
import type { BasePoint } from "../../src/cases/case4/types";

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

describe("Case4 MapRenderer2D", () => {
  it("38 预期点全部保留，实测停在 30", () => {
    const baseRoute = Array.from({ length: 38 }, (_, i) =>
      basePoint(i + 1, 1, 15 - i * 0.1, 0),
    );
    const livePoints = baseRoute.slice(0, 30).map((p) => trajPoint(p.no, p));
    const view = render(
      <MapRenderer2D
        config={CASE4_TEST_CONFIG}
        stageElementRef={{ current: document.createElement("div") }}
        baseRoute={baseRoute}
        livePoints={livePoints}
      />,
    );
    const image = view.container.querySelector(
      "img.c4-map-image",
    ) as HTMLImageElement;
    setNaturalSize(image);
    fireEvent.load(image);
    expect(view.container.querySelectorAll(".c4-pin")).toHaveLength(38);
    expect(view.container.querySelectorAll(".c4-pin.is-lit")).toHaveLength(30);
    const nos = [...view.container.querySelectorAll(".c4-pin__no")] as HTMLSpanElement[];
    expect(nos[0]?.textContent).toBe("1");
    expect(nos[0]?.style.transform).toBe("");
    const pin0 = view.container.querySelector(".c4-pin") as HTMLElement;
    expect(pin0.style.width).toBe(`${CASE4_PIN_SIZE.width}px`);
    expect(pin0.style.height).toBe(`${CASE4_PIN_SIZE.height}px`);
    const baseLines = view.container.querySelectorAll(".c4-route-base polyline");
    expect(baseLines).toHaveLength(2);
    expect(baseLines[0]?.getAttribute("stroke")).toBe("#ABC5FF80");
    expect(baseLines[0]?.getAttribute("stroke-width")).toBe("14");
    expect(baseLines[1]?.getAttribute("stroke")).toBe("#457EF980");
    expect(baseLines[1]?.getAttribute("stroke-width")).toBe("9");
    expect(baseLines[0]?.getAttribute("points")?.split(" ").length).toBe(38);
    const walkedLines = view.container.querySelectorAll(
      ".c4-route-walked polyline",
    );
    expect(walkedLines).toHaveLength(2);
    expect(walkedLines[0]?.getAttribute("stroke")).toBe("#ABC5FF");
    expect(walkedLines[0]?.getAttribute("stroke-width")).toBe("14");
    expect(walkedLines[1]?.getAttribute("stroke")).toBe("#457EF9");
    expect(walkedLines[1]?.getAttribute("stroke-width")).toBe("9");
    expect(walkedLines[0]?.getAttribute("points")?.split(" ").length).toBe(30);
    const layer = view.container.querySelector(".c4-map-image-layer");
    expect(layer?.querySelector(".c4-map-image")).toBeTruthy();
    expect(layer?.querySelector(".c4-tracks")).toBeTruthy();
    const trackLines = layer?.querySelectorAll(".c4-tracks polyline") ?? [];
    expect(trackLines.length).toBe(3);
    expect(trackLines[0]?.getAttribute("stroke-width")).toBe("2.5");
    expect(layer?.querySelectorAll(".c4-tracks circle").length).toBe(90);
    expect(view.container.querySelector('[aria-label="复位地图"]')).toBeNull();
  });

  it("滚轮后出现复位钮，点击回到 config 视角", () => {
    const ref = createRef<MapRendererHandle>();
    const view = render(
      <MapRenderer2D
        ref={ref}
        config={CASE4_TEST_CONFIG}
        stageElementRef={{ current: document.createElement("div") }}
        baseRoute={[basePoint(1, 1, 15)]}
        livePoints={[]}
      />,
    );
    const root = view.container.querySelector(".c4-map-interact") as HTMLElement;
    Object.defineProperty(root, "clientWidth", { value: 1920, configurable: true });
    fireEvent.wheel(root, { deltaY: -120, clientX: 100, clientY: 100 });
    expect(view.container.querySelector('[aria-label="复位地图"]')).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "复位地图" }));
    expect(view.container.querySelector('[aria-label="复位地图"]')).toBeNull();
  });

  it("38 点真实 L 走廊默认取景落在底栏以上", () => {
    const route: BasePoint[] = [];
    for (let y = 15; y >= 2; y -= 1) {
      route.push(basePoint(route.length + 1, 1, y));
    }
    for (let x = 2; x <= 25; x += 1) {
      route.push(basePoint(route.length + 1, x, 2));
    }
    expect(route).toHaveLength(38);
    const cfg = CASE4_TEST_CONFIG;
    const v2 = {
      v2MapOriginX: cfg.mapOriginX,
      v2MapOriginY: cfg.mapOriginY,
      v2MapUnitsPerPx: cfg.mapUnitsPerPx,
    };
    const dockInStage = 640 - CASE4_MAP_STAGE.top;
    const nat = { w: 1920, h: 988 };
    for (const p of route) {
      const img = projectBusinessToImage(p.x, p.y, v2);
      const stageY =
        nat.h / 2 +
        (img.imageY - nat.h / 2) * cfg.mapImageScale +
        cfg.mapImageOffsetY;
      expect(stageY).toBeGreaterThan(20);
      expect(stageY).toBeLessThan(dockInStage - 40);
    }
  });
});
