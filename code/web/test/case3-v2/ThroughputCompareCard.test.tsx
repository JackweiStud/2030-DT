/**
 * Case3 V2 吞吐折线分段：routeNos 顺序相邻才连线。
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ThroughputCompareCard } from "../../src/cases/case3-v2/components/ThroughputCompareCard";
import { segmentedThroughputPath } from "../../src/cases/case3-v2/v2ThroughputPath";
import type { Case3Point } from "../../src/cases/case3/types";

function point(no: number, value: number): Case3Point {
  return {
    no,
    ue: { x: no, y: 0, z: 0 },
    selectedBeamId: 1,
    throughputGbps: value,
    scanBeamIds: [0],
  };
}

describe("segmentedThroughputPath", () => {
  it("按 routeNos 下标相邻连线，不用 no+1", () => {
    const routeNos = [10, 30, 20];
    const adjacent = segmentedThroughputPath(routeNos, [
      { no: 10, x: 1, y: 1 },
      { no: 30, x: 2, y: 2 },
    ]);
    expect(adjacent).toBe("M1 1 L2 2");

    const skipped = segmentedThroughputPath(routeNos, [
      { no: 10, x: 1, y: 1 },
      { no: 20, x: 3, y: 3 },
    ]);
    expect(skipped).toBe("M1 1 M3 3");
    expect(skipped).not.toContain("L");
  });
});

describe("ThroughputCompareCard without", () => {
  it("缺点不补 0，且不跨缺口画虚假连线", () => {
    const { container } = render(
      <ThroughputCompareCard
        routeNos={[1, 2, 3, 4]}
        withoutPoints={[point(1, 8), point(3, 9)]}
      />,
    );
    const d = container.querySelector("[data-thr-wo]")?.getAttribute("d") ?? "";
    expect((d.match(/M/g) ?? []).length).toBe(2);
    expect(d.includes("L")).toBe(false);
    expect(container.querySelectorAll("[data-thr-dot-wo]")).toHaveLength(2);
    expect(
      [...container.querySelectorAll("[data-thr-dot-wo]")].map((el) =>
        el.getAttribute("data-thr-no"),
      ),
    ).toEqual(["1", "3"]);
    expect(container.querySelector("[data-thr-w]")?.getAttribute("d")).toBeNull();
  });

  it("相邻真实点仍用 L 连接", () => {
    const { container } = render(
      <ThroughputCompareCard
        routeNos={[1, 2, 3, 4]}
        withoutPoints={[point(1, 8), point(2, 9)]}
      />,
    );
    const d = container.querySelector("[data-thr-wo]")?.getAttribute("d") ?? "";
    expect((d.match(/M/g) ?? []).length).toBe(1);
    expect(d.includes("L")).toBe(true);
  });

  it("Y 轴按真实最大值扩展，X 域仍用完整路线", () => {
    const { container } = render(
      <ThroughputCompareCard
        routeNos={[1, 2, 3, 4, 5]}
        withoutPoints={[point(1, 20)]}
      />,
    );
    const yTicks = [...container.querySelectorAll("[data-thr-y-tick]")].map(
      (el) => el.textContent,
    );
    expect(yTicks[0]).toBe("0");
    expect(Number(yTicks[yTicks.length - 1])).toBeGreaterThan(12);
    const xTicks = [...container.querySelectorAll("[data-thr-x-tick]")].map(
      (el) => el.textContent,
    );
    expect(xTicks[0]).toBe("1");
    expect(xTicks[xTicks.length - 1]).toBe("5");
  });
});
