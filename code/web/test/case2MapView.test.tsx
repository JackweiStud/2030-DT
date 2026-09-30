import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatCase2MapView, loadCase2MapView } from "../src/cases/case2/components/case2MapView";
import { loadCase2RuntimeConfig } from "../src/cases/case2/metrics/heatmapConfig";

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("case2 map view", () => {
  it("默认关闭调试，非法数值回退、缩放旋转限幅", () => {
    expect(loadCase2MapView({})).toEqual({ debugInfo: false, view: { scale: 1, rotation: 0, offsetX: 0, offsetY: 0 } });
    expect(loadCase2MapView({ VITE_CASE2_MAP_SCALE: "Infinity", VITE_CASE2_MAP_OFFSET_X_PERCENT: "bad" }).view.scale).toBe(1);
    expect(loadCase2MapView({ VITE_CASE2_MAP_SCALE: "99", VITE_CASE2_MAP_ROTATION_DEG: "-100" }).view).toMatchObject({ scale: 5, rotation: -90 });
  });
  it("复制文本可无损回填 env", () => {
    const view = { scale: 1.21, rotation: -12.34, offsetX: 3.4567, offsetY: -8.9 };
    const env = Object.fromEntries(formatCase2MapView(view).split("\n").map(line => line.split("=")));
    expect(loadCase2MapView(env).view).toEqual(view);
  });
  it("六图加载统一配置，全屏缩放、复制、恢复默认；关闭调试后隐藏面板", async () => {
    vi.stubEnv("VITE_CASE2_MAP_DEBUG_INFO", "true");
    vi.stubEnv("VITE_CASE2_MAP_SCALE", "1.5");
    vi.stubEnv("VITE_CASE2_MAP_ROTATION_DEG", "12");
    vi.stubEnv("VITE_CASE2_MAP_OFFSET_X_PERCENT", "10");
    vi.stubEnv("VITE_CASE2_MAP_OFFSET_Y_PERCENT", "-5");
    vi.resetModules();
    const { HeatmapCard } = await import("../src/cases/case2/components/HeatmapCard");
    const config = loadCase2RuntimeConfig({});
    const { container } = render(<>{Array.from({ length: 6 }, (_, i) => <HeatmapCard key={i} matrix={null} config={config} empty metricClass="rss" label={`map${i}`} variant={i < 3 ? "initial" : "calibrated"} />)}</>);
    for (const node of container.querySelectorAll<HTMLElement>(".heatmap-card__xform")) {
      expect(node.style.transform).toBe("translate(10%, -5%) rotate(12deg) scale(1.5)");
    }
    fireEvent.click(screen.getByRole("button", { name: "map0 initial 全屏查看" }));
    const frame = document.querySelector(".case2-heatmap-lightbox__frame")!;
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 1000, height: 500 } as DOMRect);
    fireEvent.wheel(frame, { deltaY: -100, clientX: 500, clientY: 250 });
    const text = screen.getByRole("textbox", { name: "地图视图配置" }) as HTMLTextAreaElement;
    expect(text.value).toContain("VITE_CASE2_MAP_SCALE=1.6500000000000001");
    Object.assign(frame, { setPointerCapture: vi.fn(), hasPointerCapture: () => false });
    const pointer = (type: string, x: number, y: number, button = 0) => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, { pointerId: 1, clientX: x, clientY: y, button });
      fireEvent(frame, event);
    };
    pointer("pointerdown", 100, 100, 2);
    pointer("pointermove", 200, 150, 2);
    pointer("pointerup", 200, 150, 2);
    expect(loadCase2MapView(Object.fromEntries(text.value.split("\n").map(line => line.split("=")))).view).toMatchObject({ offsetX: 21, offsetY: 4.5 });
    pointer("pointerdown", 100, 100);
    pointer("pointermove", 300, 100);
    pointer("pointerup", 300, 100);
    expect(text.value).toContain("VITE_CASE2_MAP_ROTATION_DEG=30");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    fireEvent.click(screen.getByRole("button", { name: "复制配置" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(text.value));
    fireEvent.click(screen.getByRole("button", { name: "恢复初始缩放、旋转与平移" }));
    expect(text.value).toContain("VITE_CASE2_MAP_SCALE=1.5");
    writeText.mockRejectedValue(new Error("denied"));
    fireEvent.click(screen.getByRole("button", { name: "复制配置" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("手动复制"));
    cleanup();
    vi.stubEnv("VITE_CASE2_MAP_DEBUG_INFO", "false");
    vi.resetModules();
    const { HeatmapCard: QuietCard } = await import("../src/cases/case2/components/HeatmapCard");
    render(<QuietCard matrix={null} config={config} empty metricClass="rss" label="quiet" variant="initial" />);
    fireEvent.click(screen.getByRole("button", { name: "quiet initial 全屏查看" }));
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
