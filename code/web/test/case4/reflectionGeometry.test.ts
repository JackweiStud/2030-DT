/**
 * Case4 反射路径几何：LOS/NLOS 与独立 hop。
 */
import { describe, expect, it } from "vitest";
import {
  buildReflectionPaths,
  losLabelPosition,
  offsetPolylineSine,
  reflectionRiLabel,
  reflectionWavePhase,
} from "../../src/cases/case4/components/map/reflectionGeometry";
import type { ReflectionPayload } from "../../src/cases/case4/types";

const ue = { x: 1, y: 2, z: 0 };
const bs = { x: 9, y: 8, z: 7 };

describe("buildReflectionPaths", () => {
  it("LOS n=0 仅直达；n=2 直达加两条独立 hop", () => {
    const los0: ReflectionPayload = { state: "ready", los: true, points: [] };
    expect(buildReflectionPaths(ue, bs, los0)).toEqual([
      { id: "los", kind: "los", points: [ue, bs] },
    ]);
    const los2: ReflectionPayload = {
      state: "ready",
      los: true,
      points: [
        { id: 1, x: 3, y: 4, z: 0 },
        { id: 2, x: 5, y: 6, z: 0 },
      ],
    };
    const paths = buildReflectionPaths(ue, bs, los2);
    expect(paths.map((path) => path.id)).toEqual(["los", "r1", "r2"]);
    expect(paths[1]?.points).toEqual([ue, { x: 3, y: 4, z: 0 }, bs]);
  });

  it("NLOS 不画直达；invalid/missing 清空", () => {
    const nlos: ReflectionPayload = {
      state: "ready",
      los: false,
      points: [{ id: 2, x: 3, y: 4, z: 0 }],
    };
    expect(buildReflectionPaths(ue, bs, nlos).map((path) => path.id)).toEqual([
      "r2",
    ]);
    expect(
      buildReflectionPaths(ue, bs, { state: "invalid", los: null, points: [] }),
    ).toEqual([]);
    expect(
      buildReflectionPaths(ue, bs, { state: "missing", los: null, points: [] }),
    ).toEqual([]);
  });
});

describe("offsetPolylineSine", () => {
  it("端点钉死，中段有垂直偏移", () => {
    const start = { imageX: 0, imageY: 10 };
    const end = { imageX: 160, imageY: 10 };
    const wave = offsetPolylineSine([start, end], {
      amplitudePx: 4,
      wavelengthPx: 32,
      stepPx: 4,
      fadePx: 14,
    });
    expect(wave[0]?.imageX).toBeCloseTo(0, 5);
    expect(wave[0]?.imageY).toBeCloseTo(10, 5);
    expect(wave.at(-1)?.imageX).toBeCloseTo(160, 5);
    expect(wave.at(-1)?.imageY).toBeCloseTo(10, 5);
    const mid = wave.find(
      (point) => point.imageX > 70 && point.imageX < 90,
    );
    expect(mid).toBeTruthy();
    expect(Math.abs((mid?.imageY ?? 10) - 10)).toBeGreaterThan(1);
  });

  it("折线拐角钉死在顶点", () => {
    const a = { imageX: 0, imageY: 0 };
    const ri = { imageX: 80, imageY: 40 };
    const b = { imageX: 160, imageY: 0 };
    const wave = offsetPolylineSine([a, ri, b], {
      amplitudePx: 4,
      wavelengthPx: 32,
      stepPx: 4,
      fadePx: 14,
    });
    const nearest = wave.reduce(
      (best, point) => {
        const d = Math.hypot(point.imageX - ri.imageX, point.imageY - ri.imageY);
        return d < best.d ? { d, point } : best;
      },
      { d: Infinity, point: wave[0] },
    );
    expect(nearest.d).toBeLessThan(0.05);
  });

  it("不同路径相位错开，中段偏移不同", () => {
    const start = { imageX: 0, imageY: 10 };
    const end = { imageX: 160, imageY: 10 };
    const midOf = (phase: number) =>
      offsetPolylineSine([start, end], {
        amplitudePx: 4,
        wavelengthPx: 32,
        stepPx: 4,
        fadePx: 14,
        phase,
      }).find((point) => point.imageX > 70 && point.imageX < 90)?.imageY ?? 10;
    expect(reflectionWavePhase(1) - reflectionWavePhase(0)).toBeCloseTo(
      (2 * Math.PI) / 3,
      8,
    );
    expect(midOf(reflectionWavePhase(0))).not.toBeCloseTo(
      midOf(reflectionWavePhase(1)),
      3,
    );
  });
});

describe("reflectionRiLabel", () => {
  it("反射点标 NLOS R1 / NLOS R2", () => {
    expect(reflectionRiLabel(1)).toBe("NLOS R1");
    expect(reflectionRiLabel(2)).toBe("NLOS R2");
  });
});

describe("losLabelPosition", () => {
  it("竖直线把 LOS 标到线左侧，不落在中点", () => {
    const ue = { imageX: 0, imageY: 100 };
    const bs = { imageX: 0, imageY: 0 };
    const pos = losLabelPosition(ue, bs, 18);
    expect(pos.imageY).toBeCloseTo(50, 5);
    expect(pos.imageX).toBeCloseTo(-18, 5);
  });
});
