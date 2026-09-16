/**
 * Gate 1.5 静态示意数据。仅供验收页。
 * 禁止迁入正式 React / Node / 打桩运行路径。
 *
 * 默认完成代表态的 CEP/NLOS 使用接口文件映射（传统/商用/DT），
 * 不以 Pencil 示意柱高 3.3/1.4/0.5 与 8.1/3.5/0.4 为准。
 */
(function (global) {
  "use strict";

  var P = global.Case4MapProjection;
  var CFG = P.DEFAULTS;

  /**
   * 点位图标左上角 · 相对 .c4-map__transform（= Pencil RV86I 局部 + 18/-7）。
   * 用于派生业务坐标；地图气泡渲染以 pencil-map-art.pinTL（组内局部）为准。
   */
  var PIN_OFFSET = { x: 18, y: -7 };
  var PIN_LOCAL_TL = [
    [651.5, 425.5],
    [695.5, 410.5],
    [739.5, 395.5],
    [782.5, 381.5],
    [827.5, 367.5],
    [871.5, 353.5],
    [914.5, 338.5],
    [958.5, 325.5],
    [1002.5, 311.5],
    [1045.5, 297.5],
    [1089.5, 282.5],
    [1134.5, 268.5],
    [1177.5, 254.5],
    [1213.3049648856963, 279.67821377138824],
    [1249.1099297713927, 304.85642754277643],
    [1284.914894657089, 330.0346413141647],
    [1320.7198595427856, 355.21285508555286],
    [1356.524824428482, 380.3910688569411],
    [1392.3297893141782, 405.56928262832935],
    [1428.1347541998746, 430.74749639971753],
  ];

  function pinStageToBusiness(left, top) {
    var ground = {
      x: left + P.PIN_SIZE.width / 2 - CFG.offsetX,
      y: top + P.PIN_SIZE.height - CFG.offsetY,
    };
    return P.projectImageToBusiness(P.layerToImage(ground, CFG), CFG);
  }

  function corridor20() {
    return PIN_LOCAL_TL.map(function (xy) {
      return pinStageToBusiness(xy[0] + PIN_OFFSET.x, xy[1] + PIN_OFFSET.y);
    });
  }

  function offsetBusiness(points, dImageX, dImageY) {
    return points.map(function (pt) {
      var img = P.projectBusinessToImage(pt.x, pt.y, CFG);
      var shifted = {
        imageX: img.imageX + dImageX,
        imageY: img.imageY + dImageY,
      };
      return P.projectImageToBusiness(shifted, CFG);
    });
  }

  function slicePts(points, n) {
    return points.slice(0, Math.max(0, n));
  }

  function makeCdf(cep50) {
    var pts = [];
    var i;
    for (i = 0; i <= 48; i++) {
      var p = i / 48;
      var x = -cep50 * Math.log(1 - Math.min(0.985, p)) / Math.log(2);
      pts.push({ x: x, p: p });
    }
    return pts;
  }

  function makeThrp(values) {
    return values.map(function (v, i) {
      return { n: i + 1, v: v };
    });
  }

  function wave(len, base, amp, phase) {
    var out = [];
    var i;
    for (i = 0; i < len; i++) {
      out.push(Number((base + amp * Math.sin((i + phase) / 2.4)).toFixed(2)));
    }
    return makeThrp(out);
  }

  function alignAndError(expected, actuals) {
    var n = Math.min(
      expected.length,
      actuals.bs.length,
      actuals.gaode.length,
      actuals.dt.length
    );
    var errors = { bs: [], gaode: [], dt: [] };
    var i;
    var keys = ["bs", "gaode", "dt"];
    for (i = 0; i < n; i++) {
      keys.forEach(function (k) {
        errors[k].push(P.xyDistance(expected[i], actuals[k][i]));
      });
    }
    return { aligned: n, errors: errors };
  }

  var expected20 = corridor20();
  var expected38 = P.samplePolyline(expected20, 38);

  function schemeTracks(expected) {
    return {
      bs: offsetBusiness(expected, 9, 5),
      gaode: offsetBusiness(expected, -11, 4),
      dt: offsetBusiness(expected, 2, -3),
    };
  }

  var tracks20 = schemeTracks(expected20);
  var tracks38 = schemeTracks(expected38);

  var FILE_CEP = {
    bs: { cep50: 1.36, cep90: 3.55 },
    gaode: { cep50: 3.34, cep90: 8.05 },
    dt: { cep50: 0.15, cep90: 0.47 },
  };
  var FILE_NLOS = 0.897;

  // Pencil 完成态误差点 Y → 5.5 轴反推（仅 pencilCep 贴设计）
  var PENCIL_ERRORS = {
    bs: [4.15, 3.65, 4.4, 3.55, 4, 4.55, 3.45, 4.05, 4.45, 3.7, 4.65, 3.6, 3.95, 4.4, 3.65, 4.1, 4.55, 3.8, 3.55, 4.25],
    gaode: [3.05, 2.55, 3.3, 2.45, 2.9, 3.45, 2.35, 2.95, 3.35, 2.6, 3.55, 2.5, 2.85, 3.3, 2.55, 3, 3.45, 2.7, 2.45, 3.15],
    dt: [1.95, 1.45, 2.2, 1.35, 1.8, 2.35, 1.25, 1.85, 2.25, 1.5, 2.45, 1.4, 1.75, 2.2, 1.45, 1.9, 2.35, 1.6, 1.35, 2.05],
  };

  var PENCIL_CEP = {
    bs: { cep50: 3.3, cep90: 8.1 },
    gaode: { cep50: 1.4, cep90: 3.5 },
    dt: { cep50: 0.5, cep90: 0.4 },
  };

  function pack(expected, tracks, aligned, thrpWo, thrpW, stats) {
    var sliced = {
      bs: slicePts(tracks.bs, aligned),
      gaode: slicePts(tracks.gaode, aligned),
      dt: slicePts(tracks.dt, aligned),
    };
    var derived = alignAndError(expected, sliced);
    return {
      expected: expected,
      actual: sliced,
      errors: derived.errors,
      alignedCount: derived.aligned,
      thrpWithout: thrpWo,
      thrpWith: thrpW,
      cdf: {
        bs: makeCdf(stats.cep.bs.cep50),
        gaode: makeCdf(stats.cep.gaode.cep50),
        dt: makeCdf(stats.cep.dt.cep50),
      },
      cep: stats.cep,
      nlos: stats.nlos,
    };
  }

  var DATASETS = {
    visual20: pack(
      expected20,
      tracks20,
      20,
      wave(20, 9.05, 0.22, 0),
      wave(20, 8.48, 0.18, 1.2),
      { cep: FILE_CEP, nlos: FILE_NLOS }
    ),
    n38c30: pack(
      expected38,
      tracks38,
      30,
      wave(28, 9.05, 0.22, 0),
      wave(22, 8.48, 0.18, 1.2),
      { cep: FILE_CEP, nlos: FILE_NLOS }
    ),
    over20: pack(
      P.samplePolyline(expected20, 25),
      schemeTracks(P.samplePolyline(expected20, 25)),
      25,
      wave(26, 9.1, 0.3, 0.4),
      wave(21, 8.4, 0.25, 1.8),
      { cep: FILE_CEP, nlos: FILE_NLOS }
    ),
    thrpUneven: pack(
      expected20,
      tracks20,
      20,
      wave(24, 9.1, 0.35, 0.2),
      wave(16, 8.3, 0.4, 2.1),
      { cep: FILE_CEP, nlos: FILE_NLOS }
    ),
    pencilCep: (function () {
      var d = pack(
        expected20,
        tracks20,
        20,
        wave(20, 9.05, 0.22, 0),
        wave(20, 8.48, 0.18, 1.2),
        { cep: PENCIL_CEP, nlos: 0.995 }
      );
      d.errors = {
        bs: PENCIL_ERRORS.bs.slice(),
        gaode: PENCIL_ERRORS.gaode.slice(),
        dt: PENCIL_ERRORS.dt.slice(),
      };
      return d;
    })(),
  };

  global.Case4DemoData = {
    STATIC_ONLY: true,
    WINDOW: 20,
    RUNNING_AT: 13,
    DATASETS: DATASETS,
    DEFAULT_DATASET: "pencilCep",
    FILE_CEP: FILE_CEP,
    PENCIL_CEP: PENCIL_CEP,
  };
})(typeof window !== "undefined" ? window : this);
