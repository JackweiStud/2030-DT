/**
 * 应用入口：加载 Case2/Case3/Case4 配置；仅激活 Tab 挂载对应页面；汇总跨 Case busy。
 * 「DT辅助通信」挂 Case3 V2（tab=case3）；「DT辅助定位」挂 Case4。
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { Case1Page } from "../cases/case1/Case1Page";
import { ComingSoon, Shell, type CaseTabId } from "../shell/Shell";
import { Case2Page } from "../cases/case2/Case2Page";
import { Case3V2Page } from "../cases/case3-v2/Case3V2Page";
import { Case4Page } from "../cases/case4/Case4Page";
import {
  HeatmapConfigError,
  loadCase2RuntimeConfig,
} from "../cases/case2/metrics/heatmapConfig";
import {
  Case3ConfigError,
  loadCase3RuntimeConfig,
} from "../cases/case3/config/case3RuntimeConfig";
import {
  Case4ConfigError,
  loadCase4RuntimeConfig,
} from "../cases/case4/config/case4RuntimeConfig";
import "../../assets/shell/tokens.css";
import "../../assets/case2/tokens.css";

export function App() {
  const [tab, setTab] = useState<CaseTabId>("case1");
  const stageRef = useRef<HTMLDivElement>(null);
  const [case2Busy, setCase2Busy] = useState(false);
  const [case3Busy, setCase3Busy] = useState(false);
  const [case4Busy, setCase4Busy] = useState(false);

  const case2Config = useMemo(() => {
    try {
      return { ok: true as const, config: loadCase2RuntimeConfig(import.meta.env) };
    } catch (err) {
      const field = err instanceof HeatmapConfigError ? err.field : "unknown";
      return { ok: false as const, field, message: String(err) };
    }
  }, []);

  const case3Config = useMemo(() => {
    try {
      return { ok: true as const, config: loadCase3RuntimeConfig(import.meta.env) };
    } catch (err) {
      const field = err instanceof Case3ConfigError ? err.field : "unknown";
      return { ok: false as const, field, message: String(err) };
    }
  }, []);

  const case4Config = useMemo(() => {
    try {
      return { ok: true as const, config: loadCase4RuntimeConfig(import.meta.env) };
    } catch (err) {
      const field = err instanceof Case4ConfigError ? err.field : "unknown";
      return { ok: false as const, field, message: String(err) };
    }
  }, []);

  const navigationLocked =
    (tab === "case2" && case2Busy) ||
    (tab === "case3" && case3Busy) ||
    (tab === "case4" && case4Busy);

  const onTabChange = useCallback(
    (next: CaseTabId) => {
      if (navigationLocked && next !== tab) return;
      setTab(next);
    },
    [navigationLocked, tab],
  );

  let body: React.ReactNode;
  if (tab === "case1") {
    body = <Case1Page />;
  } else if (tab === "case2") {
    body = case2Config.ok ? (
      <Case2Page
        config={case2Config.config}
        stageElementRef={stageRef}
        onBusyChange={setCase2Busy}
      />
    ) : (
      <main className="case2-page">
        <p className="case2-config-error">
          case2 热力图配置错误：{case2Config.field}
        </p>
      </main>
    );
  } else if (tab === "case3") {
    body = case3Config.ok ? (
      <Case3V2Page
        config={case3Config.config}
        stageElementRef={stageRef}
        onBusyChange={setCase3Busy}
      />
    ) : (
      <main className="case3v2-page">
        <p className="case3v2-config-error">
          case3 配置错误：{case3Config.field}
        </p>
      </main>
    );
  } else if (tab === "case4") {
    body = case4Config.ok ? (
      <Case4Page
        config={case4Config.config}
        stageElementRef={stageRef}
        onBusyChange={setCase4Busy}
      />
    ) : (
      <main className="case4-page">
        <p className="case4-config-error">
          case4 配置错误：{case4Config.field}
        </p>
      </main>
    );
  } else {
    body = <ComingSoon />;
  }

  return (
    <Shell
      activeTab={tab}
      onTabChange={onTabChange}
      stageRef={stageRef}
      navigationLocked={navigationLocked}
    >
      {body}
    </Shell>
  );
}
