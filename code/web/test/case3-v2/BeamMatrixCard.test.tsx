/**
 * Case3 V2 波束格子映射。
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { BeamMatrixCard } from "../../src/cases/case3-v2/components/BeamMatrixCard";
import {
  beamCellRole,
  isLegalBeamId,
  legalSelectedBeamId,
} from "../../src/cases/case3-v2/v2BeamGrid";
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
});

describe("BeamMatrixCard", () => {
  it("初始为空网格", () => {
    const { container } = render(<BeamMatrixCard />);
    expect(container.querySelector("[data-point-value]")?.textContent).toBe("P--");
    expect(container.querySelector("[data-beam-id]")?.textContent).toBe("--");
    expect(container.querySelectorAll(".is-scan")).toHaveLength(0);
    expect(container.querySelectorAll(".is-best")).toHaveLength(0);
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
  });
});
