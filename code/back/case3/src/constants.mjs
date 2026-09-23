/**
 * Case3 打桩后端的共享文件名与正式默认配置。
 * 这里只描述本地模拟后端，不与 Node 适配服务共享生产代码。
 */

export const CONTROL_FILE = "case_control.json";

export const INIT_FILES = Object.freeze({
  baseRoute: "ue_comm_coordinates_base.txt",
  beamAccuracy: "ue_comm_with_dt_beam_accuracy_rate.txt",
});

export const SIDE_FILES = Object.freeze({
  without: Object.freeze({
    coordinates: "ue_comm_without_dt_coordinates.txt",
    scans: "ue_comm_without_dt_beams.txt",
    selected: "ue_comm_without_dt_sel_beam.txt",
    throughput: "ue_comm_without_dt_thrp.txt",
    cost: "ue_comm_without_dt_cost.txt",
  }),
  with: Object.freeze({
    coordinates: "ue_comm_with_dt_coordinates.txt",
    selected: "ue_comm_with_dt_sel_beam.txt",
    throughput: "ue_comm_with_dt_thrp.txt",
    reflection: "ue_comm_with_dt_coordinates_reflection_point.txt",
    cost: "ue_comm_with_dt_cost.txt",
  }),
});

export const POINT_KEYS = Object.freeze({
  without: Object.freeze(["coordinates", "scans", "selected"]),
  with: Object.freeze([
    "coordinates",
    "selected",
    "reflection",
  ]),
});

export const DEFAULTS = Object.freeze({
  pollMs: 200,
  successDwellMs: 3000,
  pointMs: 1000,
  outcome: "success",
  requestPicture: true,
  seedInit: true,
  dataMode: "random",
  seed: "",
  throughputJitter: 0.1,
  costJitter: 0.15,
  logLevel: "info",
});

export function sideFromDtType(dtType) {
  if (dtType === "without dt") return "without";
  if (dtType === "with dt") return "with";
  return null;
}

export function dtTypeFromSide(side) {
  return side === "without" ? "without dt" : "with dt";
}
