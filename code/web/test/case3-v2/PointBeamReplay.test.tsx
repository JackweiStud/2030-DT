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

function renderReplay(
  withoutPoints: Case3Point[],
  extras: {
    routeNos?: number[];
    withPoints?: Case3Point[];
    withPeerPoints?: Case3Point[] | null;
    progressSide?: "without" | "with";
  } = {},
) {
  const nos = extras.routeNos ?? Array.from({ length: 25 }, (_, i) => i + 1);
  return render(
    <PointBeamReplay
      routeNos={nos}
      withoutPoints={withoutPoints}
      withPoints={extras.withPoints}
      withPeerPoints={extras.withPeerPoints}
      progressSide={extras.progressSide}
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
    expect(container.querySelector("[data-replay-check]")).toBeNull();
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

describe("PointBeamReplay with", () => {
  it("按相同 no 显示预测波，正确/错误/缺 peer 用对应 PNG class", () => {
    const without = [point(1, 10), point(2, 20), point(3, 30)];
    const withPts = [point(1, 10), point(2, 21), point(3, 30)];
    const { container } = renderReplay(without, {
      withPoints: withPts,
      withPeerPoints: [point(3, 30), point(1, 10), point(2, 20)],
    });
    const values = [...container.querySelectorAll("[data-replay-w-value]")].map(
      (el) => el.textContent,
    );
    expect(values.slice(0, 3)).toEqual(["10", "21", "30"]);
    expect(values.slice(3).every((v) => v === "--")).toBe(true);
    const tones = [...container.querySelectorAll("[data-replay-w-tone]")].map((el) =>
      el.getAttribute("data-replay-w-tone"),
    );
    expect(tones.slice(0, 3)).toEqual(["ok", "fail", "ok"]);
    expect(container.querySelectorAll(".case3v2-replay-cell--with.is-ok")).toHaveLength(2);
    expect(container.querySelectorAll(".case3v2-replay-cell--with.is-fail")).toHaveLength(1);
    const checks = [...container.querySelectorAll("[data-replay-check]")];
    expect(checks.map((el) => el.getAttribute("data-replay-check"))).toEqual([
      "ok",
      "fail",
      "ok",
    ]);
    expect(checks[0]?.classList.contains("is-ok")).toBe(true);
    expect(checks[1]?.classList.contains("is-fail")).toBe(true);
    expect((checks[0] as HTMLElement).style.left).toBe("34px");
    expect((checks[1] as HTMLElement).style.left).toBe("119px");
    expect((checks[2] as HTMLElement).style.left).toBe("204px");
    const css = readFileSync("src/cases/case3-v2/case3v2.css", "utf8") as string;
    expect(css).toContain("cell-with-ok.png");
    expect(css).toContain("cell-with-fail.png");
    expect(css).toContain("cell-with-idle.png");
    expect(css).toContain("cell-icon-ok.png");
    expect(css).toContain("cell-icon-fail.png");
    const checkBlock = css.match(/\.case3v2-page \.case3v2-check \{[^}]+\}/)?.[0];
    expect(checkBlock).toMatch(/top:\s*50px/);
    expect(checkBlock).toMatch(/width:\s*14px/);
    expect(checkBlock).toMatch(/height:\s*14px/);
  });

  it("缺同 no peer 时用 idle，不写待比对，不按下标配对", () => {
    const { container } = renderReplay([point(1, 10), point(2, 20)], {
      withPoints: [point(1, 99)],
      withPeerPoints: [point(2, 99)],
    });
    expect(container.querySelectorAll("[data-replay-w-value]")[0]?.textContent).toBe("99");
    expect(
      container.querySelectorAll("[data-replay-w-tone]")[0]?.getAttribute("data-replay-w-tone"),
    ).toBe("idle");
    expect(container.querySelector(".case3v2-replay-cell--with.is-ok")).toBeNull();
    expect(container.querySelector(".case3v2-replay-cell--with.is-fail")).toBeNull();
    expect(container.querySelector("[data-replay-check]")).toBeNull();
    expect(container.textContent).not.toContain("待比对");
    expect(container.querySelectorAll("[data-replay-wo-value]")[0]?.textContent).toBe("10");
  });

  it("With 进度驱动窗口：route31 + With2 显示 P1..P20，前 2 列完成，Without 历史仍在", () => {
    const routeNos = Array.from({ length: 31 }, (_, i) => i + 1);
    const without = routeNos.map((no) => point(no, no * 10));
    const withPts = [point(1, 10), point(2, 21)];
    const { container } = renderReplay(without, {
      routeNos,
      withPoints: withPts,
      withPeerPoints: without,
      progressSide: "with",
    });
    const headers = [...container.querySelectorAll("[data-replay-headers] .case3v2-replay-col")];
    expect(headers.map((el) => el.textContent).slice(0, 20)).toEqual(
      Array.from({ length: 20 }, (_, i) => `P${i + 1}`),
    );
    expect(headers.filter((el) => el.classList.contains("is-done"))).toHaveLength(2);
    expect(container.querySelector("[data-replay-done]")?.getAttribute("data-replay-done")).toBe(
      "2",
    );
    const progress = container.querySelector("[data-replay-progress]") as HTMLElement | null;
    expect(progress?.style.display).toBe("block");
    expect(progress?.style.width).toBe("167px");
    const wo = [...container.querySelectorAll("[data-replay-wo-value]")].map((el) => el.textContent);
    expect(wo.slice(0, 3)).toEqual(["10", "20", "30"]);
    const w = [...container.querySelectorAll("[data-replay-w-value]")].map((el) => el.textContent);
    expect(w.slice(0, 3)).toEqual(["10", "21", "--"]);
    const checks = [...container.querySelectorAll("[data-replay-check]")];
    expect(checks.map((el) => el.getAttribute("data-replay-check"))).toEqual(["ok", "fail"]);
    expect(checks[0]?.getAttribute("data-replay-check-slot")).toBe("0");
    expect(checks[1]?.getAttribute("data-replay-check-slot")).toBe("1");
    expect((checks[0] as HTMLElement).style.left).toBe("34px");
    expect((checks[1] as HTMLElement).style.left).toBe("119px");
  });

  it("With>20 时窗口跟随最新 20 个 With 点，Without 同行仍按 no 填历史", () => {
    const routeNos = Array.from({ length: 31 }, (_, i) => i + 1);
    const without = routeNos.map((no) => point(no, no * 10));
    const withPts = Array.from({ length: 22 }, (_, i) =>
      point(i + 1, i + 1 === 2 ? 21 : (i + 1) * 10),
    );
    const { container } = renderReplay(without, {
      routeNos,
      withPoints: withPts,
      withPeerPoints: without,
      progressSide: "with",
    });
    const headers = [...container.querySelectorAll("[data-replay-headers] .case3v2-replay-col")].map(
      (el) => el.textContent,
    );
    expect(headers[0]).toBe("P3");
    expect(headers[19]).toBe("P22");
    expect(container.querySelector("[data-replay-done]")?.getAttribute("data-replay-done")).toBe(
      "20",
    );
    const wo = [...container.querySelectorAll("[data-replay-wo-value]")].map((el) => el.textContent);
    expect(wo[0]).toBe("30");
    expect(wo[19]).toBe("220");
    const w = [...container.querySelectorAll("[data-replay-w-value]")].map((el) => el.textContent);
    expect(w[0]).toBe("30");
    expect(w[19]).toBe("220");
    const checks = [...container.querySelectorAll("[data-replay-check]")];
    expect(checks).toHaveLength(20);
    expect(checks[0]?.getAttribute("data-replay-check-no")).toBe("3");
    expect(checks[0]?.getAttribute("data-replay-check-slot")).toBe("0");
    expect((checks[0] as HTMLElement).style.left).toBe("34px");
    expect(checks[19]?.getAttribute("data-replay-check-no")).toBe("22");
    expect(checks[19]?.getAttribute("data-replay-check-slot")).toBe("19");
    expect((checks[19] as HTMLElement).style.left).toBe(`${34 + 19 * 85}px`);
    expect(container.querySelector('[data-replay-check-no="2"]')).toBeNull();
  });
});
