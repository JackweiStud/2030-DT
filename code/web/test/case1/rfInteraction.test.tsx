import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { RfView } from "../../src/cases/case1/RfView";
import { loadConfig } from "../../src/cases/case1/config";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setup(shellScale: number) {
  vi.stubGlobal("PointerEvent", class extends MouseEvent {
    pointerId = 1;
  });
  const config = loadConfig({ VITE_CASE1_RF_VIEW_DEBUG: "true",
    VITE_CASE1_RF_VIEW_OFFSET_X: "20", VITE_CASE1_RF_VIEW_OFFSET_Y: "-10",
    VITE_CASE1_RF_VIEW_ROTATION_DEG: "30" });
  const ui = render(<RfView config={config} />);
  const frame = ui.getByRole("application");
  Object.defineProperties(frame, { clientWidth: { value: 1200 }, clientHeight: { value: 500 } });
  frame.getBoundingClientRect = () => ({ left: 100, top: 80, width: 1200 * shellScale, height: 500 * shellScale }) as DOMRect;
  frame.setPointerCapture = vi.fn(); frame.hasPointerCapture = () => true; frame.releasePointerCapture = vi.fn();
  const read = () => Object.fromEntries((ui.getByLabelText("RF 视图配置") as HTMLTextAreaElement).value.split("\n").map(line => {const [key, value] = line.split("="); return [key, Number(value)];}));
  return {frame, read};
}
it.each([1, 0.75, 1.5])("pan follows pointer at Shell scale %s", scale => {
  const {frame, read} = setup(scale);
  fireEvent.pointerDown(frame, {button: 2, clientX: 200, clientY: 200});
  fireEvent.pointerMove(frame, {clientX: 300, clientY: 250});
  fireEvent.pointerUp(frame);
  const next = read();
  expect((next.VITE_CASE1_RF_VIEW_OFFSET_X - 20) * scale).toBeCloseTo(100, 1);
  expect((next.VITE_CASE1_RF_VIEW_OFFSET_Y + 10) * scale).toBeCloseTo(50, 1);
});
it.each([1, 0.75, 1.5])("wheel keeps mouse anchor fixed at Shell scale %s", scale => {
  const {frame, read} = setup(scale);
  const anchorX = 200, anchorY = -100;
  fireEvent.wheel(frame, {deltaY: -100, clientX: 100 + (600 + anchorX) * scale, clientY: 80 + (250 + anchorY) * scale});
  const next = read();
  expect(next.VITE_CASE1_RF_VIEW_SCALE).toBe(1.1);
  expect(next.VITE_CASE1_RF_VIEW_OFFSET_X + (anchorX - 20) * 1.1).toBeCloseTo(anchorX);
  expect(next.VITE_CASE1_RF_VIEW_OFFSET_Y + (anchorY + 10) * 1.1).toBeCloseTo(anchorY);
  expect(next.VITE_CASE1_RF_VIEW_ROTATION_DEG).toBe(30);
});
