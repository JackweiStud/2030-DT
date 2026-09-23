/**
 * Case3 V2 回溯：真实 no/BeamID，自动跟随最近 20 点。
 */

import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import {
  CASE3V2_REPLAY_SLOT_PITCH,
  PointBeamReplay,
} from "../../src/cases/case3-v2/components/PointBeamReplay";
import {
  CASE3_ADAPTER_ERROR_BADGE,
  CASE3_ADAPTER_RETRY_HINT,
} from "../../src/cases/case3/state/case3Reducer";
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
    withoutStatus?: string;
    withStatus?: string;
    withoutBadgeError?: boolean;
    withBadgeError?: boolean;
    withoutRetryHint?: boolean;
    withRetryHint?: boolean;
    withoutPlayBusy?: boolean;
    withPlayBusy?: boolean;
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
      withoutStatus={extras.withoutStatus ?? "测试中"}
      withStatus={extras.withStatus ?? "等待无DT测试完成"}
      withoutBadgeError={extras.withoutBadgeError}
      withBadgeError={extras.withBadgeError}
      withoutRetryHint={extras.withoutRetryHint}
      withRetryHint={extras.withRetryHint}
      startWithoutEnabled={false}
      startWithEnabled={false}
      reinitWithoutEnabled={false}
      reinitWithEnabled={false}
      withoutPlayBusy={extras.withoutPlayBusy ?? true}
      withPlayBusy={extras.withPlayBusy ?? false}
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
    const runningBlock = css.match(
      /\.case3v2-side-status\.is-running \{[^}]+\}/,
    )?.[0];
    expect(runningBlock).not.toMatch(/animation/);
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*case3v2-status-ellipsis__track[\s\S]*width: 1\.15em/,
    );
  });

  it("超过 19 点时窗口跟随最近 19 个真实 no", () => {
    const points = Array.from({ length: 22 }, (_, i) => point(i + 1, 100 + i));
    const { container } = renderReplay(points);
    const headers = [...container.querySelectorAll("[data-replay-headers] .case3v2-replay-col")].map(
      (el) => el.textContent,
    );
    expect(headers).toHaveLength(19);
    expect(headers[0]).toBe("P4");
    expect(headers[18]).toBe("P22");
    const values = [...container.querySelectorAll("[data-replay-wo-value]")].map(
      (el) => el.textContent,
    );
    expect(values[0]).toBe("103");
    expect(values[18]).toBe("121");
  });

  it("点位列与两行说明位于控制区和 P 列之间", () => {
    const { container } = renderReplay([]);
    const replay = container.querySelector("[data-region='PointBeamReplay']");
    const children = [...(replay?.children ?? [])];
    const axis = container.querySelector("[data-replay-axis]");
    expect(children.indexOf(axis as Element)).toBe(1);
    expect(axis?.textContent).toBe("点位最优波束ID预测波束ID");
  });

  it("重置中使用同一套动态省略号，不走错误样式", () => {
    const { container } = renderReplay([], {
      withoutStatus: "重置中",
      withoutPlayBusy: false,
      withPlayBusy: false,
    });
    const status = container.querySelector('[data-status="without"]');
    expect(status?.textContent).toContain("重置中");
    expect(status?.classList.contains("is-running")).toBe(true);
    expect(status?.classList.contains("is-error")).toBe(false);
    expect(container.querySelector("[data-status-ellipsis]")).not.toBeNull();
  });
});

describe("PointBeamReplay status error and retry", () => {
  it("四类错误文案使用错误样式，不显示省略号或重试中", () => {
    const cases = [
      { status: "执行失败", side: "without" as const },
      { status: "重置失败", side: "with" as const },
      { status: "结果不完整已自动回退", side: "without" as const },
      { status: CASE3_ADAPTER_ERROR_BADGE, side: "with" as const },
    ];
    for (const item of cases) {
      const view = renderReplay([], {
        withoutStatus: item.side === "without" ? item.status : "未开始",
        withStatus: item.side === "with" ? item.status : "未开始",
        withoutBadgeError: item.side === "without",
        withBadgeError: item.side === "with",
        withoutPlayBusy: false,
        withPlayBusy: false,
      });
      const status = view.container.querySelector(`[data-status="${item.side}"]`);
      expect(status?.textContent).toContain(item.status);
      expect(status?.classList.contains("is-error")).toBe(true);
      expect(status?.getAttribute("data-status-error")).toBe("1");
      expect(status?.classList.contains("is-running")).toBe(false);
      expect(view.container.querySelector("[data-status-ellipsis]")).toBeNull();
      expect(view.container.querySelector("[data-status-retry-text]")).toBeNull();
      view.unmount();
    }
    const css = readFileSync("src/cases/case3-v2/case3v2.css", "utf8") as string;
    expect(css).toMatch(/\.case3v2-side-status\.is-error \{[^}]*color:\s*#f87171/);
  });

  it("retryHint=true 时出现重试中，false 时消失；忙态主状态保持测试中", () => {
    const first = renderReplay([], {
      withoutStatus: "测试中",
      withoutRetryHint: true,
    });
    const status = first.container.querySelector('[data-status="without"]');
    expect(status?.textContent).toContain("测试中");
    expect(status?.textContent).toContain(CASE3_ADAPTER_RETRY_HINT);
    expect(status?.classList.contains("is-running")).toBe(true);
    expect(status?.classList.contains("is-error")).toBe(false);
    expect(status?.getAttribute("data-status-error")).toBe("0");
    expect(status?.getAttribute("data-status-retry")).toBe("1");
    expect(first.container.querySelector("[data-status-ellipsis]")).not.toBeNull();
    expect(first.container.querySelector("[data-status-retry-text]")?.textContent).toBe(
      CASE3_ADAPTER_RETRY_HINT,
    );

    first.rerender(
      <PointBeamReplay
        routeNos={Array.from({ length: 25 }, (_, i) => i + 1)}
        withoutPoints={[]}
        withoutStatus="测试中"
        withStatus="等待无DT测试完成"
        withoutRetryHint={false}
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
    const after = first.container.querySelector('[data-status="without"]');
    expect(after?.textContent).toContain("测试中");
    expect(after?.textContent).not.toContain(CASE3_ADAPTER_RETRY_HINT);
    expect(after?.classList.contains("is-error")).toBe(false);
    expect(after?.getAttribute("data-status-retry")).toBe("0");
    expect(first.container.querySelector("[data-status-retry-text]")).toBeNull();
    expect(first.container.querySelector("[data-status-ellipsis]")).not.toBeNull();
  });

  it("忙态连接异常不被改成红色错误主状态，重置中同样保留省略号和重试中", () => {
    const { container } = renderReplay([], {
      withoutStatus: "重置中",
      withoutRetryHint: true,
      withoutBadgeError: true,
      withoutPlayBusy: false,
    });
    const status = container.querySelector('[data-status="without"]');
    expect(status?.textContent).toContain("重置中");
    expect(status?.textContent).toContain(CASE3_ADAPTER_RETRY_HINT);
    expect(status?.classList.contains("is-running")).toBe(true);
    expect(status?.classList.contains("is-error")).toBe(false);
    expect(status?.getAttribute("data-status-error")).toBe("0");
    expect(container.querySelector("[data-status-ellipsis]")).not.toBeNull();
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
    const idleBlock = css.match(
      /\.case3v2-replay-cell--with:not\(\.is-ok\):not\(\.is-fail\) \{[^}]+\}/,
    )?.[0];
    expect(idleBlock).toMatch(/background:\s*rgba\(0, 0, 0, 0\.4\)/);
    expect(css).toMatch(
      /\.case3v2-replay-cell--without:not\(\.is-done\) \{\s*border-radius:\s*4px 4px 0 0;/,
    );
    expect(css).toMatch(
      /\.case3v2-replay-cell--with:not\(\.is-ok\):not\(\.is-fail\) \{\s*border-radius:\s*0 0 4px 4px;/,
    );
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

  it("With 进度驱动窗口：route31 + With2 显示 P1..P19，前 2 列完成，Without 历史仍在", () => {
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
    expect(headers.map((el) => el.textContent)).toEqual(
      Array.from({ length: 19 }, (_, i) => `P${i + 1}`),
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

  it("With>19 时窗口跟随最新 19 个 With 点，Without 同行仍按 no 填历史", () => {
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
    expect(headers[0]).toBe("P4");
    expect(headers[18]).toBe("P22");
    expect(container.querySelector("[data-replay-done]")?.getAttribute("data-replay-done")).toBe(
      "19",
    );
    const wo = [...container.querySelectorAll("[data-replay-wo-value]")].map((el) => el.textContent);
    expect(wo[0]).toBe("40");
    expect(wo[18]).toBe("220");
    const w = [...container.querySelectorAll("[data-replay-w-value]")].map((el) => el.textContent);
    expect(w[0]).toBe("40");
    expect(w[18]).toBe("220");
    const checks = [...container.querySelectorAll("[data-replay-check]")];
    expect(checks).toHaveLength(19);
    expect(checks[0]?.getAttribute("data-replay-check-no")).toBe("4");
    expect(checks[0]?.getAttribute("data-replay-check-slot")).toBe("0");
    expect((checks[0] as HTMLElement).style.left).toBe("34px");
    expect(checks[18]?.getAttribute("data-replay-check-no")).toBe("22");
    expect(checks[18]?.getAttribute("data-replay-check-slot")).toBe("18");
    expect((checks[18] as HTMLElement).style.left).toBe(`${34 + 18 * 85}px`);
    expect(container.querySelector('[data-replay-check-no="2"]')).toBeNull();
  });
});

function headersOf(container: HTMLElement): string[] {
  return [...container.querySelectorAll("[data-replay-headers] .case3v2-replay-col")].map(
    (el) => el.textContent ?? "",
  );
}

function mockSurfaceSize(el: HTMLElement, width = 1612) {
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
  it("N<19 补空槽且不可拖", () => {
    const routeNos = [1, 2, 3, 4, 5];
    const { container } = renderReplay([point(1, 10), point(2, 20), point(3, 30)], {
      routeNos,
    });
    const headers = headersOf(container);
    expect(headers).toHaveLength(19);
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

  it("N=19 显示 P1–P19 且不可拖", () => {
    const routeNos = Array.from({ length: 19 }, (_, i) => i + 1);
    const points = routeNos.map((no) => point(no, no * 10));
    const { container } = renderReplay(points, { routeNos });
    const headers = headersOf(container);
    expect(headers).toEqual(Array.from({ length: 19 }, (_, i) => `P${i + 1}`));
    expect(container.querySelector("[data-replay-can-drag]")?.getAttribute("data-replay-can-drag")).toBe(
      "0",
    );
    dragSurface(container, CASE3V2_REPLAY_SLOT_PITCH * 3);
    expect(headersOf(container)[0]).toBe("P1");
    expect(headersOf(container)[18]).toBe("P19");
  });

  it("N=31 默认最新窗口 P13–P31，可拖到 P1–P19，两行与勾叉同步", () => {
    const routeNos = Array.from({ length: 31 }, (_, i) => i + 1);
    const without = routeNos.map((no) => point(no, no * 10));
    const withPts = routeNos.map((no) => point(no, no === 13 ? 131 : no * 10));
    const { container } = renderReplay(without, {
      routeNos,
      withPoints: withPts,
      withPeerPoints: without,
      progressSide: "with",
    });
    expect(headersOf(container)[0]).toBe("P13");
    expect(headersOf(container)[18]).toBe("P31");
    expect(container.querySelector("[data-replay-can-drag]")?.getAttribute("data-replay-can-drag")).toBe(
      "1",
    );
    expect(container.querySelector("[data-replay-follow-latest]")?.getAttribute("data-replay-follow-latest")).toBe(
      "1",
    );
    expect(container.querySelector("[data-replay-window-start]")?.getAttribute("data-replay-window-start")).toBe(
      "12",
    );
    expect(container.querySelector("[data-replay-surface]")?.classList.contains("is-scrollable")).toBe(
      true,
    );
    const wo = [...container.querySelectorAll("[data-replay-wo-value]")].map((el) => el.textContent);
    const w = [...container.querySelectorAll("[data-replay-w-value]")].map((el) => el.textContent);
    expect(wo[0]).toBe("130");
    expect(w[0]).toBe("131");
    expect(wo[18]).toBe("310");
    expect(w[18]).toBe("310");
    expect(container.querySelector("[data-replay-check-no='13']")?.getAttribute("data-replay-check")).toBe(
      "fail",
    );
    expect((container.querySelector("[data-replay-check-no='13']") as HTMLElement).style.left).toBe(
      "34px",
    );
    expect(container.querySelector("[data-replay-headers] button")).toBeNull();

    dragSurface(container, CASE3V2_REPLAY_SLOT_PITCH * 12);
    expect(headersOf(container)[0]).toBe("P1");
    expect(headersOf(container)[18]).toBe("P19");
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
    expect(woEarly[18]).toBe("190");
    expect(wEarly[18]).toBe("190");
    expect(container.querySelector("[data-replay-check-no='1']")?.getAttribute("data-replay-check-slot")).toBe(
      "0",
    );
    expect(container.querySelector("[data-replay-check-no='13']")?.getAttribute("data-replay-check-slot")).toBe(
      "12",
    );
    expect((container.querySelector("[data-replay-check-no='13']") as HTMLElement).style.left).toBe(
      `${34 + 12 * 85}px`,
    );
    expect(container.querySelector("[data-replay-check-no='31']")).toBeNull();

    dragSurface(container, -CASE3V2_REPLAY_SLOT_PITCH * 12);
    expect(headersOf(container)[0]).toBe("P13");
    expect(headersOf(container)[18]).toBe("P31");
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
    expect(headersOf(first.container)[18]).toBe("P19");
    expect(first.container.querySelector("[data-replay-follow-latest]")?.getAttribute("data-replay-follow-latest")).toBe(
      "0",
    );

    dragSurface(first.container, -CASE3V2_REPLAY_SLOT_PITCH * 5);
    expect(headersOf(first.container)[0]).toBe("P6");
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
    expect(headersOf(first.container)[0]).toBe("P7");
    expect(headersOf(first.container)[18]).toBe("P25");
  });

  it("进度侧切换或同侧完整点数回到 0 时恢复 follow-latest", () => {
    const routeNos = Array.from({ length: 31 }, (_, i) => i + 1);
    const without = routeNos.map((no) => point(no, no * 10));
    const view = renderReplay(without, { routeNos, progressSide: "without" });
    dragSurface(view.container, CASE3V2_REPLAY_SLOT_PITCH * 12);
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
    expect(headersOf(view.container)[0]).toBe("P13");
    expect(view.container.querySelector("[data-replay-follow-latest]")?.getAttribute("data-replay-follow-latest")).toBe(
      "1",
    );

    dragSurface(view.container, CASE3V2_REPLAY_SLOT_PITCH * 12);
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
