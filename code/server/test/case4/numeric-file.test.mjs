import test from "node:test";
import assert from "node:assert/strict";
import {
  assembleTrajectory,
  isCoordinateSentinel,
  parseBaseRoute,
  parseCdfFile,
  parseCoordinateRaw,
  parsePhysicalLines,
  parseSummaryFile,
  parseThroughputRaw,
  interpretSummaryRecords,
  roundSemanticNumber,
} from "../../src/cases/case4/numeric-file.mjs";

test("舍入复用 EPSILON，65534.996 不是原始哨兵", () => {
  assert.equal(roundSemanticNumber(1.005, 2), 1.01);
  assert.equal(roundSemanticNumber(-1.005, 2), -1.01);
  assert.equal(roundSemanticNumber(-0.001, 2), 0);
  assert.equal(roundSemanticNumber(65534.996, 2), 65535);
  assert.equal(isCoordinateSentinel(65534.996), false);
  assert.equal(isCoordinateSentinel(65535), true);
  assert.equal(isCoordinateSentinel(65535.0), true);
  assert.equal(isCoordinateSentinel(6.5535e4), true);
});

test("BOM 与 CRLF 不改变行号，逗号分隔 CDF 合法", () => {
  const base = parseBaseRoute("\uFEFF1,15,0\r\n2,16,0\r\n", "base.txt");
  assert.equal(base.length, 2);
  assert.equal(base[1].no, 2);
  const cdf = parseCdfFile("0,0\n1,1\n", "cdf.txt");
  assert.equal(cdf.complete.length, 2);
  assert.equal(cdf.complete[1].probability, 1);
});

test("坐标接受科学计数，拒绝垃圾后缀和空行重编号", () => {
  assert.deepEqual(parseCoordinateRaw("1.0e0, 2.5, .5", "xyz.txt"), {
    x: 1,
    y: 2.5,
    z: 0.5,
  });
  assert.deepEqual(parseCoordinateRaw("65535", "xyz.txt"), {
    x: 65535,
    y: 65535,
    z: 65535,
  });
  assert.deepEqual(parseCoordinateRaw("65535.0", "xyz.txt"), {
    x: 65535,
    y: 65535,
    z: 65535,
  });
  assert.deepEqual(parseCoordinateRaw("1 2 3", "xyz.txt"), {
    x: 1,
    y: 2,
    z: 3,
  });
  assert.throws(() => parseBaseRoute("1 2 3\n", "base.txt"), {
    code: "INIT_DATA_INVALID",
  });
  assert.throws(() => parseCoordinateRaw("1", "xyz.txt"), {
    code: "TRAJECTORY_DATA_INVALID",
  });
  assert.throws(() => parseCoordinateRaw("1.2abc,2,3", "xyz.txt"), {
    code: "TRAJECTORY_DATA_INVALID",
  });
  assert.throws(() => parseCoordinateRaw("1,2,3,4", "xyz.txt"), {
    code: "TRAJECTORY_DATA_INVALID",
  });
  assert.throws(() => parseCoordinateRaw("NaN,2,3", "xyz.txt"), {
    code: "TRAJECTORY_DATA_INVALID",
  });
  assert.throws(() => parseCoordinateRaw("Infinity,2,3", "xyz.txt"), {
    code: "TRAJECTORY_DATA_INVALID",
  });
  assert.throws(() => parseThroughputRaw("1e999", "thrp.txt"), {
    code: "THROUGHPUT_DATA_INVALID",
  });
  assert.throws(
    () =>
      parsePhysicalLines(
        "1,2,3\n\n4,5,6\n",
        "xyz.txt",
        (line, filename) => parseCoordinateRaw(line, filename),
        "TRAJECTORY_DATA_INVALID",
      ),
    { code: "TRAJECTORY_DATA_INVALID" },
  );
});

test("无换行完整末行计入 complete，半行只标 pending", () => {
  const parser = (line, filename) => parseCoordinateRaw(line, filename);
  assert.deepEqual(parsePhysicalLines("1,2,3\n4,5,6", "xyz.txt", parser, "TRAJECTORY_DATA_INVALID"), {
    complete: [
      { x: 1, y: 2, z: 3 },
      { x: 4, y: 5, z: 6 },
    ],
    hasPendingTail: false,
  });
  assert.deepEqual(
    parsePhysicalLines("1,2,3\n4,5", "xyz.txt", parser, "TRAJECTORY_DATA_INVALID"),
    {
      complete: [{ x: 1, y: 2, z: 3 }],
      hasPendingTail: true,
    },
  );
  assert.throws(
    () => parsePhysicalLines("1,2,3\n4,5\n", "xyz.txt", parser, "TRAJECTORY_DATA_INVALID"),
    { code: "TRAJECTORY_DATA_INVALID" },
  );
});

test("文件尾空白忽略，记录间空行与半写尾段仍拒绝", () => {
  const xyz = (line, filename) => parseCoordinateRaw(line, filename);
  const trailingSpaces = parsePhysicalLines(
    "1,2,3\n4,5,6\n  ",
    "xyz.txt",
    xyz,
    "TRAJECTORY_DATA_INVALID",
  );
  assert.deepEqual(trailingSpaces.complete, [
    { x: 1, y: 2, z: 3 },
    { x: 4, y: 5, z: 6 },
  ]);
  assert.equal(trailingSpaces.hasPendingTail, false);

  const extraNewlines = parsePhysicalLines(
    "1,2,3\n4,5,6\n\n",
    "xyz.txt",
    xyz,
    "TRAJECTORY_DATA_INVALID",
  );
  assert.equal(extraNewlines.complete.length, 2);
  assert.equal(extraNewlines.hasPendingTail, false);

  const onlyWhitespace = parsePhysicalLines(
    "  \n\n",
    "thrp.txt",
    (line, filename) => parseThroughputRaw(line, filename),
    "THROUGHPUT_DATA_INVALID",
  );
  assert.deepEqual(onlyWhitespace, { complete: [], hasPendingTail: false });

  assert.throws(
    () => parsePhysicalLines("1,2,3\n\n4,5,6\n", "xyz.txt", xyz, "TRAJECTORY_DATA_INVALID"),
    { code: "TRAJECTORY_DATA_INVALID" },
  );
  assert.deepEqual(
    parsePhysicalLines("8.5\n9,", "thrp.txt", parseThroughputRaw, "THROUGHPUT_DATA_INVALID"),
    { complete: [8.5], hasPendingTail: true },
  );
  assert.throws(
    () =>
      parsePhysicalLines(
        "8.5\n9,\n  ",
        "thrp.txt",
        parseThroughputRaw,
        "THROUGHPUT_DATA_INVALID",
      ),
    { code: "THROUGHPUT_DATA_INVALID" },
  );
});

test("负吞吐在 round 前拒绝，含会变成 0 的负小数", () => {
  assert.equal(parseThroughputRaw("8.555", "thrp.txt"), 8.56);
  assert.throws(() => parseThroughputRaw("-1", "thrp.txt"), {
    code: "THROUGHPUT_DATA_INVALID",
  });
  assert.throws(() => parseThroughputRaw("-0.004", "thrp.txt"), {
    code: "THROUGHPUT_DATA_INVALID",
  });
});

test("CDF 保留科学计数精度并校验单调和概率范围", () => {
  const parsed = parseCdfFile("5.71e-05 0.0\n0.1 0.99\n", "cdf.txt");
  assert.equal(parsed.complete[0].errorM, 5.71e-5);
  assert.equal(parsed.complete[0].errorM === 0, false);
  assert.equal(parsed.complete[1].probability, 0.99);
  assert.throws(() => parseCdfFile("0 0\n-1 0.5\n", "cdf.txt"), {
    code: "STATISTICS_DATA_INVALID",
  });
  assert.throws(() => parseCdfFile("0 0\n1 1.01\n", "cdf.txt"), {
    code: "STATISTICS_DATA_INVALID",
  });
  assert.throws(() => parseCdfFile("1 0.2\n0.5 0.3\n", "cdf.txt"), {
    code: "STATISTICS_DATA_INVALID",
  });
  assert.throws(() => parseCdfFile("0 0\n1,0.5\n", "cdf.txt"), {
    code: "STATISTICS_DATA_INVALID",
  });
});

test("CEP/NLOS 汇总校验 p50<=p90 与比例范围，第 4 列 2 不进业务", () => {
  const parsed = parseSummaryFile(
    "1.36 3.55\n3.34 8.05\n0.15 0.47\n0.897 0\n",
    "sum.txt",
  );
  const summary = interpretSummaryRecords(parsed.complete, "sum.txt");
  assert.equal(summary.nlosRatio, 0.897);
  assert.equal(summary.cep.dt.p90M, 0.47);
  assert.throws(
    () =>
      interpretSummaryRecords(
        parseSummaryFile("2 1\n3.34 8.05\n0.15 0.47\n0.5 0\n", "sum.txt").complete,
        "sum.txt",
      ),
    { code: "STATISTICS_DATA_INVALID" },
  );
  assert.throws(
    () =>
      interpretSummaryRecords(
        parseSummaryFile("1 2\n3 4\n5 6\n89.7 0\n", "sum.txt").complete,
        "sum.txt",
      ),
    { code: "STATISTICS_DATA_INVALID" },
  );
});

test("65535 按分量替换：P1 用 base，连续递推，仅 Z 不影响 XY", () => {
  const base = parseBaseRoute("1,15,0.5\n2,16,1\n3,17,1.5\n", "base.txt");
  const traditional = {
    filename: "trad.txt",
    complete: [
      parseCoordinateRaw("65535", "trad.txt"),
      parseCoordinateRaw("65535,20,65535", "trad.txt"),
      parseCoordinateRaw("3.1,21,65535", "trad.txt"),
    ],
    hasPendingTail: false,
  };
  const other = {
    filename: "other.txt",
    complete: [
      parseCoordinateRaw("1.02,15.01,0.5", "other.txt"),
      parseCoordinateRaw("2.02,16.01,1", "other.txt"),
      parseCoordinateRaw("3.02,17.01,1.5", "other.txt"),
    ],
    hasPendingTail: false,
  };
  const snapshot = assembleTrajectory(
    base,
    { traditional, commercial: other, dt: other },
    { logSubstitution() {} },
  );
  assert.deepEqual(snapshot.points[0].traditional, { x: 1, y: 15, z: 0.5 });
  assert.deepEqual(snapshot.points[1].traditional, { x: 1, y: 20, z: 0.5 });
  assert.equal(snapshot.points[2].traditional.x, 3.1);
  assert.equal(snapshot.points[2].traditional.y, 21);
  assert.equal(snapshot.points[2].traditional.z, 0.5);
});

test("base 含哨兵初始化失败；实时超 base 不截短", () => {
  assert.throws(() => parseBaseRoute("65535,15,0\n", "base.txt"), {
    code: "INIT_DATA_INVALID",
  });
  assert.throws(() => parseBaseRoute("65535\n", "base.txt"), {
    code: "INIT_DATA_INVALID",
  });
  assert.throws(() => parseBaseRoute("1,15,0\n2,16,65535\n", "base.txt"), {
    code: "INIT_DATA_INVALID",
  });
  const base = parseBaseRoute("1,15,0\n", "base.txt");
  const long = {
    filename: "trad.txt",
    complete: [
      parseCoordinateRaw("1,15,0", "trad.txt"),
      parseCoordinateRaw("2,16,0", "trad.txt"),
    ],
    hasPendingTail: false,
  };
  const short = {
    filename: "other.txt",
    complete: [parseCoordinateRaw("1,15,0", "other.txt")],
    hasPendingTail: false,
  };
  assert.throws(
    () =>
      assembleTrajectory(base, {
        traditional: long,
        commercial: short,
        dt: short,
      }),
    { code: "TRAJECTORY_DATA_INVALID" },
  );
});
