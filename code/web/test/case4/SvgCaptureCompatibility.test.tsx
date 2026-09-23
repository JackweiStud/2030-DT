/**
 * Case4 SVG 截图兼容：cloneNode 后仍带 fill/stroke/dash。
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CdfChart } from "../../src/cases/case4/components/CdfChart";
import { ErrorReplay } from "../../src/cases/case4/components/ErrorReplay";
import { MapRenderer2D } from "../../src/cases/case4/components/map/MapRenderer2D";
import { NlosGauge } from "../../src/cases/case4/components/NlosGauge";
import { ThroughputChart } from "../../src/cases/case4/components/ThroughputChart";
import {
  CASE4_TEST_CONFIG,
  basePoint,
  sampleBaseRoute,
  sampleStatistics,
  trajPoint,
  thrpSamples,
} from "./fixtures";

function clonedChild(
  container: HTMLElement,
  svgSelector: string,
  childSelector: string,
): Element {
  const svg = container.querySelector(svgSelector);
  expect(svg).not.toBeNull();
  const clone = svg?.cloneNode(true) as SVGElement;
  const child = clone.querySelector(childSelector);
  expect(child).not.toBeNull();
  return child as Element;
}

describe("Case4 SVG screenshot compatibility", () => {
  it("NLOS 弧在克隆后仍带 stroke 与 dash", () => {
    const view = render(<NlosGauge nlosRatio={0.5} />);
    const arc = clonedChild(view.container, ".c4-nlos-svg", ".c4-nlos-arc");
    expect(arc.getAttribute("fill")).toBe("none");
    expect(arc.getAttribute("stroke")).toBe("#3B82F6");
    expect(arc.getAttribute("stroke-dasharray")).toBe("50 100");
    expect(arc.getAttribute("stroke-dashoffset")).toBe("0");
  });

  it("CDF path 克隆后仍带 stroke", () => {
    const view = render(<CdfChart cdf={sampleStatistics().cdf} />);
    const path = clonedChild(view.container, ".c4-cdf-svg", "path");
    expect(path.getAttribute("fill")).toBe("none");
    expect(path.getAttribute("stroke")).toBeTruthy();
  });

  it("误差折线克隆后仍带 stroke", () => {
    const base = sampleBaseRoute(3);
    const view = render(
      <ErrorReplay
        baseRoute={base}
        points={base.map((p) => trajPoint(p.no, p))}
        statusText="测试中"
        startEnabled={false}
        resetEnabled={false}
        busy
        onStart={() => undefined}
        onReset={() => undefined}
      />,
    );
    const path = clonedChild(view.container, ".c4-error-svg", "path");
    expect(path.getAttribute("fill")).toBe("none");
    expect(path.getAttribute("stroke")).toBeTruthy();
  });

  it("吞吐折线克隆后仍带 stroke", () => {
    const view = render(
      <ThroughputChart
        routeNos={Array.from({ length: 20 }, (_, i) => i + 1)}
        without={thrpSamples(3)}
        withSamples={thrpSamples(2)}
      />,
    );
    const path = clonedChild(view.container, ".c4-thrp-svg", "path");
    expect(path.getAttribute("fill")).toBe("none");
    expect(path.getAttribute("stroke")).toBeTruthy();
  });

  it("反射层克隆后波纹有 stroke，点与字有 fill，亮段有 dash", () => {
    const reflection = {
      state: "ready" as const,
      los: true,
      points: [
        { id: 1, x: 2, y: 14, z: 0 },
        { id: 2, x: 3, y: 13, z: 0 },
      ],
    };
    const view = render(
      <MapRenderer2D
        config={{ ...CASE4_TEST_CONFIG, reflectionEnable: true }}
        stageElementRef={{ current: document.createElement("div") }}
        baseRoute={[basePoint(1, 1, 15)]}
        livePoints={[trajPoint(1, { x: 1, y: 15, z: 0 }, { reflection })]}
        playback="running"
      />,
    );
    const los = clonedChild(
      view.container,
      ".c4-reflection",
      ".c4-reflection__wave--los",
    );
    expect(los.getAttribute("fill")).toBe("none");
    expect(los.getAttribute("stroke")).toBe("#22c55e");
    expect(los.getAttribute("stroke-width")).toBe("2.2");
    const hop = clonedChild(
      view.container,
      ".c4-reflection",
      ".c4-reflection__wave--hop",
    );
    expect(hop.getAttribute("stroke")).toBe("url(#c4-refl-grad)");
    const ri = clonedChild(view.container, ".c4-reflection", ".c4-reflection__ri");
    expect(ri.getAttribute("fill")).toBe("#c084fc");
    expect(ri.getAttribute("stroke")).toBe("#f5d0fe");
    const label = clonedChild(
      view.container,
      ".c4-reflection",
      ".c4-reflection__label",
    );
    expect(label.getAttribute("fill")).toBe("#e0f2fe");
    const beam = clonedChild(
      view.container,
      ".c4-reflection",
      ".c4-reflection__beam",
    );
    expect(beam.getAttribute("stroke")).toBe("#f8fafc");
    expect(beam.getAttribute("stroke-dasharray")).toBe("0.13 0.93");
    expect((beam as SVGElement).style.strokeDasharray).toBe("0.13 0.93");
  });
});
