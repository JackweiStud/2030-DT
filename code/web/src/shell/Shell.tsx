/**
 * Shell：1920×1080 固定舞台等比缩放居中；跨 Case 导航锁。
 * 可见 Tab 不含旧「DT for Comm」；Case3 V2 走「DT for Comm new」。
 * 拥有「现场环境」弹窗（case2/3/4 共用）。
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import brandMark from "../../assets/shell/cloud-site.png";
import cornerMark from "../../assets/shell/huawei-logo.png";
import { SiteEnvWindow } from "./SiteEnvWindow";
import {
  SiteEnvWindowContext,
  type SiteEnvWindowApi,
} from "./siteEnvWindowContext";
import "./shell.css";

export type CaseTabId = "case1" | "case2" | "case3" | "case4" | "case5";

const LEFT_TABS: { id: CaseTabId; label: string }[] = [
  { id: "case1", label: "DT构建" },
  { id: "case2", label: "DT校正" },
];

const RIGHT_TABS: { id: CaseTabId; label: string }[] = [
  { id: "case5", label: "DT辅助通信" },
  { id: "case4", label: "DT辅助定位" },
];

type Props = {
  activeTab: CaseTabId;
  onTabChange: (tab: CaseTabId) => void;
  /** Stage 内层节点，供截图使用。 */
  stageRef: React.RefObject<HTMLDivElement>;
  /** 当前 Case Start/ReInit（含截图收尾）等待时锁定其他 Tab。 */
  navigationLocked?: boolean;
  children: ReactNode;
};

type TabItem = (typeof LEFT_TABS)[number];

/**
 * 固定舞台 + 视口缩放。业务页不得自行做第二套响应式。
 */
export function Shell(props: Props) {
  const {
    activeTab,
    onTabChange,
    stageRef,
    navigationLocked = false,
    children,
  } = props;
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [siteEnvOpen, setSiteEnvOpen] = useState(false);

  const openSiteEnv = useCallback(() => setSiteEnvOpen(true), []);
  const closeSiteEnv = useCallback(() => setSiteEnvOpen(false), []);

  const siteEnvApi = useMemo<SiteEnvWindowApi>(
    () => ({ open: openSiteEnv, close: closeSiteEnv }),
    [openSiteEnv, closeSiteEnv],
  );

  useEffect(() => {
    setSiteEnvOpen(false);
  }, [activeTab]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setScale(Math.min(w / 1920, h / 1080));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const renderTab = (tab: TabItem) => {
    const isActive = activeTab === tab.id;
    const lockedOther = navigationLocked && tab.id !== activeTab;
    return (
      <button
        key={tab.id}
        type="button"
        data-tab={tab.id}
        className={`case-tab${isActive ? " is-active" : ""}`}
        disabled={lockedOther}
        aria-current={isActive ? "page" : undefined}
        onClick={() => {
          if (lockedOther) return;
          onTabChange(tab.id);
        }}
      >
        <span className="case-tab__label">{tab.label}</span>
        <span className="tab-underline" aria-hidden />
      </button>
    );
  };

  return (
    <SiteEnvWindowContext.Provider value={siteEnvApi}>
      <div className="stage-viewport" ref={viewportRef}>
        <div
          className="stage"
          ref={stageRef}
          style={{ transform: `scale(${scale})` }}
        >
          <header className="shell-header">
            <div className="nav-bg" aria-hidden />
            <div className="brand-area">
              <img
                className="brand-logo"
                src={brandMark}
                width={36}
                height={36}
                alt=""
                aria-hidden
              />
              <span className="brand-sub">云上外场</span>
            </div>
            <nav className="case-nav case-nav--left" aria-label="左侧 Case">
              {LEFT_TABS.map(renderTab)}
            </nav>
            <div className="shell-title">IMT2030(6G)无线数字孪生</div>
            <nav className="case-nav case-nav--right" aria-label="右侧 Case">
              {RIGHT_TABS.map(renderTab)}
            </nav>
            <div className="shell-corner" aria-hidden>
              <img
                className="shell-corner__mark"
                src={cornerMark}
                width={36}
                height={36}
                alt=""
              />
            </div>
          </header>
          {children}
          <SiteEnvWindow
            open={siteEnvOpen}
            onClose={closeSiteEnv}
            stageRef={stageRef}
          />
        </div>
      </div>
    </SiteEnvWindowContext.Provider>
  );
}

export function ComingSoon() {
  return (
    <section className="placeholder-page">
      <p>建设中</p>
    </section>
  );
}
