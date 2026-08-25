/**
 * 点位波束回溯：20 槽壳 + 两侧控制。初始格子为空。
 */

import { CASE3_POINT_WINDOW } from "../../case3/config/case3RuntimeConfig";
import { case3V2StatusClass, toCase3V2SideStatus } from "../v2SideStatus";

type Props = {
  routeNos: number[];
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

/**
 * 一张回溯表，含 ①② 控制。
 */
export function PointBeamReplay(props: Props) {
  const withoutStatus = toCase3V2SideStatus(props.withoutStatus);
  const withStatus = toCase3V2SideStatus(props.withStatus);
  const slots = Array.from({ length: CASE3_POINT_WINDOW }, (_, i) => i);
  const headers = slots.map((i) => props.routeNos[i] ?? i + 1);

  return (
    <div className="case3v2-replay" data-region="PointBeamReplay">
      <div className="case3v2-replay-controls">
        <div className="case3v2-replay-title">点位波束回溯</div>
        <div className="case3v2-side-bar" data-side="without">
          <span className="case3v2-side-num" data-side-num="without">
            1
          </span>
          <div className="case3v2-side-copy">
            <span className="case3v2-side-name">无DT</span>
            <span
              className={`case3v2-side-status ${case3V2StatusClass(withoutStatus)}`.trim()}
              data-status="without"
            >
              {withoutStatus}
            </span>
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
            <span
              className={`case3v2-side-status ${case3V2StatusClass(withStatus)}`.trim()}
              data-status="with"
            >
              {withStatus}
            </span>
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
          <div className="case3v2-progress" aria-hidden />
          <div data-replay-headers>
            {headers.map((no, i) => (
              <div className="case3v2-replay-col" key={`h-${i}`}>
                {`P${no}`}
              </div>
            ))}
          </div>
          <div className="case3v2-cursor" aria-hidden />
        </div>
        <div className="case3v2-replay-pair">
          <div className="case3v2-replay-row" data-replay-without>
            {slots.map((i) => (
              <div
                className="case3v2-replay-cell case3v2-replay-cell--without"
                key={`wo-${i}`}
              >
                <span className="case3v2-replay-cell__label">最优波</span>
                <span className="case3v2-replay-cell__value">--</span>
              </div>
            ))}
          </div>
          <div className="case3v2-replay-row" data-replay-with>
            {slots.map((i) => (
              <div
                className="case3v2-replay-cell case3v2-replay-cell--with"
                key={`w-${i}`}
              >
                <span className="case3v2-replay-cell__value">--</span>
                <span className="case3v2-replay-cell__label">预测波</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
