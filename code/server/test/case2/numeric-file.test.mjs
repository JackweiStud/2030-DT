import test from "node:test";
import assert from "node:assert/strict";
import {
  parseHeatmap,
  parseKpi,
  roundSemanticNumber,
} from "../../src/cases/case2/numeric-file.mjs";

const RSS_HEATMAP = { min: -500, max: 500 };
const DELAY_HEATMAP = { min: 0, max: 1000 };
const RSS_KPI = { min: -1000, max: 1000 };
const PATH_KPI = { min: 0, max: 50000 };
const DELAY_KPI = { min: 0, max: 10000 };

test("动态 heatmap 支持 CRLF、逗号/空白并四舍五入", () => {
  assert.deepEqual(
    parseHeatmap("1.235, 2 3\r\n-1.235 4,5\r\n", "heatmap.txt", RSS_HEATMAP),
    [
      [1.24, 2, 3],
      [-1.24, 4, 5],
    ],
  );
  assert.equal(roundSemanticNumber(1.235), 1.24);
  assert.equal(roundSemanticNumber(-1.235), -1.24);
});

test("同一行有效数字之间的空格与末尾逗号不是无效数据", () => {
  assert.deepEqual(
    parseHeatmap("238.17, 240.67, 235.66, \n1,  2,3\n", "heatmap.txt", RSS_HEATMAP),
    [
      [238.17, 240.67, 235.66],
      [1, 2, 3],
    ],
  );
  assert.deepEqual(
    parseKpi("1.2,  3.4, 5.6, ", "kpi.txt", RSS_KPI),
    [1.2, 3.4, 5.6],
  );
});

test("动态 KPI 忽略行列分组并展平", () => {
  assert.deepEqual(parseKpi("1.235, 2\n3 4\n", "kpi.txt", RSS_KPI), [1.24, 2, 3, 4]);
});

test("heatmap 必须矩形；科学计数仍拒绝；越界双边掐位", () => {
  assert.deepEqual(
    parseHeatmap("500.004\n", "heatmap.txt", RSS_HEATMAP),
    [[500]],
  );
  assert.throws(() => parseHeatmap("1 2\n3\n", "heatmap.txt", RSS_HEATMAP), {
    code: "DATA_FILE_INVALID",
  });
  assert.throws(() => parseHeatmap("1e2\n", "heatmap.txt", RSS_HEATMAP), {
    code: "DATA_FILE_INVALID",
  });

  const clamped = [];
  assert.deepEqual(
    parseHeatmap(
      "-4166.67, 887.48, 1200\n",
      "heatmap_cali_first_path_delay.txt",
      DELAY_HEATMAP,
      { onOutOfRange: (info) => clamped.push(info) },
    ),
    [[0, 887.48, 1000]],
  );
  assert.equal(clamped[0].invalidCount, 2);
  assert.equal(clamped[0].action, "clamped");
});

test("KPI 越界样本丢弃并计数；滤完为空则 422", () => {
  const dropped = [];
  assert.deepEqual(
    parseKpi("157, 11184743.81, 308", "kpi.txt", DELAY_KPI, {
      onOutOfRange: (info) => dropped.push(info),
    }),
    [157, 308],
  );
  assert.equal(dropped[0].invalidCount, 1);
  assert.equal(dropped[0].remaining, 2);
  assert.equal(dropped[0].action, "dropped");

  assert.deepEqual(parseKpi("-12.3, 20", "kpi.txt", RSS_KPI), [-12.3, 20]);
  assert.deepEqual(parseKpi("45796", "kpi.txt", PATH_KPI), [45796]);

  assert.throws(() => parseKpi("1e2", "kpi.txt", RSS_KPI), {
    code: "DATA_FILE_INVALID",
  });
  assert.throws(() => parseKpi("11184743.81", "kpi.txt", DELAY_KPI), {
    code: "DATA_FILE_INVALID",
  });
});
