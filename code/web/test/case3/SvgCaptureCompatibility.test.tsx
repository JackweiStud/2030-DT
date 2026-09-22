/**
 * Case3 原生 SVG 截图兼容性回归测试。
 * html-to-image 会整棵克隆 SVG 而不固化子节点 class 样式，因此关键绘制属性必须存在于 SVG 元素本身。
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BeamAccuracyCard } from "../../src/cases/case3/components/BeamAccuracyCard";
import { BeamScanCard } from "../../src/cases/case3/components/BeamScanCard";
import { CostCard } from "../../src/cases/case3/components/CostCard";
import type { Case3Point } from "../../src/cases/case3/types";

function point(): Case3Point {
  return {
    no: 1,
    ue: { x: 1, y: 2, z: 0 },
    selectedBeamId: 4,
    throughputGbps: 9.1,
    scanBeamIds: Array.from({ length: 16 }, (_, id) => id),
  };
}

function clonedElement(
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

describe("Case3 SVG screenshot compatibility", () => {
  it("波束网格的填充和描边在整棵 SVG 克隆后仍保留", () => {
    const view = render(
      <BeamScanCard side="without" point={point()} peerPoint={null} />,
    );

    const base = clonedElement(
      view.container,
      ".case3-scan-grid",
      ".case3-scan-path--base",
    );
    expect(base.getAttribute("fill")).toBe("#d0d4db33");
    expect(base.getAttribute("stroke")).toBe("#d0d4dc80");
    expect(base.getAttribute("stroke-width")).toBe("1");
    expect(base.getAttribute("fill-rule")).toBe("evenodd");

    const scan = clonedElement(
      view.container,
      ".case3-scan-grid",
      ".case3-scan-path--scan",
    );
    expect(scan.getAttribute("fill")).toBe("#ffffff");

    const selected = clonedElement(
      view.container,
      ".case3-scan-grid",
      ".case3-scan-path--best",
    );
    expect(selected.getAttribute("fill")).toBe("#2d7cf6");
  });

  it("Cost 半环在整棵 SVG 克隆后仍保持无填充描边", () => {
    const view = render(
      <CostCard
        withoutCostPct={25.8}
        withCostPct={15.8}
        pairValid
      />,
    );

    const track = clonedElement(
      view.container,
      "[data-cost-side='without'] .case3-cost-arc",
      ".case3-cost-arc__track",
    );
    expect(track.getAttribute("fill")).toBe("none");
    expect(track.getAttribute("stroke")).toBe("#ffffff22");
    expect(track.getAttribute("stroke-width")).toBe("19");
    expect(track.getAttribute("stroke-linecap")).toBe("round");

    const glow = clonedElement(
      view.container,
      "[data-cost-side='with'] .case3-cost-arc",
      ".case3-cost-arc__glow",
    );
    expect(glow.getAttribute("fill")).toBe("none");
    expect(glow.getAttribute("stroke")).toBe("#895bf5b2");
    expect(glow.getAttribute("stroke-width")).toBe("25");
    expect((glow as SVGPathElement).style.strokeDashoffset).toBe(
      glow.getAttribute("stroke-dashoffset"),
    );

    const value = clonedElement(
      view.container,
      "[data-cost-side='with'] .case3-cost-arc",
      ".case3-cost-arc__value",
    );
    expect(value.getAttribute("fill")).toBe("none");
    expect(value.getAttribute("stroke-width")).toBe("19");
    expect(value.getAttribute("stroke-linecap")).toBe("round");
    expect(value.getAttribute("stroke-dasharray")).not.toBeNull();
    expect(value.getAttribute("stroke-dashoffset")).not.toBeNull();
    expect((value as SVGPathElement).style.strokeDashoffset).toBe(
      value.getAttribute("stroke-dashoffset"),
    );
  });

  it("Beam Accuracy 开口环在整棵 SVG 克隆后仍保持无填充描边", () => {
    const view = render(
      <BeamAccuracyCard
        baseline={{ success: 222, total: 235 }}
        without={null}
        withSide={null}
        roundCompareEnabled={false}
      />,
    );

    const track = clonedElement(
      view.container,
      ".case3-ba-ring",
      ".case3-ba-ring__track",
    );
    expect(track.getAttribute("fill")).toBe("none");
    expect(track.getAttribute("stroke")).toBe("#3a4048");
    expect(track.getAttribute("stroke-width")).toBe("12");
    expect(track.getAttribute("stroke-linecap")).toBe("round");

    const value = clonedElement(
      view.container,
      ".case3-ba-ring",
      ".case3-ba-ring__value",
    );
    expect(value.getAttribute("fill")).toBe("none");
    expect(value.getAttribute("stroke")).toBe("#22c55e");
    expect(value.getAttribute("stroke-width")).toBe("12");
    expect(value.getAttribute("stroke-linecap")).toBe("round");
    expect(value.getAttribute("stroke-dasharray")).not.toBeNull();
    expect(value.getAttribute("stroke-dashoffset")).not.toBeNull();
  });
});
