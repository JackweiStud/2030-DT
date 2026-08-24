(function () {
  "use strict";

  var STATES = [
    ["initial", "1 初始态"],
    ["without-running", "2 无DT运行中"],
    ["without-completed", "3 无DT完成"],
    ["with-running", "4 有DT运行中"],
    ["with-completed", "5 有DT完成"],
    ["site-env", "6 现场环境"],
  ];
  var STATE_SET = {};
  STATES.forEach(function (item) {
    STATE_SET[item[0]] = true;
  });

  var PIN_POS = [
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
    [1213, 278],
    [1251, 305],
    [1289, 330],
    [1324, 354],
    [1359, 378],
    [1394, 402],
    [1430.5, 427.5],
  ];

  var WO_BEAM = ["0", "122", "123", "113", "1", "3", "5", "7", "9", "11", "13", "15", "12", "0", "255", "1", "15", "16", "111", "148"];
  var W_BEAM = ["0", "122", "123", "113", "1", "3", "5", "7", "9", "11", "13", "15", "12", "0", "255", "1", "15", "16", "111", "113"];

  var PATH_SHORT = "M669 523l131-44";
  var PATH_FULL = "M669 523l526-171 253 173";
  var THR_WO_SHORT = "M28 189.82l28.42-8.08 28.42-16.16 28.42-6.06";
  var THR_WO_FULL = "M28 189.82l28.42-8.08 28.42-16.16 28.42-6.06 28.42 14.14 28.43 8.08 28.42-12.12 28.42-12.12 28.42 12.12 28.42 12.12 28.42-8.08 28.42-8.08 28.42-4.04 28.42 10.1 28.42 6.06 28.43-12.12 28.42-6.06 28.42 8.08 28.42 8.08 28.42-12.12";
  var THR_W_SHORT = "M28.48 66.56l28.42-10.1 28.42-15.57 28.42-1.69";
  var THR_W_FULL = "M27.41 65.25l28.42-10.1 28.42-14.26 28.42-1.69 28.42 9.77 28.42 8.08 28.42-12.12 28.42-5.73 28.42 5.73 28.42 12.12 28.42-8.08 28.42-8.08 28.42-1.69 28.42 7.75 28.42 6.06 28.42-12.12 28.42-1.69 28.42 3.71 28.42 8.08 28.42-11.79";

  var SCAN_WO_RUN = ["0,0", "3,2", "5,11", "9,3", "13,4", "13,11", "15,15"];
  var BEST_WO_RUN = "7,7";
  var SCAN_WO_DONE = ["5,11", "6,6", "8,9", "9,3", "9,5", "13,4", "13,11"];
  var BEST_WO_DONE = "9,13";
  var PRED_W = "7,7";

  var THR_Y = [152.27, 136.965, 121.661, 106.357, 91.053, 75.749, 60.445, 45.141, 29.837, 14.533, 0];
  var THR_X = [26.128, 55.832, 85.536, 115.24, 144.944, 174.648, 204.352, 234.056, 263.76, 293.464, 323.168, 352.872, 382.576, 412.28, 441.984, 471.688, 501.392, 531.096, 560.8, 590.503];
  var THR_YLINE = [159.165, 143.708, 128.25, 112.793, 97.336, 81.878, 66.421, 50.963, 35.506, 20.049, 4.591];
  var THR_XLINE = [29.264, 58.968, 88.672, 118.376, 148.08, 177.784, 207.488, 237.192, 266.895, 296.599, 326.303, 356.007, 385.711, 415.415, 445.119, 474.823, 504.527, 534.231, 563.935, 593.639];

  var page = document.getElementById("case3v2-page");
  var overlay = page.querySelector(".case3v2-overlay");
  var lastFlow = "initial";
  var beamCells = [];

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function buildPins() {
    var root = page.querySelector("[data-route-points]");
    PIN_POS.forEach(function (xy, index) {
      var pin = el("div", "case3v2-pin is-idle");
      pin.style.left = xy[0] + "px";
      pin.style.top = xy[1] + "px";
      pin.dataset.index = String(index);
      pin.innerHTML = '<span class="case3v2-pin__icon"></span><span class="case3v2-pin__no">' + (index + 1) + "</span>";
      root.appendChild(pin);
    });
  }

  function buildBeam() {
    var yRoot = page.querySelector("[data-beam-y]");
    var xRoot = page.querySelector("[data-beam-x]");
    var grid = page.querySelector("[data-beam-grid]");
    var r;
    var c;
    for (r = 0; r < 16; r += 1) {
      yRoot.appendChild(el("span")).textContent = String(r);
      xRoot.appendChild(el("span")).textContent = String(r);
      var row = el("div", "case3v2-beam-grid__row");
      for (c = 0; c < 16; c += 1) {
        var cell = el("div", "case3v2-beam-cell");
        cell.dataset.rc = r + "," + c;
        row.appendChild(cell);
        beamCells.push(cell);
      }
      grid.appendChild(row);
    }
  }

  function buildReplay() {
    var heads = page.querySelector("[data-replay-headers]");
    var wo = page.querySelector("[data-replay-without]");
    var w = page.querySelector("[data-replay-with]");
    var checks = page.querySelector("[data-replay-checks]");
    var i;
    for (i = 0; i < 20; i += 1) {
      var head = el("div", "case3v2-replay-col");
      head.textContent = "P" + (i + 1);
      heads.appendChild(head);

      var woCell = el("div", "case3v2-replay-cell case3v2-replay-cell--without");
      woCell.innerHTML = '<span class="case3v2-replay-cell__label">最优波</span><span class="case3v2-replay-cell__value">--</span>';
      wo.appendChild(woCell);

      var wCell = el("div", "case3v2-replay-cell case3v2-replay-cell--with");
      wCell.innerHTML = '<span class="case3v2-replay-cell__value">--</span><span class="case3v2-replay-cell__label">预测波</span>';
      w.appendChild(wCell);

      var mark = el("div", "case3v2-check");
      mark.style.left = 34 + i * 85 + "px";
      mark.hidden = true;
      checks.appendChild(mark);
    }
  }

  function buildThr() {
    var grid = page.querySelector("[data-thr-grid]");
    var axis = page.querySelector("[data-thr-axis]");
    THR_YLINE.forEach(function (top) {
      var line = el("div", "case3v2-thr-yline");
      line.style.left = "29.264px";
      line.style.top = top + "px";
      line.style.width = "564.375px";
      line.style.height = "1px";
      grid.appendChild(line);
    });
    THR_XLINE.forEach(function (left) {
      var line = el("div", "case3v2-thr-xline");
      line.style.left = left + "px";
      line.style.top = "4.591px";
      line.style.width = "1px";
      line.style.height = "154.574px";
      grid.appendChild(line);
    });
    THR_Y.forEach(function (top, index) {
      var label = el("div", "case3v2-thr-label");
      label.textContent = String(index);
      label.style.left = index === 10 ? "15px" : "17px";
      label.style.top = top + "px";
      axis.appendChild(label);
    });
    THR_X.forEach(function (left, index) {
      var label = el("div", "case3v2-thr-label");
      label.textContent = String(index + 1);
      label.style.left = left + "px";
      label.style.top = "162.226px";
      axis.appendChild(label);
    });
  }

  function setBtn(btn, kind, mode) {
    btn.classList.remove("is-ready", "is-busy", "is-off");
    btn.classList.add("is-" + mode);
    btn.disabled = mode === "off";
  }

  function setStatus(node, text, tone) {
    node.textContent = text;
    node.classList.remove("is-running", "is-done");
    if (tone) node.classList.add(tone);
  }

  function fillCells(root, values, doneCount, kind) {
    var cells = root.children;
    var i;
    for (i = 0; i < 20; i += 1) {
      var cell = cells[i];
      var value = values[i] || "--";
      cell.querySelector(".case3v2-replay-cell__value").textContent = value;
      cell.classList.remove("is-done", "is-ok", "is-fail");
      if (kind === "without" && i < doneCount) cell.classList.add("is-done");
      if (kind === "with" && i < doneCount) {
        cell.classList.add(i === 19 && doneCount === 20 ? "is-fail" : "is-ok");
      }
    }
  }

  function fillChecks(count, failLast) {
    var marks = page.querySelector("[data-replay-checks]").children;
    var i;
    for (i = 0; i < 20; i += 1) {
      var mark = marks[i];
      if (i < count) {
        mark.hidden = false;
        mark.classList.toggle("is-fail", Boolean(failLast && i === count - 1 && count === 20));
        mark.classList.toggle("is-ok", !(failLast && i === count - 1 && count === 20));
      } else {
        mark.hidden = true;
        mark.classList.remove("is-ok", "is-fail");
      }
    }
  }

  function fillHeaders(doneCount) {
    var cols = page.querySelector("[data-replay-headers]").children;
    var i;
    for (i = 0; i < 20; i += 1) {
      cols[i].classList.toggle("is-done", i < doneCount);
    }
  }

  function fillPins(litCount) {
    var pins = page.querySelector("[data-route-points]").children;
    var i;
    for (i = 0; i < pins.length; i += 1) {
      pins[i].classList.toggle("is-lit", i < litCount);
      pins[i].classList.toggle("is-idle", i >= litCount);
    }
  }

  function fillBeam(scanKeys, bestKey, predKey) {
    var scan = {};
    (scanKeys || []).forEach(function (key) {
      scan[key] = true;
    });
    beamCells.forEach(function (cell) {
      var rc = cell.dataset.rc;
      cell.classList.remove("is-scan", "is-best", "is-pred");
      if (predKey && rc === predKey) cell.classList.add("is-pred");
      else if (bestKey && rc === bestKey) cell.classList.add("is-best");
      else if (scan[rc]) cell.classList.add("is-scan");
    });
  }

  function parseThrPoints(d) {
    if (!d) return [];
    var points = [];
    var x = 0;
    var y = 0;
    var cmd = null;
    var tokenRe = /([MmLl])|([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/g;
    var match;
    var nums = [];
    function flushPair() {
      while (nums.length >= 2) {
        var a = nums.shift();
        var b = nums.shift();
        if (cmd === "M" || cmd === "L") {
          x = a;
          y = b;
          if (cmd === "M") cmd = "L";
        } else if (cmd === "m" || cmd === "l") {
          x += a;
          y += b;
          if (cmd === "m") cmd = "l";
        } else {
          return;
        }
        points.push([x, y]);
      }
    }
    while ((match = tokenRe.exec(d))) {
      if (match[1]) {
        flushPair();
        cmd = match[1];
        nums = [];
      } else {
        nums.push(Number(match[2]));
        if (nums.length >= 2) flushPair();
      }
    }
    flushPair();
    return points;
  }

  function fillThr(woPath, wPath) {
    page.querySelector("[data-thr-wo]").setAttribute("d", woPath || "");
    page.querySelector("[data-thr-w]").setAttribute("d", wPath || "");
    var dots = page.querySelector("[data-thr-dots]");
    dots.innerHTML = "";
    function addDots(d, color) {
      parseThrPoints(d).forEach(function (pt) {
        var dot = el("div", "case3v2-thr-dot");
        dot.style.background = color;
        dot.style.left = pt[0] * (602 / 576) - 2 + "px";
        dot.style.top = pt[1] * (176 / 230) - 2 + "px";
        dots.appendChild(dot);
      });
    }
    addDots(woPath, "#6B7280");
    addDots(wPath, "#22D3EE");
  }

  function applyVisual(name) {
    var visual = name === "site-env" ? "with-running" : name;
    var woPlay = page.querySelector('[data-action="start-without"]');
    var woReset = page.querySelector('[data-action="reset-without"]');
    var wPlay = page.querySelector('[data-action="start-with"]');
    var wReset = page.querySelector('[data-action="reset-with"]');
    var woNum = page.querySelector('[data-side-num="without"]');
    var wNum = page.querySelector('[data-side-num="with"]');
    var legendScan = page.querySelector("[data-legend-scan]");
    var badge = page.querySelector("[data-beam-badge]");
    var walked = visual === "without-completed" || visual === "with-completed" ? PATH_FULL : PATH_SHORT;

    page.querySelector("[data-walked-outer]").setAttribute("d", walked);
    page.querySelector("[data-walked-inner]").setAttribute("d", walked);

    if (visual === "initial") {
      page.querySelector("[data-point-value]").textContent = "P--";
      page.querySelector("[data-beam-id]").textContent = "--";
      setStatus(page.querySelector('[data-status="without"]'), "未开始", "");
      setStatus(page.querySelector('[data-status="with"]'), "未开始", "");
      setBtn(woPlay, "play", "ready");
      setBtn(woReset, "reset", "off");
      setBtn(wPlay, "play", "off");
      setBtn(wReset, "reset", "off");
      woNum.classList.remove("is-done");
      wNum.classList.remove("is-done");
      fillPins(0);
      fillHeaders(0);
      fillBeam([], "", "");
      fillCells(page.querySelector("[data-replay-without]"), Array(20).fill("--"), 0, "without");
      fillCells(page.querySelector("[data-replay-with]"), Array(20).fill("--"), 0, "with");
      fillChecks(0, false);
      page.querySelector("[data-cost-wo]").textContent = "--";
      page.querySelector("[data-cost-w]").textContent = "--";
      page.querySelector("[data-cost-delta]").textContent = "--";
      page.querySelector("[data-ba-pct]").textContent = "75.0";
      page.querySelector("[data-ba-ok]").textContent = "75";
      page.querySelector("[data-ba-bad]").textContent = "25";
      fillThr("", "");
      legendScan.textContent = "扫描波";
      badge.textContent = "预测成功";
    } else if (visual === "without-running") {
      page.querySelector("[data-point-value]").textContent = "P4";
      page.querySelector("[data-beam-id]").textContent = "113";
      setStatus(page.querySelector('[data-status="without"]'), "测试中…", "is-running");
      setStatus(page.querySelector('[data-status="with"]'), "未开始", "");
      setBtn(woPlay, "play", "busy");
      setBtn(woReset, "reset", "off");
      setBtn(wPlay, "play", "off");
      setBtn(wReset, "reset", "off");
      woNum.classList.add("is-done");
      wNum.classList.remove("is-done");
      fillPins(4);
      fillHeaders(4);
      fillBeam(SCAN_WO_RUN, BEST_WO_RUN, "");
      fillCells(page.querySelector("[data-replay-without]"), WO_BEAM.map(function (v, i) { return i < 4 ? v : "--"; }), 4, "without");
      fillCells(page.querySelector("[data-replay-with]"), Array(20).fill("--"), 0, "with");
      fillChecks(0, false);
      page.querySelector("[data-cost-wo]").textContent = "--";
      page.querySelector("[data-cost-w]").textContent = "--";
      page.querySelector("[data-cost-delta]").textContent = "--";
      page.querySelector("[data-ba-pct]").textContent = "75.0";
      page.querySelector("[data-ba-ok]").textContent = "75";
      page.querySelector("[data-ba-bad]").textContent = "25";
      fillThr(THR_WO_SHORT, "");
      legendScan.textContent = "扫描波";
      badge.textContent = "预测成功";
    } else if (visual === "without-completed") {
      page.querySelector("[data-point-value]").textContent = "P20";
      page.querySelector("[data-beam-id]").textContent = "148";
      setStatus(page.querySelector('[data-status="without"]'), "测试已完成", "is-done");
      setStatus(page.querySelector('[data-status="with"]'), "未开始", "");
      setBtn(woPlay, "play", "off");
      setBtn(woReset, "reset", "ready");
      setBtn(wPlay, "play", "ready");
      setBtn(wReset, "reset", "off");
      woNum.classList.remove("is-done");
      wNum.classList.remove("is-done");
      fillPins(20);
      fillHeaders(20);
      fillBeam(SCAN_WO_DONE, BEST_WO_DONE, "");
      fillCells(page.querySelector("[data-replay-without]"), WO_BEAM, 20, "without");
      fillCells(page.querySelector("[data-replay-with]"), Array(20).fill("--"), 0, "with");
      fillChecks(0, false);
      page.querySelector("[data-cost-wo]").textContent = "50";
      page.querySelector("[data-cost-w]").textContent = "--";
      page.querySelector("[data-cost-delta]").textContent = "--";
      page.querySelector("[data-ba-pct]").textContent = "75.0";
      page.querySelector("[data-ba-ok]").textContent = "75";
      page.querySelector("[data-ba-bad]").textContent = "25";
      fillThr(THR_WO_FULL, "");
      legendScan.textContent = "扫描波";
      badge.textContent = "预测成功";
    } else if (visual === "with-running") {
      page.querySelector("[data-point-value]").textContent = "P4";
      page.querySelector("[data-beam-id]").textContent = "113";
      setStatus(page.querySelector('[data-status="without"]'), "测试已完成", "is-done");
      setStatus(page.querySelector('[data-status="with"]'), "测试中…", "is-running");
      setBtn(woPlay, "play", "off");
      setBtn(woReset, "reset", "off");
      setBtn(wPlay, "play", "busy");
      setBtn(wReset, "reset", "off");
      woNum.classList.remove("is-done");
      wNum.classList.add("is-done");
      fillPins(4);
      fillHeaders(4);
      fillBeam([], "", PRED_W);
      fillCells(page.querySelector("[data-replay-without]"), WO_BEAM, 20, "without");
      fillCells(page.querySelector("[data-replay-with]"), W_BEAM.map(function (v, i) { return i < 4 ? v : "--"; }), 4, "with");
      fillChecks(4, false);
      page.querySelector("[data-cost-wo]").textContent = "50";
      page.querySelector("[data-cost-w]").textContent = "--";
      page.querySelector("[data-cost-delta]").textContent = "--";
      page.querySelector("[data-ba-pct]").textContent = "75.0";
      page.querySelector("[data-ba-ok]").textContent = "75";
      page.querySelector("[data-ba-bad]").textContent = "25";
      fillThr(THR_WO_FULL, THR_W_SHORT);
      legendScan.textContent = "预测波";
      badge.textContent = "预测成功";
    } else if (visual === "with-completed") {
      page.querySelector("[data-point-value]").textContent = "P20";
      page.querySelector("[data-beam-id]").textContent = "113";
      setStatus(page.querySelector('[data-status="without"]'), "测试已完成", "is-done");
      setStatus(page.querySelector('[data-status="with"]'), "测试已完成", "is-done");
      setBtn(woPlay, "play", "off");
      setBtn(woReset, "reset", "ready");
      setBtn(wPlay, "play", "off");
      setBtn(wReset, "reset", "ready");
      woNum.classList.remove("is-done");
      wNum.classList.remove("is-done");
      fillPins(20);
      fillHeaders(20);
      fillBeam([], BEST_WO_DONE, PRED_W);
      fillCells(page.querySelector("[data-replay-without]"), WO_BEAM, 20, "without");
      fillCells(page.querySelector("[data-replay-with]"), W_BEAM, 20, "with");
      fillChecks(20, true);
      page.querySelector("[data-cost-wo]").textContent = "50";
      page.querySelector("[data-cost-w]").textContent = "25";
      page.querySelector("[data-cost-delta]").textContent = "50";
      page.querySelector("[data-ba-pct]").textContent = "78.3";
      page.querySelector("[data-ba-ok]").textContent = "94";
      page.querySelector("[data-ba-bad]").textContent = "26";
      fillThr(THR_WO_FULL, THR_W_FULL);
      legendScan.textContent = "预测波";
      badge.textContent = "预测失败";
    }
  }

  function setScale() {
    var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.getElementById("stage").style.transform = "scale(" + scale + ")";
  }

  function normalized(raw) {
    var name = String(raw || "").replace(/^#/, "");
    return STATE_SET[name] ? name : "initial";
  }

  function setState(name, updateHash) {
    var next = normalized(name);
    if (next !== "site-env") lastFlow = next;
    page.dataset.state = next;
    overlay.hidden = next !== "site-env";
    applyVisual(next);
    document.querySelectorAll("#review-controls button").forEach(function (button) {
      button.setAttribute("aria-current", String(button.dataset.state === next));
    });
    document.title = "case3V1 Gate 1.5 工程静态页 - " + next;
    if (updateHash && location.hash.replace(/^#/, "") !== next) {
      history.replaceState(null, "", "#" + next);
    }
  }

  function buildControls() {
    var box = document.getElementById("review-controls");
    if (new URLSearchParams(location.search).get("controls") !== "1") return;
    box.dataset.visible = "true";
    STATES.forEach(function (item) {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = item[1];
      button.dataset.state = item[0];
      button.addEventListener("click", function () {
        setState(item[0], true);
      });
      box.appendChild(button);
    });
  }

  buildPins();
  buildBeam();
  buildReplay();
  buildThr();
  buildControls();
  setScale();
  if (normalized(location.hash) === "site-env") lastFlow = "with-running";
  setState(location.hash, false);

  window.addEventListener("resize", setScale);
  window.addEventListener("hashchange", function () {
    setState(location.hash, false);
  });
  window.addEventListener("keydown", function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    var map = { "1": "initial", "2": "without-running", "3": "without-completed", "4": "with-running", "5": "with-completed", "6": "site-env" };
    if (map[event.key]) setState(map[event.key], true);
  });

  page.addEventListener("click", function (event) {
    var action = event.target.closest("[data-action]");
    if (!action) return;
    var kind = action.getAttribute("data-action");
    if (kind === "start-without") setState("without-running", true);
    if (kind === "reset-without") setState("initial", true);
    if (kind === "start-with") setState("with-running", true);
    if (kind === "reset-with") setState("initial", true);
    if (kind === "open-site-env") setState("site-env", true);
    if (kind === "close-site-env") setState(lastFlow === "site-env" ? "with-running" : lastFlow, true);
  });
})();
