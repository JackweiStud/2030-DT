/**
 * Shell 级「现场环境」弹窗：蒙版 + 可拖拽窗口 + 双路图片占位。
 * 挂在 1920×1080 stage 内，坐标按舞台空间计算（兼容 scale）。
 * 不接入真实视频流。
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import videoIcon from "../../assets/shell/site-env/video-icon.png";
import videoFeed1 from "../../assets/shell/site-env/video-feed-1.png";
import videoFeed2 from "../../assets/shell/site-env/video-feed-2.png";
import "./site-env-window.css";

const STAGE_W = 1920;
const STAGE_H = 1080;
const DEFAULT_LEFT = 400;
const DEFAULT_TOP = 280;
const DIALOG_W = 1120;
const DIALOG_H = 520;

const FEEDS = [
  { label: "视频1 | 基站视角", src: videoFeed1 },
  { label: "视频2 | 集装箱视角", src: videoFeed2 },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  stageRef: RefObject<HTMLElement | null>;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function clientToStage(
  stage: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = stage.getBoundingClientRect();
  const scaleX = rect.width / STAGE_W;
  const scaleY = rect.height / STAGE_H;
  return {
    x: (clientX - rect.left) / scaleX,
    y: (clientY - rect.top) / scaleY,
  };
}

function CloseIcon() {
  return (
    <svg
      className="site-env-dialog__close-icon"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z"
      />
    </svg>
  );
}

export function SiteEnvWindow(props: Props) {
  const { open, onClose, stageRef } = props;
  const [pos, setPos] = useState({ left: DEFAULT_LEFT, top: DEFAULT_TOP });
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setPos({ left: DEFAULT_LEFT, top: DEFAULT_TOP });
    closeBtnRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const applyPosition = useCallback((left: number, top: number) => {
    setPos({
      left: clamp(left, 0, Math.max(0, STAGE_W - DIALOG_W)),
      top: clamp(top, 0, Math.max(0, STAGE_H - DIALOG_H)),
    });
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("[data-site-env-close]")) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pt = clientToStage(stage, e.clientX, e.clientY);
    dragRef.current = {
      offsetX: pt.x - pos.left,
      offsetY: pt.y - pos.top,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pt = clientToStage(stage, e.clientX, e.clientY);
    applyPosition(pt.x - dragRef.current.offsetX, pt.y - dragRef.current.offsetY);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  if (!open) return null;

  return (
    <div className="site-env-overlay is-open" data-site-env-overlay="">
      <div
        className="site-env-mask"
        data-site-env-mask=""
        onClick={onClose}
        aria-hidden
      />
      <div
        className="site-env-dialog"
        data-site-env-dialog=""
        role="dialog"
        aria-modal="true"
        aria-label="现场环境"
        style={{ left: pos.left, top: pos.top }}
      >
        <div
          className="site-env-dialog__header"
          data-site-env-drag=""
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <h2 className="site-env-dialog__title">现场环境</h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="site-env-dialog__close"
            data-site-env-close=""
            aria-label="关闭"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="site-env-dialog__body">
          {FEEDS.map((feed) => (
            <div className="site-env-feed" key={feed.label}>
              <div className="site-env-feed__label">
                <img
                  className="site-env-feed__icon"
                  src={videoIcon}
                  width={22}
                  height={22}
                  alt=""
                />
                <span className="site-env-feed__text">{feed.label}</span>
              </div>
              <div className="site-env-feed__media">
                <img src={feed.src} alt={feed.label} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
