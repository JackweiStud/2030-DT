/**
 * App 导航挂载：可见 Tab 挂 Case3 V2；busy 互斥。
 */

import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";

const { case2Busy, case3Busy, case4Busy } = vi.hoisted(() => ({
  case2Busy: { onMount: false },
  case3Busy: { onMount: false },
  case4Busy: { onMount: false },
}));

vi.mock("../../src/cases/case1/Case1Page", () => ({
  Case1Page: () => <div data-testid="case1-page" />,
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

vi.mock("../../src/cases/case3-v2/Case3V2Page", async () => {
  const { useEffect } = await import("react");
  return {
    Case3V2Page: ({
      onBusyChange,
    }: {
      onBusyChange?: (busy: boolean) => void;
    }) => {
      useEffect(() => {
        if (case3Busy.onMount) onBusyChange?.(true);
      }, [onBusyChange]);
      return <div data-testid="case3-v2-page" />;
    },
  };
});

vi.mock("../../src/cases/case4/Case4Page", async () => {
  const { useEffect } = await import("react");
  return {
    Case4Page: ({
      onBusyChange,
    }: {
      onBusyChange?: (busy: boolean) => void;
    }) => {
      useEffect(() => {
        if (case4Busy.onMount) onBusyChange?.(true);
      }, [onBusyChange]);
      return <div data-testid="case4-page" />;
    },
  };
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

afterEach(() => {
  case2Busy.onMount = false;
  case3Busy.onMount = false;
  case4Busy.onMount = false;
});

function tab(name: string, exact = true) {
  return { name, exact };
}

describe("App Shell 导航挂载", () => {
  it("默认挂载 case1 首页", () => {
    const view = render(<App />);
    expect(view.getByTestId("case1-page")).toBeTruthy();
    expect(view.queryByTestId("case2-page")).toBeNull();
    expect(view.queryByTestId("case3-v2-page")).toBeNull();
    expect(view.queryByText("建设中")).toBeNull();
    expect(
      view.getByRole("button", tab("DT构建")).classList.contains("is-active"),
    ).toBe(true);
  });

  it("DT辅助通信 挂载 Case3 V2", () => {
    const view = render(<App />);
    fireEvent.click(view.getByRole("button", tab("DT辅助通信")));
    expect(view.getByTestId("case3-v2-page")).toBeTruthy();
    expect(view.queryByText("建设中")).toBeNull();
    expect(view.queryByTestId("case2-page")).toBeNull();
    expect(
      view.getByRole("button", tab("DT辅助通信")).classList.contains("is-active"),
    ).toBe(true);
  });

  it("case1 与 case4 挂载正式页，切换卸载 case1", () => {
    const view = render(<App />);
    fireEvent.click(view.getByRole("button", tab("DT构建")));
    expect(view.getByTestId("case1-page")).toBeTruthy();
    fireEvent.click(view.getByRole("button", tab("DT辅助定位")));
    expect(view.queryByText("建设中")).toBeNull();
    expect(view.getByTestId("case4-page")).toBeTruthy();
    expect(view.queryByTestId("case1-page")).toBeNull();
    expect(view.queryByTestId("case2-page")).toBeNull();
    expect(view.queryByTestId("case3-v2-page")).toBeNull();
  });

  it("case2 忙时其他非当前 Tab 一并禁用", () => {
    case2Busy.onMount = true;
    const view = render(<App />);
    fireEvent.click(view.getByRole("button", tab("DT校正")));
    const current = view.getByRole("button", tab("DT校正"));
    const case3 = view.getByRole("button", tab("DT辅助通信"));
    expect((current as HTMLButtonElement).disabled).toBe(false);
    expect((case3 as HTMLButtonElement).disabled).toBe(true);
    expect(
      (view.getByRole("button", tab("DT构建")) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (view.getByRole("button", tab("DT辅助定位")) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.click(case3);
    expect(view.getByTestId("case2-page")).toBeTruthy();
    expect(view.queryByTestId("case3-v2-page")).toBeNull();
  });

  it("case3 busy 时锁定其他 Tab", () => {
    case3Busy.onMount = true;
    const view = render(<App />);
    fireEvent.click(view.getByRole("button", tab("DT辅助通信")));
    expect(view.getByTestId("case3-v2-page")).toBeTruthy();
    expect(
      (view.getByRole("button", tab("DT辅助通信")) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (view.getByRole("button", tab("DT校正")) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (view.getByRole("button", tab("DT构建")) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (view.getByRole("button", tab("DT辅助定位")) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.click(view.getByRole("button", tab("DT校正")));
    expect(view.getByTestId("case3-v2-page")).toBeTruthy();
    expect(view.queryByTestId("case2-page")).toBeNull();
  });

  it("case4 busy 时锁定其他 Tab", () => {
    case4Busy.onMount = true;
    const view = render(<App />);
    fireEvent.click(view.getByRole("button", tab("DT辅助定位")));
    expect(view.getByTestId("case4-page")).toBeTruthy();
    expect(
      (view.getByRole("button", tab("DT辅助定位")) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (view.getByRole("button", tab("DT校正")) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (view.getByRole("button", tab("DT辅助通信")) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (view.getByRole("button", tab("DT构建")) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.click(view.getByRole("button", tab("DT校正")));
    expect(view.getByTestId("case4-page")).toBeTruthy();
    expect(view.queryByTestId("case2-page")).toBeNull();
  });
});
