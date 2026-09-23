/**
 * Case3 V2 BA 卡：主文案在独立 overlay，不被 fill 宽度裁切。
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BeamAccuracyCard } from "../../src/cases/case3-v2/components/BeamAccuracyCard";

function assertMainOnOverlay(container: HTMLElement, pct: string) {
  const num = container.querySelector("[data-ba-pct]");
  expect(num?.textContent).toBe(pct);
  expect(num?.closest("[data-ba-overlay]")).not.toBeNull();
  expect(num?.closest(".case3v2-ba-fill--ok")).toBeNull();
  expect(num?.closest(".case3v2-ba-fill--bad")).toBeNull();
}

function fillWidth(container: HTMLElement, cls: string): string {
  return (container.querySelector(cls) as HTMLElement | null)?.style.width ?? "";
}

describe("Case3V2 BeamAccuracyCard overlay", () => {
  it("baseline=null 时 overlay 显示 --，fill 宽度为 0", () => {
    const { container } = render(
      <BeamAccuracyCard
        baseline={null}
        without={null}
        withSide={null}
        roundCompareEnabled={false}
      />,
    );
    assertMainOnOverlay(container, "--");
    expect(container.querySelector("[data-ba-ok]")?.textContent).toBe("--");
    expect(container.querySelector("[data-ba-bad]")?.textContent).toBe("--");
    expect(fillWidth(container, ".case3v2-ba-fill--ok")).toBe("0%");
    expect(fillWidth(container, ".case3v2-ba-fill--bad")).toBe("0%");
  });

  it("0% 时主文案仍在 overlay，不被 fill 裁切", () => {
    const { container } = render(
      <BeamAccuracyCard
        baseline={{ success: 0, total: 10 }}
        without={null}
        withSide={null}
        roundCompareEnabled={false}
      />,
    );
    assertMainOnOverlay(container, "0.0");
    expect(fillWidth(container, ".case3v2-ba-fill--ok")).toBe("0%");
    expect(fillWidth(container, ".case3v2-ba-fill--bad")).toBe("100%");
  });

  it("低百分比时主文案仍在 overlay，绿条按真实比例", () => {
    const { container } = render(
      <BeamAccuracyCard
        baseline={{ success: 1, total: 100 }}
        without={null}
        withSide={null}
        roundCompareEnabled={false}
      />,
    );
    assertMainOnOverlay(container, "1.0");
    expect(fillWidth(container, ".case3v2-ba-fill--ok")).toBe("1%");
    expect(fillWidth(container, ".case3v2-ba-fill--bad")).toBe("99%");
  });

  it("100% 时主文案仍在 overlay", () => {
    const { container } = render(
      <BeamAccuracyCard
        baseline={{ success: 10, total: 10 }}
        without={null}
        withSide={null}
        roundCompareEnabled={false}
      />,
    );
    assertMainOnOverlay(container, "100.0");
    expect(fillWidth(container, ".case3v2-ba-fill--ok")).toBe("100%");
    expect(fillWidth(container, ".case3v2-ba-fill--bad")).toBe("0%");
  });
});
