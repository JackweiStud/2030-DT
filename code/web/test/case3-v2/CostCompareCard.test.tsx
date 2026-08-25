/**
 * Case3 V2 Cost fill：空值隐藏，有值移动不拉伸。
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CostCompareCard } from "../../src/cases/case3-v2/components/CostCompareCard";
import {
  CASE3V2_COST_FILL,
  costFillStyle,
} from "../../src/cases/case3-v2/v2CostFill";

describe("costFillStyle", () => {
  it("空值隐藏", () => {
    expect(costFillStyle(null, "without")).toEqual({ display: "none" });
    expect(costFillStyle(undefined, "with")).toEqual({ display: "none" });
  });

  it("50% 对齐冻结带顶 94px，且不改宽高", () => {
    const style = costFillStyle(50, "without");
    expect(style.display).toBe("block");
    expect(style.top).toBe("94px");
    expect(style.transform).toContain("scaleX(1)");
    expect(style).not.toHaveProperty("width");
    expect(style).not.toHaveProperty("height");
  });

  it("100% 高于 0%，透视 scaleX 更小", () => {
    const high = costFillStyle(100, "without");
    const low = costFillStyle(0, "without");
    expect(high.top).toBe(`${CASE3V2_COST_FILL.topAt100}px`);
    expect(low.top).toBe(`${CASE3V2_COST_FILL.topAt0}px`);
    const highScale = Number(/scaleX\((.+)\)/.exec(high.transform ?? "")?.[1]);
    const lowScale = Number(/scaleX\((.+)\)/.exec(low.transform ?? "")?.[1]);
    expect(highScale).toBeLessThan(lowScale);
  });
});

describe("CostCompareCard", () => {
  it("空值显示 -- 并隐藏双侧 fill", () => {
    const { container } = render(
      <CostCompareCard withoutCostPct={null} withCostPct={null} deltaText="--" />,
    );
    expect(container.querySelector("[data-cost-wo]")?.textContent).toBe("--");
    expect(container.querySelector("[data-cost-w]")?.textContent).toBe("--");
    expect(
      (container.querySelector("[data-cost-fill-wo]") as HTMLElement).style.display,
    ).toBe("none");
    expect(
      (container.querySelector("[data-cost-fill-w]") as HTMLElement).style.display,
    ).toBe("none");
  });

  it("Without 实时值显示 fill，With 仍隐藏", () => {
    const { container } = render(
      <CostCompareCard withoutCostPct={25} withCostPct={null} deltaText="--" />,
    );
    expect(container.querySelector("[data-cost-wo]")?.textContent).toBe("25.0");
    expect(container.querySelector("[data-cost-w]")?.textContent).toBe("--");
    const wo = container.querySelector("[data-cost-fill-wo]") as HTMLElement;
    const w = container.querySelector("[data-cost-fill-w]") as HTMLElement;
    expect(wo.style.display).toBe("block");
    expect(wo.style.top).not.toBe("94px");
    expect(w.style.display).toBe("none");
  });
});
