/**
 * 点位波束回溯：20 槽壳 + 两侧控制。Without 按真实 no 填 BeamID。
 * N>20 时整表 Pointer Events 拖动，槽距 85px，不复用旧皮肤 29px。
 */

import { useEffect, useRef, useState } from "react";
import { CASE3_POINT_WINDOW } from "../../case3/config/case3RuntimeConfig";
import {
  pointProgressRouteNos,
  pointProgressWindowRange,
} from "../../case3/metrics/case3Metrics";
import type { Case3Point } from "../../case3/types";
import { CASE3_ADAPTER_RETRY_HINT } from "../../case3/state/case3Reducer";
import {
  case3V2StatusClass,
  case3V2StatusIsRunning,
  toCase3V2SideStatus,
} from "../v2SideStatus";
import {
  peerPointByNo,
  v2ReplayCompleteCount,
  withReplayTone,
  type V2LiveMapSide,
} from "../v2WithCompare";

/** V2 槽距：82px 格 + 3px gap。不得使用旧皮肤 CASE3_POINT_SLOT_PITCH=29。 */
export const CASE3V2_REPLAY_SLOT_PITCH = 85;
const CURSOR_SIZE = 28;
/** 勾/叉相对回溯对表左缘，与静态 `fillChecks` 一致：34 + i * 85。 */
const CHECK_LEFT0 = 34;

function clampStart(value: number, maxStart: number): number {
  return Math.max(0, Math.min(maxStart, Math.round(value)));
}

type Props = {
  expanded?: boolean;
  onToggleExpanded?: () => void;
  routeNos: number[];
  withoutPoints: Case3Point[];
  withPoints?: Case3Point[];
  withPeerPoints?: Case3Point[] | null;
  progressSide?: V2LiveMapSide;
  withoutStatus: string;
  withStatus: string;
  withoutBadgeError?: boolean;
  withBadgeError?: boolean;
  withoutRetryHint?: boolean;
  withRetryHint?: boolean;
  startWithoutEnabled: boolean;
  startWithEnabled: boolean;
  reinitWithoutEnabled: boolean;
  reinitWithEnabled: boolean;
  withoutPlayBusy: boolean;
  withPlayBusy: boolean;
  onStartWithout: () => void;
  onStartWith: () => void;
  onReinitWithout: () => void;
  onReinitWith: () => void;
};

function playClass(enabled: boolean, busy: boolean): string {
  if (busy) return "is-busy";
  return enabled ? "is-ready" : "is-off";
}

function resetClass(enabled: boolean): string {
  return enabled ? "is-ready" : "is-off";
}

function StatusLabel(props: {
  status: string;
  side: "without" | "with";
  error?: boolean;
  retryHint?: boolean;
}) {
  const running = case3V2StatusIsRunning(props.status);
  const error = Boolean(props.error) && !running;
  const retryHint = Boolean(props.retryHint);
  const className = [
    "case3v2-side-status",
    case3V2StatusClass(props.status),
    error ? "is-error" : "",
    retryHint ? "is-retrying" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span
      className={className}
      data-status={props.side}
      data-status-error={error ? "1" : "0"}
      data-status-retry={retryHint ? "1" : "0"}
    >
      <span className="case3v2-side-status__text">{props.status}</span>
      {running ? (
        <span className="case3v2-status-ellipsis" aria-hidden data-status-ellipsis>
          <span className="case3v2-status-ellipsis__track" />
        </span>
      ) : null}
      {retryHint ? (
        <span className="case3v2-side-status__retry" data-status-retry-text>
          {CASE3_ADAPTER_RETRY_HINT}
        </span>
      ) : null}
    </span>
  );
}

/**
 * 一张回溯表，含 ①② 控制。默认跟随最近最多 20 个点。
 */
export function PointBeamReplay(props: Props) {
  const withoutStatus = toCase3V2SideStatus(props.withoutStatus);
  const withStatus = toCase3V2SideStatus(props.withStatus);
  const progressSide = props.progressSide ?? "without";
  const completeCount = v2ReplayCompleteCount(
    progressSide,
    props.withoutPoints.length,
    (props.withPoints ?? []).length,
  );
  const range = pointProgressWindowRange(
    props.routeNos.length,
    completeCount,
    CASE3_POINT_WINDOW,
  );
  const [followLatest, setFollowLatest] = useState(true);
  const [userStart, setUserStart] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    originX: number;
    originStart: number;
    scale: number;
  } | null>(null);
  const progressSideRef = useRef(progressSide);

  useEffect(() => {
    if (progressSideRef.current !== progressSide) {
      progressSideRef.current = progressSide;
      setFollowLatest(true);
      setUserStart(0);
    }
  }, [progressSide]);

  useEffect(() => {
    if (completeCount <= 0) {
      setFollowLatest(true);
      setUserStart(0);
    }
  }, [completeCount]);

  useEffect(() => {
    if (range.maxStart <= 0) setFollowLatest(true);
  }, [range.maxStart]);

  const windowStart = followLatest
    ? range.defaultStart
    : clampStart(userStart, range.maxStart);
  const windowNos = pointProgressRouteNos(
    props.routeNos,
    completeCount,
    CASE3_POINT_WINDOW,
    windowStart,
  );
  const slots: Array<number | null> = [...windowNos];
  while (slots.length < CASE3_POINT_WINDOW) slots.push(null);
  const canDrag = range.maxStart > 0;

  const withoutByNo = new Map(
    props.withoutPoints.map((p) => [p.no, p] as const),
  );
  const withByNo = new Map(
    (props.withPoints ?? []).map((p) => [p.no, p] as const),
  );
  const progressByNo = progressSide === "with" ? withByNo : withoutByNo;
  const withPeers = props.withPeerPoints ?? null;
  const doneInWindow = slots.filter(
    (no) => no != null && progressByNo.has(no),
  ).length;
  const showTrack = doneInWindow > 0;
  /** 进度条宽；游标贴蓝条前端，避免盖住列心 P##（对齐静态稿）。 */
  const progressWidth = showTrack
    ? doneInWindow * CASE3V2_REPLAY_SLOT_PITCH - 3
    : 0;
  const cursorLeft = showTrack ? progressWidth - CURSOR_SIZE : 0;

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button > 0 || !canDrag) return;
    event.preventDefault();
    event.stopPropagation();
    const el = event.currentTarget;
    const cssWidth = el.getBoundingClientRect().width;
    const layoutWidth = el.offsetWidth;
    const scale =
      cssWidth > 0 && layoutWidth > 0 ? cssWidth / layoutWidth : 1;
    dragRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originStart: windowStart,
      scale,
    };
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      /* jsdom 可能未实现 pointer capture */
    }
    setDragging(true);
  }

  function samePointer(
    event: React.PointerEvent<HTMLDivElement>,
    pointerId: number,
  ): boolean {
    if (event.pointerId == null || event.pointerId === 0) return true;
    return event.pointerId === pointerId;
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || !samePointer(event, drag.pointerId)) return;
    const localDx = (event.clientX - drag.originX) / drag.scale;
    const next = clampStart(
      drag.originStart - localDx / CASE3V2_REPLAY_SLOT_PITCH,
      range.maxStart,
    );
    setFollowLatest(next >= range.maxStart);
    setUserStart(next);
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || !samePointer(event, drag.pointerId)) return;
    dragRef.current = null;
    try {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* jsdom 可能未实现 pointer capture */
    }
    setDragging(false);
  }

  return (
    <div
      className="case3v2-replay"
      data-region="PointBeamReplay"
      data-replay-progress-side={progressSide}
      data-replay-done={String(doneInWindow)}
      data-replay-window-start={String(windowStart)}
      data-replay-follow-latest={followLatest ? "1" : "0"}
      data-replay-can-drag={canDrag ? "1" : "0"}
    >
      <div className="case3v2-replay-controls">
        <div className="case3v2-replay-title-row">
          <div className="case3v2-replay-title">点位波束回溯</div>
          <button type="button" className="case3v2-dock-expand"
            aria-label={props.expanded ? "收起指标栏" : "展开指标栏"}
            title={props.expanded ? "收起" : "全屏"}
            onClick={() => props.onToggleExpanded?.()}>
            <svg viewBox="0 0 24 24" aria-hidden><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M9 9 3 3m12 6 6-6M9 15l-6 6m12-6 6 6" /></svg>
          </button>
        </div>
        <div className="case3v2-side-bar" data-side="without">
          <span className="case3v2-side-num" data-side-num="without">
            1
          </span>
          <div className="case3v2-side-copy">
            <span className="case3v2-side-name">无DT辅助</span>
            <StatusLabel
              status={withoutStatus}
              side="without"
              error={props.withoutBadgeError}
              retryHint={props.withoutRetryHint}
            />
          </div>
          <div className="case3v2-side-actions">
            <button
              type="button"
              className={`case3v2-icon-btn case3v2-icon-btn--play ${playClass(
                props.startWithoutEnabled,
                props.withoutPlayBusy,
              )}`}
              title="启动无 DT"
              disabled={!props.startWithoutEnabled}
              onClick={props.onStartWithout}
            />
            <button
              type="button"
              className={`case3v2-icon-btn case3v2-icon-btn--reset ${resetClass(
                props.reinitWithoutEnabled,
              )}`}
              title="重置无 DT"
              disabled={!props.reinitWithoutEnabled}
              onClick={props.onReinitWithout}
            />
          </div>
        </div>
        <div className="case3v2-side-bar" data-side="with">
          <span className="case3v2-side-num" data-side-num="with">
            2
          </span>
          <div className="case3v2-side-copy">
            <span className="case3v2-side-name">有DT辅助</span>
            <StatusLabel
              status={withStatus}
              side="with"
              error={props.withBadgeError}
              retryHint={props.withRetryHint}
            />
          </div>
          <div className="case3v2-side-actions">
            <button
              type="button"
              className={`case3v2-icon-btn case3v2-icon-btn--play ${playClass(
                props.startWithEnabled,
                props.withPlayBusy,
              )}`}
              title="启动有 DT"
              disabled={!props.startWithEnabled}
              onClick={props.onStartWith}
            />
            <button
              type="button"
              className={`case3v2-icon-btn case3v2-icon-btn--reset ${resetClass(
                props.reinitWithEnabled,
              )}`}
              title="重置有 DT"
              disabled={!props.reinitWithEnabled}
              onClick={props.onReinitWith}
            />
          </div>
        </div>
        <div className="case3v2-side-link" aria-hidden>
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>

      <div
        className={`case3v2-replay-board${canDrag ? " is-scrollable" : ""}${
          dragging ? " is-dragging" : ""
        }`}
        data-replay-surface
        data-replay-dragging={dragging ? "1" : "0"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="case3v2-replay-head">
          <div
            className="case3v2-progress"
            data-replay-progress
            aria-hidden
            style={
              showTrack
                ? { display: "block", width: `${progressWidth}px` }
                : { display: "none" }
            }
          />
          <div data-replay-headers>
            {slots.map((no, i) => (
              <div
                className={`case3v2-replay-col${
                  no != null && progressByNo.has(no) ? " is-done" : ""
                }`}
                key={`h-${i}`}
              >
                {no == null ? "\u00A0" : `P${no}`}
              </div>
            ))}
          </div>
          <div
            className="case3v2-cursor"
            data-replay-cursor
            aria-hidden
            style={
              showTrack
                ? { display: "block", left: `${cursorLeft}px` }
                : { display: "none" }
            }
          />
        </div>
        <div className="case3v2-replay-pair">
          <div className="case3v2-replay-row" data-replay-without>
            {slots.map((no, i) => {
              const point = no == null ? null : (withoutByNo.get(no) ?? null);
              return (
                <div
                  className={`case3v2-replay-cell case3v2-replay-cell--without${
                    point ? " is-done" : ""
                  }`}
                  key={`wo-${i}`}
                >
                  <span className="case3v2-replay-cell__label">最优波</span>
                  <span
                    className="case3v2-replay-cell__value"
                    data-replay-wo-value
                  >
                    {point ? String(point.selectedBeamId) : "--"}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="case3v2-replay-row" data-replay-with>
            {slots.map((no, i) => {
              const withPoint = no == null ? null : (withByNo.get(no) ?? null);
              const peer = no == null ? null : peerPointByNo(withPeers, no);
              const tone = withReplayTone(withPoint, peer);
              const toneClass =
                tone === "ok" ? " is-ok" : tone === "fail" ? " is-fail" : "";
              return (
                <div
                  className={`case3v2-replay-cell case3v2-replay-cell--with${toneClass}`}
                  data-replay-w-tone={tone}
                  key={`w-${i}`}
                >
                  <span className="case3v2-replay-cell__value" data-replay-w-value>
                    {withPoint ? String(withPoint.selectedBeamId) : "--"}
                  </span>
                  <span className="case3v2-replay-cell__label">预测波</span>
                </div>
              );
            })}
          </div>
          <div className="case3v2-check-layer" data-replay-checks aria-hidden>
            {slots.map((no, i) => {
              const withPoint = no == null ? null : (withByNo.get(no) ?? null);
              const peer = no == null ? null : peerPointByNo(withPeers, no);
              const tone = withReplayTone(withPoint, peer);
              if (tone !== "ok" && tone !== "fail") return null;
              return (
                <div
                  className={`case3v2-check is-${tone}`}
                  data-replay-check={tone}
                  data-replay-check-slot={String(i)}
                  data-replay-check-no={no == null ? undefined : String(no)}
                  style={{ left: `${CHECK_LEFT0 + i * CASE3V2_REPLAY_SLOT_PITCH}px` }}
                  key={`ck-${i}`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
