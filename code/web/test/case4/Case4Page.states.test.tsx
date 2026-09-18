/**
 * Case4 页面结构、按钮与现场环境。controller 注入 mock。
 */
import { fireEvent, render } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Case4Page } from "../../src/cases/case4/Case4Page";
import {
  useCase4Controller,
  type Case4Controller,
} from "../../src/cases/case4/hooks/useCase4Controller";
import { selectCase4Presentation } from "../../src/cases/case4/presentation/selectCase4Presentation";
import {
  case4Reducer,
  createInitialCase4State,
} from "../../src/cases/case4/state/case4Reducer";
import { SiteEnvWindowContext } from "../../src/shell/siteEnvWindowContext";
import { CASE4_TEST_CONFIG, sampleBaseRoute, sampleResult, trajPoint, trajectorySnapshot } from "./fixtures";

vi.mock("../../src/cases/case4/hooks/useCase4Controller", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/cases/case4/hooks/useCase4Controller")
  >("../../src/cases/case4/hooks/useCase4Controller");
  return { ...actual, useCase4Controller: vi.fn() };
});

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

function fromState(
  state: Case4Controller["state"],
  extra: Partial<Case4Controller> = {},
): Case4Controller {
  const view = selectCase4Presentation(state);
  return {
    state,
    ...view,
    onStart: vi.fn(),
    onReinit: vi.fn(),
    ...extra,
  };
}

function renderPage(
  ctrl: Case4Controller,
  config: typeof CASE4_TEST_CONFIG = CASE4_TEST_CONFIG,
) {
  vi.mocked(useCase4Controller).mockImplementation(() => ctrl);
  const open = vi.fn();
  const view = render(
    <SiteEnvWindowContext.Provider value={{ open, close: vi.fn() }}>
      <Case4Page
        config={config}
        stageElementRef={{ current: document.createElement("div") }}
      />
    </SiteEnvWindowContext.Provider>,
  );
  return { view, open, ctrl };
}

function readyState() {
  return case4Reducer(createInitialCase4State(), {
    type: "INIT_READY",
    baseRoute: sampleBaseRoute(5),
  });
}

describe("Case4Page", () => {
  it("initial：开始可用、重置禁用、NLOS --、现场环境打开 Shell", () => {
    const { view, open } = renderPage(fromState(readyState()));
    const page = view.container.querySelector(".case4-page");
    expect(page?.getAttribute("data-state")).toBe("initial");
    const start = view.getByRole("button", { name: "开始" }) as HTMLButtonElement;
    const reset = view.getByRole("button", { name: "重置" }) as HTMLButtonElement;
    expect(start.disabled).toBe(false);
    expect(reset.disabled).toBe(true);
    expect(view.container.querySelector(".c4-nlos-value")?.textContent).toBe("--");
    expect(view.container.querySelector(".c4-cdf-empty")).toBeNull();
    expect(view.container.querySelector(".c4-cdf-x")?.textContent).not.toContain(
      "--",
    );
    expect(view.container.querySelector(".c4-cep-label")?.textContent).toBe(
      "传统",
    );
    const thrpX = [
      ...view.container.querySelectorAll(".c4-thrp-x span"),
    ] as HTMLSpanElement[];
    expect(thrpX).toHaveLength(20);
    expect(Number.parseFloat(thrpX[0]?.style.left ?? "0")).toBeGreaterThan(20);
    fireEvent.click(view.getByRole("button", { name: "现场环境 >" }));
    expect(open).toHaveBeenCalled();
    expect(
      view.container.querySelector('[aria-disabled="true"]')?.textContent,
    ).toContain("3D");
  });

  it("running：双禁、统计仍空", () => {
    let s = readyState();
    s = case4Reducer(s, { type: "ACTION_BEGIN", kind: "start", generation: 1 });
    const { view } = renderPage(fromState(s));
    expect(view.container.querySelector(".case4-page")?.getAttribute("data-state")).toBe(
      "running",
    );
    expect(
      (view.getByRole("button", { name: "开始" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (view.getByRole("button", { name: "重置" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(view.container.querySelector(".c4-nlos-value")?.textContent).toBe("--");
    expect(view.container.querySelector(".c4-cep-label")?.textContent).toBe(
      "传统",
    );
  });

  it("completed：统计亮起；busy 时重置仍禁用", () => {
    let s = readyState();
    s = case4Reducer(s, { type: "ACTION_BEGIN", kind: "start", generation: 1 });
    s = case4Reducer(s, { type: "RESULT_SUBMITTED", ...sampleResult(2) });
    const { view } = renderPage(fromState(s));
    expect(view.container.querySelector(".case4-page")?.getAttribute("data-state")).toBe(
      "completed",
    );
    expect(view.container.querySelector(".c4-nlos-value")?.textContent).toBe("89.7");
    expect(
      (view.getByRole("button", { name: "重置" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(view.getByText("已完成")).toBeTruthy();
  });

  it("仅 running 播放反射亮段，finalizing 停止", () => {
    const snapshot = trajectorySnapshot([
      trajPoint(1, { x: 1, y: 15, z: 0 }, {
        reflection: {
          state: "ready",
          los: true,
          points: [{ id: 1, x: 2, y: 14, z: 0 }],
        },
      }),
    ]);
    let s = readyState();
    s = case4Reducer(s, { type: "ACTION_BEGIN", kind: "start", generation: 1 });
    s = case4Reducer(s, { type: "LIVE_TRAJECTORY", snapshot });
    const config = { ...CASE4_TEST_CONFIG, reflectionEnable: true };
    const running = renderPage(fromState(s), config);
    fireEvent.load(
      running.view.container.querySelector("img.c4-map-image") as HTMLImageElement,
    );
    expect(
      running.view.container
        .querySelector("[data-reflection-beam]")
        ?.getAttribute("data-reflection-beam"),
    ).toBe("running");
    expect(
      running.view.container.querySelectorAll(".c4-reflection__beam").length,
    ).toBeGreaterThan(0);

    s = case4Reducer(s, { type: "ENTER_FINALIZING" });
    const finalizing = renderPage(fromState(s), config);
    fireEvent.load(
      finalizing.view.container.querySelector(
        "img.c4-map-image",
      ) as HTMLImageElement,
    );
    expect(
      finalizing.view.container
        .querySelector("[data-reflection-beam]")
        ?.getAttribute("data-reflection-beam"),
    ).toBe("static");
    expect(
      finalizing.view.container.querySelectorAll(".c4-reflection__beam"),
    ).toHaveLength(0);
  });

  it("CSS 选择器落在 .case4-page 下，3D 不可点", () => {
    const { view } = renderPage(fromState(readyState()));
    expect(view.container.querySelector(".metric-card")).toBeNull();
    const three = view.container.querySelector(
      ".c4-view-toggle__item.is-disabled",
    ) as HTMLElement;
    fireEvent.click(three);
    expect(three.getAttribute("aria-disabled")).toBe("true");
  });
});
