export const CASE2_API_PREFIX = "/api/case2";

export const REQUIRED_CONTROL_FIELDS = Object.freeze([
  "case",
  "command",
  "dt_type",
  "status",
  "save_picture_flag",
]);

export const OPTIONAL_CONTROL_FIELDS = Object.freeze(["debug_flag", "scene_type"]);

export const METRIC_FILES = Object.freeze({
  rss: Object.freeze({
    initial: Object.freeze({
      heatmap: "heatmap_init_rss.txt",
      kpi: "heatmap_init_kpi_rss.txt",
    }),
    calibrated: Object.freeze({
      heatmap: "heatmap_cali_rss.txt",
      kpi: "heatmap_cali_kpi_rss.txt",
    }),
  }),
  effective_path_num: Object.freeze({
    initial: Object.freeze({
      heatmap: "heatmap_init_effective_path_num.txt",
      kpi: "heatmap_init_kpi_effective_path_num.txt",
    }),
    calibrated: Object.freeze({
      heatmap: "heatmap_cali_effective_path_num.txt",
      kpi: "heatmap_cali_kpi_effective_path_num.txt",
    }),
  }),
  first_path_delay: Object.freeze({
    initial: Object.freeze({
      heatmap: "heatmap_init_first_path_delay.txt",
      kpi: "heatmap_init_kpi_first_path_delay.txt",
    }),
    calibrated: Object.freeze({
      heatmap: "heatmap_cali_first_path_delay.txt",
      kpi: "heatmap_cali_kpi_first_path_delay.txt",
    }),
  }),
});
