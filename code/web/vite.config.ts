/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

declare const process: {
  env: Record<string, string | undefined>;
};

const adapterHost =
  process.env.DT_ADAPTER_HOST ||
  process.env.CASE2_ADAPTER_HOST ||
  "127.0.0.1";
const adapterPort =
  process.env.DT_ADAPTER_PORT ||
  process.env.CASE2_ADAPTER_PORT ||
  "3102";

/**
 * Vite 配置：开发时把 /api 代理到本机适配服务。
 * 主变量 DT_ADAPTER_*；旧 CASE2_ADAPTER_* 仅 fallback。
 * 正式包由同机静态托管保持同源，不依赖 CORS。
 * host:true 监听 0.0.0.0，启动时打印 Local + Network（局域网 IP）。
 */
export default defineConfig({
  plugins: [react()],
  publicDir: false,
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
});
