/**
 * case2 页面：测试对比 + KPI 对比。
 * DOM 分区对齐 Gate 1.5；状态机不继承静态假逻辑。
 */

import titleAccent from "../../../assets/case2/icons/panel-title-accent.png";
import colInit from "../../../assets/case2/icons/column-initial-icon.png";
import colCali from "../../../assets/case2/icons/column-calibrated-icon.png";
import iconPlay from "../../../assets/case2/icons/icon-play.svg";
import iconPause from "../../../assets/case2/icons/icon-pause.svg";
import iconReset from "../../../assets/case2/icons/icon-rotate-ccw.svg";
import type { Case2RuntimeConfig } from "./metrics/heatmapConfig";
import { useCase2Controller } from "./hooks/useCase2Controller";
import { HeatmapCard } from "./components/HeatmapCard";
import { KpiComparisonRow } from "./components/KpiComparisonRow";
import { METRIC_KEYS, type MetricKey } from "./types";
import "./case2.css";

type Props = {
  config: Case2RuntimeConfig;
  stageElementRef: React.RefObject<HTMLElement>;
};

const TAG_CLASS: Record<MetricKey, "rss" | "path" | "delay"> = {
  rss: "rss",
  effective_path_num: "path",
  first_path_delay: "delay",
};

const TAG_LABEL: Record<MetricKey, string> = {
  rss: "RSS",
  effective_path_num: "Effective Path Num",
  first_path_delay: "First Path Delay",
};

export function Case2Page(props: Props) {
  const { config, stageElementRef } = props;
  const {
    state,
    statusText,
    startEnabled,
    resetEnabled,
    showCalibrated,
    onStart,
    onReset,
  } = useCase2Controller({ config, stageElementRef });

  const ui = state.case2UiState;

  return (
    <main className="case2-page" data-state={ui}>
      <div className="main-content">
        <div className="main-row">
          <section className="calibration-panel">
            <div className="panel-title-row">
              <div className="title-group">
                <img className="title-accent" src={titleAccent} alt="" />
                <h2 className="panel-title">测试对比</h2>
              </div>
              <a
                className="env-link"
                href="#现场环境"
                onClick={(e) => {
                  e.preventDefault();
                }}
              >
                现场环境 &gt;
              </a>
            </div>

            <div className="column-header-row">
              <div className="initial-column-head">
                <img src={colInit} width={24} height={24} alt="" />
                <span>Initial DT</span>
              </div>
              <div className="calibrated-column-head">
                <div className="calibrated-info">
                  <div className="calibrated-label">
                    <img src={colCali} width={24} height={24} alt="" />
                    <span>Calibrated DT</span>
                  </div>
                  <div
                    className={`status-feedback${ui === "completed" ? " is-done" : ""}${
                      state.adapterError || ui.startsWith("failed")
                        ? " is-error"
                        : ""
                    }`}
                  >
                    <span className="status-dot" />
                    <span className="status-text">{statusText}</span>
                  </div>
                </div>
                <div className="calibration-controls">
                  <button
                    type="button"
                    className="ctrl-btn ctrl-btn--start"
                    disabled={!startEnabled}
                    onClick={onStart}
                    title="启动"
                  >
                    <img
                      className="ctrl-icon ctrl-icon--play"
                      src={iconPlay}
                      width={16}
                      height={16}
                      alt=""
                    />
                    <img
                      className="ctrl-icon ctrl-icon--pause"
                      src={iconPause}
                      width={16}
                      height={16}
                      alt=""
                    />
                    <span>启动</span>
                  </button>
                  <button
                    type="button"
                    className="ctrl-btn ctrl-btn--clear"
                    disabled={!resetEnabled}
                    onClick={onReset}
                    title="重置"
                  >
                    <img src={iconReset} width={16} height={16} alt="" />
                    <span>重置</span>
                  </button>
                </div>
              </div>
            </div>

            {state.initialError ? (
              <p className="initial-error">
                Initial 区不可用：{state.initialError}
              </p>
            ) : null}

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
              <img className="title-accent" src={titleAccent} alt="" />
              <h2 className="panel-title">KPI对比</h2>
            </div>
            <div className="kpi-stack">
              {state.initialData
                ? METRIC_KEYS.map((key) => (
                    <KpiComparisonRow
                      key={key}
                      metric={key}
                      initialKpi={state.initialData![key].kpi}
                      calibratedKpi={
                        showCalibrated
                          ? (state.calibratedData?.[key].kpi ?? null)
                          : null
                      }
                      cdfPointCap={config.cdfPointCap}
                      showComparison={showCalibrated}
                    />
                  ))
                : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
