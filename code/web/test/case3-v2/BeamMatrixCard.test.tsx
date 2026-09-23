/**
 * Case3 V2 波束格子映射。
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { BeamMatrixCard } from "../../src/cases/case3-v2/components/BeamMatrixCard";
import {
  beamCellOriginPx,
  beamCellRole,
  beamIdToRowCol,
  CASE3V2_BEAM_CROSSHAIR_ARM_PX,
  CASE3V2_BEAM_CROSSHAIR_BAR_PX,
  CASE3V2_BEAM_CROSSHAIR_OPACITY,
  CASE3V2_BEAM_GRID_HEIGHT_PX,
  CASE3V2_BEAM_GRID_WIDTH_PX,
  isLegalBeamId,
  legalSelectedBeamId,
  withBeamCellRole,
} from "../../src/cases/case3-v2/v2BeamGrid";
import {
  BEAM_CROSSHAIR_PALETTE,
  BeamCrosshair,
} from "../../src/cases/case3-v2/components/BeamCrosshair";
import type { Case3Point } from "../../src/cases/case3/types";

function point(partial: Partial<Case3Point> = {}): Case3Point {
  return {
    no: 4,
    ue: { x: 1, y: 2, z: 0 },
    selectedBeamId: 122,
    scanBeamIds: [0, 122, 255],
    ...partial,
  };
}

describe("v2BeamGrid", () => {
  it("只接受 0-255 整数", () => {
    expect(isLegalBeamId(0)).toBe(true);
    expect(isLegalBeamId(255)).toBe(true);
    expect(isLegalBeamId(-1)).toBe(false);
    expect(isLegalBeamId(256)).toBe(false);
    expect(isLegalBeamId(1.5)).toBe(false);
    expect(legalSelectedBeamId(300)).toBeNull();
  });

  it("同格最优波优先于扫描波", () => {
    expect(beamCellRole(7, 10, [122, 0], 122)).toBe("best");
    expect(beamCellRole(0, 0, [0, 122], 122)).toBe("scan");
    expect(beamCellRole(15, 15, [255], 122)).toBe("scan");
  });

  it("BeamID 映射到格子原点", () => {
    expect(beamIdToRowCol(0)).toEqual({ row: 0, col: 0 });
    expect(beamIdToRowCol(91)).toEqual({ row: 5, col: 11 });
    expect(beamIdToRowCol(122)).toEqual({ row: 7, col: 10 });
    expect(beamIdToRowCol(255)).toEqual({ row: 15, col: 15 });
    expect(beamCellOriginPx(0, 0)).toEqual({ x: 26, y: 4.5 });
    expect(beamCellOriginPx(0, 15).x).toBeCloseTo(300, 5);
    expect(beamCellOriginPx(15, 0).y).toBeCloseTo(4.5 + 15 * 19, 5);
    expect(CASE3V2_BEAM_CROSSHAIR_ARM_PX).toBeLessThan(CASE3V2_BEAM_GRID_WIDTH_PX);
    expect(CASE3V2_BEAM_CROSSHAIR_OPACITY).toBeGreaterThan(0);
    expect(CASE3V2_BEAM_CROSSHAIR_OPACITY).toBeLessThanOrEqual(1);
    expect(withBeamCellRole(0, 0, 0, 255)).toBe("pred");
    expect(withBeamCellRole(15, 15, 0, 255)).toBe("best");
  });
});

describe("BeamMatrixCard", () => {
  it("初始为空网格", () => {
    const { container } = render(<BeamMatrixCard />);
    expect(container.querySelector("[data-point-value]")?.textContent).toBe("P--");
    expect(container.querySelector("[data-beam-id-value]")?.textContent).toBe("--");
    expect(container.querySelectorAll(".is-scan")).toHaveLength(0);
    expect(container.querySelectorAll(".is-best")).toHaveLength(0);
    expect(container.querySelector("[data-beam-crosshair]")).toBeNull();
  });

  it("扫描波 is-scan，最优波 is-best，同格 best 优先", () => {
    const { container } = render(
      <BeamMatrixCard point={point({ scanBeamIds: [0, 122], selectedBeamId: 122 })} />,
    );
    expect(container.querySelector("[data-point-value]")?.textContent).toBe("P4");
    expect(container.querySelector("[data-beam-id-value]")?.textContent).toBe("122");
    const best = container.querySelector('[data-rc="7,10"]');
    const scan = container.querySelector('[data-rc="0,0"]');
    expect(best?.classList.contains("is-best")).toBe(true);
    expect(best?.classList.contains("is-scan")).toBe(false);
    expect(scan?.classList.contains("is-scan")).toBe(true);
    expect(container.querySelectorAll(".is-best")).toHaveLength(1);
    expect(container.querySelectorAll(".is-scan")).toHaveLength(1);
    const crosshair = container.querySelector("[data-beam-crosshair]");
    expect(crosshair?.getAttribute("data-tone")).toBe("neutral");
    expect(crosshair?.getAttribute("data-beam-id")).toBe("122");
    expect(container.querySelector('[data-crosshair-mark="best"]')).not.toBeNull();
  });

  it("非法 BeamID 不污染格子，标签为 --", () => {
    const { container } = render(
      <BeamMatrixCard
        point={point({
          scanBeamIds: [256, 257, 1.5, 3],
          selectedBeamId: 999,
        })}
      />,
    );
    expect(container.querySelector("[data-beam-id-value]")?.textContent).toBe("--");
    expect(container.querySelectorAll(".is-best")).toHaveLength(0);
    expect(container.querySelectorAll(".is-scan")).toHaveLength(1);
    expect(container.querySelector('[data-rc="0,3"]')?.classList.contains("is-scan")).toBe(
      true,
    );
    expect(container.querySelector("[data-beam-crosshair]")).toBeNull();
  });

  it("tone / marker 透传给准星", () => {
    const { container } = render(
      <BeamMatrixCard
        point={point()}
        crosshairTone="success"
        crosshairMarker="pred"
      />,
    );
    expect(container.querySelector("[data-beam-crosshair]")?.getAttribute("data-tone")).toBe(
      "success",
    );
    expect(container.querySelector('[data-crosshair-mark="pred"]')).not.toBeNull();
  });

  it("准星臂短于整行，槽窄于格子", () => {
    const { container } = render(
      <BeamMatrixCard point={point({ selectedBeamId: 91, scanBeamIds: [80, 96] })} />,
    );
    const rects = [...container.querySelectorAll(".case3v2-beam-crosshair__svg rect")];
    const hBar = rects[rects.length - 2];
    const vBar = rects[rects.length - 1];
    expect(hBar).toBeDefined();
    expect(vBar).toBeDefined();
    if (!hBar || !vBar) return;
    expect(Number(hBar.getAttribute("width"))).toBeLessThan(CASE3V2_BEAM_GRID_WIDTH_PX);
    expect(Number(hBar.getAttribute("height"))).toBe(CASE3V2_BEAM_CROSSHAIR_BAR_PX);
    expect(Number(vBar.getAttribute("height"))).toBeLessThan(CASE3V2_BEAM_GRID_HEIGHT_PX);
    expect(Number(vBar.getAttribute("width"))).toBe(CASE3V2_BEAM_CROSSHAIR_BAR_PX);
    expect(
      (container.querySelector(".case3v2-beam-crosshair__svg") as SVGElement | null)?.style
        .opacity,
    ).toBe(String(CASE3V2_BEAM_CROSSHAIR_OPACITY));
  });
});

describe("BeamCrosshair", () => {
  it("tone 与 marker 可参数化", () => {
    const { container, rerender } = render(
      <BeamCrosshair beamId={91} tone="success" marker="pred" />,
    );
    const el = container.querySelector("[data-beam-crosshair]");
    expect(el?.getAttribute("data-tone")).toBe("success");
    expect(el?.getAttribute("data-beam-id")).toBe("91");
    expect(container.querySelector('[data-crosshair-mark="pred"]')).not.toBeNull();

    rerender(<BeamCrosshair beamId={91} tone="fail" marker="none" />);
    expect(container.querySelector("[data-beam-crosshair]")?.getAttribute("data-tone")).toBe(
      "fail",
    );
    expect(container.querySelector("[data-crosshair-mark]")).toBeNull();
  });

  it("非法 BeamID 不渲染", () => {
    const { container } = render(<BeamCrosshair beamId={256} tone="neutral" />);
    expect(container.querySelector("[data-beam-crosshair]")).toBeNull();
  });

  it("截图关键色在整棵 SVG 克隆后仍为字面量 rgba，不含 CSS var", () => {
    const { container } = render(
      <BeamCrosshair beamId={122} tone="success" marker="none" />,
    );
    const svg = container.querySelector(".case3v2-beam-crosshair__svg");
    expect(svg).not.toBeNull();
    const clone = svg?.cloneNode(true) as SVGElement;
    const stops = [...clone.querySelectorAll("stop")];
    expect(stops.length).toBeGreaterThan(0);
    for (const stop of stops) {
      const color = stop.getAttribute("stop-color");
      expect(color).toMatch(/^rgba?\(/);
      expect(color).not.toContain("var(");
    }
    expect(
      stops.some(
        (s) => s.getAttribute("stop-color") === BEAM_CROSSHAIR_PALETTE.success.stroke,
      ),
    ).toBe(true);
    expect(
      stops.some(
        (s) => s.getAttribute("stop-color") === BEAM_CROSSHAIR_PALETTE.success.glowCore,
      ),
    ).toBe(true);

    const glow = clone.querySelector(".case3v2-beam-crosshair__glow") as SVGGElement | null;
    expect(glow).not.toBeNull();
    expect(glow?.style.mixBlendMode).toBe("screen");
  });

  it("fail tone 克隆后仍保留红色字面量", () => {
    const { container } = render(
      <BeamCrosshair beamId={21} tone="fail" marker="none" />,
    );
    const clone = (
      container.querySelector(".case3v2-beam-crosshair__svg") as SVGElement
    ).cloneNode(true) as SVGElement;
    const colors = [...clone.querySelectorAll("stop")].map((s) =>
      s.getAttribute("stop-color"),
    );
    expect(colors).toContain(BEAM_CROSSHAIR_PALETTE.fail.stroke);
    expect(colors).toContain(BEAM_CROSSHAIR_PALETTE.fail.fill);
    expect(colors.every((c) => c && !c.includes("var("))).toBe(true);
  });
});

describe("BeamMatrixCard with", () => {
  it("match：同格预测波、绿色准星、预测成功，无扫描波", () => {
    const { container } = render(
      <BeamMatrixCard
        mode="with"
        point={point({ selectedBeamId: 122, scanBeamIds: [0, 5] })}
        peerPoint={point({ no: 4, selectedBeamId: 122 })}
      />,
    );
    expect(container.querySelector("[data-beam-mode]")?.getAttribute("data-beam-mode")).toBe(
      "with",
    );
    expect(container.querySelector("[data-legend-pred]")?.textContent).toBe("预测波");
    expect(container.querySelector("[data-legend-best]")?.textContent).toBe("最优波");
    expect(container.querySelector("[data-legend-scan]")).toBeNull();
    expect(container.querySelector("[data-beam-badge]")?.textContent).toBe("预测成功");
    expect(container.querySelector("[data-beam-id-value]")?.textContent).toBe("122");
    const cell = container.querySelector('[data-rc="7,10"]');
    expect(cell?.getAttribute("data-beam-role")).toBe("pred");
    expect(cell?.classList.contains("is-pred")).toBe(true);
    expect(cell?.classList.contains("is-best")).toBe(false);
    expect(container.querySelectorAll(".is-scan")).toHaveLength(0);
    expect(container.querySelector("[data-beam-crosshair]")?.getAttribute("data-tone")).toBe(
      "success",
    );
    expect(container.querySelector("[data-beam-crosshair]")?.getAttribute("data-beam-id")).toBe(
      "122",
    );
    expect(container.querySelector('[data-crosshair-mark="pred"]')).not.toBeNull();
  });

  it("mismatch：最优波与预测波分格，红色准星锚定预测波", () => {
    const { container } = render(
      <BeamMatrixCard
        mode="with"
        point={point({ no: 4, selectedBeamId: 0 })}
        peerPoint={point({ no: 4, selectedBeamId: 255 })}
      />,
    );
    expect(container.querySelector("[data-beam-badge]")?.textContent).toBe("预测失败");
    expect(container.querySelector("[data-beam-id-value]")?.textContent).toBe("0");
    expect(container.querySelector('[data-rc="0,0"]')?.getAttribute("data-beam-role")).toBe(
      "pred",
    );
    expect(container.querySelector('[data-rc="15,15"]')?.getAttribute("data-beam-role")).toBe(
      "best",
    );
    expect(container.querySelector("[data-beam-crosshair]")?.getAttribute("data-tone")).toBe(
      "fail",
    );
    expect(container.querySelector("[data-beam-crosshair]")?.getAttribute("data-beam-id")).toBe(
      "0",
    );
  });

  it("no peer：隐藏徽标和准星，只显示预测波", () => {
    const { container } = render(
      <BeamMatrixCard
        mode="with"
        point={point({ selectedBeamId: 91 })}
        peerPoint={null}
      />,
    );
    expect(container.querySelector("[data-beam-badge]")).toBeNull();
    expect(container.querySelector("[data-beam-crosshair]")).toBeNull();
    expect(container.querySelector("[data-beam-id-value]")?.textContent).toBe("91");
    expect(container.querySelector('[data-rc="5,11"]')?.classList.contains("is-pred")).toBe(
      true,
    );
    expect(container.querySelectorAll(".is-best")).toHaveLength(0);
    expect(container.textContent).not.toContain("待比对");
  });

  it("peer 不同 no 视为无对照，不按下标误配", () => {
    const { container } = render(
      <BeamMatrixCard
        mode="with"
        point={point({ no: 4, selectedBeamId: 10 })}
        peerPoint={point({ no: 9, selectedBeamId: 10 })}
      />,
    );
    expect(container.querySelector("[data-beam-badge]")).toBeNull();
    expect(container.querySelector("[data-beam-crosshair]")).toBeNull();
    expect(container.querySelector('[data-rc="0,10"]')?.classList.contains("is-pred")).toBe(
      true,
    );
  });
});
