/**
 * Shell 可见 Tab 导航：顺序、文案、active、忙锁。
 */

import { createRef } from "react";
import { fireEvent, render } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Shell, type CaseTabId } from "../../src/shell/Shell";

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

const TAB_LABELS = [
  "DT构建",
  "DT校正",
  "DT辅助通信",
  "DT辅助定位",
] as const;

function renderShell(opts: {
  activeTab?: CaseTabId;
  navigationLocked?: boolean;
  onTabChange?: (tab: CaseTabId) => void;
} = {}) {
  const stageRef = createRef<HTMLDivElement>();
  const onTabChange = opts.onTabChange ?? vi.fn();
  const view = render(
    <Shell
      activeTab={opts.activeTab ?? "case2"}
      onTabChange={onTabChange}
      stageRef={stageRef}
      navigationLocked={opts.navigationLocked}
    >
      <div>body</div>
    </Shell>,
  );
  return { view, onTabChange };
}

function tabButtons(view: ReturnType<typeof render>) {
  return view.getAllByRole("button");
}

describe("Shell 可见 Tab 导航", () => {
  it("四个 Tab 从左到右顺序与文案固定", () => {
    const { view } = renderShell();
    expect(tabButtons(view).map((el) => el.textContent)).toEqual([...TAB_LABELS]);
    expect(view.getByText("云上外场")).toBeTruthy();
    expect(view.getByText("IMT2030(6G)无线数字孪生")).toBeTruthy();
  });

  it("当前 Tab 带 is-active 与 aria-current=page", () => {
    const { view } = renderShell({ activeTab: "case3" });
    const active = view.getByRole("button", { name: "DT辅助通信" });
    expect(active.classList.contains("is-active")).toBe(true);
    expect(active.getAttribute("aria-current")).toBe("page");
    expect(active.getAttribute("data-tab")).toBe("case3");

    const other = view.getByRole("button", { name: "DT校正" });
    expect(other.classList.contains("is-active")).toBe(false);
    expect(other.getAttribute("aria-current")).toBeNull();
  });

  it("未锁定时通信 Tab 可点击并回传 case3", () => {
    const { view, onTabChange } = renderShell({ activeTab: "case2" });
    fireEvent.click(view.getByRole("button", { name: "DT辅助通信" }));
    expect(onTabChange).toHaveBeenCalledWith("case3");
  });

  it("navigationLocked 时除当前 Tab 外全部禁用", () => {
    const { view, onTabChange } = renderShell({
      activeTab: "case2",
      navigationLocked: true,
    });
    const current = view.getByRole("button", { name: "DT校正" });
    const case3 = view.getByRole("button", { name: "DT辅助通信" });
    const others = tabButtons(view).filter((el) => el !== current);

    expect((current as HTMLButtonElement).disabled).toBe(false);
    for (const el of others) {
      expect((el as HTMLButtonElement).disabled).toBe(true);
    }
    expect((case3 as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(case3);
    fireEvent.click(view.getByRole("button", { name: "DT构建" }));
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it("锁定且当前为通信 Tab 时，仅该 Tab 可点", () => {
    const { view, onTabChange } = renderShell({
      activeTab: "case3",
      navigationLocked: true,
    });
    const case3 = view.getByRole("button", { name: "DT辅助通信" });
    expect((case3 as HTMLButtonElement).disabled).toBe(false);
    expect(
      (view.getByRole("button", { name: "DT校正" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.click(case3);
    expect(onTabChange).toHaveBeenCalledWith("case3");
  });

  it("品牌标、标题与右侧标识不是按钮", () => {
    const { view } = renderShell();
    expect(tabButtons(view)).toHaveLength(4);
    expect(view.container.querySelector(".brand-area")?.closest("button")).toBeNull();
    expect(view.container.querySelector(".shell-title")?.closest("button")).toBeNull();
    expect(view.container.querySelector(".shell-corner")?.closest("button")).toBeNull();
  });
});
