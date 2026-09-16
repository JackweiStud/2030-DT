/**
 * Case4 进页握手：GET control → POST init → GET init-data。
 * StrictMode 用 entryGeneration / Abort 防双 POST。
 */

import { Case4ApiError, type Case4Api } from "../api/case4Api";
import { case4Error, case4Log, controlSummary } from "../log/case4Log";
import type { BasePoint, ControlSnapshot } from "../types";

export type HandshakeOk = {
  ok: true;
  control: ControlSnapshot;
  baseRoute: BasePoint[];
};

export type HandshakeFail = {
  ok: false;
  kind: "adapter" | "init-data";
  error: unknown;
};

/**
 * 跑完三步握手。中止时抛 AbortError。
 */
export async function runCase4Handshake(
  api: Case4Api,
  signal: AbortSignal,
  entryGeneration: number,
): Promise<HandshakeOk | HandshakeFail> {
  try {
    const control = await api.getControl(signal);
    case4Log("entry.control_ok", {
      entryGeneration,
      ...controlSummary(control),
    });
    const afterInit = await api.postControl({ command: "init" }, signal);
    case4Log("entry.init_reset_ok", {
      entryGeneration,
      ...controlSummary(afterInit),
    });
    const initData = await api.getInitData(signal);
    case4Log("entry.init_data_ok", {
      entryGeneration,
      baseCount: initData.baseRoute.length,
    });
    return { ok: true, control: afterInit, baseRoute: initData.baseRoute };
  } catch (err) {
    if (signal.aborted) throw err;
    const dataError =
      err instanceof Case4ApiError &&
      (err.code === "CASE4_INVALID_RESPONSE" ||
        err.code === "INIT_DATA_INVALID");
    if (dataError) {
      case4Error("entry.init_data_fail", {
        entryGeneration,
        code: err instanceof Case4ApiError ? err.code : undefined,
        reason: err instanceof Error ? err.message : String(err),
      });
      return { ok: false, kind: "init-data", error: err };
    }
    case4Error("entry.adapter_fail", {
      entryGeneration,
      code: err instanceof Case4ApiError ? err.code : undefined,
      reason: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, kind: "adapter", error: err };
  }
}
