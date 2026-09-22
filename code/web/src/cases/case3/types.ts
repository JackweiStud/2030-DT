/**
 * Case3 REST / 本地状态类型。
 * 字段语义以 API-CONTRACT 为准；本文件不重新定义业务含义。
 */

export type Case3Side = "without" | "with";

export type BaseRoutePoint = {
  no: number;
  x: number;
  y: number;
  z: number;
};

export type ThroughputSample = { no: number; gbps: number };

export type ThroughputSnapshot = {
  samples: ThroughputSample[];
  pendingTail: boolean;
};

export type Case3Point = {
  no: number;
  ue: { x: number; y: number; z: number };
  selectedBeamId: number;
  throughputGbps: number;
  scanBeamIds?: number[];
  reflection?: { x: number; y: number; z: number; los: boolean };
};

export type SideSnapshot = {
  side: Case3Side;
  points: Case3Point[];
  completeCount: number;
  pendingTail: boolean;
  costPct: number | null;
};

export type BeamAccuracyBaseline = {
  success: number;
  total: number;
};

export type ControlSnapshot = {
  case: string;
  command: "init" | "start" | "reinit" | string;
  dt_type: "" | "without dt" | "with dt" | string;
  status: string;
  save_picture_flag: 0 | 1 | number;
  debug_flag?: number;
  scene_type?: string;
  [unknownField: string]: unknown;
};

export type ActionKind = "start" | "reinit";

export type ActiveAction = {
  kind: ActionKind;
  side: Case3Side;
  seenExecuteSuccess: boolean;
  generation: number;
};

/** Start/ReInit 失败原因；result-incomplete 仅 Start 终态门槛耗尽。 */
export type FailureReason = "execute-fail" | "result-incomplete";

export type Failure = {
  kind: ActionKind;
  side: Case3Side;
  reason: FailureReason;
} | null;

export type Case3VisibleState =
  | "initial"
  | "without-running"
  | "with-running"
  | "resetting-without"
  | "resetting-with"
  | "failed-start-without"
  | "failed-start-with"
  | "failed-reinit-without"
  | "failed-reinit-with"
  | "without-completed"
  | "with-completed"
  | "unpaired-both"
  | "with-history-only";

export type ApiErrorBody = {
  ok: false;
  error?: { code?: string; message?: string };
};
