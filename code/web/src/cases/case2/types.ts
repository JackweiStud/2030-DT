/**
 * case2 领域类型与 REST shape。
 * 状态语义以 WEB-SPEC 为准；未知 status 在运行时按 string 透传处理。
 */

export type Case2UiState =
  | "initial"
  | "calibrating"
  | "resetting"
  | "completed"
  | "failed-start"
  | "failed-reinit";

/** 契约已知 status；运行时还可能收到未知字面值。 */
export type KnownControlStatus =
  | ""
  | "execute success"
  | "execute fail"
  | "case complete"
  | "reinit complete";

export type MetricKey = "rss" | "effective_path_num" | "first_path_delay";
export type DataPhase = "initial" | "calibrated";

export type MetricData = {
  heatmap: number[][];
  kpi: number[];
};

export type MetricsBundle = Record<MetricKey, MetricData>;

export type ControlSnapshot = {
  case: string;
  command: string;
  dt_type: string;
  status: string;
  save_picture_flag: 0 | 1;
  [key: string]: unknown;
};

export type DataFilesResponse = {
  ok: true;
  phase: DataPhase;
  metrics: MetricsBundle;
};

export type ControlFileResponse = {
  ok: true;
  control: ControlSnapshot;
};

export type ScreenshotResponse = {
  ok: true;
  path: string;
  seq: number;
};

export type ApiErrorResponse = {
  ok: false;
  error: { code: string; message: string };
};

export type ScreenshotPhase = "idle" | "saving" | "waitClear";

export const METRIC_KEYS: readonly MetricKey[] = [
  "rss",
  "effective_path_num",
  "first_path_delay",
] as const;

export const METRIC_LABELS: Record<MetricKey, string> = {
  rss: "RSS",
  effective_path_num: "有效路径数",
  first_path_delay: "首径时延",
};
