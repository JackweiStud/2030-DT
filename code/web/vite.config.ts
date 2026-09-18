/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

declare const process: {
  env: Record<string, string | undefined>;
  cwd: () => string;
};

/**
 * Vite 配置：开发时把 /api 代理到本机适配服务。
 * 主变量 DT_ADAPTER_*；旧 CASE2_ADAPTER_* 仅 fallback。
 * 正式包由同机静态托管保持同源，不依赖 CORS。
 * host:true 监听 0.0.0.0，启动时打印 Local + Network（局域网 IP）。
 * CASE4_REFLECTION_ENABLE / CASE4_BS_XYZ 显式白名单注入，不暴露整个 .env。
 */
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "");
  const adapterHost =
    process.env.DT_ADAPTER_HOST ||
    process.env.CASE2_ADAPTER_HOST ||
    "127.0.0.1";
  const adapterPort =
    process.env.DT_ADAPTER_PORT ||
    process.env.CASE2_ADAPTER_PORT ||
    "3102";
  const reflectionEnable =
    process.env.CASE4_REFLECTION_ENABLE ??
    fileEnv.CASE4_REFLECTION_ENABLE ??
    "";
  const bsXyz = process.env.CASE4_BS_XYZ ?? fileEnv.CASE4_BS_XYZ ?? "";

  return {
    plugins: [react()],
    publicDir: false,
    define: {
      "import.meta.env.CASE4_REFLECTION_ENABLE": JSON.stringify(reflectionEnable),
      "import.meta.env.CASE4_BS_XYZ": JSON.stringify(bsXyz),
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        "/api": {
          target: `http://${adapterHost}:${adapterPort}`,
          changeOrigin: false,
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    },
  };
});
