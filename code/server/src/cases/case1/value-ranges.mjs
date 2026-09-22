import { parseRangePair } from "../case2/value-ranges.mjs";

export const DEFAULT_CASE1_RANGE_HEATMAP_RSS = Object.freeze({
  min: -500,
  max: 500,
});

export function loadCase1ValueRanges(env = {}) {
  const rawValue = env.CASE1_RANGE_HEATMAP_RSS;
  return Object.freeze({
    heatmapRss:
      rawValue === undefined || rawValue === ""
        ? DEFAULT_CASE1_RANGE_HEATMAP_RSS
        : parseRangePair(rawValue, "CASE1_RANGE_HEATMAP_RSS"),
  });
}
