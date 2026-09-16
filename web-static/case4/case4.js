/**
 * case4 Gate 1.5 静态验收脚本。
 * 假状态机 / URL 切换 / 示意数据 — 禁止迁入正式 React。
 */
(function () {
  "use strict";

  var P = window.Case4MapProjection;
  var DEMO = window.Case4DemoData;
  var CFG = P.DEFAULTS;
  var WINDOW = DEMO.WINDOW;
  var COLORS = {
    planOuter: "#ABC5FF80",
    planInner: "#457EF980",
    walkedOuter: "#ABC5FF",
    walkedInner: "#457EF9",
    bs: "#97AAC4",
    gaode: "#F0A12E",
    dt: "#7A6BFF",
  };

  var STATES = [
    ["initial", "1 初始态"],
    ["running", "2 运行中"],
    ["completed", "3 完成态"],
    ["adapter-error", "4 适配异常"],
    ["site-env", "5 现场环境"],
  ];

  var STATE_CFG = {
    initial: {
      status: "未开始",
      start: "ready",
      reset: "off",
      banner: "",
      bannerTitle: "",
      bannerDetail: "",
      progress: 0,
      finalStats: false,
      thrp: false,
      tracks: false,
    },
    running: {
      status: "测试中...",
      start: "busy",
      reset: "off",
      banner: "",
      bannerTitle: "",
      bannerDetail: "",
      progress: DEMO.RUNNING_AT,
      finalStats: false,
      thrp: true,
      tracks: true,
    },
    completed: {
      status: "已完成",
      start: "off",
      reset: "ready",
      banner: "",
      bannerTitle: "",
      bannerDetail: "",
      progress: "all",
      finalStats: true,
      thrp: true,
      tracks: true,
    },
    "adapter-error": {
      status: "适配异常",
      start: "off",
      reset: "off",
      bannerTitle: "适配服务异常",
      bannerDetail: "",
      bannerKind: "error",
      progress: 0,
      finalStats: false,
      thrp: false,
      tracks: false,
    },
    "site-env": {
      status: "测试中...",
      start: "busy",
      reset: "off",
      banner: "",
      bannerTitle: "",
      bannerDetail: "",
      progress: DEMO.RUNNING_AT,
      finalStats: false,
      thrp: true,
      tracks: true,
      openSiteEnv: true,
    },
  };

  var page = document.getElementById("case4-page");
  var stage = document.getElementById("stage");
  var placeholder = document.getElementById("placeholder-page");
  var datasetKey = DEMO.DEFAULT_DATASET;
  var currentState = "initial";
  var lastFlow = "initial";
  var siteEnv = null;

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function businessToStage(pt) {
    var layer = P.businessToLayer(pt.x, pt.y, CFG);
    return {
      x: layer.x + CFG.offsetX,
      y: layer.y + CFG.offsetY,
    };
  }

  /* Pencil iD2DE 相对变换层 (12,-36)：舞台坐标 → 轨迹局部坐标 */
  var TRACK_OFFSET = { x: 12, y: -36 };
  /* Pencil y87v9 相对变换层 (17,-6) */
  var CORRIDOR_OFFSET = { x: 17, y: -6 };
  var PENCIL_ART = window.Case4PencilMapArt;

  function businessToTrackLocal(pt) {
    var s = businessToStage(pt);
    return {
      x: s.x - TRACK_OFFSET.x,
      y: s.y - TRACK_OFFSET.y,
    };
  }

  function businessToCorridorLocal(pt) {
    var s = businessToStage(pt);
    return {
      x: s.x - CORRIDOR_OFFSET.x,
      y: s.y - CORRIDOR_OFFSET.y,
    };
  }

  function pathFromBusiness(points) {
    if (!points || !points.length) return "";
    return points
      .map(function (pt, i) {
        var s = businessToCorridorLocal(pt);
        return (i === 0 ? "M" : "L") + s.x.toFixed(2) + " " + s.y.toFixed(2);
      })
      .join(" ");
  }

  function pathFromBusinessTrack(points) {
    if (!points || !points.length) return "";
    return points
      .map(function (pt, i) {
        var s = businessToTrackLocal(pt);
        return (i === 0 ? "M" : "L") + s.x.toFixed(2) + " " + s.y.toFixed(2);
      })
      .join(" ");
  }

  function polylineSvg(path, stroke, width, dash) {
    if (!path) return "";
    return (
      '<path d="' +
      path +
      '" fill="none" stroke="' +
      stroke +
      '" stroke-width="' +
      width +
      '" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"' +
      (dash ? ' stroke-dasharray="' + dash + '"' : "") +
      "></path>"
    );
  }

  /** 与 Pencil 走廊同 d；按进度弧长截断（pathLength=100） */
  function corridorProgressSvg(path, stroke, width, progress01) {
    if (!path) return "";
    var t = Math.max(0, Math.min(1, progress01));
    if (t >= 1) return polylineSvg(path, stroke, width);
    var pct = Number((t * 100).toFixed(2));
    return (
      '<path d="' +
      path +
      '" fill="none" stroke="' +
      stroke +
      '" stroke-width="' +
      width +
      '" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"' +
      ' pathLength="100" stroke-dasharray="' +
      pct +
      " " +
      Number((100 - pct).toFixed(2)) +
      '"' +
      "></path>"
    );
  }

  function getDataset() {
    return DEMO.DATASETS[datasetKey] || DEMO.DATASETS[DEMO.DEFAULT_DATASET];
  }

  function resolveProgress(cfg, data) {
    if (cfg.progress === "all") return data.alignedCount;
    if (typeof cfg.progress === "number") {
      return Math.min(cfg.progress, data.alignedCount);
    }
    return 0;
  }

  function windowSlice(total, current, win) {
    if (total <= win) {
      return { start: 1, end: Math.max(total, 1), nos: range(1, Math.max(total, 1)) };
    }
    var end = Math.max(current, win);
    end = Math.min(end, total);
    var start = end - win + 1;
    return { start: start, end: end, nos: range(start, end) };
  }

  function range(a, b) {
    var out = [];
    for (var i = a; i <= b; i++) out.push(i);
    return out;
  }

  function fitStage() {
    var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = "scale(" + scale + ")";
  }

  function setButton(btn, mode) {
    if (!btn) return;
    btn.classList.remove("is-ready", "is-busy", "is-off");
    btn.classList.add("is-" + mode);
    btn.disabled = mode !== "ready";
  }

  function renderMap(data, current, showTracks) {
    var expected = data.expected;
    var art = PENCIL_ART && PENCIL_ART.ART;
    var baseEl = page.querySelector("[data-route-base]");
    var walkedSvg = page.querySelector("[data-route-walked]");
    var tracksSvg = page.querySelector("[data-tracks]");

    // 预置走廊：Pencil y87v9 代表态折线（非投影采样）
    if (art) {
      baseEl.innerHTML =
        polylineSvg(art.corridor.d, art.corridor.outer, art.corridor.outerWidth) +
        polylineSvg(art.corridor.d, art.corridor.inner, art.corridor.innerWidth);
    } else {
      var basePath = pathFromBusiness(expected);
      baseEl.innerHTML =
        polylineSvg(basePath, COLORS.planOuter, 14) +
        polylineSvg(basePath, COLORS.planInner, 9);
    }

    if (current > 0) {
      if (art) {
        // 已走 = Pencil 走廊同 d（y87v9）；按点位进度弧长截断，禁止再走业务投影
        var totalPins = (art.pinTL && art.pinTL.length) || expected.length || 1;
        var progress01 = Math.min(1, current / totalPins);
        walkedSvg.innerHTML =
          corridorProgressSvg(art.corridor.d, COLORS.walkedOuter, 14, progress01) +
          corridorProgressSvg(art.corridor.d, COLORS.walkedInner, 9, progress01);
      } else {
        var walkedPts = expected.slice(0, current);
        var walkedPath = pathFromBusiness(walkedPts);
        walkedSvg.innerHTML =
          polylineSvg(walkedPath, COLORS.walkedOuter, 14) +
          polylineSvg(walkedPath, COLORS.walkedInner, 9);
      }
      walkedSvg.style.display = "";
    } else {
      walkedSvg.innerHTML = "";
      walkedSvg.style.display = "none";
    }

    if (showTracks && current > 0) {
      var html = "";
      if (art && PENCIL_ART.sliceTrack) {
        // 实测：Pencil iD2DE 代表态；运行中按进度截断点列
        ["bs", "gaode", "dt"].forEach(function (key) {
          var slice = PENCIL_ART.sliceTrack(key, current);
          if (slice.d) html += polylineSvg(slice.d, slice.color, slice.strokeWidth);
          slice.dots.forEach(function (p) {
            html +=
              '<circle cx="' +
              p.x.toFixed(2) +
              '" cy="' +
              p.y.toFixed(2) +
              '" r="4" fill="' +
              slice.color +
              '"></circle>';
          });
        });
      } else {
        [
          ["bs", COLORS.bs],
          ["gaode", COLORS.gaode],
          ["dt", COLORS.dt],
        ].forEach(function (pair) {
          var pts = data.actual[pair[0]].slice(0, current);
          var d = pathFromBusinessTrack(pts);
          html += polylineSvg(d, pair[1], 2.5);
          pts.forEach(function (pt) {
            var s = businessToTrackLocal(pt);
            html +=
              '<circle cx="' +
              s.x.toFixed(2) +
              '" cy="' +
              s.y.toFixed(2) +
              '" r="3.5" fill="' +
              pair[1] +
              '"></circle>';
          });
        });
      }
      tracksSvg.innerHTML = html;
      tracksSvg.style.display = "";
    } else {
      tracksSvg.innerHTML = "";
      tracksSvg.style.display = "none";
    }

    var pinsRoot = page.querySelector("[data-route-points]");
    var ue = page.querySelector("[data-ue]");
    // 先挪走 UE，再清空点位，避免 innerHTML 清掉 UE 节点
    if (ue && ue.parentNode === pinsRoot) {
      pinsRoot.parentNode.insertBefore(ue, pinsRoot);
    }
    pinsRoot.innerHTML = "";
    pinsRoot.appendChild(ue);

    var pinTL = (art && art.pinTL) || null;
    var count = pinTL ? pinTL.length : expected.length;
    var i;
    for (i = 0; i < count; i++) {
      var pin = el("div", "c4-pin" + (i < current ? " is-lit" : ""));
      if (pinTL) {
        // Pencil RV86I 局部 left/top，层已偏移 (18,-7)
        pin.style.left = pinTL[i][0] + "px";
        pin.style.top = pinTL[i][1] + "px";
      } else {
        var s = businessToStage(expected[i]);
        var box = P.pinBoxFromLayer({
          x: s.x - CFG.offsetX,
          y: s.y - CFG.offsetY,
        });
        pin.style.left = box.left + CFG.offsetX + "px";
        pin.style.top = box.top + CFG.offsetY + "px";
      }
      pin.innerHTML =
        '<span class="c4-pin__icon"></span><span class="c4-pin__no">' +
        (i + 1) +
        "</span>";
      pinsRoot.appendChild(pin);
    }

    if (current > 0) {
      if (pinTL && pinTL[current - 1]) {
        // 钉尖 = 图标底边中心；UE 36×48 底中对齐钉尖（同属 RV86I 局部）
        var tl = pinTL[current - 1];
        var tipX = tl[0] + 35 / 2;
        var tipY = tl[1] + 42;
        ue.style.left = tipX - 36 / 2 + "px";
        ue.style.top = tipY - 48 + "px";
      } else {
        var uePt = expected[current - 1];
        var ueStage = businessToStage(uePt);
        var ueBox = P.ueBoxFromLayer({
          x: ueStage.x - CFG.offsetX,
          y: ueStage.y - CFG.offsetY,
        });
        ue.style.left = ueBox.left + CFG.offsetX + "px";
        ue.style.top = ueBox.top + CFG.offsetY + "px";
      }
    }
    // Pencil CAVal 预期路径块钉在 CSS 518,439；不再按首点推算
  }

  function renderErrorReplay(data, current) {
    var total = Math.max(data.expected.length, 1);
    var win = windowSlice(total, Math.max(current, 1), WINDOW);
    var headers = page.querySelector("[data-col-headers]");
    var slots = page.querySelector("[data-col-slots]");
    headers.innerHTML = "";
    slots.innerHTML = "";
    win.nos.forEach(function (no) {
      var h = el("div", "c4-col-head" + (current > 0 && no <= current ? " is-done" : ""));
      h.textContent = "P" + no;
      headers.appendChild(h);
      slots.appendChild(el("div", "c4-col-slot"));
    });

    // Pencil 组件 wYizf：固定刻度 5.5…0（定稿帧不改）
    var yMax = 5.5;
    var yAxis = page.querySelector("[data-y-axis]");
    yAxis.innerHTML = "";
    [5.5, 4.5, 3.5, 2.5, 1.5, 0].forEach(function (t) {
      var span = document.createElement("span");
      span.textContent = String(t);
      yAxis.appendChild(span);
    });

    var gap = 3;
    var nCols = win.nos.length;
    var plotW = 1748;
    // Pencil：列宽 fill_container → (1748 - (n-1)*gap) / n
    var colW = nCols > 0 ? (plotW - Math.max(0, nCols - 1) * gap) / nCols : 85;
    var plotH = 110;
    var svg = page.querySelector("[data-error-svg]");
    svg.setAttribute("viewBox", "0 0 " + plotW + " " + plotH);
    svg.style.width = plotW + "px";

    function seriesPath(key, color) {
      var vals = data.errors[key] || [];
      var pts = [];
      win.nos.forEach(function (no, i) {
        if (no > current) return;
        var v = vals[no - 1];
        if (v == null) return;
        var x = i * (colW + gap) + colW / 2;
        var y = plotH - (v / yMax) * plotH;
        pts.push({ x: x, y: y, v: v });
      });
      if (!pts.length) return "";
      var d = pts
        .map(function (p, i) {
          return (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1);
        })
        .join(" ");
      var circles = pts
        .map(function (p) {
          return (
            '<circle cx="' +
            p.x.toFixed(1) +
            '" cy="' +
            p.y.toFixed(1) +
            '" r="5" fill="' +
            color +
            '"></circle>'
          );
        })
        .join("");
      return polylineSvg(d, color, 2) + circles;
    }

    if (current > 0) {
      svg.innerHTML =
        seriesPath("bs", COLORS.bs) +
        seriesPath("gaode", COLORS.gaode) +
        seriesPath("dt", COLORS.dt);
    } else {
      svg.innerHTML = "";
    }

    var progress = page.querySelector("[data-progress]");
    var cursor = page.querySelector("[data-cursor]");
    if (current > 0) {
      var idx = Math.min(current, win.end) - win.start;
      var width = (idx + 1) * colW + idx * gap;
      // Pencil：进度 left=-2、宽=列跨度+2；光标 24×24、top=-2.5，右缘对齐进度右缘
      var progLeft = -2;
      var progW = Math.max(width + 2, 24);
      progress.style.left = progLeft + "px";
      progress.style.width = progW + "px";
      var cursorLeft = progLeft + progW - 24;
      cursor.style.left = cursorLeft + "px";
      var board = page.querySelector(".c4-replay-board");
      board.scrollLeft = Math.max(0, cursorLeft + 24 - board.clientWidth + 120);
    } else {
      progress.style.width = "0px";
      cursor.style.left = "0px";
    }
  }

  function renderCdf(data, show) {
    var empty = page.querySelector("[data-cdf-empty]");
    var svg = page.querySelector("[data-cdf-svg]");
    var yEl = page.querySelector("[data-cdf-y]");
    var xEl = page.querySelector("[data-cdf-x]");
    yEl.innerHTML = ["1.0", "0.8", "0.6", "0.4", "0.2", "0.0"]
      .map(function (t) {
        return "<span>" + t + "</span>";
      })
      .join("");

    // Pencil 完成态 X 轴固定 0–4.5；空态同样保留刻度骨架
    var xmax = 4.5;
    xEl.innerHTML = ["0", "0.5", "1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5"]
      .map(function (t) {
        return "<span>" + t + "</span>";
      })
      .join("");

    if (!show) {
      // Pencil 空闲/测试中定位误差卡无「--」「等待」占位，仅保留坐标轴骨架
      // 适配异常同构空态，也不画「--」
      var blankPos =
        currentState === "initial" ||
        currentState === "running" ||
        currentState === "adapter-error" ||
        currentState === "site-env";
      empty.hidden = blankPos;
      empty.textContent = blankPos ? "" : "--";
      svg.innerHTML = "";
      return;
    }
    empty.hidden = true;

    var w = 280;
    var h = 136;
    function cdfPath(key, color) {
      var pts = data.cdf[key] || [];
      if (!pts.length) return "";
      var d = pts
        .map(function (p, idx) {
          var x = Math.min(1, p.x / xmax) * w;
          var y = h - p.p * h;
          return (idx === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
        })
        .join(" ");
      return polylineSvg(d, color, 2);
    }
    svg.innerHTML =
      cdfPath("bs", COLORS.bs) +
      cdfPath("gaode", COLORS.gaode) +
      cdfPath("dt", COLORS.dt);
  }

  function renderCep(data, show) {
    var specs = [
      { key: "50", maxY: 4, labels: ["4.0", "3.0", "2.0", "1.0", "0.0"] },
      { key: "90", maxY: 10, labels: ["10.0", "7.5", "5.0", "2.5", "0.0"] },
    ];
    // Pencil 完成态柱高（按方案，非纯线性）：传统/商用/DT
    var pencilBarH = {
      "50": { bs: 109, gaode: 46, dt: 5 },
      "90": { bs: 107, gaode: 46, dt: 6 },
    };
    var usePencilBars =
      data.cep &&
      Number(data.cep.bs.cep50) === 3.3 &&
      Number(data.cep.gaode.cep50) === 1.4 &&
      Number(data.cep.dt.cep50) === 0.5;

    specs.forEach(function (item) {
      var yRoot = page.querySelector("[data-cep" + item.key + "-y]");
      if (yRoot) {
        yRoot.innerHTML = item.labels
          .map(function (t) {
            return "<span>" + t + "</span>";
          })
          .join("");
      }
      var root = page.querySelector("[data-cep" + item.key + "-plot]");
      var rows = [
        ["传统", "bs", COLORS.bs],
        ["商用", "gaode", COLORS.gaode],
        ["DT", "dt", COLORS.dt],
      ];
      root.innerHTML = "";
      rows.forEach(function (row) {
        var col = el("div", "c4-cep-col");
        var val = el("div", "c4-cep-value");
        var bar = el("div", "c4-cep-bar");
        var label = el("div", "c4-cep-label");
        label.textContent = row[0];
        bar.style.background = row[2];
        if (!show) {
          var blankPos =
            currentState === "initial" ||
            currentState === "running" ||
            currentState === "adapter-error" ||
            currentState === "site-env";
          val.textContent = blankPos ? "" : "--";
          bar.classList.add("is-empty");
        } else {
          var v = data.cep[row[1]]["cep" + item.key];
          val.textContent = Number(v).toFixed(1);
          var h = usePencilBars
            ? pencilBarH[item.key][row[1]]
            : Math.max(2, Math.min(132, (v / item.maxY) * 132));
          bar.style.height = h + "px";
        }
        // Pencil：vertical / center / end → 值紧贴柱顶，无固定 120 槽
        col.appendChild(val);
        col.appendChild(bar);
        col.appendChild(label);
        root.appendChild(col);
      });
    });
  }

  function renderNlos(data, show) {
    var value = page.querySelector("[data-nlos-value]");
    var arc = page.querySelector("[data-nlos-arc]");
    // Pencil 底环已是 270° path；pathLength=100 时进度 = pct
    if (!show) {
      // Pencil 空闲/测试中实例：值「--」，值弧 enabled=false
      value.textContent = "--";
      arc.classList.add("is-off");
      arc.setAttribute("stroke-dasharray", "0 100");
      return;
    }
    arc.classList.remove("is-off");
    var ratio = data.nlos;
    var pct = ratio <= 1 ? ratio * 100 : ratio;
    pct = Math.min(100, Math.max(0, pct));
    value.textContent = pct.toFixed(1);
    arc.setAttribute("stroke-dasharray", pct + " 100");
  }

  /* Pencil fYdoo / AFTrn 绘图坐标系（602×176，外槽 clip 171） */
  var THRP_PLOT = {
    left: 29.263888888888886,
    top: 4.591304347826087,
    width: 564.375,
    height: 154.57391304347829,
    xLabelY: 162.22608695652175,
    xLabel0: 26.12847222222222,
    xStep: 29.703947368421052,
    yLabels: [
      { v: 10, x: 15, y: 0 },
      { v: 9, x: 17, y: 13 },
      { v: 8, x: 17, y: 28.304347826086996 },
      { v: 7, x: 17, y: 43.60869565217388 },
      { v: 6, x: 17, y: 58.913043478260875 },
      { v: 5, x: 17, y: 74.98260869565217 },
      { v: 4, x: 17, y: 90.28695652173917 },
      { v: 3, x: 17, y: 106.35652173913047 },
      { v: 2, x: 17, y: 121.66086956521735 },
      { v: 1, x: 17, y: 136.96521739130435 },
      { v: 0, x: 17, y: 152.26956521739135 },
    ],
  };

  function renderThrp(data, show) {
    var svg = page.querySelector("[data-thrp-svg]");
    var dots = page.querySelector("[data-thrp-dots]");
    var yEl = page.querySelector("[data-thrp-y]");
    var xEl = page.querySelector("[data-thrp-x]");
    var P = THRP_PLOT;

    var wo = data.thrpWithout || [];
    var w = data.thrpWith || [];
    // Pencil 空闲 oMbB7：仅关曲线层，网格+Y0–10+X1–20 仍在；无「--」
    var n = show ? Math.max(wo.length, w.length, 1) : WINDOW;
    var winStart = n > WINDOW ? n - WINDOW + 1 : 1;
    var winEnd = n > WINDOW ? n : WINDOW;
    var winNos = range(winStart, winEnd);
    var ymax = 10;
    var slots = Math.max(winNos.length, 1);

    yEl.innerHTML = P.yLabels
      .map(function (lab) {
        return (
          '<span style="left:' +
          lab.x +
          "px;top:" +
          lab.y +
          'px">' +
          lab.v +
          "</span>"
        );
      })
      .join("");

    xEl.innerHTML = winNos
      .map(function (no, i) {
        var x =
          slots === 1
            ? P.xLabel0 + ((WINDOW - 1) / 2) * P.xStep
            : P.xLabel0 + (i / (slots - 1)) * ((WINDOW - 1) * P.xStep);
        return (
          '<span style="left:' +
          x.toFixed(2) +
          "px;top:" +
          P.xLabelY +
          'px">' +
          no +
          "</span>"
        );
      })
      .join("");

    if (!show) {
      svg.innerHTML = "";
      dots.innerHTML = "";
      return;
    }

    function series(arr, color, strokeWidth) {
      var pts = [];
      winNos.forEach(function (no, i) {
        var item = arr[no - 1];
        if (!item) return;
        var x =
          slots === 1
            ? P.left + P.width / 2
            : P.left + (i / (slots - 1)) * P.width;
        var y = P.top + P.height - (item.v / ymax) * P.height;
        pts.push({ x: x, y: y });
      });
      if (!pts.length) return { path: "", dots: "" };
      var d = pts
        .map(function (p, i) {
          return (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1);
        })
        .join(" ");
      var dotsHtml = pts
        .map(function (p) {
          return (
            '<span class="c4-thrp-dot" style="left:' +
            p.x.toFixed(1) +
            "px;top:" +
            p.y.toFixed(1) +
            "px;background:" +
            color +
            '"></span>'
          );
        })
        .join("");
      return { path: polylineSvg(d, color, strokeWidth), dots: dotsHtml };
    }

    var a = series(wo, COLORS.bs, 1.5);
    var b = series(w, COLORS.dt, 2.5);
    svg.innerHTML = a.path + b.path;
    dots.innerHTML = a.dots + b.dots;
  }

  function applyState(state) {
    if (!STATE_CFG[state]) state = "initial";
    var cfg = STATE_CFG[state];
    var data = getDataset();
    currentState = state;
    if (state !== "site-env") lastFlow = state;

    page.dataset.state = state;
    page.dataset.dataset = datasetKey;

    page.querySelector("[data-status-text]").textContent = cfg.status;
    setButton(page.querySelector('[data-action="start"]'), cfg.start);
    setButton(page.querySelector('[data-action="reset"]'), cfg.reset);

    var banner = page.querySelector("[data-banner]");
    var bannerTitle = cfg.bannerTitle || "";
    var bannerDetail = cfg.bannerDetail || "";
    var bannerPlain = cfg.banner || "";
    if (bannerTitle || bannerPlain) {
      banner.hidden = false;
      banner.className =
        "c4-banner" + (cfg.bannerKind === "error" ? " is-error" : cfg.bannerKind === "wait" ? " is-wait" : "");
      if (bannerTitle) {
        banner.innerHTML =
          '<span class="c4-banner__title">' +
          bannerTitle +
          "</span>" +
          (bannerDetail
            ? '<span class="c4-banner__detail">' + bannerDetail + "</span>"
            : "");
      } else {
        banner.textContent = bannerPlain;
      }
    } else {
      banner.hidden = true;
      banner.textContent = "";
      banner.className = "c4-banner";
    }

    var current = resolveProgress(cfg, data);
    renderMap(data, current, cfg.tracks);
    renderErrorReplay(data, current);
    renderCdf(data, cfg.finalStats);
    renderCep(data, cfg.finalStats);
    renderNlos(data, cfg.finalStats);
    renderThrp(data, cfg.thrp);

    if (siteEnv) {
      if (cfg.openSiteEnv) siteEnv.open();
      else siteEnv.close();
    }

    document.querySelectorAll("#review-controls [data-set-state]").forEach(function (btn) {
      btn.setAttribute(
        "aria-current",
        btn.getAttribute("data-set-state") === state ? "true" : "false"
      );
    });

    var url = new URL(window.location.href);
    url.searchParams.set("state", state);
    url.searchParams.set("dataset", datasetKey);
    if (url.searchParams.get("controls") !== "1") {
      /* keep clean default; controls param only when present */
    }
    history.replaceState(null, "", url.toString());
  }

  function showTab(tab) {
    var isCase4 = tab === "case4";
    page.hidden = !isCase4;
    placeholder.hidden = isCase4;
    document.querySelectorAll(".case-tab").forEach(function (btn) {
      var active = btn.getAttribute("data-tab") === tab;
      btn.classList.toggle("is-active", active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
  }

  function enableReviewDrag(box) {
    var handle = box.querySelector("[data-review-drag]");
    if (!handle) return;
    var dragging = false;
    var startX = 0;
    var startY = 0;
    var origLeft = 0;
    var origTop = 0;

    function clamp(left, top) {
      var w = box.offsetWidth;
      var h = box.offsetHeight;
      var maxL = Math.max(0, window.innerWidth - w);
      var maxT = Math.max(0, window.innerHeight - h);
      return {
        left: Math.min(maxL, Math.max(0, left)),
        top: Math.min(maxT, Math.max(0, top)),
      };
    }

    function onMove(e) {
      if (!dragging) return;
      var next = clamp(origLeft + (e.clientX - startX), origTop + (e.clientY - startY));
      box.style.left = next.left + "px";
      box.style.top = next.top + "px";
      box.style.right = "auto";
      box.style.bottom = "auto";
    }

    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      box.classList.remove("is-dragging");
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }

    handle.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button !== 0) return;
      var rect = box.getBoundingClientRect();
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origLeft = rect.left;
      origTop = rect.top;
      box.style.left = origLeft + "px";
      box.style.top = origTop + "px";
      box.style.right = "auto";
      box.style.bottom = "auto";
      box.classList.add("is-dragging");
      handle.setPointerCapture(e.pointerId);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      e.preventDefault();
    });
  }

  function buildReview() {
    var box = document.getElementById("review-controls");
    var params = new URLSearchParams(location.search);
    if (params.get("controls") !== "1") return;
    box.setAttribute("data-visible", "true");
    enableReviewDrag(box);
    var host = box.querySelector("[data-review-states]");
    STATES.forEach(function (item) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-set-state", item[0]);
      btn.textContent = item[1];
      btn.addEventListener("click", function () {
        applyState(item[0]);
      });
      host.appendChild(btn);
    });
    var select = box.querySelector("[data-dataset-select]");
    select.value = datasetKey;
    select.addEventListener("change", function () {
      datasetKey = select.value;
      applyState(currentState === "site-env" ? "site-env" : currentState);
    });
  }

  function bindActions() {
    page.querySelector('[data-action="start"]').addEventListener("click", function () {
      if (currentState === "initial") {
        applyState("running");
      }
    });
    page.querySelector('[data-action="reset"]').addEventListener("click", function () {
      if (currentState === "completed") {
        applyState("initial");
      }
    });

    document.querySelectorAll(".case-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showTab(btn.getAttribute("data-tab"));
      });
    });

    document.addEventListener("keydown", function (e) {
      if (new URLSearchParams(location.search).get("controls") !== "1") return;
      var map = {
        "1": "initial",
        "2": "running",
        "3": "completed",
        "4": "adapter-error",
        "5": "site-env",
      };
      if (map[e.key]) applyState(map[e.key]);
    });
  }

  function boot() {
    fitStage();
    window.addEventListener("resize", fitStage);

    siteEnv = window.SiteEnvWindow
      ? window.SiteEnvWindow.mount({
          stage: stage,
          assetBase: "../../04-runtime-assets/shell/site-env/",
          trigger: page.querySelector("[data-site-env-trigger]"),
        })
      : null;

    var params = new URLSearchParams(location.search);
    if (params.get("dataset") && DEMO.DATASETS[params.get("dataset")]) {
      datasetKey = params.get("dataset");
    }
    buildReview();
    bindActions();
    showTab("case4");
    applyState(params.get("state") || "initial");
  }

  boot();
})();
