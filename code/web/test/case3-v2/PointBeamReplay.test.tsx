/**
 * Case3 V2 回溯：真实 no/BeamID，自动跟随最近 20 点。
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PointBeamReplay } from "../../src/cases/case3-v2/components/PointBeamReplay";
import type { Case3Point } from "../../src/cases/case3/types";
// @ts-expect-error vitest 跑在 Node，tsconfig 未纳入 @types/node
import { readFileSync } from "fs";

const noop = () => undefined;

function point(no: number, beam = no): Case3Point {
  return {
    no,
    ue: { x: no, y: 2, z: 0 },
    selectedBeamId: beam,
    throughputGbps: 8,
    scanBeamIds: [beam],
  };
}

function renderReplay(withoutPoints: Case3Point[], routeNos?: number[]) {
  const nos = routeNos ?? Array.from({ length: 25 }, (_, i) => i + 1);
  return render(
    <PointBeamReplay
      routeNos={nos}
      withoutPoints={withoutPoints}
      withoutStatus="测试中"
      withStatus="等待无DT测试完成"
      startWithoutEnabled={false}
      startWithEnabled={false}
      reinitWithoutEnabled={false}
      reinitWithEnabled={false}
      withoutPlayBusy
      withPlayBusy={false}
      onStartWithout={noop}
      onStartWith={noop}
      onReinitWithout={noop}
      onReinitWith={noop}
    />,
  );
}

describe("PointBeamReplay without", () => {
  it("按真实 point.no 显示最优波 BeamID，空点 --，不出现 X/Y", () => {
    const { container } = renderReplay([point(1, 4), point(2, 9)]);
    const values = [...container.querySelectorAll("[data-replay-wo-value]")].map(
      (el) => el.textContent,
    );
    expect(values[0]).toBe("4");
    expect(values[1]).toBe("9");
    expect(values.slice(2).every((v) => v === "--")).toBe(true);
    expect(container.textContent).not.toMatch(/x\s*\(/i);
    expect(container.textContent).not.toMatch(/y\s*\(/i);
    expect(container.querySelector('[data-status="without"]')?.textContent).toContain(
      "测试中",
    );
    expect(container.querySelector("[data-status-ellipsis]")).not.toBeNull();
    const css = readFileSync("src/cases/case3-v2/case3v2.css", "utf8") as string;
    expect(css).toContain("1.6s ease-in-out infinite");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*case3v2-status-ellipsis__track[\s\S]*width: 1\.15em/,
    );
  });

  it("超过 20 点时窗口跟随最近 20 个真实 no", () => {
    const points = Array.from({ length: 22 }, (_, i) => point(i + 1, 100 + i));
    const { container } = renderReplay(points);
    const headers = [...container.querySelectorAll("[data-replay-headers] .case3v2-replay-col")].map(
      (el) => el.textContent,
    );
    expect(headers).toHaveLength(20);
    expect(headers[0]).toBe("P3");
    expect(headers[19]).toBe("P22");
    const values = [...container.querySelectorAll("[data-replay-wo-value]")].map(
      (el) => el.textContent,
    );
    expect(values[0]).toBe("102");
    expect(values[19]).toBe("121");
  });
});
