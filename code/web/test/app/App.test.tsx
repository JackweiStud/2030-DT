/**
 * App 导航挂载：第五 Tab 建设中；case2 / 旧 case3 仍走原页面。
 */

import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";

const { case2Busy } = vi.hoisted(() => ({
  case2Busy: { onMount: false },
}));

vi.mock("../../src/cases/case2/Case2Page", async () => {
  const { useEffect } = await import("react");
  return {
    Case2Page: ({
      onBusyChange,
    }: {
      onBusyChange?: (busy: boolean) => void;
    }) => {
      useEffect(() => {
        if (case2Busy.onMount) onBusyChange?.(true);
      }, [onBusyChange]);
      return <div data-testid="case2-page" />;
    },
  };
});

vi.mock("../../src/cases/case3/Case3Page", () => ({
  Case3Page: () => <div data-testid="case3-page" />,
}));

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

afterEach(() => {
  case2Busy.onMount = false;
});

function tab(name: string, exact = true) {
  return { name, exact };
}

describe("App Shell 导航挂载", () => {
  it("默认挂载原 case2 页面路径", () => {
    const view = render(<App />);
    expect(view.getByTestId("case2-page")).toBeTruthy();
    expect(view.queryByTestId("case3-page")).toBeNull();
    expect(view.queryByText("建设中")).toBeNull();
  });

  it("DT for Comm 仍挂载原 case3 页面路径", () => {
    const view = render(<App />);
    fireEvent.click(view.getByRole("button", tab("DT for Comm")));
    expect(view.getByTestId("case3-page")).toBeTruthy();
    expect(view.queryByTestId("case2-page")).toBeNull();
    expect(view.queryByText("建设中")).toBeNull();
  });

  it("第五 Tab 可点击并显示建设中", () => {
    const view = render(<App />);
    fireEvent.click(view.getByRole("button", tab("DT for Comm new")));
    expect(view.getByText("建设中")).toBeTruthy();
    expect(view.queryByTestId("case2-page")).toBeNull();
    expect(view.queryByTestId("case3-page")).toBeNull();
    expect(
      view.getByRole("button", tab("DT for Comm new")).classList.contains("is-active"),
    ).toBe(true);
  });

  it("case1 与 case4 仍为建设中", () => {
    const view = render(<App />);
    fireEvent.click(view.getByRole("button", tab("DT Construction")));
    expect(view.getByText("建设中")).toBeTruthy();
    fireEvent.click(view.getByRole("button", tab("DT for positioning")));
    expect(view.getByText("建设中")).toBeTruthy();
    expect(view.queryByTestId("case2-page")).toBeNull();
    expect(view.queryByTestId("case3-page")).toBeNull();
  });

  it("case2 忙时第五 Tab 与其他非当前 Tab 一并禁用", () => {
    case2Busy.onMount = true;
    const view = render(<App />);
    const current = view.getByRole("button", tab("DT Calibration"));
    const case5 = view.getByRole("button", tab("DT for Comm new"));
    expect((current as HTMLButtonElement).disabled).toBe(false);
    expect((case5 as HTMLButtonElement).disabled).toBe(true);
    expect(
      (view.getByRole("button", tab("DT Construction")) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (view.getByRole("button", tab("DT for Comm")) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (view.getByRole("button", tab("DT for positioning")) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.click(case5);
    expect(view.getByTestId("case2-page")).toBeTruthy();
    expect(view.queryByText("建设中")).toBeNull();
  });
});
