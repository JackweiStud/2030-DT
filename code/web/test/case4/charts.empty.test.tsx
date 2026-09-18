/**
 * 底栏图表：空态骨架、刻度与折线共用映射、误差圆点。
 */
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
import { CdfChart, cdfHoverProbFromLocalY } from "../../src/cases/case4/components/CdfChart";
import { CepBars } from "../../src/cases/case4/components/CepBars";
import {
  ErrorReplay,
  CASE4_ERROR_REPLAY_DRAG_THRESHOLD_PX,
  CASE4_ERROR_REPLAY_SLOT_PITCH,
} from "../../src/cases/case4/components/ErrorReplay";
import { NlosGauge } from "../../src/cases/case4/components/NlosGauge";
import { ThroughputChart, thrpHoverNoFromLocalX } from "../../src/cases/case4/components/ThroughputChart";
import {
  sampleBaseRoute,
  sampleStatistics,
  thrpSamples,
  trajPoint,
} from "./fixtures";

describe("ThroughputChart", () => {
  it("绘图区 X 映射到最近样点号，轴外为空", () => {
    expect(thrpHoverNoFromLocalX(15, 1, 20)).toBeNull();
    expect(thrpHoverNoFromLocalX(29.263888888888886, 1, 20)).toBe(1);
    expect(thrpHoverNoFromLocalX(29.263888888888886 + 564.375, 1, 20)).toBe(20);
    expect(thrpHoverNoFromLocalX(29.263888888888886, 6, 25)).toBe(6);
    expect(thrpHoverNoFromLocalX(700, 1, 20)).toBeNull();
  });

  it("空态 Y0–10 与 X1–20 带 left/top，不堆在原点", () => {
    const view = render(<ThroughputChart without={[]} withSamples={[]} />);
    const ys = [
      ...view.container.querySelectorAll(".c4-thrp-y span"),
    ] as HTMLSpanElement[];
    const xs = [
      ...view.container.querySelectorAll(".c4-thrp-x span"),
    ] as HTMLSpanElement[];
    expect(ys.map((el) => el.textContent)).toEqual([
      "10",
      "9",
      "8",
      "7",
      "6",
      "5",
      "4",
      "3",
      "2",
      "1",
      "0",
    ]);
    expect(xs).toHaveLength(20);
    expect(xs[0]?.textContent).toBe("1");
    expect(xs[19]?.textContent).toBe("20");
    const x0 = Number.parseFloat(xs[0]?.style.left ?? "");
    const xLast = Number.parseFloat(xs[19]?.style.left ?? "");
    const yTop = Number.parseFloat(ys[0]?.style.top ?? "");
    const yBot = Number.parseFloat(ys[10]?.style.top ?? "");
    expect(x0).toBeGreaterThan(20);
    expect(xLast).toBeGreaterThan(x0 + 400);
    expect(yBot).toBeGreaterThan(yTop + 100);
  });

  it("N≤20 横轴仍是 1–20，不按样点数拉伸", () => {
    const empty = render(<ThroughputChart without={[]} withSamples={[]} />);
    const live = render(
      <ThroughputChart without={thrpSamples(5)} withSamples={[]} />,
    );
    const emptyXs = [
      ...empty.container.querySelectorAll(".c4-thrp-x span"),
    ] as HTMLSpanElement[];
    const liveXs = [
      ...live.container.querySelectorAll(".c4-thrp-x span"),
    ] as HTMLSpanElement[];
    expect(liveXs).toHaveLength(20);
    expect(liveXs[0]?.textContent).toBe("1");
    expect(liveXs[19]?.textContent).toBe("20");
    expect(liveXs[0]?.style.left).toBe(emptyXs[0]?.style.left);
    expect(liveXs[19]?.style.left).toBe(emptyXs[19]?.style.left);
    expect(live.container.querySelectorAll(".c4-thrp-dot")).toHaveLength(5);
  });

  it("峰值≤10 时 Y 锁 0–10 整数", () => {
    const view = render(
      <ThroughputChart without={[{ no: 1, gbps: 9.5 }]} withSamples={[]} />,
    );
    const ys = [
      ...view.container.querySelectorAll(".c4-thrp-y span"),
    ].map((el) => el.textContent);
    expect(ys).toEqual([
      "10",
      "9",
      "8",
      "7",
      "6",
      "5",
      "4",
      "3",
      "2",
      "1",
      "0",
    ]);
  });

  it("峰值刚过 10 时 Y 为 12…0 整数，横网格条数跟刻度走", () => {
    const view = render(
      <ThroughputChart without={[{ no: 1, gbps: 10.5 }]} withSamples={[]} />,
    );
    const ys = [
      ...view.container.querySelectorAll(".c4-thrp-y span"),
    ].map((el) => el.textContent);
    expect(ys).toEqual([
      "12",
      "11",
      "10",
      "9",
      "8",
      "7",
      "6",
      "5",
      "4",
      "3",
      "2",
      "1",
      "0",
    ]);
    expect(ys).not.toContain("10.8");
    expect(
      view.container.querySelectorAll(".c4-thrp-grid-svg rect[data-thrp-yline]"),
    ).toHaveLength(13);
  });

  it("有数据时横轴序号与折线同一窗口", () => {
    const view = render(
      <ThroughputChart without={thrpSamples(25)} withSamples={thrpSamples(22)} />,
    );
    const xs = [
      ...view.container.querySelectorAll(".c4-thrp-x span"),
    ] as HTMLSpanElement[];
    expect(xs[0]?.textContent).toBe("6");
    expect(xs.at(-1)?.textContent).toBe("25");
    const path = view.container.querySelector(".c4-thrp-svg path");
    expect(path?.getAttribute("d")?.startsWith("M ")).toBe(true);
  });

  it("悬停有样点弹出双路读数，空槽与 leave 收起", () => {
    const view = render(
      <ThroughputChart
        without={thrpSamples(5)}
        withSamples={[{ no: 2, gbps: 7.25 }]}
      />,
    );
    const surface = mockThrpSurface(view.container);

    fireEvent.pointerMove(surface, { clientX: 30, clientY: 40 });
    const tip = view.container.querySelector("[data-thrp-tip]");
    expect(tip?.getAttribute("data-thrp-tip-no")).toBe("1");
    expect(surface.getAttribute("data-hover-no")).toBe("1");
    expect(tip?.textContent).not.toContain("样点");
    expect(tip?.textContent).not.toContain("吞吐率");
    expect(tip?.textContent).toContain("传统基站定位");
    expect(tip?.textContent).toContain("数字孪生辅助定位");
    expect(tip?.textContent).toContain("8.00Gbps");
    expect(tip?.textContent).toContain("--");

    fireEvent.pointerMove(surface, { clientX: 148, clientY: 40 });
    expect(surface.getAttribute("data-hover-no")).toBe("5");
    expect(
      view.container.querySelector("[data-thrp-tip]")?.getAttribute("data-thrp-tip-no"),
    ).toBe("5");

    fireEvent.pointerMove(surface, { clientX: 445, clientY: 40 });
    expect(view.container.querySelector("[data-thrp-tip]")).toBeNull();
    expect(surface.getAttribute("data-hover-no")).toBe("");

    fireEvent.pointerMove(surface, { clientX: 30, clientY: 40 });
    expect(view.container.querySelector("[data-thrp-tip]")).not.toBeNull();
    fireEvent.pointerLeave(surface);
    expect(view.container.querySelector("[data-thrp-tip]")).toBeNull();
  });

  it("两路同序号都显示 2 位 Gbps", () => {
    const view = render(
      <ThroughputChart
        without={[{ no: 1, gbps: 4.2 }]}
        withSamples={[{ no: 1, gbps: 3.8 }]}
      />,
    );
    const surface = mockThrpSurface(view.container);
    fireEvent.pointerMove(surface, { clientX: 30, clientY: 40 });
    const text = view.container.querySelector("[data-thrp-tip]")?.textContent;
    expect(text).toContain("4.20Gbps");
    expect(text).toContain("3.80Gbps");
  });

  it("N>20 悬停跟当前窗口样点号", () => {
    const view = render(
      <ThroughputChart without={thrpSamples(25)} withSamples={thrpSamples(22)} />,
    );
    const surface = mockThrpSurface(view.container);
    fireEvent.pointerMove(surface, { clientX: 30, clientY: 40 });
    expect(surface.getAttribute("data-hover-no")).toBe("6");
    expect(
      view.container.querySelector("[data-thrp-tip]")?.getAttribute("data-thrp-tip-no"),
    ).toBe("6");
  });
});

describe("CdfChart empty", () => {
  it("空态无中心 --，保留 Y 轴与 X 骨架", () => {
    const view = render(<CdfChart cdf={null} />);
    expect(view.container.querySelector(".c4-cdf-empty")).toBeNull();
    expect(view.container.textContent).not.toContain("--");
    const ys = [...view.container.querySelectorAll(".c4-cdf-y span")].map(
      (el) => el.textContent,
    );
    expect(ys).toEqual(["1.0", "0.8", "0.6", "0.4", "0.2", "0.0"]);
    const xs = [...view.container.querySelectorAll(".c4-cdf-x span")].map(
      (el) => el.textContent,
    );
    expect(xs[0]).toBe("0");
    expect(xs.at(-1)).toBe("4.5");
  });

  it("有数据时 X 为 0～max 十档、一位小数", () => {
    const view = render(<CdfChart cdf={sampleStatistics().cdf} />);
    expect(view.container.querySelector(".c4-cdf-svg path")).toBeTruthy();
    const xs = [...view.container.querySelectorAll(".c4-cdf-x span")].map(
      (el) => el.textContent,
    );
    expect(xs).toHaveLength(10);
    expect(xs[0]).toBe("0.0");
    expect(xs.at(-1)).toBe("0.8");
  });

  it("绘图区 Y 映射到一位小数概率", () => {
    expect(cdfHoverProbFromLocalY(-1)).toBeNull();
    expect(cdfHoverProbFromLocalY(0)).toBe(1);
    expect(cdfHoverProbFromLocalY(68)).toBe(0.5);
    expect(cdfHoverProbFromLocalY(136)).toBe(0);
    expect(cdfHoverProbFromLocalY(200)).toBeNull();
  });

  it("空态无悬停热区", () => {
    const view = render(<CdfChart cdf={null} />);
    expect(view.container.querySelector("[data-cdf-surface]")).toBeNull();
  });

  it("悬停横线读三方案一位小数误差，leave 收起", () => {
    const view = render(<CdfChart cdf={sampleStatistics().cdf} />);
    const surface = mockCdfSurface(view.container);
    fireEvent.pointerMove(surface, { clientX: 40, clientY: 68 });
    const tip = view.container.querySelector("[data-cdf-tip]");
    expect(tip?.getAttribute("data-cdf-tip-p")).toBe("0.5");
    expect(surface.getAttribute("data-hover-p")).toBe("0.5");
    expect(tip?.textContent).toContain("传统基站定位");
    expect(tip?.textContent).toContain("商用方案定位");
    expect(tip?.textContent).toContain("数字孪生辅助定位");
    expect(tip?.textContent).toContain("0.8m");
    expect(tip?.textContent).toContain("0.1m");
    expect(view.container.querySelector(".c4-cdf-cursor")).toBeTruthy();
    const top50 = Number.parseFloat((tip as HTMLElement).style.top);
    expect((tip as HTMLElement).style.transform).toContain("-100%");
    expect((tip as HTMLElement).style.transform).toContain("20px");
    expect((tip as HTMLElement).style.left).toBe("68px");

    fireEvent.pointerMove(surface, { clientX: 40, clientY: 0 });
    expect(view.container.querySelector("[data-cdf-tip]")).toBeNull();

    fireEvent.pointerMove(surface, { clientX: 40, clientY: 14 });
    expect(surface.getAttribute("data-hover-p")).toBe("0.9");
    const tip90 = view.container.querySelector("[data-cdf-tip]") as HTMLElement;
    expect(tip90?.textContent).toContain("0.6m");
    expect(Number.parseFloat(tip90.style.top)).toBeLessThan(top50);
    fireEvent.pointerLeave(surface);
    expect(view.container.querySelector("[data-cdf-tip]")).toBeNull();
  });
});

describe("CepBars empty", () => {
  it("空态保留传统/商用/DT 与数字刻度，不用 --", () => {
    const view = render(<CepBars cep={null} kind="p50M" />);
    expect(view.container.textContent).toContain("传统");
    expect(view.container.textContent).toContain("商用");
    expect(view.container.textContent).toContain("DT");
    expect(view.container.textContent).not.toContain("--");
    const ticks = [...view.container.querySelectorAll(".c4-cep-y span")].map(
      (el) => el.textContent,
    );
    expect(ticks).toEqual(["4.0", "3.0", "2.0", "1.0", "0.0"]);
    expect(view.container.querySelectorAll(".c4-cep-bar.is-empty")).toHaveLength(
      3,
    );
  });

  it("有数据时 Y 刻度与柱顶均为一位小数", () => {
    const view = render(<CepBars cep={sampleStatistics().cep} kind="p50M" />);
    const ticks = [...view.container.querySelectorAll(".c4-cep-y span")].map(
      (el) => el.textContent,
    );
    expect(ticks).toEqual(["0.4", "0.3", "0.2", "0.1", "0.0"]);
    const values = [...view.container.querySelectorAll(".c4-cep-value")].map(
      (el) => el.textContent,
    );
    expect(values).toEqual(["0.4", "0.3", "0.1"]);
  });

  it("空态与相等/零基准不画百分比；50/90 各自相对传统计算", () => {
    const empty = render(<CepBars cep={null} kind="p50M" />);
    expect(empty.container.querySelector("[data-cep-delta]")).toBeNull();
    expect(empty.container.querySelector("[data-cep-baseline]")).toBeNull();
    empty.unmount();

    const equal = render(
      <CepBars
        cep={{
          traditional: { p50M: 10, p90M: 0 },
          commercial: { p50M: 1, p90M: 1 },
          dt: { p50M: 10, p90M: 5 },
        }}
        kind="p50M"
      />,
    );
    expect(equal.container.querySelector("[data-cep-delta]")).toBeNull();
    equal.unmount();

    const mixed = {
      traditional: { p50M: 10, p90M: 10 },
      commercial: { p50M: 1, p90M: 1 },
      dt: { p50M: 2, p90M: 15 },
    };
    const p50 = render(<CepBars cep={mixed} kind="p50M" />);
    const d50 = p50.container.querySelector("[data-cep-delta]");
    expect(d50?.textContent).toBe("80.0%");
    expect(d50?.querySelector(".c4-cep-delta__num")?.textContent).toBe("80.0");
    expect(d50?.querySelector(".c4-cep-delta__pct")?.textContent).toBe("%");
    expect(d50?.getAttribute("data-cep-delta-dir")).toBe("down");
    expect(p50.container.querySelectorAll("[data-cep-delta]")).toHaveLength(1);
    const base50 = p50.container.querySelector(
      "[data-cep-baseline]",
    ) as HTMLElement | null;
    expect(base50).not.toBeNull();
    expect(base50?.style.bottom).toBe("122px");
    expect((d50 as HTMLElement).style.bottom).toBe("130px");
    p50.unmount();

    const p90 = render(<CepBars cep={mixed} kind="p90M" />);
    const d90 = p90.container.querySelector("[data-cep-delta]");
    expect(d90?.textContent).toBe("50.0%");
    expect(d90?.getAttribute("data-cep-delta-dir")).toBe("up");
    const base90 = p90.container.querySelector(
      "[data-cep-baseline]",
    ) as HTMLElement | null;
    expect(base90?.style.bottom).toBe(`${13 + 109 * (10 / 15)}px`);
    expect((d90 as HTMLElement).style.bottom).toBe("137.2px");
    p90.unmount();
  });

  it("DT 接近或高于传统时气泡让开数值，虚线仍锚传统柱顶", () => {
    const near = render(
      <CepBars
        cep={{
          traditional: { p50M: 10, p90M: 1 },
          commercial: { p50M: 1, p90M: 1 },
          dt: { p50M: 9.9, p90M: 1 },
        }}
        kind="p50M"
      />,
    );
    const nearBase = near.container.querySelector(
      "[data-cep-baseline]",
    ) as HTMLElement | null;
    const nearDelta = near.container.querySelector(
      "[data-cep-delta]",
    ) as HTMLElement | null;
    expect(nearBase?.style.bottom).toBe("122px");
    expect(nearDelta?.style.bottom).toBe(
      `${13 + 109 * (9.9 / 10) + 13.2 + 2}px`,
    );
    near.unmount();

    const tall = render(
      <CepBars
        cep={{
          traditional: { p50M: 10, p90M: 1 },
          commercial: { p50M: 1, p90M: 1 },
          dt: { p50M: 15, p90M: 1 },
        }}
        kind="p50M"
      />,
    );
    const tallBase = tall.container.querySelector(
      "[data-cep-baseline]",
    ) as HTMLElement | null;
    const tallDelta = tall.container.querySelector(
      "[data-cep-delta]",
    ) as HTMLElement | null;
    expect(tallBase?.style.bottom).toBe(`${13 + 109 * (10 / 15)}px`);
    expect(tallDelta?.style.bottom).toBe("137.2px");
    tall.unmount();
  });
});

describe("NlosGauge ticks", () => {
  it("空态中心 --，内侧仍有 0/25/50/75/100", () => {
    const view = render(<NlosGauge nlosRatio={null} />);
    expect(view.container.querySelector(".c4-nlos-value")?.textContent).toBe(
      "--",
    );
    const ticks = [
      ...view.container.querySelectorAll(".c4-nlos-ticks span"),
    ].map((el) => el.textContent);
    expect(ticks).toEqual(["0", "25", "50", "75", "100"]);
    const first = view.container.querySelector(
      ".c4-nlos-ticks span",
    ) as HTMLSpanElement | null;
    expect(first?.style.left).toBe("32.28%");
    expect(first?.style.top).toBe("73.91%");
  });
});

describe("ErrorReplay", () => {
  it("空态标题为点位/定位误差/(m)，Y 轴为 5.5…0 六刻度", () => {
    const view = render(
      <ErrorReplay
        baseRoute={sampleBaseRoute(3)}
        points={[]}
        statusText="未开始"
        startEnabled
        resetEnabled={false}
        busy={false}
        onStart={() => undefined}
        onReset={() => undefined}
      />,
    );
    const title = view.container.querySelector(".c4-axis-title");
    expect(title?.textContent).toBe("点位定位误差(m)");
    const ticks = [...view.container.querySelectorAll(".c4-y-axis span")].map(
      (el) => el.textContent,
    );
    expect(ticks).toEqual(["5.5", "4.5", "3.5", "2.5", "1.5", "0"]);
    const heads = [...view.container.querySelectorAll(".c4-col-head")].map(
      (el) => el.textContent,
    );
    expect(heads).toHaveLength(20);
    expect(heads[0]).toBe("P1");
    expect(heads[19]).toBe("P20");
  });

  it("有点时画折线与圆点，圆点 x 随列递增", () => {
    const base = sampleBaseRoute(3);
    const view = render(
      <ErrorReplay
        baseRoute={base}
        points={base.map((p) => trajPoint(p.no, p))}
        statusText="测试中"
        startEnabled={false}
        resetEnabled={false}
        busy
        onStart={() => undefined}
        onReset={() => undefined}
      />,
    );
    const circles = [
      ...view.container.querySelectorAll(".c4-error-svg circle"),
    ] as SVGCircleElement[];
    expect(circles.length).toBeGreaterThanOrEqual(3);
    const xs = circles.slice(0, 3).map((c) => Number(c.getAttribute("cx")));
    expect(xs[1]! - xs[0]!).toBeGreaterThan(50);
  });

  it("测试中与重置中都带动态省略号，未开始不带", () => {
    const base = {
      baseRoute: sampleBaseRoute(1),
      points: [],
      startEnabled: false,
      resetEnabled: false,
      busy: true,
      onStart: () => undefined,
      onReset: () => undefined,
    };
    const running = render(<ErrorReplay {...base} statusText="测试中" />);
    expect(
      running.container.querySelector(".c4-ctrl-status.is-busy"),
    ).not.toBeNull();
    expect(
      running.container.querySelector(".c4-status-ellipsis"),
    ).not.toBeNull();
    running.unmount();

    const resetting = render(<ErrorReplay {...base} statusText="重置中" />);
    expect(
      resetting.container.querySelector(".c4-ctrl-status.is-busy"),
    ).not.toBeNull();
    expect(
      resetting.container.querySelector(".c4-status-ellipsis"),
    ).not.toBeNull();
    resetting.unmount();

    const idle = render(
      <ErrorReplay {...base} statusText="未开始" busy={false} startEnabled />,
    );
    expect(idle.container.querySelector(".c4-ctrl-status.is-busy")).toBeNull();
    expect(idle.container.querySelector(".c4-status-ellipsis")).toBeNull();
    idle.unmount();

    const done = render(<ErrorReplay {...base} statusText="已完成" />);
    expect(done.container.querySelector(".c4-ctrl-status.is-busy")).toBeNull();
    expect(done.container.querySelector(".c4-status-ellipsis")).toBeNull();
  });

  it("N=21 默认 P2–P21 可拖到 P1–P20，列头与折线同步", async () => {
    const base = sampleBaseRoute(21);
    const points = base.map((p) => trajPoint(p.no, p));
    const view = render(
      <ErrorReplay
        baseRoute={base}
        points={points}
        statusText="测试中"
        startEnabled={false}
        resetEnabled={false}
        busy
        onStart={() => undefined}
        onReset={() => undefined}
      />,
    );
    const board = view.container.querySelector(
      "[data-replay-surface]",
    ) as HTMLElement;
    expect(board?.getAttribute("data-replay-can-drag")).toBe("1");
    expect(board?.classList.contains("is-scrollable")).toBe(true);
    const heads = () =>
      [...view.container.querySelectorAll(".c4-col-head")].map(
        (el) => el.textContent,
      );
    expect(heads()[0]).toBe("P2");
    expect(heads()[19]).toBe("P21");
    expect(board?.getAttribute("data-replay-window-start")).toBe("1");

    Object.defineProperty(board, "offsetWidth", {
      configurable: true,
      value: 1748,
    });
    board.getBoundingClientRect = () =>
      ({
        width: 1748,
        height: 147,
        top: 0,
        left: 0,
        right: 1748,
        bottom: 147,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.pointerDown(board, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 800,
      clientY: 20,
    });
    fireEvent.pointerMove(board, {
      pointerId: 1,
      buttons: 1,
      clientX: 800 + CASE4_ERROR_REPLAY_SLOT_PITCH,
      clientY: 20,
    });
    fireEvent.pointerUp(board, {
      pointerId: 1,
      button: 0,
      clientX: 800 + CASE4_ERROR_REPLAY_SLOT_PITCH,
      clientY: 20,
    });

    await waitFor(() => {
      expect(heads()[0]).toBe("P1");
    });
    expect(heads()[19]).toBe("P20");
    expect(board?.getAttribute("data-replay-follow-latest")).toBe("0");
    expect(board?.getAttribute("data-replay-window-start")).toBe("0");
  });

  it("N≤20 不可拖动", () => {
    const base = sampleBaseRoute(5);
    const points = base.map((p) => trajPoint(p.no, p));
    const view = render(
      <ErrorReplay
        baseRoute={base}
        points={points}
        statusText="未开始"
        startEnabled
        resetEnabled={false}
        busy={false}
        onStart={() => undefined}
        onReset={() => undefined}
      />,
    );
    const board = view.container.querySelector("[data-replay-surface]");
    expect(board?.getAttribute("data-replay-can-drag")).toBe("0");
    expect(board?.classList.contains("is-scrollable")).toBe(false);
  });

  it("悬停有数据槽弹出三方案误差，空槽与离开均关闭", () => {
    const base = sampleBaseRoute(3).map((p, i) =>
      i === 0 ? { ...p, x: 0, y: 0, z: 0 } : p,
    );
    const p1 = base[0]!;
    const points = [
      trajPoint(p1.no, p1, {
        traditional: { x: 0.017, y: 0, z: 0 },
        commercial: { x: 0.012, y: 0, z: 0 },
        dt: { x: 0.011, y: 0, z: 0 },
      }),
      trajPoint(base[1]!.no, base[1]!),
      trajPoint(base[2]!.no, base[2]!),
    ];
    const view = render(
      <ErrorReplay
        baseRoute={base}
        points={points}
        statusText="测试中"
        startEnabled={false}
        resetEnabled={false}
        busy
        onStart={() => undefined}
        onReset={() => undefined}
      />,
    );
    const board = mockReplayBoard(view.container);

    fireEvent.pointerMove(board, { clientX: 40, clientY: 40 });
    const tip = view.container.querySelector("[data-error-tip]");
    expect(tip?.getAttribute("data-error-tip-no")).toBe("1");
    expect(board.getAttribute("data-hover-no")).toBe("1");
    expect(tip?.textContent).toContain("P1定位误差");
    expect(tip?.textContent).toContain("传统基站定位轨迹");
    expect(tip?.textContent).toContain("商用方案定位轨迹");
    expect(tip?.textContent).toContain("数字孪生辅助定位轨迹");
    expect(tip?.textContent).toContain("0.017m");
    expect(tip?.textContent).toContain("0.012m");
    expect(tip?.textContent).toContain("0.011m");

    fireEvent.pointerMove(board, { clientX: 1700, clientY: 40 });
    expect(view.container.querySelector("[data-error-tip]")).toBeNull();
    expect(board.getAttribute("data-hover-no")).toBe("");

    fireEvent.pointerMove(board, { clientX: 40, clientY: 40 });
    expect(view.container.querySelector("[data-error-tip]")).not.toBeNull();
    fireEvent.pointerLeave(board);
    expect(view.container.querySelector("[data-error-tip]")).toBeNull();
  });

  it("N=21 悬停跟当前列点号，拖过阈值才滑窗并收起浮层", async () => {
    const base = sampleBaseRoute(21);
    const points = base.map((p) => trajPoint(p.no, p));
    const view = render(
      <ErrorReplay
        baseRoute={base}
        points={points}
        statusText="测试中"
        startEnabled={false}
        resetEnabled={false}
        busy
        onStart={() => undefined}
        onReset={() => undefined}
      />,
    );
    const board = mockReplayBoard(view.container);
    const heads = () =>
      [...view.container.querySelectorAll(".c4-col-head")].map(
        (el) => el.textContent,
      );

    fireEvent.pointerMove(board, { clientX: 40, clientY: 20 });
    expect(board.getAttribute("data-hover-no")).toBe("2");
    expect(
      view.container.querySelector("[data-error-tip]")?.textContent,
    ).toContain("P2定位误差");

    fireEvent.pointerDown(board, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 800,
      clientY: 20,
    });
    fireEvent.pointerMove(board, {
      pointerId: 1,
      buttons: 1,
      clientX: 800 + CASE4_ERROR_REPLAY_DRAG_THRESHOLD_PX - 1,
      clientY: 20,
    });
    expect(heads()[0]).toBe("P2");
    expect(board.getAttribute("data-replay-window-start")).toBe("1");

    fireEvent.pointerMove(board, {
      pointerId: 1,
      buttons: 1,
      clientX: 800 + CASE4_ERROR_REPLAY_SLOT_PITCH,
      clientY: 20,
    });
    expect(view.container.querySelector("[data-error-tip]")).toBeNull();
    await waitFor(() => {
      expect(heads()[0]).toBe("P1");
    });
    expect(board.getAttribute("data-replay-window-start")).toBe("0");

    fireEvent.pointerUp(board, {
      pointerId: 1,
      button: 0,
      clientX: 40,
      clientY: 20,
    });
    expect(board.getAttribute("data-hover-no")).toBe("1");
    expect(
      view.container.querySelector("[data-error-tip]")?.textContent,
    ).toContain("P1定位误差");
  });
});

function mockReplayBoard(container: HTMLElement): HTMLElement {
  const board = container.querySelector("[data-replay-surface]") as HTMLElement;
  Object.defineProperty(board, "offsetWidth", {
    configurable: true,
    value: 1748,
  });
  board.getBoundingClientRect = () =>
    ({
      width: 1748,
      height: 147,
      top: 0,
      left: 0,
      right: 1748,
      bottom: 147,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  return board;
}

function mockThrpSurface(container: HTMLElement): HTMLElement {
  const surface = container.querySelector("[data-thrp-surface]") as HTMLElement;
  Object.defineProperty(surface, "offsetWidth", {
    configurable: true,
    value: 602,
  });
  surface.getBoundingClientRect = () =>
    ({
      width: 602,
      height: 171,
      top: 0,
      left: 0,
      right: 602,
      bottom: 171,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  return surface;
}

function mockCdfSurface(container: HTMLElement): HTMLElement {
  const surface = container.querySelector("[data-cdf-surface]") as HTMLElement;
  Object.defineProperty(surface, "offsetWidth", {
    configurable: true,
    value: 280,
  });
  Object.defineProperty(surface, "offsetHeight", {
    configurable: true,
    value: 136,
  });
  surface.getBoundingClientRect = () =>
    ({
      width: 280,
      height: 136,
      top: 0,
      left: 0,
      right: 280,
      bottom: 136,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  return surface;
}
