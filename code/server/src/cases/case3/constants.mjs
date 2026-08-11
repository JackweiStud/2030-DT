/** Case3 REST 与共享文件名常量。 */

export const CASE3_API_PREFIX = "/api/case3";

export const CASE3_INIT_FILES = Object.freeze({
  baseRoute: "ue_comm_coordinates_base.txt",
  beamAccuracy: "ue_comm_with_dt_beam_accuracy_rate.txt",
});

export const CASE3_SIDE_FILES = Object.freeze({
  without: Object.freeze({
    coordinates: "ue_comm_without_dt_coordinates.txt",
    scans: "ue_comm_without_dt_beams.txt",
    selected: "ue_comm_without_dt_sel_beam.txt",
    throughput: "ue_comm_without_dt_thrp.txt",
    cost: "ue_comm_without_dt_cost.txt",
    optionalMse: "ue_comm_without_dt_mse.txt",
  }),
  with: Object.freeze({
    coordinates: "ue_comm_with_dt_coordinates.txt",
    selected: "ue_comm_with_dt_sel_beam.txt",
    throughput: "ue_comm_with_dt_thrp.txt",
    reflection: "ue_comm_with_dt_coordinates_reflection_point.txt",
    cost: "ue_comm_with_dt_cost.txt",
    optionalMse: "ue_comm_with_dt_mse.txt",
  }),
});

export function dtTypeForSide(side) {
  return side === "without" ? "without dt" : "with dt";
}
