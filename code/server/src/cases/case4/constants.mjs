/** Case4 REST 与共享文件名常量。 */

export const CASE4_API_PREFIX = "/api/case4";

export const CASE4_BASE_FILE = "ue_position_coordinates_base.txt";

export const CASE4_TRAJECTORY_FILES = Object.freeze({
  traditional: "ue_position_without_dt_coordinates_realtime.txt",
  commercial: "ue_position_gaode_coordinates_realtime.txt",
  dt: "ue_position_with_dt_coordinates_realtime.txt",
});

export const CASE4_THROUGHPUT_FILES = Object.freeze({
  without: "ue_position_without_dt_thrp.txt",
  with: "ue_position_with_dt_thrp.txt",
});

export const CASE4_CDF_FILES = Object.freeze({
  traditional: "ue_position_without_dt_coordinates_realtime_cdf.txt",
  commercial: "ue_position_gaode_coordinates_realtime_cdf.txt",
  dt: "ue_position_with_dt_coordinates_realtime_cdf.txt",
});

export const CASE4_SUMMARY_FILE = "ue_position_with_dt_error_and_nlos.txt";

export const CASE4_REFLECTION_FILE =
  "ue_position_with_dt_coordinates_reflection_point.txt";

/** Start/ReInit 必清的 9 个动态文件；不含 base、截图或 JSONL。 */
export const CASE4_DYNAMIC_FILES = Object.freeze([
  CASE4_TRAJECTORY_FILES.traditional,
  CASE4_TRAJECTORY_FILES.commercial,
  CASE4_TRAJECTORY_FILES.dt,
  CASE4_THROUGHPUT_FILES.without,
  CASE4_THROUGHPUT_FILES.with,
  CASE4_CDF_FILES.traditional,
  CASE4_CDF_FILES.commercial,
  CASE4_CDF_FILES.dt,
  CASE4_SUMMARY_FILE,
]);

export const CASE4_SCHEMES = Object.freeze([
  "traditional",
  "commercial",
  "dt",
]);
