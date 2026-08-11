import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCostLine,
  parsePhysicalLines,
  parseReflectionLine,
  parseScanBeamLine,
  parseSelectedBeamLine,
  parseThroughputLine,
  roundSemanticNumber,
} from "../../src/cases/case3/numeric-line.mjs";

test("数值按绝对值半入并归一负零", () => {
  assert.equal(roundSemanticNumber(1.005, 2), 1.01);
  assert.equal(roundSemanticNumber(-1.005, 2), -1.01);
  assert.equal(roundSemanticNumber(-0.001, 2), 0);
});

test("Throughput、Cost、beam id 和 Reflection 执行冻结校验", () => {
  assert.equal(parseThroughputLine("8.555", "throughput"), 8.56);
  assert.equal(parseCostLine("99.96", "cost"), 100);
  assert.equal(parseSelectedBeamLine("255", "beam"), 255);
  assert.deepEqual(parseReflectionLine("1.005,-2.005,0,1", "reflection"), {
    x: 1.01,
    y: -2.01,
    z: 0,
    los: true,
  });
  assert.equal(parseReflectionLine("1,2,3,0", "reflection").los, false);

  assert.throws(() => parseThroughputLine("-1", "throughput"), {
    code: "SIDE_DATA_INVALID",
  });
  assert.throws(() => parseCostLine("100.06", "cost"), {
    code: "SIDE_DATA_INVALID",
  });
  assert.throws(() => parseSelectedBeamLine("256", "beam"), {
    code: "SIDE_DATA_INVALID",
  });
  assert.throws(() => parseReflectionLine("1,2,3,2", "reflection"), {
    code: "SIDE_DATA_INVALID",
  });
});

test("Without 扫描 beam 必须恰好 16 个互不重复整数", () => {
  const valid = parseScanBeamLine(
    "0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15",
    "scan",
  );
  assert.equal(valid.length, 16);
  assert.throws(
    () =>
      parseScanBeamLine(
        "0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,14",
        "scan",
      ),
    { code: "SIDE_DATA_INVALID" },
  );
});

test("已提交非法行返回 422，无换行非法尾段只标 pending", () => {
  assert.throws(
    () => parsePhysicalLines("1\nbad\n", "selected", parseSelectedBeamLine),
    { code: "SIDE_DATA_INVALID" },
  );
  assert.deepEqual(
    parsePhysicalLines("1\nba", "selected", parseSelectedBeamLine),
    { complete: [1], hasPendingTail: true },
  );
  assert.deepEqual(
    parsePhysicalLines("1\n2", "selected", parseSelectedBeamLine),
    { complete: [1, 2], hasPendingTail: false },
  );
});
