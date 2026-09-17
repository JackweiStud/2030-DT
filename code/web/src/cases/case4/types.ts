/**
 * Case4 REST / 本地状态类型。
 * 字段语义以 API-CONTRACT 为准；本文件不重新定义业务含义。
 * 不持有 timer、AbortController、Base64 或 DOM 句柄。
 */

export const CASE4_SCHEMES = ["traditional", "commercial", "dt"] as const;
/** 与 CASE4_SCHEMES 同引用，供 metrics/api 遍历。 */
export const SCHEMES = CASE4_SCHEMES;
export type Scheme = (typeof CASE4_SCHEMES)[number];
export type ThroughputSide = "without" | "with";

export type ControlStatus =
  | ""
  | "execute success"
  | "execute fail"
  | "case complete"
  | "reinit complete";

export type XYZ = { x: number; y: number; z: number };
export type BasePoint = XYZ & { no: number };

export type TrajectoryPoint = {
  no: number;
  traditional: XYZ;
  commercial: XYZ;
  dt: XYZ;
};

export type TrajectorySnapshot = {
  points: TrajectoryPoint[];
  completeCount: number;
  pendingTail: boolean;
};

export type ThroughputSample = { no: number; gbps: number };
export type ThroughputSnapshot = {
  samples: ThroughputSample[];
  pendingTail: boolean;
};

export type CdfPoint = { errorM: number; probability: number };
export type CepPoint = { p50M: number; p90M: number };
export type Statistics = {
  cdf: Record<Scheme, CdfPoint[]>;
  cep: Record<Scheme, CepPoint>;
  nlosRatio: number;
};

export type Case4Result = {
  trajectory: TrajectorySnapshot;
  throughput: { without: ThroughputSnapshot; with: ThroughputSnapshot };
  statistics: Statistics;
};

export type ControlSnapshot = {
  case: string;
  command: "init" | "start" | "reinit" | string;
  dt_type: "" | "all" | "without dt" | "with dt" | string;
  status: string;
  save_picture_flag: 0 | 1 | number;
  debug_flag?: number;
  scene_type?: string;
  [unknownField: string]: unknown;
};

export type ActionKind = "start" | "reinit";

export type ActiveAction = {
  kind: ActionKind;
  seenExecuteSuccess: boolean;
  generation: number;
};

export type Case4UiState =
  | "initial"
  | "running"
  | "finalizing"
  | "completed"
  | "resetting"
  | "failed-start"
  | "failed-reinit";

export type FailureReason = "execute-fail" | "result-incomplete" | null;

export type Case4DataState =
  | "initial"
  | "running"
  | "completed"
  | "resetting"
  | "failed-start"
  | "failed-reinit";

export type ApiErrorBody = {
  ok: false;
  error?: { code?: string; message?: string };
};
