import test from "node:test";
import assert from "node:assert/strict";
import {
  parseHeatmap,
  parseKpi,
  roundSemanticNumber,
} from "../../src/cases/case2/numeric-file.mjs";

test("动态 heatmap 支持 CRLF、逗号和空白并四舍五入", () => {
  assert.deepEqual(
    parseHeatmap("1.235, 2 3\r\n-1.235 4,5\r\n", "heatmap.txt"),
    [
      [1.24, 2, 3],
      [-1.24, 4, 5],
    ],
  );
  assert.equal(roundSemanticNumber(1.235), 1.24);
  assert.equal(roundSemanticNumber(-1.235), -1.24);
});

test("动态 KPI 忽略行列分组并展平", () => {
  assert.deepEqual(parseKpi("1.235, 2\n3 4\n", "kpi.txt"), [1.24, 2, 3, 4]);
});

test("heatmap 必须矩形且范围按归一后数值判定", () => {
  assert.deepEqual(parseHeatmap("200.004\n", "heatmap.txt"), [[200]]);
  assert.throws(() => parseHeatmap("1 2\n3\n", "heatmap.txt"), {
    code: "DATA_FILE_INVALID",
  });
  assert.throws(() => parseHeatmap("200.005\n", "heatmap.txt"), {
    code: "DATA_FILE_INVALID",
  });
  assert.throws(() => parseHeatmap("1e2\n", "heatmap.txt"), {
    code: "DATA_FILE_INVALID",
  });
});

test("KPI 禁止负号、科学计数和归一后越界", () => {
  assert.deepEqual(parseKpi("500.004", "kpi.txt"), [500]);
  for (const value of ["-0", "500.005", "1e2", "NaN", "Infinity"]) {
    assert.throws(() => parseKpi(value, "kpi.txt"), {
      code: "DATA_FILE_INVALID",
    });
  }
});
