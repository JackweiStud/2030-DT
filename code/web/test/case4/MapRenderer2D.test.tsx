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

  it("mapDebugShow 为 false 时隐藏调参面板", () => {
    const view = render(
      <MapRenderer2D
        config={{ ...CASE4_TEST_CONFIG, mapDebugShow: false }}
        stageElementRef={{ current: document.createElement("div") }}
        baseRoute={[basePoint(1, 1, 15)]}
        livePoints={[]}
      />,
    );
    expect(view.container.querySelector("[data-map-debug]")).toBeNull();
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

  it("开启 Reflection 时画 LOS 与 hop，完成后去掉亮段", () => {
    const reflection = {
      state: "ready" as const,
      los: true,
      points: [
        { id: 1, x: 2, y: 14, z: 0 },
        { id: 2, x: 3, y: 13, z: 0 },
      ],
    };
    const livePoints = [
      trajPoint(1, { x: 1, y: 15, z: 0 }, { reflection }),
    ];
    const running = render(
      <MapRenderer2D
        config={{ ...CASE4_TEST_CONFIG, reflectionEnable: true }}
        stageElementRef={{ current: document.createElement("div") }}
        baseRoute={[basePoint(1, 1, 15)]}
        livePoints={livePoints}
        playback="running"
      />,
    );
    expect(running.container.querySelector("[data-reflection-state='ready']")).toBeTruthy();
    expect(running.container.querySelectorAll(".c4-reflection__wave--los")).toHaveLength(1);
    expect(running.container.querySelectorAll(".c4-reflection__wave--hop")).toHaveLength(2);
    expect(running.container.querySelectorAll(".c4-reflection__wave")).toHaveLength(3);
    expect(running.container.querySelectorAll(".c4-reflection__los")).toHaveLength(0);
    expect(running.container.querySelectorAll(".c4-reflection__hop")).toHaveLength(0);
    expect(running.container.querySelectorAll(".c4-reflection__beam").length).toBeGreaterThan(0);
    const losWave = running.container.querySelector(".c4-reflection__wave--los");
    const losBeam = running.container.querySelector(
      ".c4-reflection__wave--los + .c4-reflection__beam",
    );
    expect(losWave?.getAttribute("points")).toBe(losBeam?.getAttribute("points"));
    const hopWaves = [...running.container.querySelectorAll(".c4-reflection__wave--hop")];
    expect(hopWaves[0]?.getAttribute("points")).not.toBe(
      hopWaves[1]?.getAttribute("points"),
    );
    const losLabels = [...running.container.querySelectorAll(".c4-reflection__label")].map(
      (node) => node.textContent,
    );
    expect(losLabels).toContain("NLOS R1");
    expect(losLabels).toContain("NLOS R2");
    expect(losLabels).not.toContain("R1");
    expect(losLabels).toContain("BS");
    expect(losLabels).toContain("LOS");
    expect(
      [...running.container.querySelectorAll(".c4-reflection__beam")].every(
        (node) => (node as HTMLElement).style.animationDelay === "",
      ),
    ).toBe(true);

    const done = render(
      <MapRenderer2D
        config={{ ...CASE4_TEST_CONFIG, reflectionEnable: true }}
        stageElementRef={{ current: document.createElement("div") }}
        baseRoute={[basePoint(1, 1, 15)]}
        livePoints={livePoints}
        playback="static"
      />,
    );
    expect(done.container.querySelector(".c4-reflection.is-static")).toBeTruthy();
    expect(done.container.querySelectorAll(".c4-reflection__beam")).toHaveLength(0);
    expect(
      done.container.querySelector(".c4-reflection")?.getAttribute("data-reflection-beam"),
    ).toBe("static");
  });

  it("反射点标签为 NLOS R1", () => {
    const livePoints = [
      trajPoint(
        1,
        { x: 1, y: 15, z: 0 },
        {
          reflection: {
            state: "ready",
            los: false,
            points: [
              { id: 1, x: 2, y: 14, z: 0 },
              { id: 2, x: 3, y: 13, z: 0 },
            ],
          },
        },
      ),
    ];
    const view = render(
      <MapRenderer2D
        config={{ ...CASE4_TEST_CONFIG, reflectionEnable: true }}
        stageElementRef={{ current: document.createElement("div") }}
        baseRoute={[basePoint(1, 1, 15)]}
        livePoints={livePoints}
        playback="static"
      />,
    );
    const labels = [...view.container.querySelectorAll(".c4-reflection__label")].map(
      (node) => node.textContent,
    );
    expect(labels).toContain("NLOS R1");
    expect(labels).toContain("NLOS R2");
    expect(labels).not.toContain("R1");
    expect(labels).not.toContain("LOS");
  });
});
