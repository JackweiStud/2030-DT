/**
 * Case4 截图任务：pending 登记后，完成画面 waitForPaint + prepareCapture 再 toPng。
 * 最多 3 次；上传失败复用 Base64。放弃清零失败不由本文件发 init。
 */

import { toPng } from "html-to-image";
import { Case4ApiError, type Case4Api } from "../api/case4Api";
import {
  CASE4_SCREENSHOT_MAX_ATTEMPTS,
  CASE4_SCREENSHOT_PIXEL_RATIO,
  CASE4_STAGE_HEIGHT,
  CASE4_STAGE_WIDTH,
} from "../config/case4RuntimeConfig";
import { case4Error, case4Log, case4Warn } from "../log/case4Log";
import { controlMatchesAction } from "./case4Polling";

export type ScreenshotPhase = "idle" | "pending" | "saving";

export type MapCaptureHandle = {
  resetView(): void;
  prepareCapture(): Promise<void>;
};

export async function waitForPaintDefault(): Promise<void> {
  const once = () =>
    new Promise<void>((resolve) => {
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => resolve());
        return;
      }
      window.setTimeout(() => resolve(), 0);
    });
  await once();
  await once();
}

function stripDataUrl(base64: string): string {
  const idx = base64.indexOf("base64,");
  return idx >= 0 ? base64.slice(idx + 7) : base64;
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

export type ScreenshotOutcome =
  | { kind: "ok"; path: string; seq: number }
  | { kind: "dropped" }
  | { kind: "clear-fail" }
  | { kind: "aborted" };

/**
 * 生成并上传一张完成画面 PNG。调用前画面必须已是 completed。
 */
export async function runCase4Screenshot(args: {
  api: Case4Api;
  stage: HTMLElement;
  mapRef: MapCaptureHandle | null;
  signal: AbortSignal;
  generation: number;
  waitForPaint: () => Promise<void>;
  prepareCapture?: () => Promise<void>;
}): Promise<ScreenshotOutcome> {
  const { api, stage, mapRef, signal, generation } = args;
  case4Log("round.completed_rendered", { roundGeneration: generation });
  await args.waitForPaint();
  try {
    if (args.prepareCapture) {
      await args.prepareCapture();
    } else {
      await mapRef?.prepareCapture();
    }
  } catch (err) {
    case4Warn("screenshot.prepare_timeout", {
      roundGeneration: generation,
      reason: err instanceof Error ? err.message : String(err),
    });
  }

  let base64: string | null = null;
  const taskStartedAt = performance.now();

  for (let attempt = 1; attempt <= CASE4_SCREENSHOT_MAX_ATTEMPTS; attempt += 1) {
    if (signal.aborted) return { kind: "aborted" };
    let failurePhase: "generate" | "upload" = "generate";
    const attemptStartedAt = performance.now();
    let toPngMs = 0;
    let uploadMs = 0;
    try {
      if (!base64) {
        case4Log("screenshot.capture_begin", {
          roundGeneration: generation,
          attempt,
        });
        const dataUrl = await toPng(stage, {
          width: CASE4_STAGE_WIDTH,
          height: CASE4_STAGE_HEIGHT,
          pixelRatio: CASE4_SCREENSHOT_PIXEL_RATIO,
          style: { transform: "none" },
          filter: (node) => {
            if (!(node instanceof HTMLElement)) return true;
            return !node.classList.contains("review-dock");
          },
        });
        toPngMs = Math.round(performance.now() - attemptStartedAt);
        base64 = stripDataUrl(dataUrl);
        case4Log("screenshot.capture_ok", {
          roundGeneration: generation,
          attempt,
          toPngMs,
        });
      }
      failurePhase = "upload";
      const uploadStartedAt = performance.now();
      const saved = await api.postScreenshot(base64, signal);
      uploadMs = Math.round(performance.now() - uploadStartedAt);
      case4Log("screenshot.upload_ok", {
        roundGeneration: generation,
        attempt,
        path: saved.path,
        seq: saved.seq,
        toPngMs,
        uploadMs,
        totalMs: Math.round(performance.now() - taskStartedAt),
      });
      return { kind: "ok", path: saved.path, seq: saved.seq };
    } catch (err) {
      if (isAbortError(err) || signal.aborted) return { kind: "aborted" };
      case4Warn("screenshot.retry", {
        roundGeneration: generation,
        attempt,
        phase: failurePhase,
        reason: err instanceof Error ? err.message : String(err),
        code: err instanceof Case4ApiError ? err.code : undefined,
      });
      if (failurePhase === "upload") {
        try {
          const control = await api.getControl(signal);
          if (signal.aborted) return { kind: "aborted" };
          const owned = controlMatchesAction(control, "start");
          if (control.save_picture_flag === 0 && owned) {
            case4Log("screenshot.upload_confirmed", {
              roundGeneration: generation,
              attempt,
              source: "flag-cleared",
            });
            return { kind: "dropped" };
          }
          if (!owned) {
            case4Warn("screenshot.ownership_lost", {
              roundGeneration: generation,
            });
            return { kind: "clear-fail" };
          }
        } catch (confirmErr) {
          if (isAbortError(confirmErr) || signal.aborted) {
            return { kind: "aborted" };
          }
        }
      }
      if (attempt >= CASE4_SCREENSHOT_MAX_ATTEMPTS) {
        try {
          await api.postControl({ save_picture_flag: 0 }, signal);
          case4Error("screenshot.dropped", {
            roundGeneration: generation,
            attempts: attempt,
          });
          return { kind: "dropped" };
        } catch (clearErr) {
          if (isAbortError(clearErr) || signal.aborted) {
            return { kind: "aborted" };
          }
          case4Error("screenshot.clear_flag_fail", {
            roundGeneration: generation,
            reason:
              clearErr instanceof Error ? clearErr.message : String(clearErr),
          });
          return { kind: "clear-fail" };
        }
      }
      if (failurePhase === "generate") base64 = null;
    }
  }
  return { kind: "dropped" };
}
