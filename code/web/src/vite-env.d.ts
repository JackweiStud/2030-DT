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
  readonly VITE_CASE3_POLL_MS?: string;
  readonly VITE_CASE3_MAP_ORIGIN_X?: string;
  readonly VITE_CASE3_MAP_ORIGIN_Y?: string;
  readonly VITE_CASE3_MAP_UNITS_PER_PX?: string;
  readonly VITE_CASE3_V2_MAP_ORIGIN_X?: string;
  readonly VITE_CASE3_V2_MAP_ORIGIN_Y?: string;
  readonly VITE_CASE3_V2_MAP_UNITS_PER_PX?: string;
  readonly VITE_CASE3_V2_MAP_IMAGE_SCALE?: string;
  readonly VITE_CASE3_V2_MAP_IMAGE_ROTATION_DEG?: string;
  readonly VITE_CASE3_V2_MAP_IMAGE_OFFSET_X?: string;
  readonly VITE_CASE3_V2_MAP_IMAGE_OFFSET_Y?: string;
  readonly VITE_CASE3_V2_DEBUG_SHOW?: string;
  readonly CASE3_REFLECTION_ENABLE?: string;
  readonly CASE3_BS_XYZ?: string;
  readonly VITE_CASE4_POLL_MS?: string;
  readonly VITE_CASE4_MAP_ORIGIN_X?: string;
  readonly VITE_CASE4_MAP_ORIGIN_Y?: string;
  readonly VITE_CASE4_MAP_UNITS_PER_PX?: string;
  readonly VITE_CASE4_MAP_IMAGE_SCALE?: string;
  readonly VITE_CASE4_MAP_IMAGE_ROTATION_DEG?: string;
  readonly VITE_CASE4_MAP_IMAGE_OFFSET_X?: string;
  readonly VITE_CASE4_MAP_IMAGE_OFFSET_Y?: string;
  readonly VITE_CASE4_MAP_DEBUG_SHOW?: string;
  readonly CASE4_REFLECTION_ENABLE?: string;
  readonly CASE4_BS_XYZ?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
