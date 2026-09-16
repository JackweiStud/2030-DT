/**
 * 截图状态机：waitForPaint 之后才 toPng；放弃清零失败不发 init。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { toPng } from "html-to-image";
import { Case4ApiError } from "../../src/cases/case4/api/case4Api";
import { runCase4Screenshot } from "../../src/cases/case4/hooks/case4Screenshot";
import { deferred, stubApi } from "./fixtures";

vi.mock("html-to-image", () => ({
  toPng: vi.fn(),
}));

afterEach(() => {
  vi.mocked(toPng).mockReset();
});

describe("runCase4Screenshot", () => {
  it("waitForPaint resolve 前不 toPng、不 POST screenshot", async () => {
    const paint = deferred<void>();
    const api = stubApi({
      postScreenshot: vi.fn(async () => ({
        path: "out/case4/case4-000.png",
        seq: 0,
      })),
    });
    vi.mocked(toPng).mockResolvedValue("data:image/png;base64,AAA");
    const running = runCase4Screenshot({
      api,
      stage: document.createElement("div"),
      mapRef: { resetView: vi.fn(), prepareCapture: vi.fn(async () => undefined) },
      signal: new AbortController().signal,
      generation: 1,
      waitForPaint: () => paint.promise,
    });
    await Promise.resolve();
    expect(toPng).not.toHaveBeenCalled();
    expect(api.postScreenshot).not.toHaveBeenCalled();
    paint.resolve();
    await expect(running).resolves.toMatchObject({ kind: "ok" });
    expect(toPng).toHaveBeenCalledTimes(1);
    expect(api.postScreenshot).toHaveBeenCalledTimes(1);
  });

  it("上传失败复用同一 Base64", async () => {
    let uploads = 0;
    const api = stubApi({
      postScreenshot: vi.fn(async () => {
        uploads += 1;
        if (uploads < 2) {
          throw new Case4ApiError("SCREENSHOT_WRITE_FAILED", "fail", 500);
        }
        return { path: "out/case4/case4-000.png", seq: 0 };
      }),
      getControl: vi.fn(async () => ({
        case: "case4",
        command: "start",
        dt_type: "with dt",
        status: "case complete",
        save_picture_flag: 1,
      })),
    });
    vi.mocked(toPng).mockResolvedValue("data:image/png;base64,ABC");
    const outcome = await runCase4Screenshot({
      api,
      stage: document.createElement("div"),
      mapRef: null,
      signal: new AbortController().signal,
      generation: 1,
      waitForPaint: async () => undefined,
      prepareCapture: async () => undefined,
    });
    expect(outcome.kind).toBe("ok");
    expect(toPng).toHaveBeenCalledTimes(1);
    expect(api.postScreenshot).toHaveBeenCalledTimes(2);
  });

  it("第三次失败后清零成功返回 dropped", async () => {
    const api = stubApi({
      postScreenshot: vi.fn(async () => {
        throw new Case4ApiError("SCREENSHOT_WRITE_FAILED", "fail", 500);
      }),
      postControl: vi.fn(async () => ({
        case: "case4",
        command: "start",
        dt_type: "with dt",
        status: "case complete",
        save_picture_flag: 0,
      })),
      getControl: vi.fn(async () => ({
        case: "case4",
        command: "start",
        dt_type: "with dt",
        status: "case complete",
        save_picture_flag: 1,
      })),
    });
    vi.mocked(toPng).mockResolvedValue("data:image/png;base64,ABC");
    const outcome = await runCase4Screenshot({
      api,
      stage: document.createElement("div"),
      mapRef: null,
      signal: new AbortController().signal,
      generation: 1,
      waitForPaint: async () => undefined,
      prepareCapture: async () => undefined,
    });
    expect(outcome.kind).toBe("dropped");
    expect(api.postControl).toHaveBeenCalledWith(
      { save_picture_flag: 0 },
      expect.anything(),
    );
  });

  it("清零失败返回 clear-fail", async () => {
    const api = stubApi({
      postScreenshot: vi.fn(async () => {
        throw new Case4ApiError("SCREENSHOT_WRITE_FAILED", "fail", 500);
      }),
      postControl: vi.fn(async () => {
        throw new Case4ApiError("REQUEST_TIMEOUT", "timeout", 0);
      }),
      getControl: vi.fn(async () => ({
        case: "case4",
        command: "start",
        dt_type: "with dt",
        status: "case complete",
        save_picture_flag: 1,
      })),
    });
    vi.mocked(toPng).mockResolvedValue("data:image/png;base64,ABC");
    const outcome = await runCase4Screenshot({
      api,
      stage: document.createElement("div"),
      mapRef: null,
      signal: new AbortController().signal,
      generation: 1,
      waitForPaint: async () => undefined,
      prepareCapture: async () => undefined,
    });
    expect(outcome.kind).toBe("clear-fail");
  });
});
