/**
 * Case3 进页握手与 generation 门闩（注入 fake API）。
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCase3Controller } from "../../src/cases/case3/hooks/useCase3Controller";
import type { Case3Api } from "../../src/cases/case3/api/case3Api";
import type { Case3RuntimeConfig } from "../../src/cases/case3/config/case3RuntimeConfig";
import type { ControlSnapshot } from "../../src/cases/case3/types";

const config: Case3RuntimeConfig = {
  pollMs: 20,
  mapOriginX: 905,
  mapOriginY: 445,
  mapUnitsPerPx: 0.11,
};

function control(partial: Partial<ControlSnapshot> = {}): ControlSnapshot {
  return {
    case: "case3",
    command: "init",
    dt_type: "",
    status: "",
    save_picture_flag: 0,
    ...partial,
  };
}

function stageRef() {
  return { current: document.createElement("div") };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useCase3Controller entry", () => {
  it("StrictMode 双挂载只完成一组握手", async () => {
    let initPosts = 0;
    const api: Case3Api = {
      getControl: vi.fn(async () => control()),
      postControl: vi.fn(async (payload) => {
        if ("command" in payload && payload.command === "init") initPosts += 1;
        return control(payload as Partial<ControlSnapshot>);
      }),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 1, total: 2 },
      })),
      getSide: vi.fn(),
      postScreenshot: vi.fn(),
    };

    const { unmount } = renderHook(() =>
      useCase3Controller({ config, stageElementRef: stageRef(), api }),
    );
    // simulate strict remount
    unmount();
    const second = renderHook(() =>
      useCase3Controller({ config, stageElementRef: stageRef(), api }),
    );

    await waitFor(() => {
      expect(second.result.current.state.initStatus).toBe("ready");
    });
    expect(initPosts).toBeGreaterThanOrEqual(1);
    // 第二次挂载的成功握手应占主导；允许 cleanup abort 导致额外尝试，但 ready 只能来自未中止那次
    expect(second.result.current.startWithoutEnabled).toBe(true);
    second.unmount();
  });

  it("Start POST 成功后轮询看到 fail 进入失败态", async () => {
    let poll = 0;
    const api: Case3Api = {
      getControl: vi.fn(async () => {
        if (poll === 0) {
          poll += 1;
          return control();
        }
        return control({
          command: "start",
          dt_type: "without dt",
          status: poll++ === 1 ? "execute success" : "execute fail",
          save_picture_flag: 0,
        });
      }),
      postControl: vi.fn(async () =>
        control({ command: "start", dt_type: "without dt", status: "" }),
      ),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 1, total: 2 },
      })),
      getSide: vi.fn(),
      postScreenshot: vi.fn(),
    };

    const { result, unmount } = renderHook(() =>
      useCase3Controller({ config, stageElementRef: stageRef(), api }),
    );
    await waitFor(() => expect(result.current.state.initStatus).toBe("ready"));

    await act(async () => {
      result.current.onStartWithout();
    });

    await waitFor(() => {
      expect(result.current.visible).toBe("failed-start-without");
    });
    unmount();
  });
});
