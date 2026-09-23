/**
 * Case3 V2 Reflection 覆盖层：开关门控、LOS/NLOS 路径、不拦截地图手势。
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReflectionOverlay } from "../../src/cases/case3-v2/components/map/ReflectionOverlay";
import type { Case3RuntimeConfig } from "../../src/cases/case3/config/case3RuntimeConfig";
import type { Case3Point } from "../../src/cases/case3/types";

const baseConfig: Case3RuntimeConfig = {
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
  v2DebugShow: false,
  reflectionEnable: true,
  bsXyz: { x: 10, y: 20, z: 0 },
};

const viewBox = { w: 1920, h: 988 };

function withPoint(
  reflection: Case3Point["reflection"],
  no = 3,
): Case3Point {
  return {
    no,
    ue: { x: 1, y: 2, z: 0 },
    selectedBeamId: 1,
    reflection,
  };
}

describe("Case3V2 ReflectionOverlay", () => {
  it("开关关闭或缺少当前点时不渲染", () => {
    const off = render(
      <ReflectionOverlay
        config={{ ...baseConfig, reflectionEnable: false }}
        point={withPoint({ x: 3, y: 4, z: 0, los: true })}
        viewBox={viewBox}
        playback="running"
      />,
    );
    expect(off.container.querySelector("[data-reflection]")).toBeNull();

    const empty = render(
      <ReflectionOverlay
        config={baseConfig}
        point={null}
        viewBox={viewBox}
        playback="static"
      />,
    );
    expect(empty.container.querySelector("[data-reflection]")).toBeNull();
  });

  it("LOS 画 UE→BS，带 BS/LOS 标签与运行中亮段", () => {
    const view = render(
      <ReflectionOverlay
        config={baseConfig}
        point={withPoint({ x: 3, y: 4, z: 0, los: true })}
        viewBox={viewBox}
        playback="running"
      />,
    );
    const root = view.container.querySelector(
      "[data-reflection]",
    ) as SVGElement;
    expect(root).toBeTruthy();
    expect(root.getAttribute("data-reflection-los")).toBe("true");
    expect(root.getAttribute("data-reflection-pi")).toBe("3");
    expect(root.getAttribute("data-reflection-beam")).toBe("running");
    expect(root.querySelector(".case3v2-reflection__wave.is-los")).toBeTruthy();
    expect(root.querySelector(".case3v2-reflection__beam")).toBeTruthy();
    expect(root.textContent).toContain("BS");
    expect(root.textContent).toContain("LOS");
    expect(root.textContent).not.toContain("NLOS");
    expect(root.classList.contains("case3v2-reflection")).toBe(true);
  });

  it("NLOS 画 UE→R1→BS，完成后无动态亮段", () => {
    const view = render(
      <ReflectionOverlay
        config={baseConfig}
        point={withPoint({ x: 5, y: 6, z: 1, los: false })}
        viewBox={viewBox}
        playback="static"
      />,
    );
    const root = view.container.querySelector(
      "[data-reflection]",
    ) as SVGElement;
    expect(root.getAttribute("data-reflection-los")).toBe("false");
    expect(root.getAttribute("data-reflection-beam")).toBe("static");
    expect(root.classList.contains("is-static")).toBe(true);
    expect(root.querySelector(".case3v2-reflection__wave.is-hop")).toBeTruthy();
    expect(root.querySelector(".case3v2-reflection__beam")).toBeNull();
    expect(root.querySelector("circle")).toBeTruthy();
    expect(root.textContent).toContain("NLOS R1");
  });
});
