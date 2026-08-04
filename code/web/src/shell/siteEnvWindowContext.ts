/**
 * Shell 级「现场环境」弹窗 API（case2 / case3 / case4 共用）。
 */

import { createContext, useContext } from "react";

export type SiteEnvWindowApi = {
  open: () => void;
  close: () => void;
};

export const SiteEnvWindowContext = createContext<SiteEnvWindowApi | null>(null);

export function useSiteEnvWindow(): SiteEnvWindowApi {
  const ctx = useContext(SiteEnvWindowContext);
  if (!ctx) {
    throw new Error("useSiteEnvWindow must be used within Shell");
  }
  return ctx;
}
