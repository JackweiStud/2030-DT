/**
 * Case3 V2 Cost：数字槽与 SVG 梯形体积填充。
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CostCompareCard } from "../../src/cases/case3-v2/components/CostCompareCard";
import { costFillVolume, CASE3V2_COST_AUX_RANGE } from "../../src/cases/case3-v2/v2CostFill";
// @ts-expect-error vitest 跑在 Node，tsconfig 未纳入 @types/node
import { readFileSync } from "fs";

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
      <CostCompareCard withoutCostPct={null} withCostPct={null} pairValid={false} />,
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
      <CostCompareCard withoutCostPct={25} withCostPct={null} pairValid={false} />,
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
      <CostCompareCard withoutCostPct={50} withCostPct={25} pairValid={true} />,
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
    expect(container.querySelector("[data-cost-delta]")?.textContent).toBe("-50.0");
    expect(container.querySelector("[data-cost-delta-label]")?.textContent).toBe(
      "开销减少",
    );
    expect(container.querySelector("[data-delta-tone]")?.getAttribute("data-delta-tone")).toBe(
      "down",
    );
  });

  it("pairValid=false 时双侧真实 cost 仍显示，变化为 --", () => {
    const { container } = render(
      <CostCompareCard withoutCostPct={25} withCostPct={12.5} pairValid={false} />,
    );
    expect(container.querySelector("[data-cost-wo]")?.textContent).toBe("25.0");
    expect(container.querySelector("[data-cost-w]")?.textContent).toBe("12.5");
    expect(container.querySelector("[data-cost-delta]")?.textContent).toBe("--");
    expect(container.querySelector("[data-cost-delta-label]")?.textContent).toBe(
      "开销变化",
    );
    expect(container.querySelector("[data-delta-tone]")?.getAttribute("data-delta-tone")).toBe(
      "empty",
    );
  });

  it("开销增加 / 中性 / without=0 不可比", () => {
    const up = render(
      <CostCompareCard withoutCostPct={20} withCostPct={30} pairValid={true} />,
    );
    expect(up.container.querySelector("[data-cost-delta]")?.textContent).toBe("50.0");
    expect(up.container.querySelector("[data-cost-delta-label]")?.textContent).toBe(
      "开销增加",
    );
    expect(up.container.querySelector("[data-delta-tone]")?.getAttribute("data-delta-tone")).toBe(
      "up",
    );

    const zero = render(
      <CostCompareCard withoutCostPct={20} withCostPct={20} pairValid={true} />,
    );
    expect(zero.container.querySelector("[data-cost-delta]")?.textContent).toBe("0.0");
    expect(zero.container.querySelector("[data-cost-delta-label]")?.textContent).toBe(
      "开销变化",
    );
    expect(zero.container.querySelector("[data-delta-tone]")?.getAttribute("data-delta-tone")).toBe(
      "zero",
    );

    const invalid = render(
      <CostCompareCard withoutCostPct={0} withCostPct={10} pairValid={true} />,
    );
    expect(invalid.container.querySelector("[data-cost-delta]")?.textContent).toBe("--");
  });

  it("变化值槽可完整容纳 -99.9 且槽内右对齐，百分号仍紧跟数字", () => {
    const { container } = render(
      <CostCompareCard withoutCostPct={100} withCostPct={0.1} pairValid={true} />,
    );
    const num = container.querySelector("[data-cost-delta]") as HTMLElement | null;
    expect(num?.textContent).toBe("-99.9");
    expect(num?.classList.contains("case3v2-cost-delta__num")).toBe(true);
    expect(num?.nextElementSibling?.classList.contains("case3v2-cost-delta__unit")).toBe(
      true,
    );
    expect(num?.nextElementSibling?.textContent).toBe("%");
    const css = readFileSync("src/cases/case3-v2/case3v2.css", "utf8") as string;
    const block = css.match(
      /\.case3v2-page \.case3v2-cost-delta__num \{[^}]+\}/,
    )?.[0];
    expect(block).toBeDefined();
    expect(block).toMatch(/width:\s*72px/);
    expect(block).toMatch(/min-width:\s*72px/);
    expect(block).toMatch(/text-align:\s*right/);
    expect(block).not.toMatch(/text-align:\s*center/);
    expect(block).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });
});
