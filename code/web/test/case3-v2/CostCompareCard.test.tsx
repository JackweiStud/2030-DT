/**
 * Case3 V2 Cost：数字槽与 SVG 梯形体积填充。
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CostCompareCard } from "../../src/cases/case3-v2/components/CostCompareCard";
import { costFillVolume, CASE3V2_COST_AUX_RANGE } from "../../src/cases/case3-v2/v2CostFill";

describe("costFillVolume", () => {
  it("空值不画", () => {
    expect(costFillVolume(null, "without")).toBeNull();
    expect(costFillVolume(undefined, "with")).toBeNull();
  });

  it("0% 贴近近端，100% 贴 aux 上边缘，50% 在中间", () => {
    const low = costFillVolume(0, "without")!;
    const mid = costFillVolume(50, "without")!;
    const high = costFillVolume(100, "without")!;
    expect(low.clipHeight).toBe(0);
    expect(high.yCut).toBe(CASE3V2_COST_AUX_RANGE.without.yFar);
    expect(low.yCut).toBe(CASE3V2_COST_AUX_RANGE.without.yNear);
    expect(high.yCut).toBeLessThan(mid.yCut);
    expect(mid.yCut).toBeLessThan(low.yCut);
    expect(high.clipHeight).toBeGreaterThan(mid.clipHeight);
  });

  it("左右侧都沿 aux 边缘裁切", () => {
    const wo = costFillVolume(23.1, "without")!;
    const w = costFillVolume(23.1, "with")!;
    expect(wo.surfaceX2).toBeGreaterThan(wo.surfaceX1);
    expect(w.surfaceX2).toBeGreaterThan(w.surfaceX1);
    expect(costFillVolume(100, "with")!.yCut).toBe(CASE3V2_COST_AUX_RANGE.with.yFar);
    const topWo = costFillVolume(100, "without")!;
    expect(topWo.surfaceX2 - topWo.surfaceX1).toBeGreaterThan(90);
    expect(
      costFillVolume(85, "without")!.surfaceX2 -
        costFillVolume(85, "without")!.surfaceX1,
    ).toBeGreaterThan(90);
  });
});

describe("CostCompareCard", () => {
  it("空值显示 -- 并隐藏双侧 fill", () => {
    const { container } = render(
      <CostCompareCard withoutCostPct={null} withCostPct={null} deltaText="--" />,
    );
    expect(container.querySelector("[data-cost-wo]")?.textContent).toBe("--");
    expect(container.querySelector("[data-cost-w]")?.textContent).toBe("--");
    expect(container.querySelector("[data-cost-wo]")?.classList.contains("case3v2-cost-value__num")).toBe(
      true,
    );
    expect(
      (container.querySelector("[data-cost-wo]")?.nextElementSibling as HTMLElement)
        .classList.contains("case3v2-cost-value__unit"),
    ).toBe(true);
    expect(container.querySelector("[data-cost-fill-wo]")?.hasAttribute("hidden")).toBe(
      true,
    );
    expect(container.querySelector("[data-cost-fill-w]")?.hasAttribute("hidden")).toBe(
      true,
    );
  });

  it("Without 实时值显示 SVG 体积，With 仍隐藏", () => {
    const { container } = render(
      <CostCompareCard withoutCostPct={25} withCostPct={null} deltaText="--" />,
    );
    expect(container.querySelector("[data-cost-wo]")?.textContent).toBe("25.0");
    expect(container.querySelector("[data-cost-w]")?.textContent).toBe("--");
    const wo = container.querySelector("[data-cost-fill-wo]") as SVGSVGElement;
    const w = container.querySelector("[data-cost-fill-w]") as SVGSVGElement;
    expect(wo.hasAttribute("hidden")).toBe(false);
    expect(wo.querySelector("[data-cost-fill-clip]")).not.toBeNull();
    expect(wo.querySelector("line")).toBeNull();
    expect(w.hasAttribute("hidden")).toBe(true);
  });

  it("有 DT 填充用切图青绿，无 DT 仍为灰白", () => {
    const { container } = render(
      <CostCompareCard withoutCostPct={50} withCostPct={25} deltaText="-50.0" />,
    );
    const woStops = [
      ...container.querySelectorAll("[data-cost-fill-wo] stop"),
    ].map((el) => el.getAttribute("stop-color"));
    const wStops = [
      ...container.querySelectorAll("[data-cost-fill-w] stop"),
    ].map((el) => el.getAttribute("stop-color"));
    expect(woStops).toContain("#ffffff");
    expect(woStops).toContain("#f4f7fb");
    expect(wStops).toContain("#1affa8");
    expect(wStops).toContain("#b8ffe8");
    expect(wStops).not.toContain("#f4f7fb");
    expect(container.querySelector("[data-cost-fill-wo] line")).toBeNull();
    expect(container.querySelector("[data-cost-fill-w] line")).toBeNull();
  });
});
