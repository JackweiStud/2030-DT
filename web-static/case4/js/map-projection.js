/**
 * case3 V2 地图投影的静态可迁移副本。
 * 语义对齐 `code/web/src/cases/case3-v2/mapProjectionV2.ts`。
 * 仅坐标映射；不含业务状态。正式 React 应使用 TS 源，不要 import 本文件。
 */
(function (global) {
  "use strict";

  var PIN_SIZE = { width: 35, height: 42 };
  /* case4.pen 当前UE标记 36×48；勿用 case3 的 38 高 */
  var UE_SIZE = { width: 36, height: 48 };

  var DEFAULTS = {
    originX: 905,
    originY: 445,
    unitsPerPx: 0.11,
    naturalW: 1920,
    naturalH: 988,
    displayW: 3466,
    displayH: 1783,
    offsetX: -447,
    offsetY: -874,
  };

  function projectBusinessToImage(x, y, cfg) {
    cfg = cfg || DEFAULTS;
    return {
      imageX: cfg.originX + y / cfg.unitsPerPx,
      imageY: cfg.originY + x / cfg.unitsPerPx,
    };
  }

  function projectImageToBusiness(point, cfg) {
    cfg = cfg || DEFAULTS;
    return {
      x: (point.imageY - cfg.originY) * cfg.unitsPerPx,
      y: (point.imageX - cfg.originX) * cfg.unitsPerPx,
      z: 0,
    };
  }

  function imageToLayer(point, cfg) {
    cfg = cfg || DEFAULTS;
    return {
      x: point.imageX * (cfg.displayW / cfg.naturalW),
      y: point.imageY * (cfg.displayH / cfg.naturalH),
    };
  }

  function layerToImage(point, cfg) {
    cfg = cfg || DEFAULTS;
    return {
      imageX: point.x / (cfg.displayW / cfg.naturalW),
      imageY: point.y / (cfg.displayH / cfg.naturalH),
    };
  }

  function businessToLayer(x, y, cfg) {
    return imageToLayer(projectBusinessToImage(x, y, cfg), cfg);
  }

  function pinBoxFromLayer(point) {
    return {
      left: point.x - PIN_SIZE.width / 2,
      top: point.y - PIN_SIZE.height,
    };
  }

  function ueBoxFromLayer(point) {
    return {
      left: point.x - UE_SIZE.width / 2,
      top: point.y - UE_SIZE.height,
    };
  }

  function xyDistance(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function samplePolyline(points, count) {
    var n = Math.max(0, Math.floor(count));
    if (!n || !points.length) return [];
    if (n === 1 || points.length === 1) return [points[0]];
    var segs = [];
    var total = 0;
    for (var i = 1; i < points.length; i++) {
      var from = points[i - 1];
      var to = points[i];
      var len = Math.hypot(to.x - from.x, to.y - from.y);
      if (!(len > 0)) continue;
      segs.push({ from: from, to: to, start: total, length: len });
      total += len;
    }
    if (!(total > 0)) {
      return Array.from({ length: n }, function () {
        return points[0];
      });
    }
    var out = [];
    for (var s = 0; s < n; s++) {
      var target = s === n - 1 ? total : (total * s) / (n - 1);
      var seg = segs[segs.length - 1];
      for (var k = 0; k < segs.length; k++) {
        if (target <= segs[k].start + segs[k].length) {
          seg = segs[k];
          break;
        }
      }
      var ratio = seg.length > 0 ? (target - seg.start) / seg.length : 0;
      out.push({
        x: seg.from.x + (seg.to.x - seg.from.x) * ratio,
        y: seg.from.y + (seg.to.y - seg.from.y) * ratio,
        z: 0,
      });
    }
    return out;
  }

  global.Case4MapProjection = {
    PIN_SIZE: PIN_SIZE,
    UE_SIZE: UE_SIZE,
    DEFAULTS: DEFAULTS,
    projectBusinessToImage: projectBusinessToImage,
    projectImageToBusiness: projectImageToBusiness,
    imageToLayer: imageToLayer,
    layerToImage: layerToImage,
    businessToLayer: businessToLayer,
    pinBoxFromLayer: pinBoxFromLayer,
    ueBoxFromLayer: ueBoxFromLayer,
    xyDistance: xyDistance,
    samplePolyline: samplePolyline,
  };
})(typeof window !== "undefined" ? window : this);
