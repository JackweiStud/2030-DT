/**
 * [case4] 结构化日志。正常 info，可恢复 warn，失败 error。
 * generation 在 entry/probe 用 entryGeneration，动作事件用 roundGeneration。
 * 禁止 points 全量、Base64、未知控制字段。
 */

export function controlSummary(control: {
  case: string;
  command: string;
  dt_type: string;
  status: string;
  save_picture_flag: number;
}) {
  return {
    case: control.case,
    command: control.command,
    dtType: control.dt_type,
    status: control.status,
    savePictureFlag: control.save_picture_flag,
  };
}

function formatLogData(
  event: string,
  data?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (data === undefined || !("generation" in data)) return data;
  const { generation, ...rest } = data;
  const generationKey =
    event.startsWith("entry.") || event.startsWith("adapter_probe.")
      ? "entryGeneration"
      : "roundGeneration";
  return { [generationKey]: generation, ...rest };
}

export function case4Log(event: string, data?: Record<string, unknown>): void {
  const logData = formatLogData(event, data);
  if (logData === undefined) console.info(`[case4] ${event}`);
  else console.info(`[case4] ${event}`, logData);
}

export function case4Warn(event: string, data?: Record<string, unknown>): void {
  const logData = formatLogData(event, data);
  if (logData === undefined) console.warn(`[case4] ${event}`);
  else console.warn(`[case4] ${event}`, logData);
}

export function case4Error(event: string, data?: Record<string, unknown>): void {
  const logData = formatLogData(event, data);
  if (logData === undefined) console.error(`[case4] ${event}`);
  else console.error(`[case4] ${event}`, logData);
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}
