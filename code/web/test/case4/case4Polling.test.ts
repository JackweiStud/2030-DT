/**
 * 串行轮询原语与控制归属。
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  controlMatchesAction,
  createSerialPoll,
} from "../../src/cases/case4/hooks/case4Polling";
import { deferred } from "./fixtures";

afterEach(() => {
  // 测试内 stop
});

describe("controlMatchesAction", () => {
  it("只接受本 case 本动作元组", () => {
    expect(
      controlMatchesAction(
        { case: "case4", command: "start", dt_type: "all" },
        "start",
      ),
    ).toBe(true);
    expect(
      controlMatchesAction(
        { case: "case3", command: "start", dt_type: "with dt" },
        "start",
      ),
    ).toBe(false);
    expect(
      controlMatchesAction(
        { case: "case4", command: "start", dt_type: "without dt" },
        "start",
      ),
    ).toBe(false);
    expect(
      controlMatchesAction(
        { case: "case4", command: "reinit", dt_type: "all" },
        "start",
      ),
    ).toBe(false);
  });
});

describe("createSerialPoll", () => {
  it("禁止重入：上一拍未结束不排下一拍", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    let ticks = 0;
    const gate = deferred<void>();
    const poll = createSerialPoll({
      intervalMs: 5,
      async tick() {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        ticks += 1;
        if (ticks === 1) await gate.promise;
        concurrent -= 1;
      },
    });
    poll.start();
    await new Promise((r) => setTimeout(r, 20));
    expect(ticks).toBe(1);
    gate.resolve();
    await new Promise((r) => setTimeout(r, 20));
    poll.stop();
    expect(maxConcurrent).toBe(1);
    expect(ticks).toBeGreaterThan(1);
  });

  it("两路独立定时器，一路挂起不推迟另一路", async () => {
    let a = 0;
    let b = 0;
    const hang = deferred<void>();
    const pa = createSerialPoll({
      intervalMs: 5,
      async tick() {
        a += 1;
        if (a === 1) await hang.promise;
      },
    });
    const pb = createSerialPoll({
      intervalMs: 5,
      async tick() {
        b += 1;
      },
    });
    pa.start();
    pb.start();
    await new Promise((r) => setTimeout(r, 40));
    expect(a).toBe(1);
    expect(b).toBeGreaterThan(2);
    hang.resolve();
    pa.stop();
    pb.stop();
  });
});
