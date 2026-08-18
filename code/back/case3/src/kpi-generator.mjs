/**
 * Case3 打桩 KPI 数据集生成器。
 * random 只生成 Throughput 与 Cost；坐标、波束和 Reflection 始终沿用 fixture。
 */

import { StubError } from "./errors.mjs";

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

function roundTo(value, digits) {
  const factor = 10 ** digits;
  const rounded =
    Math.sign(value) *
    (Math.round((Math.abs(value) + Number.EPSILON) * factor) / factor);
  return Object.is(rounded, -0) ? 0 : rounded;
}

function jittered(value, jitter, nextRandom, digits) {
  const ratio = 1 + (nextRandom() * 2 - 1) * jitter;
  return roundTo(value * ratio, digits);
}

function fixed(value, digits) {
  return Number(value).toFixed(digits);
}

/**
 * 为一次 Start 构造不可变发布快照。
 *
 * With 的下限高于对应 Without 模板在 +jitter 时的理论上限，保证两侧
 * 独立生成时仍保持 With Throughput 更高；若 fixture 无法满足则快速失败。
 */
export function createRoundDataset(options) {
  const {
    fixtureStore,
    side,
    dataMode = "random",
    seed = "",
    operationId,
    throughputJitter = 0.1,
    costJitter = 0.15,
  } = options;
  const fixture = fixtureStore.sides[side];

  if (dataMode !== "random" && dataMode !== "replay") {
    throw new StubError("CONFIG_INVALID", "CASE3_STUB_DATA_MODE 必须是 random / replay");
  }

  if (dataMode === "replay") {
    return {
      rows: fixture.rows,
      costLine: fixture.costLine,
      costLines: [fixture.costLine],
      count: fixture.count,
      dataMode,
      dataSource: "fixture-replay",
      resolvedSeed: null,
    };
  }

  const resolvedSeed =
    seed === undefined || seed === null || seed === ""
      ? String(operationId)
      : `${String(seed)}:${side}`;
  const nextRandom = createSeededRng(resolvedSeed);
  const withoutTemplate = fixtureStore.sides.without.throughputValues;
  const throughputLines = fixture.throughputValues.map((template, index) => {
    let value = jittered(template, throughputJitter, nextRandom, 2);

    if (side === "with" && withoutTemplate[index] !== undefined) {
      const withoutUpper = roundTo(
        withoutTemplate[index] * (1 + throughputJitter),
        2,
      );
      const requiredFloor = roundTo(withoutUpper + 0.01, 2);
      const withUpper = roundTo(template * (1 + throughputJitter), 2);
      if (requiredFloor > withUpper) {
        throw new StubError(
          "KPI_GENERATION_INVALID",
          `第 ${index + 1} 点 fixture 无法在抖动范围内保证 With Throughput 更高`,
        );
      }
      value = Math.max(value, requiredFloor);
    }
    return fixed(value, 2);
  });

  const costLines = Array.from({ length: fixture.count }, () =>
    fixed(
      Math.min(
        100,
        Math.max(0, jittered(fixture.cost, costJitter, nextRandom, 1)),
      ),
      1,
    ),
  );
  return {
    rows: {
      ...fixture.rows,
      throughput: throughputLines,
    },
    costLine: costLines.at(-1),
    costLines,
    count: fixture.count,
    dataMode,
    dataSource: "synthetic-kpi+fixture-structure",
    resolvedSeed,
  };
}
