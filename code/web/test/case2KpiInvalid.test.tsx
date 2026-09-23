/**
 * case2 KPI 哨兵 -1：不进 CDF/均值；全无效不画图。
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CdfChart } from "../src/cases/case2/components/CdfChart";
import { KpiComparisonRow } from "../src/cases/case2/components/KpiComparisonRow";
import { MeanBarChart } from "../src/cases/case2/components/MeanBarChart";

describe("case2 KPI invalid sentinel", () => {
  it("全为 -1 时不渲染 CDF 与平均误差图", () => {
    const { container } = render(
      <KpiComparisonRow
        metric="rss"
        initialKpi={[-1, -1]}
        calibratedKpi={[-1]}
        cdfPointCap={256}
        showComparison
      />,
    );
    expect(container.querySelector(".chart-row")).toBeNull();
    expect(container.querySelector(".cdf-svg")).toBeNull();
    expect(container.querySelector(".kpi-row")?.classList.contains("is-charts-hidden")).toBe(
      true,
    );
  });

  it("仅校正侧有效时仍画图", () => {
    const { container } = render(
      <KpiComparisonRow
        metric="rss"
        initialKpi={[-1, -1]}
        calibratedKpi={[-1, 4]}
        cdfPointCap={256}
        showComparison
      />,
    );
    expect(container.querySelector(".chart-row")).not.toBeNull();
    expect(container.querySelector(".cdf-svg")).not.toBeNull();
  });

  it("混入 -1 时均值只算有效样本", () => {
    const { container } = render(
      <MeanBarChart initialKpi={[2, -1, 4]} calibratedKpi={null} showReduction={false} />,
    );
    expect(container.querySelector(".mean-value")?.textContent).toBe("3.0");
  });

  it("混入 -1 时 CDF 与去掉哨兵后一致，x 不落到 -1", () => {
    const mixed = render(
      <CdfChart initialKpi={[3, -1, 1]} calibratedKpi={null} cdfPointCap={256} />,
    );
    const filtered = render(
      <CdfChart initialKpi={[3, 1]} calibratedKpi={null} cdfPointCap={256} />,
    );
    const mixedPath = mixed.container.querySelector(".cdf-svg path")?.getAttribute("d");
    const filteredPath = filtered.container
      .querySelector(".cdf-svg path")
      ?.getAttribute("d");
    expect(mixedPath).toBeTruthy();
    expect(mixedPath).toBe(filteredPath);
    const ticks = [...mixed.container.querySelectorAll(".cdf-axis-label--x")].map(
      (node) => node.textContent,
    );
    expect(ticks.some((text) => text === "-1")).toBe(false);
  });
});
