/**
 * Case4 打桩后端的共享文件名与正式默认配置。
 * 这里只描述本地模拟后端，不与 Node 适配服务共享生产代码。
 */

export const CONTROL_FILE = "case_control.json";
export const CASE_ID = "case4";
export const REQUIRED_DT_TYPE = "all";

export const BASE_FILE = "ue_position_coordinates_base.txt";

export const SCHEMES = Object.freeze(["traditional", "commercial", "dt"]);
export const THR_SIDES = Object.freeze(["without", "with"]);

export const TRAJECTORY_FILES = Object.freeze({
  traditional: "ue_position_without_dt_coordinates_realtime.txt",
  commercial: "ue_position_gaode_coordinates_realtime.txt",
  dt: "ue_position_with_dt_coordinates_realtime.txt",
});

export const THROUGHPUT_FILES = Object.freeze({
  without: "ue_position_without_dt_thrp.txt",
  with: "ue_position_with_dt_thrp.txt",
});

export const CDF_FILES = Object.freeze({
  traditional: "ue_position_without_dt_coordinates_realtime_cdf.txt",
  commercial: "ue_position_gaode_coordinates_realtime_cdf.txt",
  dt: "ue_position_with_dt_coordinates_realtime_cdf.txt",
});

export const SUMMARY_FILE = "ue_position_with_dt_error_and_nlos.txt";

export const DYNAMIC_FILES = Object.freeze([
  TRAJECTORY_FILES.traditional,
  TRAJECTORY_FILES.commercial,
  TRAJECTORY_FILES.dt,
  THROUGHPUT_FILES.without,
  THROUGHPUT_FILES.with,
  CDF_FILES.traditional,
  CDF_FILES.commercial,
  CDF_FILES.dt,
  SUMMARY_FILE,
]);

export const RANDOM = Object.freeze({
  xyDeltaM: 0.02,
  thrpRatioMin: 0.98,
  thrpRatioMax: 1.02,
  statScaleMin: 0.98,
  statScaleMax: 1.02,
  nlosDelta: 0.005,
});

export const DEFAULTS = Object.freeze({
  pollMs: 200,
  successDwellMs: 3000,
  stepMs: 1000,
  outcome: "success",
  requestPicture: true,
  seedInit: true,
  dataMode: "random",
  seed: "",
  logLevel: "info",
});

export function isRequiredDtType(dtType) {
  return dtType === REQUIRED_DT_TYPE;
}
