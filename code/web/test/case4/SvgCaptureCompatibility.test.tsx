/**
 * Case4 SVG 截图兼容：cloneNode 后仍带 fill/stroke/dash。
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CdfChart } from "../../src/cases/case4/components/CdfChart";
import { ErrorReplay } from "../../src/cases/case4/components/ErrorReplay";
import { NlosGauge } from "../../src/cases/case4/components/NlosGauge";
import { ThroughputChart } from "../../src/cases/case4/components/ThroughputChart";
import {
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
        statusText="测试中..."
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
        without={thrpSamples(3)}
        withSamples={thrpSamples(2)}
      />,
    );
    const path = clonedChild(view.container, ".c4-thrp-svg", "path");
    expect(path.getAttribute("fill")).toBe("none");
    expect(path.getAttribute("stroke")).toBeTruthy();
  });
});
