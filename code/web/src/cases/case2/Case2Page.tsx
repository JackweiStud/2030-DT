/**
 * case2 页面：DT校正测试（初始/校正热力图）+ 测试性能（三项误差）。
 * 状态机不继承静态假逻辑。
 */

import pageTitleIcon from "../../../assets/case2/icons/page-title-icon.png";
import { useEffect } from "react";
import { useSiteEnvWindow } from "../../shell/siteEnvWindowContext";
import type { Case2RuntimeConfig } from "./metrics/heatmapConfig";
import { useCase2Controller } from "./hooks/useCase2Controller";
import { HeatmapCard } from "./components/HeatmapCard";
import { KpiComparisonRow } from "./components/KpiComparisonRow";
import { METRIC_KEYS, type MetricKey } from "./types";
import "./case2.css";

type Props = {
  config: Case2RuntimeConfig;
  stageElementRef: React.RefObject<HTMLElement>;
  /** 跨 Case Tab 锁：calibrating/resetting（及截图收尾）时上报 busy。 */
  onBusyChange?: (busy: boolean) => void;
};

const TAG_CLASS: Record<MetricKey, "rss" | "path" | "delay"> = {
  rss: "rss",
  effective_path_num: "path",
  first_path_delay: "delay",
};

const TAG_LABEL: Record<MetricKey, string> = {
  rss: "接收信号强度 (dBm)",
  effective_path_num: "有效径数 (条)",
  first_path_delay: "最强径时延 (ns)",
};

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        d="M5.5 3.6v8.8a.6.6 0 0 0 .9.5l7-4.4a.6.6 0 0 0 0-1l-7-4.4a.6.6 0 0 0-.9.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        d="M12.6 9.4A4.8 4.8 0 1 1 11.4 4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12.4 2.2v3h-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Case2Page(props: Props) {
  const { config, stageElementRef, onBusyChange } = props;
  const { open: openSiteEnv } = useSiteEnvWindow();
  const {
    state,
    statusText,
    statusRetryHint,
    startEnabled,
    resetEnabled,
    showCalibrated,
    onStart,
    onReset,
  } = useCase2Controller({ config, stageElementRef });

  const ui = state.case2UiState;
  const busy =
    ui === "calibrating" ||
    ui === "resetting" ||
    state.screenshotPhase === "pending" ||
    state.screenshotPhase === "saving" ||
    state.screenshotPhase === "waitClear";
  const commandBusy = ui === "calibrating" || ui === "resetting";
  const statusBusy = commandBusy;
  const statusError =
    !commandBusy &&
    (state.adapterError ||
      Boolean(state.initialError) ||
      ui.startsWith("failed"));

  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  const startClass =
    ui === "calibrating" ? "is-busy" : startEnabled ? "is-ready" : "is-off";
  const resetClass =
    ui === "resetting" ? "is-busy" : resetEnabled ? "is-ready" : "is-off";

  return (
    <main className="case2-page" data-state={ui}>
      <div className="main-content">
        <div className="page-title-row">
          <div className="title-group">
            <img className="page-title-icon" src={pageTitleIcon} alt="" />
            <h2 className="panel-title">DT校正测试</h2>
          </div>
          <a
            className="env-link"
            href="#现场环境"
            onClick={(e) => {
              e.preventDefault();
              openSiteEnv();
            }}
          >
            现场环境 &gt;
          </a>
        </div>
        <div className="main-row">
          <section className="calibration-panel">
            <div className="column-header-row">
              <div className="initial-column-head">
                <span>初始 DT</span>
              </div>
              <div className="calibrated-column-head">
                <div className="calibrated-info">
                  <div className="calibrated-label">
                    <span>校正 DT</span>
                  </div>
                  <div
                    className={`status-feedback${ui === "completed" ? " is-done" : ""}${
                      statusError ? " is-error" : ""
                    }${statusBusy ? " is-busy" : ""}`}
                    title={statusRetryHint ? "连接重试中" : undefined}
                  >
                    <span className="status-dot" />
                    <span className="status-text">{statusText}</span>
                    {statusRetryHint ? (
                      <span className="status-retry">{statusRetryHint}</span>
                    ) : null}
                    {statusBusy ? (
                      <span className="status-ellipsis" aria-hidden>
                        <span className="status-ellipsis__track" />
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="calibration-controls">
                  <button
                    type="button"
                    className={`ctrl-btn ctrl-btn--start ${startClass}`}
                    disabled={!startEnabled}
                    onClick={onStart}
                    title="启动"
                    aria-label="启动"
                  >
                    <PlayIcon />
                  </button>
                  <button
                    type="button"
                    className={`ctrl-btn ctrl-btn--clear ${resetClass}`}
                    disabled={!resetEnabled}
                    onClick={onReset}
                    title="重置"
                    aria-label="重置"
                  >
                    <ResetIcon />
                  </button>
                </div>
              </div>
            </div>

            <div className="heatmap-stack">
              {METRIC_KEYS.map((key) => (
                <div className="heatmap-pair" key={key} data-metric={key}>
                  <HeatmapCard
                    variant="initial"
                    metricClass={TAG_CLASS[key]}
                    label={TAG_LABEL[key]}
                    config={config}
                    matrix={state.initialData?.[key].heatmap ?? null}
                    empty={!state.initialData}
                  />
                  <HeatmapCard
                    variant="calibrated"
                    metricClass={TAG_CLASS[key]}
                    label={TAG_LABEL[key]}
                    config={config}
                    matrix={
                      showCalibrated
                        ? (state.calibratedData?.[key].heatmap ?? null)
                        : null
                    }
                    empty={!showCalibrated}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="kpi-panel">
            <div className="kpi-title-row">
              <h2 className="section-title">测试性能</h2>
            </div>
            <div className="kpi-stack">
              {METRIC_KEYS.map((key) => (
                <KpiComparisonRow
                  key={key}
                  metric={key}
                  initialKpi={state.initialData?.[key].kpi ?? []}
                  calibratedKpi={
                    showCalibrated
                      ? (state.calibratedData?.[key].kpi ?? null)
                      : null
                  }
                  cdfPointCap={config.cdfPointCap}
                  showComparison={showCalibrated}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
