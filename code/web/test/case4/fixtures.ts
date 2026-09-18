/**
 * Case4 测试夹具。只用于 test/，不进正式运行路径。
 */

import type { Case4Api } from "../../src/cases/case4/api/case4Api";
import type { Case4RuntimeConfig } from "../../src/cases/case4/config/case4RuntimeConfig";
import type {
  BasePoint,
  ControlSnapshot,
  Statistics,
  ThroughputSample,
  ThroughputSnapshot,
  TrajectoryPoint,
  TrajectorySnapshot,
  XYZ,
} from "../../src/cases/case4/types";

export const CASE4_TEST_CONFIG: Case4RuntimeConfig = {
  pollMs: 5,
  mapOriginX: 916,
  mapOriginY: 608,
  mapUnitsPerPx: 0.11,
  mapImageScale: 2,
  mapImageRotationDeg: 0,
  mapImageOffsetX: 205,
  mapImageOffsetY: -670,
  mapDebugShow: true,
  reflectionEnable: false,
  bsXyz: { x: 1, y: 5, z: 7 },
};

export function xyz(x: number, y: number, z = 0): XYZ {
  return { x, y, z };
}

export function basePoint(no: number, x: number, y: number, z = 0): BasePoint {
  return { no, x, y, z };
}

export function sampleBaseRoute(count = 3): BasePoint[] {
  return Array.from({ length: count }, (_, i) =>
    basePoint(i + 1, i + 1, 15 - i, 0),
  );
}

export function idleControl(
  partial: Partial<ControlSnapshot> = {},
): ControlSnapshot {
  return {
    case: "case4",
    command: "init",
    dt_type: "",
    status: "",
    save_picture_flag: 0,
    ...partial,
  };
}

export function startControl(
  status: ControlSnapshot["status"] = "",
  extra: Partial<ControlSnapshot> = {},
): ControlSnapshot {
  return idleControl({
    command: "start",
    dt_type: "all",
    status,
    ...extra,
  });
}

export function reinitControl(
  status: ControlSnapshot["status"] = "",
  extra: Partial<ControlSnapshot> = {},
): ControlSnapshot {
  return idleControl({
    command: "reinit",
    dt_type: "all",
    status,
    ...extra,
  });
}

export function trajPoint(
  no: number,
  base: XYZ,
  extras?: Partial<
    Pick<TrajectoryPoint, "traditional" | "commercial" | "dt" | "reflection">
  >,
): TrajectoryPoint {
  return {
    no,
    traditional: extras?.traditional ?? {
      x: base.x + 0.3,
      y: base.y,
      z: base.z,
    },
    commercial: extras?.commercial ?? {
      x: base.x + 0.2,
      y: base.y,
      z: base.z,
    },
    dt: extras?.dt ?? { x: base.x + 0.1, y: base.y, z: base.z },
    reflection: extras?.reflection,
  };
}

export function trajectorySnapshot(
  points: TrajectoryPoint[],
  pendingTail = false,
): TrajectorySnapshot {
  return { points, completeCount: points.length, pendingTail };
}

export function liveTrajectory(
  count: number,
  route: BasePoint[] = sampleBaseRoute(Math.max(count, 1)),
): TrajectorySnapshot {
  const points = route.slice(0, count).map((p) => trajPoint(p.no, p));
  return trajectorySnapshot(points);
}

export function thrpSamples(count: number, startNo = 1): ThroughputSample[] {
  return Array.from({ length: count }, (_, i) => ({
    no: startNo + i,
    gbps: 8 + i * 0.1,
  }));
}

export function thrpSnapshot(
  samples: ThroughputSample[],
  pendingTail = false,
): ThroughputSnapshot {
  return { samples, pendingTail };
}

export function sampleStatistics(): Statistics {
  return {
    cdf: {
      traditional: [
        { errorM: 0.2, probability: 0.4 },
        { errorM: 0.8, probability: 0.9 },
      ],
      commercial: [
        { errorM: 0.15, probability: 0.5 },
        { errorM: 0.6, probability: 0.9 },
      ],
      dt: [
        { errorM: 0.05, probability: 0.5 },
        { errorM: 0.2, probability: 0.9 },
      ],
    },
    cep: {
      traditional: { p50M: 0.4, p90M: 0.9 },
      commercial: { p50M: 0.3, p90M: 0.7 },
      dt: { p50M: 0.1, p90M: 0.25 },
    },
    nlosRatio: 0.897,
  };
}

export function sampleResult(pointCount = 3) {
  const route = sampleBaseRoute(pointCount);
  return {
    trajectory: liveTrajectory(pointCount, route),
    throughput: {
      without: thrpSnapshot(thrpSamples(2)),
      with: thrpSnapshot(thrpSamples(3)),
    },
    statistics: sampleStatistics(),
  };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

export function okJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function stubApi(partial: Partial<Case4Api> = {}): Case4Api {
  return {
    getControl: async () => idleControl(),
    postControl: async () => idleControl(),
    getInitData: async () => ({ baseRoute: sampleBaseRoute() }),
    getTrajectory: async () => liveTrajectory(0),
    getThroughput: async () => thrpSnapshot([]),
    getResult: async () => sampleResult(),
    postScreenshot: async () => ({ path: "out/case4/case4-000.png", seq: 0 }),
    ...partial,
  };
}
