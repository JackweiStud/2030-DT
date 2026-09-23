/**
 * Case3 V2 吞吐折线分段：连续吞吐样点才连线。
 */

import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ThroughputCompareCard,
  thrHoverNoFromLocalX,
} from "../../src/cases/case3-v2/components/ThroughputCompareCard";
import { segmentedThroughputPath } from "../../src/cases/case3-v2/v2ThroughputPath";
import type { ThroughputSnapshot } from "../../src/cases/case3/types";

function thrp(samples: Array<{ no: number; gbps: number }>): ThroughputSnapshot {
  return { samples, pendingTail: false };
}

describe("segmentedThroughputPath", () => {
  it("按连续吞吐样点序号连线，不依赖结构 route", () => {
    const adjacent = segmentedThroughputPath([
      { no: 22, x: 1, y: 1 },
      { no: 23, x: 2, y: 2 },
    ]);
    expect(adjacent).toBe("M1 1 L2 2");

    const skipped = segmentedThroughputPath([
      { no: 22, x: 1, y: 1 },
      { no: 24, x: 3, y: 3 },
    ]);
    expect(skipped).toBe("M1 1 M3 3");
    expect(skipped).not.toContain("L");
  });
});

function mockThrSurface(container: HTMLElement): HTMLElement {
  const surface = container.querySelector("[data-thr-surface]") as HTMLElement;
  Object.defineProperty(surface, "offsetWidth", {
    configurable: true,
    value: 602,
  });
  surface.getBoundingClientRect = () =>
    ({
      width: 602,
      height: 171,
      top: 0,
      left: 0,
      right: 602,
      bottom: 171,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  return surface;
}

describe("thrHoverNoFromLocalX", () => {
  it("绘图区 X 映射到最近样点号，轴外为空", () => {
    expect(thrHoverNoFromLocalX(15, 1, 20)).toBeNull();
    expect(thrHoverNoFromLocalX(29.264, 1, 20)).toBe(1);
    expect(thrHoverNoFromLocalX(29.264 + 564.375, 1, 20)).toBe(20);
    expect(thrHoverNoFromLocalX(29.264, 6, 25)).toBe(6);
    expect(thrHoverNoFromLocalX(700, 1, 20)).toBeNull();
  });
});

describe("ThroughputCompareCard without", () => {
  it("缺点不补 0，且不跨缺口画虚假连线", () => {
    const { container } = render(
      <ThroughputCompareCard
        routeNos={[1, 2, 3, 4]}
        without={thrp([
          { no: 1, gbps: 8 },
          { no: 3, gbps: 9 },
        ])}
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
        without={thrp([
          { no: 1, gbps: 8 },
          { no: 2, gbps: 9 },
        ])}
      />,
    );
    const d = container.querySelector("[data-thr-wo]")?.getAttribute("d") ?? "";
    expect((d.match(/M/g) ?? []).length).toBe(1);
    expect(d.includes("L")).toBe(true);
  });

  it("Y 轴按真实最大值扩展，X 域至少覆盖完整路线", () => {
    const { container } = render(
      <ThroughputCompareCard
        routeNos={[1, 2, 3, 4, 5]}
        without={thrp([{ no: 1, gbps: 20 }])}
      />,
    );
    const yTicks = [...container.querySelectorAll("[data-thr-y-tick]")].map(
      (el) => el.textContent,
    );
    expect(yTicks[0]).toBe("24.8");
    expect(yTicks[yTicks.length - 1]).toBe("0.0");
    expect(yTicks).toEqual([
      "24.8",
      "21.7",
      "18.6",
      "15.5",
      "12.4",
      "9.3",
      "6.2",
      "3.1",
      "0.0",
    ]);
    const xTicks = [...container.querySelectorAll("[data-thr-x-tick]")].map(
      (el) => el.textContent,
    );
    expect(xTicks[0]).toBe("1");
    expect(xTicks[xTicks.length - 1]).toBe("5");
  });

  it("路线 21 点但吞吐 23 点时，横轴和曲线仍覆盖 P22/P23", () => {
    const { container } = render(
      <ThroughputCompareCard
        routeNos={Array.from({ length: 21 }, (_, i) => i + 1)}
        without={thrp([
          { no: 22, gbps: 8.7 },
          { no: 23, gbps: 8.8 },
        ])}
      />,
    );
    const xTicks = [...container.querySelectorAll("[data-thr-x-tick]")].map(
      (el) => el.textContent,
    );
    expect(xTicks.at(-1)).toBe("23");
    expect(container.querySelectorAll("[data-thr-dot-wo]")).toHaveLength(2);
    expect(container.querySelector("[data-thr-wo]")?.getAttribute("d")).toContain("L");
  });

  it("悬停有样点弹出双路读数，空槽与 leave 收起", () => {
    const { container } = render(
      <ThroughputCompareCard
        routeNos={Array.from({ length: 20 }, (_, i) => i + 1)}
        without={thrp([
          { no: 1, gbps: 8 },
          { no: 2, gbps: 8.1 },
          { no: 3, gbps: 8.2 },
          { no: 4, gbps: 8.3 },
          { no: 5, gbps: 8.4 },
        ])}
        withSamples={thrp([{ no: 2, gbps: 7.25 }])}
        showWithSeries
      />,
    );
    const surface = mockThrSurface(container);

    act(() => {
      fireEvent.mouseMove(surface, { clientX: 30, clientY: 40 });
    });
    const tip = container.querySelector("[data-thr-tip]");
    expect(surface.getAttribute("data-hover-no")).toBe("1");
    expect(tip?.getAttribute("data-thr-tip-no")).toBe("1");
    expect(tip?.textContent).toContain("有DT辅助");
    expect(tip?.textContent).toContain("无DT辅助");
    expect(tip?.textContent).toContain("8.00Gbps");
    expect(tip?.textContent).toContain("--");

    act(() => {
      fireEvent.mouseMove(surface, { clientX: 148, clientY: 40 });
    });
    expect(surface.getAttribute("data-hover-no")).toBe("5");
    expect(
      container.querySelector("[data-thr-tip]")?.getAttribute("data-thr-tip-no"),
    ).toBe("5");

    act(() => {
      fireEvent.mouseMove(surface, { clientX: 445, clientY: 40 });
    });
    expect(container.querySelector("[data-thr-tip]")).toBeNull();
    expect(surface.getAttribute("data-hover-no")).toBe("");

    act(() => {
      fireEvent.mouseMove(surface, { clientX: 30, clientY: 40 });
    });
    expect(container.querySelector("[data-thr-tip]")).not.toBeNull();
    act(() => {
      fireEvent.mouseLeave(surface);
    });
    expect(container.querySelector("[data-thr-tip]")).toBeNull();
  });
});
