/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CASE2_POLL_MS?: string;
  readonly VITE_CASE2_HEATMAP_X0?: string;
  readonly VITE_CASE2_HEATMAP_Y0?: string;
  readonly VITE_CASE2_HEATMAP_X1?: string;
  readonly VITE_CASE2_HEATMAP_Y1?: string;
  readonly VITE_CASE2_HEATMAP_CELL?: string;
  readonly VITE_CASE2_HEATMAP_GAP?: string;
  readonly VITE_CASE2_HEATMAP_ALPHA?: string;
  readonly VITE_CASE2_CDF_POINT_CAP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
