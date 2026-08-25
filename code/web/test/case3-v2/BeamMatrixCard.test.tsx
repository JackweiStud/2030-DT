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
} from "../../src/cases/case3-v2/v2BeamGrid";
import { BeamCrosshair } from "../../src/cases/case3-v2/components/BeamCrosshair";
import type { Case3Point } from "../../src/cases/case3/types";

function point(partial: Partial<Case3Point> = {}): Case3Point {
  return {
    no: 4,
    ue: { x: 1, y: 2, z: 0 },
    selectedBeamId: 122,
    throughputGbps: 8,
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
  });
});

describe("BeamMatrixCard", () => {
  it("初始为空网格", () => {
    const { container } = render(<BeamMatrixCard />);
    expect(container.querySelector("[data-point-value]")?.textContent).toBe("P--");
    expect(container.querySelector("[data-beam-id]")?.textContent).toBe("--");
    expect(container.querySelectorAll(".is-scan")).toHaveLength(0);
    expect(container.querySelectorAll(".is-best")).toHaveLength(0);
    expect(container.querySelector("[data-beam-crosshair]")).toBeNull();
  });

  it("扫描波 is-scan，最优波 is-best，同格 best 优先", () => {
    const { container } = render(
      <BeamMatrixCard point={point({ scanBeamIds: [0, 122], selectedBeamId: 122 })} />,
    );
    expect(container.querySelector("[data-point-value]")?.textContent).toBe("P4");
    expect(container.querySelector("[data-beam-id]")?.textContent).toBe("122");
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
          scanBeamIds: [-1, 256, 1.5, 3],
          selectedBeamId: 999,
        })}
      />,
    );
    expect(container.querySelector("[data-beam-id]")?.textContent).toBe("--");
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
});
