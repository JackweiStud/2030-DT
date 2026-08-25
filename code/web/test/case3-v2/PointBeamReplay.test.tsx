/**
 * Case3 V2 回溯：真实 no/BeamID，自动跟随最近 20 点。
 */

import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import {
  CASE3V2_REPLAY_SLOT_PITCH,
  PointBeamReplay,
} from "../../src/cases/case3-v2/components/PointBeamReplay";
import type { Case3Point } from "../../src/cases/case3/types";
// @ts-expect-error vitest 跑在 Node，tsconfig 未纳入 @types/node
import { readFileSync } from "fs";

if (typeof PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(
      type: string,
      init: MouseEventInit & {
        pointerId?: number;
        pointerType?: string;
        isPrimary?: boolean;
      } = {},
    ) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "mouse";
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    writable: true,
    value: PointerEventPolyfill,
  });
}

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

function headersOf(container: HTMLElement): string[] {
  return [...container.querySelectorAll("[data-replay-headers] .case3v2-replay-col")].map(
    (el) => el.textContent ?? "",
  );
}

function mockSurfaceSize(el: HTMLElement, width = 1702) {
  Object.defineProperty(el, "offsetWidth", { configurable: true, value: width });
  el.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      width,
      height: 140,
      right: width,
      bottom: 140,
      toJSON: () => ({}),
    }) as DOMRect;
}

function dragSurface(container: HTMLElement, dx: number) {
  const surface = container.querySelector("[data-replay-surface]") as HTMLElement;
  mockSurfaceSize(surface);
  fireEvent.pointerDown(surface, {
    button: 0,
    buttons: 1,
    pointerId: 1,
    clientX: 800,
    clientY: 20,
  });
  fireEvent.pointerMove(surface, {
    pointerId: 1,
    buttons: 1,
    clientX: 800 + dx,
    clientY: 20,
  });
  fireEvent.pointerUp(surface, {
    pointerId: 1,
    button: 0,
    clientX: 800 + dx,
    clientY: 20,
  });
}

describe("PointBeamReplay window size", () => {
  it("N<20 补空槽且不可拖", () => {
    const routeNos = [1, 2, 3, 4, 5];
    const { container } = renderReplay([point(1, 10), point(2, 20), point(3, 30)], {
      routeNos,
    });
    const headers = headersOf(container);
    expect(headers).toHaveLength(20);
    expect(headers.slice(0, 5)).toEqual(["P1", "P2", "P3", "P4", "P5"]);
    expect(headers.slice(5).every((text) => text === "\u00A0" || text.trim() === "")).toBe(
      true,
    );
    expect(container.querySelector("[data-replay-can-drag]")?.getAttribute("data-replay-can-drag")).toBe(
      "0",
    );
    expect(container.querySelector("[data-replay-surface]")?.classList.contains("is-scrollable")).toBe(
      false,
    );
    dragSurface(container, CASE3V2_REPLAY_SLOT_PITCH);
    expect(headersOf(container)[0]).toBe("P1");
    expect(container.querySelector("[data-replay-window-start]")?.getAttribute("data-replay-window-start")).toBe(
      "0",
    );
  });

  it("N=20 显示 P1–P20 且不可拖", () => {
    const routeNos = Array.from({ length: 20 }, (_, i) => i + 1);
    const points = routeNos.map((no) => point(no, no * 10));
    const { container } = renderReplay(points, { routeNos });
    const headers = headersOf(container);
    expect(headers).toEqual(Array.from({ length: 20 }, (_, i) => `P${i + 1}`));
    expect(container.querySelector("[data-replay-can-drag]")?.getAttribute("data-replay-can-drag")).toBe(
      "0",
    );
    dragSurface(container, CASE3V2_REPLAY_SLOT_PITCH * 3);
    expect(headersOf(container)[0]).toBe("P1");
    expect(headersOf(container)[19]).toBe("P20");
  });

  it("N=31 默认最新窗口 P12–P31，可拖到 P1–P20，两行与勾叉同步", () => {
    const routeNos = Array.from({ length: 31 }, (_, i) => i + 1);
    const without = routeNos.map((no) => point(no, no * 10));
    const withPts = routeNos.map((no) => point(no, no === 12 ? 121 : no * 10));
    const { container } = renderReplay(without, {
      routeNos,
      withPoints: withPts,
      withPeerPoints: without,
      progressSide: "with",
    });
    expect(headersOf(container)[0]).toBe("P12");
    expect(headersOf(container)[19]).toBe("P31");
    expect(container.querySelector("[data-replay-can-drag]")?.getAttribute("data-replay-can-drag")).toBe(
      "1",
    );
    expect(container.querySelector("[data-replay-follow-latest]")?.getAttribute("data-replay-follow-latest")).toBe(
      "1",
    );
    expect(container.querySelector("[data-replay-window-start]")?.getAttribute("data-replay-window-start")).toBe(
      "11",
    );
    expect(container.querySelector("[data-replay-surface]")?.classList.contains("is-scrollable")).toBe(
      true,
    );
    const wo = [...container.querySelectorAll("[data-replay-wo-value]")].map((el) => el.textContent);
    const w = [...container.querySelectorAll("[data-replay-w-value]")].map((el) => el.textContent);
    expect(wo[0]).toBe("120");
    expect(w[0]).toBe("121");
    expect(wo[19]).toBe("310");
    expect(w[19]).toBe("310");
    expect(container.querySelector("[data-replay-check-no='12']")?.getAttribute("data-replay-check")).toBe(
      "fail",
    );
    expect((container.querySelector("[data-replay-check-no='12']") as HTMLElement).style.left).toBe(
      "34px",
    );
    expect(container.querySelector("[data-replay-headers] button")).toBeNull();

    dragSurface(container, CASE3V2_REPLAY_SLOT_PITCH * 11);
    expect(headersOf(container)[0]).toBe("P1");
    expect(headersOf(container)[19]).toBe("P20");
    expect(container.querySelector("[data-replay-follow-latest]")?.getAttribute("data-replay-follow-latest")).toBe(
      "0",
    );
    expect(container.querySelector("[data-replay-window-start]")?.getAttribute("data-replay-window-start")).toBe(
      "0",
    );
    const woEarly = [...container.querySelectorAll("[data-replay-wo-value]")].map(
      (el) => el.textContent,
    );
    const wEarly = [...container.querySelectorAll("[data-replay-w-value]")].map(
      (el) => el.textContent,
    );
    expect(woEarly[0]).toBe("10");
    expect(wEarly[0]).toBe("10");
    expect(woEarly[19]).toBe("200");
    expect(wEarly[19]).toBe("200");
    expect(container.querySelector("[data-replay-check-no='1']")?.getAttribute("data-replay-check-slot")).toBe(
      "0",
    );
    expect(container.querySelector("[data-replay-check-no='12']")?.getAttribute("data-replay-check-slot")).toBe(
      "11",
    );
    expect((container.querySelector("[data-replay-check-no='12']") as HTMLElement).style.left).toBe(
      `${34 + 11 * 85}px`,
    );
    expect(container.querySelector("[data-replay-check-no='31']")).toBeNull();

    dragSurface(container, -CASE3V2_REPLAY_SLOT_PITCH * 11);
    expect(headersOf(container)[0]).toBe("P12");
    expect(headersOf(container)[19]).toBe("P31");
    expect(container.querySelector("[data-replay-follow-latest]")?.getAttribute("data-replay-follow-latest")).toBe(
      "1",
    );
  });

  it("拖过边界会钳制；拖到较早窗口后新点到达保持用户窗口", () => {
    const routeNos = Array.from({ length: 31 }, (_, i) => i + 1);
    const makeWithout = (n: number) =>
      Array.from({ length: n }, (_, i) => point(i + 1, (i + 1) * 10));
    const first = renderReplay(makeWithout(22), { routeNos });
    dragSurface(first.container, CASE3V2_REPLAY_SLOT_PITCH * 20);
    expect(headersOf(first.container)[0]).toBe("P1");
    expect(first.container.querySelector("[data-replay-window-start]")?.getAttribute("data-replay-window-start")).toBe(
      "0",
    );

    first.rerender(
      <PointBeamReplay
        routeNos={routeNos}
        withoutPoints={makeWithout(24)}
        withPoints={undefined}
        withPeerPoints={undefined}
        progressSide="without"
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
    expect(headersOf(first.container)[0]).toBe("P1");
    expect(headersOf(first.container)[19]).toBe("P20");
    expect(first.container.querySelector("[data-replay-follow-latest]")?.getAttribute("data-replay-follow-latest")).toBe(
      "0",
    );

    dragSurface(first.container, -CASE3V2_REPLAY_SLOT_PITCH * 4);
    expect(headersOf(first.container)[0]).toBe("P5");
    expect(first.container.querySelector("[data-replay-follow-latest]")?.getAttribute("data-replay-follow-latest")).toBe(
      "1",
    );
    first.rerender(
      <PointBeamReplay
        routeNos={routeNos}
        withoutPoints={makeWithout(25)}
        progressSide="without"
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
    expect(headersOf(first.container)[0]).toBe("P6");
    expect(headersOf(first.container)[19]).toBe("P25");
  });

  it("进度侧切换或同侧完整点数回到 0 时恢复 follow-latest", () => {
    const routeNos = Array.from({ length: 31 }, (_, i) => i + 1);
    const without = routeNos.map((no) => point(no, no * 10));
    const view = renderReplay(without, { routeNos, progressSide: "without" });
    dragSurface(view.container, CASE3V2_REPLAY_SLOT_PITCH * 11);
    expect(headersOf(view.container)[0]).toBe("P1");
    expect(view.container.querySelector("[data-replay-follow-latest]")?.getAttribute("data-replay-follow-latest")).toBe(
      "0",
    );

    view.rerender(
      <PointBeamReplay
        routeNos={routeNos}
        withoutPoints={without}
        withPoints={without.map((p) => point(p.no, p.selectedBeamId))}
        withPeerPoints={without}
        progressSide="with"
        withoutStatus="已结束"
        withStatus="已结束"
        startWithoutEnabled={false}
        startWithEnabled={false}
        reinitWithoutEnabled={false}
        reinitWithEnabled={false}
        withoutPlayBusy={false}
        withPlayBusy={false}
        onStartWithout={noop}
        onStartWith={noop}
        onReinitWithout={noop}
        onReinitWith={noop}
      />,
    );
    expect(headersOf(view.container)[0]).toBe("P12");
    expect(view.container.querySelector("[data-replay-follow-latest]")?.getAttribute("data-replay-follow-latest")).toBe(
      "1",
    );

    dragSurface(view.container, CASE3V2_REPLAY_SLOT_PITCH * 11);
    expect(headersOf(view.container)[0]).toBe("P1");
    view.rerender(
      <PointBeamReplay
        routeNos={routeNos}
        withoutPoints={[]}
        withPoints={[]}
        progressSide="with"
        withoutStatus="测试中"
        withStatus="测试中"
        startWithoutEnabled={false}
        startWithEnabled={false}
        reinitWithoutEnabled={false}
        reinitWithEnabled={false}
        withoutPlayBusy={false}
        withPlayBusy
        onStartWithout={noop}
        onStartWith={noop}
        onReinitWithout={noop}
        onReinitWith={noop}
      />,
    );
    expect(view.container.querySelector("[data-replay-follow-latest]")?.getAttribute("data-replay-follow-latest")).toBe(
      "1",
    );
    expect(view.container.querySelector("[data-replay-window-start]")?.getAttribute("data-replay-window-start")).toBe(
      "0",
    );
    expect(headersOf(view.container)[0]).toBe("P1");
  });

  it("拖动 CSS 只用 grab/grabbing，不出现分页或滚动条", () => {
    const css = readFileSync("src/cases/case3-v2/case3v2.css", "utf8") as string;
    expect(css).toContain("cursor: grab");
    expect(css).toContain("cursor: grabbing");
    const boardBlock = css.match(
      /\.case3v2-page \.case3v2-replay-board\.is-scrollable \{[^}]+\}/,
    )?.[0];
    expect(boardBlock).toBeDefined();
    expect(boardBlock).not.toMatch(/overflow(-x)?:\s*auto/);
    expect(css).not.toContain("上一页");
    expect(css).not.toContain("下一页");
  });
});
