/**
 * 应用入口：加载 case2 配置；仅激活 Tab 挂载对应页面。
 */

import { useMemo, useRef, useState } from "react";
import { ComingSoon, Shell, type CaseTabId } from "../shell/Shell";
import { Case2Page } from "../cases/case2/Case2Page";
import {
  HeatmapConfigError,
  loadCase2RuntimeConfig,
} from "../cases/case2/metrics/heatmapConfig";
import "../../assets/shell/tokens.css";
import "../../assets/case2/tokens.css";

export function App() {
  const [tab, setTab] = useState<CaseTabId>("case2");
  const stageRef = useRef<HTMLDivElement>(null);

  const configResult = useMemo(() => {
    try {
      return { ok: true as const, config: loadCase2RuntimeConfig(import.meta.env) };
    } catch (err) {
      const field =
        err instanceof HeatmapConfigError ? err.field : "unknown";
      return { ok: false as const, field, message: String(err) };
    }
  }, []);

  return (
    <Shell activeTab={tab} onTabChange={setTab} stageRef={stageRef}>
      {tab === "case2" ? (
        configResult.ok ? (
          <Case2Page config={configResult.config} stageElementRef={stageRef} />
        ) : (
          <main className="case2-page">
            <p className="case2-config-error">
              case2 热力图配置错误：{configResult.field}
            </p>
          </main>
        )
      ) : (
        <ComingSoon />
      )}
    </Shell>
  );
}
