/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite 配置：开发时把 /api 代理到本机适配服务 3102。
 * 正式包由同机静态托管保持同源，不依赖 CORS。
 */
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3102",
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
