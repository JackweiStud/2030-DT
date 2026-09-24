/**
 * 热力矩阵：无效格按格处理，不再整张取消 canvas。
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeatmapCard } from "../src/cases/case2/components/HeatmapCard";
import { loadCase2RuntimeConfig } from "../src/cases/case2/metrics/heatmapConfig";

const config = loadCase2RuntimeConfig({});

describe("case2 heatmap invalid cells", () => {
  it("矩阵含 -1 时仍渲染热力 canvas，色标排除 -1", () => {
    const { container } = render(
      <HeatmapCard
        matrix={[
          [1, -1],
          [2, 4],
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
    expect(legend?.textContent).not.toContain("-1");
  });

  it("无无效格时渲染热力 canvas 与色标", () => {
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
  });

  it("整张皆 -1 时仍画 canvas，色标为 —", () => {
    const { container } = render(
      <HeatmapCard
        matrix={[
          [-1, -1],
          [-1, -1],
        ]}
        config={config}
        empty={false}
        metricClass="path"
        label="path"
        variant="initial"
      />,
    );
    expect(container.querySelector(".heatmap-canvas")).not.toBeNull();
    const legend = container.querySelector(".heatmap-card__legend");
    expect(legend?.textContent).toContain("—");
  });
});
