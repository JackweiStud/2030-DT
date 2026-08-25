/**
 * 点位波束回溯：20 槽壳 + 两侧控制。Without 按真实 no 填 BeamID。
 */

import { CASE3_POINT_WINDOW } from "../../case3/config/case3RuntimeConfig";
import { pointProgressRouteNos } from "../../case3/metrics/case3Metrics";
import type { Case3Point } from "../../case3/types";
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

const SLOT_PITCH = 85;
const CURSOR_SIZE = 28;
/** 勾/叉相对回溯对表左缘，与静态 `fillChecks` 一致：34 + i * 85。 */
const CHECK_LEFT0 = 34;

type Props = {
  routeNos: number[];
  withoutPoints: Case3Point[];
  withPoints?: Case3Point[];
  withPeerPoints?: Case3Point[] | null;
  progressSide?: V2LiveMapSide;
  withoutStatus: string;
  withStatus: string;
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

function StatusLabel(props: { status: string; side: "without" | "with" }) {
  const running = case3V2StatusIsRunning(props.status);
  return (
    <span
      className={`case3v2-side-status ${case3V2StatusClass(props.status)}`.trim()}
      data-status={props.side}
    >
      <span className="case3v2-side-status__text">{props.status}</span>
      {running ? (
        <span className="case3v2-status-ellipsis" aria-hidden data-status-ellipsis>
          <span className="case3v2-status-ellipsis__track" />
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
  const windowNos = pointProgressRouteNos(
    props.routeNos,
    completeCount,
    CASE3_POINT_WINDOW,
  );
  const slots: Array<number | null> = [...windowNos];
  while (slots.length < CASE3_POINT_WINDOW) slots.push(null);

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
  const progressWidth = showTrack ? doneInWindow * SLOT_PITCH - 3 : 0;
  const cursorLeft = showTrack ? progressWidth - CURSOR_SIZE : 0;

  return (
    <div
      className="case3v2-replay"
      data-region="PointBeamReplay"
      data-replay-progress-side={progressSide}
      data-replay-done={String(doneInWindow)}
    >
      <div className="case3v2-replay-controls">
        <div className="case3v2-replay-title">点位波束回溯</div>
        <div className="case3v2-side-bar" data-side="without">
          <span className="case3v2-side-num" data-side-num="without">
            1
          </span>
          <div className="case3v2-side-copy">
            <span className="case3v2-side-name">无DT</span>
            <StatusLabel status={withoutStatus} side="without" />
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
            <span className="case3v2-side-name">有DT</span>
            <StatusLabel status={withStatus} side="with" />
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

      <div className="case3v2-replay-board">
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
                  style={{ left: `${CHECK_LEFT0 + i * SLOT_PITCH}px` }}
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
