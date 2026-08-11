/**
 * Case3 波束网格组件测试。
 * 验证单 SVG 路径渲染和预测图例语义。
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BeamScanCard } from "../../src/cases/case3/components/BeamScanCard";
import type { Case3Point } from "../../src/cases/case3/types";

function withPoint(selectedBeamId: number): Case3Point {
  return {
    no: 1,
    ue: { x: 1, y: 2, z: 0 },
    selectedBeamId,
    throughputGbps: 9.1,
    reflection: { x: 0, y: 0, z: 0, los: true },
  };
}

describe("BeamScanCard", () => {
  it("16×16 网格由少量 SVG path 渲染，不创建 256 个叶子节点", () => {
    const view = render(
      <BeamScanCard side="without" point={null} peerPoint={null} />,
    );

    expect(view.container.querySelectorAll(".case3-scan-grid")).toHaveLength(1);
    expect(view.container.querySelectorAll(".case3-scan-path")).toHaveLength(1);
    expect(view.container.querySelectorAll(".case3-scan-dot")).toHaveLength(0);
  });

  it("预测图例按同 no 的 BeamId 标记成功或失败", () => {
    const current = withPoint(4);
    const view = render(
      <BeamScanCard
        side="with"
        point={current}
        peerPoint={{ ...current, selectedBeamId: 4 }}
      />,
    );
    expect(
      view.container
        .querySelector(".case3-beam-legend__item--predict")
        ?.classList.contains("is-ok"),
    ).toBe(true);

    view.rerender(
      <BeamScanCard
        side="with"
        point={current}
        peerPoint={{ ...current, selectedBeamId: 7 }}
      />,
    );
    expect(
      view.container
        .querySelector(".case3-beam-legend__item--predict")
        ?.classList.contains("is-fail"),
    ).toBe(true);
    expect(
      view.container.querySelectorAll(".case3-scan-path--predict-fail"),
    ).toHaveLength(1);
    expect(
      view.container.querySelectorAll(".case3-scan-path--predict"),
    ).toHaveLength(0);
  });
});
