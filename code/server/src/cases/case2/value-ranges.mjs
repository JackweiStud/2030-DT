const RANGE_PAIR =
  /^\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*[,~～]\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*$/;

export const DEFAULT_CASE2_RANGES = Object.freeze({
  rss: Object.freeze({
    heatmap: Object.freeze({ min: -500, max: 500 }),
    kpi: Object.freeze({ min: -1000, max: 1000 }),
  }),
  effective_path_num: Object.freeze({
    heatmap: Object.freeze({ min: 0, max: 500 }),
    kpi: Object.freeze({ min: 0, max: 50000 }),
  }),
  first_path_delay: Object.freeze({
    heatmap: Object.freeze({ min: 0, max: 1000 }),
    kpi: Object.freeze({ min: 0, max: 10000 }),
  }),
});

export const CASE2_RANGE_ENV_KEYS = Object.freeze({
  rss: Object.freeze({
    heatmap: "CASE2_RANGE_HEATMAP_RSS",
    kpi: "CASE2_RANGE_KPI_RSS",
  }),
  effective_path_num: Object.freeze({
    heatmap: "CASE2_RANGE_HEATMAP_EFFECTIVE_PATH_NUM",
    kpi: "CASE2_RANGE_KPI_EFFECTIVE_PATH_NUM",
  }),
  first_path_delay: Object.freeze({
    heatmap: "CASE2_RANGE_HEATMAP_FIRST_PATH_DELAY",
    kpi: "CASE2_RANGE_KPI_FIRST_PATH_DELAY",
  }),
});

export function parseRangePair(rawValue, envName) {
  const matched = RANGE_PAIR.exec(rawValue);
  if (!matched) {
    throw new Error(`${envName} 必须是 min,max 或 min~max（例如 -500,500）`);
  }
  const min = Number(matched[1]);
  const max = Number(matched[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error(`${envName} 必须是有限数字`);
  }
  if (min > max) {
    throw new Error(`${envName} 的 min 不能大于 max`);
  }
  return Object.freeze({ min, max });
}

export function loadCase2ValueRanges(env = {}) {
  const ranges = {};
  for (const [metric, kinds] of Object.entries(CASE2_RANGE_ENV_KEYS)) {
    ranges[metric] = {};
    for (const [kind, envName] of Object.entries(kinds)) {
      const rawValue = env[envName];
      ranges[metric][kind] =
        rawValue === undefined || rawValue === ""
          ? DEFAULT_CASE2_RANGES[metric][kind]
          : parseRangePair(rawValue, envName);
    }
    ranges[metric] = Object.freeze(ranges[metric]);
  }
  return Object.freeze(ranges);
}

export function rangeForFile(ranges, metric, kind) {
  const range = ranges?.[metric]?.[kind];
  if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) {
    throw new Error(`missing case2 range for ${metric}.${kind}`);
  }
  return range;
}
