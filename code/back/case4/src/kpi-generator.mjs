/**
 * Case4 打桩数据集生成器。
 * replay 保留有效记录原文；random 相对 fixture 小幅扰动一次。
 */

import { RANDOM, SCHEMES, THR_SIDES } from "./constants.mjs";
import { StubError } from "./errors.mjs";
import { isSentinel } from "./fixture-store.mjs";

export function roundSemanticNumber(value, digits = 2) {
  const factor = 10 ** digits;
  const rounded =
    Math.sign(value) *
    (Math.round((Math.abs(value) + Number.EPSILON) * factor) / factor);
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** 基于文本 seed 的轻量可复现随机数生成器。 */
export function createSeededRng(seedText) {
  let state = 0;
  for (const char of String(seedText)) {
    state = (Math.imul(31, state) + char.charCodeAt(0)) >>> 0;
  }
  if (state === 0) state = 0x9e3779b9;
  return function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function formatUnrounded(value) {
  if (Object.is(value, -0) || value === 0) return "0";
  return String(value);
}

function joinTwo(tokens, separator) {
  return separator === "comma" ? `${tokens[0]},${tokens[1]}` : `${tokens[0]} ${tokens[1]}`;
}

function rangeValue(nextRandom, min, max) {
  return min + nextRandom() * (max - min);
}

function signedDelta(nextRandom, amplitude) {
  return (nextRandom() * 2 - 1) * amplitude;
}

function trajectoryPlanValid(trajectories) {
  const trad = trajectories.traditional.length;
  return (
    trad > 0 &&
    trad === trajectories.commercial.length &&
    trad === trajectories.dt.length
  );
}

function replayFromStore(fixtureStore) {
  return {
    trajectories: {
      traditional: [...fixtureStore.trajectories.traditional.lines],
      commercial: [...fixtureStore.trajectories.commercial.lines],
      dt: [...fixtureStore.trajectories.dt.lines],
    },
    throughputs: {
      without: [...fixtureStore.throughputs.without.lines],
      with: [...fixtureStore.throughputs.with.lines],
    },
    statistics: {
      cdf: {
        traditional: [...fixtureStore.statistics.cdf.traditional.lines],
        commercial: [...fixtureStore.statistics.cdf.commercial.lines],
        dt: [...fixtureStore.statistics.cdf.dt.lines],
      },
      summary: [...fixtureStore.statistics.summary.lines],
    },
    dataMode: "replay",
    dataSource: "fixture-replay",
    resolvedSeed: null,
    trajectoryPlanValid: trajectoryPlanValid({
      traditional: fixtureStore.trajectories.traditional.lines,
      commercial: fixtureStore.trajectories.commercial.lines,
      dt: fixtureStore.trajectories.dt.lines,
    }),
  };
}

function randomFromStore(fixtureStore, resolvedSeed) {
  const nextRandom = createSeededRng(resolvedSeed);
  const trajectories = {};
  for (const scheme of SCHEMES) {
    trajectories[scheme] = fixtureStore.trajectories[scheme].points.map(
      (point) => {
        if (point.passthrough) return point.line;
        const [x, y, z] = point.values;
        const xOut = isSentinel(x)
          ? point.tokens[0]
          : roundSemanticNumber(
              x + signedDelta(nextRandom, RANDOM.xyDeltaM),
              2,
            ).toFixed(2);
        const yOut = isSentinel(y)
          ? point.tokens[1]
          : roundSemanticNumber(
              y + signedDelta(nextRandom, RANDOM.xyDeltaM),
              2,
            ).toFixed(2);
        const zOut = point.tokens[2];
        return `${xOut},${yOut},${zOut}`;
      },
    );
  }

  const throughputs = {};
  for (const side of THR_SIDES) {
    throughputs[side] = fixtureStore.throughputs[side].values.map((value) => {
      if (value === 0) return "0";
      const scaled =
        value *
        rangeValue(nextRandom, RANDOM.thrpRatioMin, RANDOM.thrpRatioMax);
      return roundSemanticNumber(Math.max(0, scaled), 2).toFixed(2);
    });
  }

  const scales = {};
  for (const scheme of SCHEMES) {
    scales[scheme] = rangeValue(
      nextRandom,
      RANDOM.statScaleMin,
      RANDOM.statScaleMax,
    );
  }

  const cdf = {};
  for (const scheme of SCHEMES) {
    const block = fixtureStore.statistics.cdf[scheme];
    cdf[scheme] = block.rows.map((row) => {
      const errorM = row.errorM * scales[scheme];
      return joinTwo(
        [formatUnrounded(errorM), row.tokens[1]],
        block.separator,
      );
    });
  }

  const summaryBlock = fixtureStore.statistics.summary;
  const summary = summaryBlock.rows.map((row, index) => {
    if (index < 3) {
      const scheme = SCHEMES[index];
      const p50 = formatUnrounded(row.values[0] * scales[scheme]);
      const p90 = formatUnrounded(row.values[1] * scales[scheme]);
      return joinTwo([p50, p90], summaryBlock.separator);
    }
    const nlos = Math.min(
      1,
      Math.max(0, row.values[0] + signedDelta(nextRandom, RANDOM.nlosDelta)),
    );
    return joinTwo([formatUnrounded(nlos), row.tokens[1]], summaryBlock.separator);
  });

  return {
    trajectories,
    throughputs,
    statistics: { cdf, summary },
    dataMode: "random",
    dataSource: "synthetic-perturbation",
    resolvedSeed,
    trajectoryPlanValid: trajectoryPlanValid(trajectories),
    scales,
  };
}

/**
 * 为一次 Start 构造不可变发布快照。
 * 正式入口只从 loadFixtureStore 的结果生成，因此默认三轨迹同长。
 */
export function createRoundDataset(options) {
  const {
    fixtureStore,
    dataMode = "random",
    seed = "",
    operationId,
  } = options;

  if (dataMode !== "random" && dataMode !== "replay") {
    throw new StubError(
      "CONFIG_INVALID",
      "CASE4_STUB_DATA_MODE 必须是 random / replay",
    );
  }

  if (dataMode === "replay") return replayFromStore(fixtureStore);

  const resolvedSeed =
    seed === undefined || seed === null || seed === ""
      ? String(operationId)
      : String(seed);
  return randomFromStore(fixtureStore, resolvedSeed);
}

/**
 * 测试专用：绕过 loadFixtureStore，注入计划行。
 * 三轨迹不同长时 trajectoryPlanValid=false，发布器不得 complete。
 */
export function createInjectedDataset(options) {
  const trajectories = {
    traditional: [...options.trajectories.traditional],
    commercial: [...options.trajectories.commercial],
    dt: [...options.trajectories.dt],
  };
  const throughputs = {
    without: [...(options.throughputs?.without ?? [])],
    with: [...(options.throughputs?.with ?? [])],
  };
  return {
    trajectories,
    throughputs,
    statistics: options.statistics,
    dataMode: options.dataMode ?? "replay",
    dataSource: options.dataSource ?? "fixture-replay",
    resolvedSeed: options.resolvedSeed ?? null,
    trajectoryPlanValid: trajectoryPlanValid(trajectories),
  };
}

export function datasetLengths(dataset) {
  return {
    traditional: dataset.trajectories.traditional.length,
    commercial: dataset.trajectories.commercial.length,
    dt: dataset.trajectories.dt.length,
    without: dataset.throughputs.without.length,
    with: dataset.throughputs.with.length,
  };
}
