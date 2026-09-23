/**
 * 热力矩阵含哨兵 -1 时不画叠层，走空槽底图。
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeatmapCard } from "../src/cases/case2/components/HeatmapCard";
import { loadCase2RuntimeConfig } from "../src/cases/case2/metrics/heatmapConfig";

const config = loadCase2RuntimeConfig({});

describe("case2 heatmap invalid sentinel", () => {
  it("矩阵含 -1 时不渲染热力 canvas", () => {
    const { container } = render(
      <HeatmapCard
        matrix={[
          [1, -1],
          [2, 3],
        ]}
        config={config}
        empty={false}
        metricClass="rss"
        label="RSS"
        variant="initial"
      />,
    );
    expect(container.querySelector(".heatmap-canvas")).toBeNull();
    expect(container.querySelector(".heatmap-base")).not.toBeNull();
    const emptyLegend = container.querySelector(".heatmap-card__legend");
    expect(emptyLegend).not.toBeNull();
    expect(emptyLegend?.textContent).toContain("—");
    expect(emptyLegend?.querySelectorAll("i")).toHaveLength(5);
  });

  it("无哨兵时渲染热力 canvas", () => {
    const { container } = render(
      <HeatmapCard
        matrix={[
          [1, 2],
          [3, 4],
        ]}
        config={config}
        empty={false}
        metricClass="rss"
        label="RSS"
        variant="initial"
      />,
    );
    expect(container.querySelector(".heatmap-canvas")).not.toBeNull();
    expect(container.querySelector(".heatmap-base")).toBeNull();
    const legend = container.querySelector(".heatmap-card__legend");
    expect(legend).not.toBeNull();
    expect(legend?.textContent).toContain("1.0");
    expect(legend?.textContent).toContain("4.0");
    expect(legend?.querySelectorAll("i")).toHaveLength(5);
  });
});
