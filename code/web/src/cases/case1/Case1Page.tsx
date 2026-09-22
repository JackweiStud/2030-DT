import { useState } from "react";
import { asset } from "./assets";
import { useLayerData } from "./data";
import { useModels } from "./models";
import { ModelViewport } from "./ModelViewport";
import { KpiChart } from "./KpiChart";
import { RfView } from "./RfView";
import { loadConfig } from "./config";
import type { Layer, View } from "./data";
import "./case1.css";

export function Case1Page() {
  const [result] = useState(() => {
    try {
      return { config: loadConfig(import.meta.env) };
    } catch (e) {
      return { error: String(e) };
    }
  });
  return result.config ? (
    <Case1Content config={result.config} />
  ) : (
    <main className="case1-page">
      <p role="alert">case1 配置错误：{result.error}</p>
    </main>
  );
}
function Case1Content({ config }: { config: ReturnType<typeof loadConfig> }) {
  const [view, setView] = useState<View>("home");
  const select = (layer: Layer) =>
    setView((current) => (current === layer ? "home" : layer));
  const { data, errors } = useLayerData(view);
  const { models, errors: modelErrors } = useModels();
  return (
    <main className="case1-page" id="case1-page" data-view={view}>
      <aside className="c1-nav" aria-label="无线数字孪生架构">
        <div className="c1-nav-title">
          <img
            src={asset("icon-dt-wireless.png")}
            alt=""
            width="26"
            height="26"
          />
          <h1>无线数字孪生架构</h1>
        </div>
        <div className="c1-layers">
          <div className="c1-layer-block">
            <div className="c1-layer">
              <div className="c1-layer-copy">
                <span className="c1-pill c1-pill-geo">Layer 1</span>
                <span className="c1-layer-name">环境几何层</span>
              </div>
              <button
                type="button"
                className="c1-diamond"
                data-layer="geometry"
                aria-pressed={view === "geometry"}
                onClick={() => select("geometry")}
                aria-label="环境几何层"
              >
                <img src={asset("layer-geometry.png")} alt="" />
              </button>
            </div>
            <div className="c1-layer">
              <div className="c1-layer-copy">
                <span className="c1-pill c1-pill-em">Layer 2</span>
                <span className="c1-layer-name">电磁材质层</span>
              </div>
              <button
                type="button"
                className="c1-diamond"
                data-layer="material"
                aria-pressed={view === "material"}
                onClick={() => select("material")}
                aria-label="电磁材质层"
              >
                <img src={asset("layer-material.png")} alt="" />
              </button>
            </div>
            <div className="c1-layer">
              <div className="c1-layer-copy">
                <span className="c1-pill c1-pill-rf">Layer 3</span>
                <span className="c1-layer-name">RF层</span>
              </div>
              <button
                type="button"
                className="c1-diamond"
                data-layer="rf"
                aria-pressed={view === "rf"}
                onClick={() => select("rf")}
                aria-label="RF层"
              >
                <img src={asset("layer-rf.png")} alt="" />
              </button>
            </div>
            <div className="c1-layer">
              <div className="c1-layer-copy">
                <span className="c1-pill c1-pill-kg">Layer 4</span>
                <span className="c1-layer-name">知识图谱层</span>
              </div>
              <div className="c1-diamond" data-layer="kg">
                <img src={asset("layer-kg.png")} alt="" />
              </div>
            </div>
            <svg
              className="c1-stack-lines"
              viewBox="0 0 286 714"
              aria-hidden="true"
            >
              <line x1="18" y1="81" x2="22" y2="627" />
              <line x1="143" y1="138" x2="143" y2="190" />
              <line x1="143" y1="322" x2="143" y2="374" />
              <line x1="143" y1="506" x2="143" y2="558" />
              <line x1="270" y1="81" x2="264" y2="627" />
            </svg>
          </div>
          <div className="c1-layer c1-layer-app">
            <div className="c1-layer-copy">
              <span className="c1-pill c1-pill-app">Layer 5</span>
              <span className="c1-layer-name">数字孪生应用层</span>
            </div>
            <div className="c1-app-card">
              <div className="c1-diamond" data-layer="app">
                <img src={asset("layer-app.png")} alt="" />
              </div>
            </div>
          </div>
        </div>
        <svg className="c1-bracket" viewBox="0 0 520 970" aria-hidden="true">
          <path d="M496 418 H500 A12 12 0 0 1 512 430 V859 A12 12 0 0 1 500 871 H496" />
        </svg>
      </aside>

      <section className="c1-home" id="panel-home" hidden={view !== "home"}>
        <div className="c1-section-title">
          <img src={asset("icon-layers.png")} alt="" width="28" height="28" />
          <h2>无线数字孪生分层</h2>
        </div>
        <div className="c1-home-body">
          <div className="c1-quad">
            <article className="c1-home-row">
              <div className="c1-home-copy">
                <h3>环境几何层</h3>
                <p>构建物理世界的三维实体数字重构</p>
                <div className="c1-tags c1-tags-geo">
                  <span>多源感知融合</span>
                  <span>离散点云/3D表征</span>
                  <span>体素与空间网格表征</span>
                  <span>…</span>
                </div>
              </div>
              <div className="c1-shots">
                <figure>
                  <img src={asset("home/融合感知+new.png")} alt="" />
                  <figcaption>多源感知融合</figcaption>
                </figure>
                <figure>
                  <img src={asset("home/3D表征+new.png")} alt="" />
                  <figcaption>离散点云/3D表征</figcaption>
                </figure>
                <figure>
                  <img src={asset("home/网格+new.png")} alt="" />
                  <figcaption>体素与空间网格表征</figcaption>
                </figure>
              </div>
            </article>
            <div className="c1-rule" aria-hidden="true"></div>
            <article className="c1-home-row">
              <div className="c1-home-copy">
                <h3>电磁材质层</h3>
                <p>数字孪生的物理场核心，几何实体的电磁属性</p>
                <div className="c1-tags c1-tags-em">
                  <span>电常数</span>
                  <span>电导率</span>
                  <span>粗糙度</span>
                  <span>…</span>
                </div>
              </div>
              <div className="c1-shots">
                <figure>
                  <img src={asset("home/电常数+new.png")} alt="" />
                  <figcaption>电常数</figcaption>
                </figure>
                <figure>
                  <img src={asset("home/电导率+new.png")} alt="" />
                  <figcaption>电导率</figcaption>
                </figure>
                <figure>
                  <img src={asset("home/粗糙度+new.png")} alt="" />
                  <figcaption>粗糙度</figcaption>
                </figure>
              </div>
            </article>
            <div className="c1-rule" aria-hidden="true"></div>
            <article className="c1-home-row">
              <div className="c1-home-copy">
                <h3>RF层</h3>
                <p>电磁材质层计算结果的空间网格化/可视化呈现</p>
                <div className="c1-tags c1-tags-rf">
                  <span>接收信号强度(RSSI)</span>
                  <span>信噪比(SINR)</span>
                  <span>多径</span>
                  <span>…</span>
                </div>
              </div>
              <div className="c1-shots">
                <figure>
                  <img src={asset("home/接收信号强度+new.png")} alt="" />
                  <figcaption>接收信号强度(RSSI)</figcaption>
                </figure>
                <figure>
                  <img src={asset("home/信噪比+new.png")} alt="" />
                  <figcaption>信噪比(SINR)</figcaption>
                </figure>
                <figure>
                  <img src={asset("home/多径+new.png")} alt="" />
                  <figcaption>多径</figcaption>
                </figure>
              </div>
            </article>
            <div className="c1-rule" aria-hidden="true"></div>
            <article className="c1-home-row">
              <div className="c1-home-copy">
                <h3>知识图谱层</h3>
                <p>提供数字孪生的认知能力</p>
                <div className="c1-tags c1-tags-kg">
                  <span>语义标签化</span>
                  <span>环境态势与感知</span>
                  <span>知识图谱与行为预测</span>
                  <span>…</span>
                </div>
              </div>
              <div className="c1-shots">
                <figure>
                  <img src={asset("home/语义+new.png")} alt="" />
                  <figcaption>语义标签化</figcaption>
                </figure>
                <figure>
                  <img src={asset("home/环境感知1+new.png")} alt="" />
                  <figcaption>环境态势与感知</figcaption>
                </figure>
                <figure>
                  <img src={asset("home/知识图谱+new.png")} alt="" />
                  <figcaption>知识图谱与行为预测</figcaption>
                </figure>
              </div>
            </article>
          </div>
          <article className="c1-home-row c1-home-app">
            <div className="c1-home-copy">
              <h3>数字孪生应用层</h3>
              <p>数字孪生价值的变现与应用界面</p>
              <div className="c1-tags c1-tags-app">
                <span>辅助通信</span>
                <span>辅助定位</span>
                <span>具身智能路径规划</span>
                <span>…</span>
              </div>
            </div>
            <div className="c1-shots">
              <figure>
                <img src={asset("home/辅助通信+new.png")} alt="" />
                <figcaption>辅助通信</figcaption>
              </figure>
              <figure>
                <img src={asset("home/辅助定位+new.png")} alt="" />
                <figcaption>辅助定位</figcaption>
              </figure>
              <figure>
                <img src={asset("home/具生智能+new.png")} alt="" />
                <figcaption>具身智能路径规划</figcaption>
              </figure>
            </div>
          </article>
        </div>
      </section>

      <section
        className="c1-detail"
        id="panel-geometry"
        hidden={view !== "geometry"}
      >
        <div className="c1-section-title">
          <img src={asset("icon-layers.png")} alt="" width="28" height="28" />
          <h2>无线数字孪生分层</h2>
        </div>
        <div className="c1-detail-card">
          <div className="c1-overview">
            <div className="c1-brief">
              <h3>环境几何层</h3>
              <p>构建物理世界的三维实体数字重构</p>
              <div className="c1-tags c1-tags-geo">
                <span>多源感知融合</span>
                <span>离散点云/3D表征</span>
                <span>体素与空间网格表征</span>
                <span>结构与拓扑</span>
              </div>
            </div>
            <div className="c1-kpi-row">
              <article className="c1-kpi">
                <header>
                  <img src={asset("icon-geo-fidelity.png")} alt="" />
                  <h3>几何保真度</h3>
                </header>
                <KpiChart
                  layer="geometry"
                  item={data.geometry?.kpis[0]}
                  error={errors.geometry}
                />
              </article>
              <article className="c1-kpi">
                <header>
                  <img src={asset("icon-recon-rate.png")} alt="" />
                  <h3>重构覆盖率</h3>
                </header>
                <KpiChart
                  layer="geometry"
                  item={data.geometry?.kpis[1]}
                  error={errors.geometry}
                />
              </article>
            </div>
          </div>
          <div className="c1-view">
            <ModelViewport
              layer="geometry"
              model={models.geometry}
              error={modelErrors.geometry}
              active={view === "geometry"}
              config={config.geometry}
              debug={config.debug}
            />
          </div>
        </div>
      </section>

      <section
        className="c1-detail"
        id="panel-material"
        hidden={view !== "material"}
      >
        <div className="c1-section-title">
          <img src={asset("icon-layers.png")} alt="" width="28" height="28" />
          <h2>无线数字孪生分层</h2>
        </div>
        <div className="c1-detail-card">
          <div className="c1-overview">
            <div className="c1-brief">
              <h3>电磁材质层</h3>
              <p>赋予几何体真实的电磁属性</p>
              <div className="c1-tags c1-tags-em c1-tags-tight">
                <span>介电常数</span>
                <span>电导率</span>
                <span>粗糙度</span>
              </div>
            </div>
            <div className="c1-kpi-row">
              <article className="c1-kpi">
                <header>
                  <img src={asset("icon-em.png")} alt="" />
                  <h3>电磁信道保真度</h3>
                </header>
                <KpiChart
                  layer="material"
                  item={data.material?.kpis[0]}
                  error={errors.material}
                />
              </article>
              <article className="c1-materials">
                <header>
                  <img src={asset("icon-material.png")} alt="" />
                  <h3>材质</h3>
                </header>
                <div className="c1-swatches">
                  <div className="c1-swatch-row">
                    <figure>
                      <img src={asset("material/玻璃.png")} alt="" />
                      <figcaption>玻璃</figcaption>
                    </figure>
                    <figure>
                      <img src={asset("material/swatch-concrete.png")} alt="" />
                      <figcaption>混凝土</figcaption>
                    </figure>
                    <figure>
                      <img src={asset("material/木材.png")} alt="" />
                      <figcaption>木材</figcaption>
                    </figure>
                  </div>
                  <div className="c1-swatch-row">
                    <figure>
                      <img src={asset("material/金属.png")} alt="" />
                      <figcaption>金属</figcaption>
                    </figure>
                    <figure>
                      <img src={asset("material/其他.png")} alt="" />
                      <figcaption>其他</figcaption>
                    </figure>
                  </div>
                </div>
              </article>
            </div>
          </div>
          <div className="c1-view">
            <ModelViewport
              layer="material"
              model={models.material}
              error={modelErrors.material}
              active={view === "material"}
              config={config.material}
              debug={config.debug}
            />
          </div>
        </div>
      </section>

      <section
        className="c1-detail c1-detail-rf"
        id="panel-rf"
        hidden={view !== "rf"}
      >
        <div className="c1-section-title">
          <img src={asset("icon-layers.png")} alt="" width="28" height="28" />
          <h2>无线数字孪生分层</h2>
        </div>
        <div className="c1-detail-card">
          <div className="c1-overview">
            <div className="c1-brief">
              <h3>RF层</h3>
              <p>电磁层计算结果的空间网格化/可视化呈现</p>
              <div className="c1-tags c1-tags-rf-detail">
                <span>接收信号强度(RSS)</span>
                <span>信噪比(SINR)</span>
                <span>多径</span>
                <span>时延</span>
                <span>相位</span>
              </div>
            </div>
            <article className="c1-kpi c1-kpi-wide">
              <header>
                <img src={asset("icon-rf.png")} alt="" />
                <h3>RSS误差</h3>
              </header>
              <KpiChart layer="rf" item={data.rf?.kpis[0]} error={errors.rf} />
            </article>
          </div>
          <div className="c1-view">
            <RfView
              matrix={data.rf?.matrix}
              error={errors.rf}
              config={config}
            />
            <div className="c1-legend">
              <span className="c1-legend-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="16" height="16">
                  <path
                    d="M2 11.5a6 6 0 0 1 12 0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <path
                    d="M4.2 11.5a3.8 3.8 0 0 1 7.6 0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <circle cx="8" cy="12" r="1.2" fill="currentColor" />
                </svg>
              </span>
              <span className="c1-legend-title">信号强度</span>
              <span className="c1-legend-end">强</span>
              <span
                className="c1-legend-bar c1-legend-live"
                aria-hidden="true"
              >
                <i></i>
                <i></i>
                <i></i>
                <i></i>
              </span>
              <span className="c1-legend-end">弱</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
