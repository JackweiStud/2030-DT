/**
 * Gate 1.5 review-only state switching for case3.
 * NOT a formal state machine. Do not reuse in production frontend.
 * No API / shared-dir / Node — static visual + fake interaction only.
 * Visual source of truth: 03-design/case3/case3-dt-com.pen
 */
(function () {
  "use strict";

  var STATES = {
    initial: {
      withoutBadge: "等待启动测试",
      withBadge: "等待无DT测试完成",
      withoutStart: true,
      withoutReset: false,
      withStart: false,
      withReset: false,
      withoutPoint: "点位{no}",
      withPoint: "点位2",
      withoutPointVisible: false,
      withPointVisible: false,
      withoutFilled: 0,
      withFilled: 0,
      withoutScan: [],
      withoutBest: null,
      withPredictIndex: null,
      withLegend: null,
      costWo: null,
      costW: null,
      costDelta: null,
      thrpWo: 0,
      thrpW: 0,
      baOk: 80,
      baErr: 0,
      baPct: 100,
      baBadge: "正常",
    },
    "without-running": {
      withoutBadge: "测试中",
      withBadge: "等待无DT测试完成",
      withoutStart: false,
      withoutReset: false,
      withStart: false,
      withReset: false,
      withoutPoint: "点位18",
      withPoint: "点位2",
      withoutPointVisible: true,
      withPointVisible: false,
      withoutFilled: 18,
      withFilled: 0,
      withoutScan: [6, 28, 51, 66, 89, 112, 141, 175, 191, 208, 229, 251],
      withoutBest: 138,
      withPredictIndex: null,
      withLegend: null,
      costWo: 25,
      costW: null,
      costDelta: null,
      thrpWo: 18,
      thrpW: 0,
      baOk: 80,
      baErr: 0,
      baPct: 100,
      baBadge: "正常",
    },
    "without-completed": {
      withoutBadge: "已完成",
      withBadge: "等待启动测试",
      withoutStart: false,
      withoutReset: true,
      withStart: true,
      withReset: false,
      withoutPoint: "点位20",
      withPoint: "点位2",
      withoutPointVisible: true,
      withPointVisible: false,
      withoutFilled: 20,
      withFilled: 0,
      withoutScan: [6, 28, 51, 66, 89, 112, 141, 175, 191, 208, 229, 251],
      withoutBest: 138,
      withPredictIndex: null,
      withLegend: null,
      costWo: 25,
      costW: null,
      costDelta: null,
      thrpWo: 20,
      thrpW: 0,
      baOk: 80,
      baErr: 0,
      baPct: 100,
      baBadge: "正常",
    },
    "with-running": {
      withoutBadge: "已完成",
      withBadge: "测试中",
      withoutStart: false,
      withoutReset: false,
      withStart: false,
      withReset: false,
      withoutPoint: "点位20",
      withPoint: "点位2",
      withoutPointVisible: true,
      withPointVisible: true,
      withoutFilled: 20,
      withFilled: 2,
      withoutScan: [6, 28, 51, 66, 89, 112, 141, 175, 191, 208, 229, 251],
      withoutBest: 138,
      withPredictIndex: 1,
      withLegend: {
        ok: true,
        icon: "./assets/icon-ok.png",
        text: "波束预测成功,BeamId:2",
      },
      costWo: 25,
      costW: 15,
      costDelta: 66.7,
      thrpWo: 20,
      thrpW: 2,
      baOk: 80,
      baErr: 0,
      baPct: 100,
      baBadge: "正常",
    },
    "with-completed": {
      withoutBadge: "已完成",
      withBadge: "已完成",
      /* Pencil u8lgf 操作区 JHkHJ / OtKqK：启动 disabled，重置高亮 */
      withoutStart: false,
      withoutReset: true,
      withStart: false,
      withReset: true,
      withoutPoint: "点位20",
      withPoint: "点位20",
      withoutPointVisible: true,
      withPointVisible: true,
      withoutFilled: 20,
      withFilled: 20,
      withoutScan: [6, 28, 51, 66, 89, 112, 141, 175, 191, 208, 229, 251],
      withoutBest: 138,
      withPredictIndex: 138,
      withLegend: {
        ok: false,
        icon: "./assets/icon-err.png",
        text: "波束预测失败,BeamId: 44",
      },
      costWo: 25,
      costW: 15,
      costDelta: 66.7,
      thrpWo: 20,
      thrpW: 20,
      baOk: 98,
      baErr: 2,
      baPct: 98,
      baBadge: "正常",
    },
  };

  /* Pencil map 891×452 + UE路线层(143,136); percent = (layer+local+2)/map */
  var ROUTE_POINTS = [
    [54.83, 41.26],
    [54.04, 41.26],
    [53.14, 41.26],
    [52.36, 41.26],
    [51.68, 41.26],
    [50.9, 41.26],
    [50.11, 41.26],
    [49.33, 41.26],
    [48.54, 41.26],
    [47.76, 41.26],
    [47.76, 42.81],
    [47.76, 44.36],
    [47.76, 45.91],
    [47.76, 47.23],
    [47.76, 48.78],
    [47.76, 50.33],
    [47.76, 51.88],
    [47.76, 53.43],
    [47.76, 55.2],
    [47.76, 56.97],
  ];
  var COST_RING_LEN = Math.PI * 58;

  /* Representative throughput samples (Gbps), index = point no-1 */
  var THRP_WO = [1.1, 1.5, 2.3, 2.6, 1.9, 1.5, 2.1, 2.7, 2.1, 1.5, 1.9, 2.3, 2.5, 2.0, 1.7, 2.3, 2.6, 2.2, 1.8, 2.4];
  var THRP_W = [7.0, 7.5, 7.2, 7.8, 7.4, 7.9, 7.1, 7.6, 8.0, 7.3, 7.7, 7.5, 7.9, 7.2, 7.6, 8.1, 7.4, 7.8, 7.3, 7.7];
  var WITH_OK = [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, false, false];

  var stage = document.getElementById("stage");
  var case3Page = document.getElementById("case3-page");
  var placeholder = document.getElementById("placeholder-page");
  var reviewButtons = document.querySelectorAll(".review-dock [data-set-state]");
  var tabs = document.querySelectorAll(".case-tab");

  function fitStage() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var scale = Math.min(vw / 1920, vh / 1080);
    stage.style.transform = "scale(" + scale + ")";
  }

  function buildScanGrid(root) {
    root.innerHTML = "";
    var i;
    var r;
    var c;
    var row;
    var dot;
    for (r = 0; r < 16; r++) {
      row = document.createElement("div");
      row.className = "case3-scan-row";
      for (c = 0; c < 16; c++) {
        i = r * 16 + c;
        dot = document.createElement("span");
        dot.className = "case3-scan-dot";
        dot.setAttribute("data-beam-index", String(i));
        row.appendChild(dot);
      }
      root.appendChild(row);
    }
  }

  function buildRouteLayer(root) {
    root.innerHTML = "";
    var i;
    var dot;
    for (i = 0; i < ROUTE_POINTS.length; i++) {
      dot = document.createElement("span");
      dot.className = "case3-route-dot";
      dot.setAttribute("data-route-index", String(i));
      dot.style.left = ROUTE_POINTS[i][0] + "%";
      dot.style.top = ROUTE_POINTS[i][1] + "%";
      root.appendChild(dot);
    }
  }

  function updateRoute(side, activeCount) {
    var root = case3Page.querySelector('[data-route="' + side + '"]');
    if (!root) return;
    var dots = root.querySelectorAll(".case3-route-dot");
    var i;
    for (i = 0; i < dots.length; i++) {
      dots[i].classList.toggle("is-active", i < activeCount);
    }
  }

  function buildProgressSlots(root, side) {
    root.innerHTML = "";
    var i;
    var slot;
    var label;
    var value;
    var empty;
    var icon;
    for (i = 1; i <= 20; i++) {
      slot = document.createElement("div");
      slot.className = "case3-slot";
      slot.setAttribute("data-slot", String(i));

      label = document.createElement("span");
      label.className = "case3-slot__label";
      label.textContent = "P" + i;
      slot.appendChild(label);

      if (side === "without") {
        value = document.createElement("span");
        value.className = "case3-slot__value";
        value.setAttribute("data-slot-value", "");
        value.hidden = true;
        slot.appendChild(value);

        empty = document.createElement("span");
        empty.className = "case3-slot__empty";
        empty.setAttribute("data-slot-empty", "");
        slot.appendChild(empty);
      } else {
        icon = document.createElement("img");
        icon.className = "case3-slot__icon";
        icon.setAttribute("data-slot-icon", "");
        icon.alt = "";
        icon.hidden = true;
        slot.appendChild(icon);

        empty = document.createElement("span");
        empty.className = "case3-slot__empty";
        empty.setAttribute("data-slot-empty", "");
        slot.appendChild(empty);
      }

      root.appendChild(slot);
    }
  }

  function setButtonEnabled(btn, enabled) {
    if (!btn) return;
    btn.disabled = !enabled;
    btn.classList.toggle("is-disabled", !enabled);
  }

  function setCostArc(side, value) {
    var arc = case3Page.querySelector('[data-cost-arc="' + side + '"]');
    var glow = case3Page.querySelector('[data-cost-glow="' + side + '"]');
    var label = case3Page.querySelector('[data-cost-value="' + side + '"]');
    if (label) label.textContent = value == null ? "--" : String(value);
    var offset = COST_RING_LEN;
    if (value != null) {
      var pct = Math.max(0, Math.min(100, Number(value))) / 100;
      offset = COST_RING_LEN * (1 - pct);
    }
    [arc, glow].forEach(function (el) {
      if (!el) return;
      el.style.strokeDasharray = String(COST_RING_LEN);
      el.style.strokeDashoffset = String(offset);
    });
  }

  function setThroughput(side, count, series) {
    var line = case3Page.querySelector('[data-thrp-line="' + side + '"]');
    var dotsHost = case3Page.querySelector('[data-thrp-dots="' + side + '"]');
    if (!line || !dotsHost) return;
    dotsHost.innerHTML = "";
    if (!count || count <= 0) {
      line.setAttribute("points", "");
      return;
    }

    var left = 36;
    var right = 580;
    var top = 12;
    var bottom = 210;
    var maxX = 20;
    var maxY = 10;
    var points = [];
    var i;
    var x;
    var y;
    var v;
    var circle;
    for (i = 0; i < count; i++) {
      v = series[i];
      x = left + i / (maxX - 1) * (right - left);
      y = bottom - (v / maxY) * (bottom - top);
      points.push(x.toFixed(1) + "," + y.toFixed(1));
      circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", x.toFixed(1));
      circle.setAttribute("cy", y.toFixed(1));
      circle.setAttribute("r", "3");
      circle.setAttribute("fill", side === "with" ? "#22D3EE" : "#6B7280");
      dotsHost.appendChild(circle);
    }
    line.setAttribute("points", points.join(" "));
  }

  function setBa(cfg) {
    var ok = case3Page.querySelector("[data-ba-ok]");
    var err = case3Page.querySelector("[data-ba-err]");
    var pct = case3Page.querySelector("[data-ba-pct]");
    var badge = case3Page.querySelector("[data-ba-badge]");
    var ring = case3Page.querySelector("[data-ba-ring]");
    if (ok) ok.textContent = String(cfg.baOk);
    if (err) err.textContent = String(cfg.baErr);
    if (pct) pct.textContent = String(cfg.baPct);
    if (badge) badge.textContent = cfg.baBadge;
    if (ring) {
      /* measured length of 240° open arc r=86 */
      var arcLen = 384.29;
      var offset = arcLen * (1 - Math.max(0, Math.min(100, cfg.baPct)) / 100);
      ring.style.strokeDasharray = String(arcLen);
      ring.style.strokeDashoffset = String(offset);
    }
  }

  function updateWithoutScan(cfg) {
    var root = case3Page.querySelector('[data-scan-grid="without"]');
    if (!root) return;
    var dots = root.querySelectorAll(".case3-scan-dot");
    var scanSet = {};
    var i;
    for (i = 0; i < cfg.withoutScan.length; i++) scanSet[cfg.withoutScan[i]] = true;
    for (i = 0; i < dots.length; i++) {
      dots[i].classList.remove("is-scan", "is-best", "is-predict");
      if (cfg.withoutBest != null && i === cfg.withoutBest) {
        dots[i].classList.add("is-best");
      } else if (scanSet[i]) {
        dots[i].classList.add("is-scan");
      }
    }
  }

  function updateWithScan(cfg) {
    var root = case3Page.querySelector('[data-scan-grid="with"]');
    var legend = case3Page.querySelector('[data-beam-legend="with"]');
    var legendItem = case3Page.querySelector("[data-with-legend]");
    var legendIcon = case3Page.querySelector("[data-with-legend-icon]");
    var legendText = case3Page.querySelector("[data-with-legend-text]");
    if (!root) return;

    var dots = root.querySelectorAll(".case3-scan-dot");
    var i;
    for (i = 0; i < dots.length; i++) {
      dots[i].classList.remove("is-scan", "is-best", "is-predict");
      if (cfg.withPredictIndex != null && i === cfg.withPredictIndex) {
        dots[i].classList.add("is-predict");
      }
    }

    if (!legend) return;
    if (!cfg.withLegend) {
      legend.hidden = true;
      return;
    }
    legend.hidden = false;
    if (legendItem) {
      legendItem.classList.toggle("is-ok", !!cfg.withLegend.ok);
      legendItem.classList.toggle("is-fail", !cfg.withLegend.ok);
    }
    if (legendIcon) {
      legendIcon.src = cfg.withLegend.icon;
      legendIcon.alt = cfg.withLegend.ok ? "预测成功" : "预测失败";
    }
    if (legendText) legendText.textContent = cfg.withLegend.text;
  }

  function updateProgress(side, filled, mode) {
    var root = case3Page.querySelector('[data-progress-slots="' + side + '"]');
    if (!root) return;
    var slots = root.querySelectorAll(".case3-slot");
    var i;
    var slot;
    var value;
    var empty;
    var icon;
    for (i = 0; i < slots.length; i++) {
      slot = slots[i];
      value = slot.querySelector("[data-slot-value]");
      empty = slot.querySelector("[data-slot-empty]");
      icon = slot.querySelector("[data-slot-icon]");
      if (i < filled) {
        if (empty) empty.hidden = true;
        if (mode === "without") {
          if (value) {
            value.hidden = false;
            value.textContent = String(i + 1);
          }
        } else if (icon) {
          icon.hidden = false;
          if (WITH_OK[i]) {
            icon.src = "./assets/icon-ok.png";
            icon.alt = "预测正确";
          } else {
            icon.src = "./assets/icon-err.png";
            icon.alt = "预测错误";
          }
        }
      } else {
        if (value) value.hidden = true;
        if (icon) icon.hidden = true;
        if (empty) empty.hidden = false;
      }
    }
  }

  function setState(state) {
    if (!STATES[state]) state = "initial";
    var cfg = STATES[state];
    case3Page.dataset.state = state;

    var withoutText = case3Page.querySelector('[data-badge-text="without"]');
    var withText = case3Page.querySelector('[data-badge-text="with"]');
    if (withoutText) withoutText.textContent = cfg.withoutBadge;
    if (withText) withText.textContent = cfg.withBadge;

    setButtonEnabled(case3Page.querySelector('[data-action="start-without"]'), cfg.withoutStart);
    setButtonEnabled(case3Page.querySelector('[data-action="reset-without"]'), cfg.withoutReset);
    setButtonEnabled(case3Page.querySelector('[data-action="start-with"]'), cfg.withStart);
    setButtonEnabled(case3Page.querySelector('[data-action="reset-with"]'), cfg.withReset);

    var woPoint = case3Page.querySelector('[data-beam-point="without"]');
    var wPoint = case3Page.querySelector('[data-beam-point="with"]');
    var woPointWrap = case3Page.querySelector('[data-beam-point-wrap="without"]');
    var wPointWrap = case3Page.querySelector('[data-beam-point-wrap="with"]');
    if (woPoint) woPoint.textContent = cfg.withoutPoint;
    if (wPoint) wPoint.textContent = cfg.withPoint;
    if (woPointWrap) woPointWrap.hidden = !cfg.withoutPointVisible;
    if (wPointWrap) wPointWrap.hidden = !cfg.withPointVisible;

    updateRoute("without", cfg.withoutFilled);
    updateRoute("with", cfg.withFilled);
    updateWithoutScan(cfg);
    updateWithScan(cfg);
    updateProgress("without", cfg.withoutFilled, "without");
    updateProgress("with", cfg.withFilled, "with");

    setCostArc("without", cfg.costWo);
    setCostArc("with", cfg.costW);
    var delta = case3Page.querySelector("[data-cost-delta]");
    var arrow = case3Page.querySelector("[data-cost-arrow]");
    if (delta) delta.textContent = cfg.costDelta == null ? "--" : String(cfg.costDelta);
    if (arrow) arrow.hidden = cfg.costDelta == null;

    setThroughput("without", cfg.thrpWo, THRP_WO);
    setThroughput("with", cfg.thrpW, THRP_W);
    setBa(cfg);

    reviewButtons.forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-set-state") === state);
    });

    try {
      var url = new URL(window.location.href);
      url.searchParams.set("state", state);
      url.searchParams.delete("tab");
      history.replaceState(null, "", url.toString());
    } catch (_) {
      /* file:// may restrict URL API in some hosts; ignore */
    }
  }

  function showTab(tab) {
    var isCase3 = tab === "case3";
    case3Page.hidden = !isCase3;
    placeholder.hidden = isCase3;
    tabs.forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-tab") === tab);
    });
  }

  var scanWo = case3Page.querySelector('[data-scan-grid="without"]');
  var scanW = case3Page.querySelector('[data-scan-grid="with"]');
  var routeWo = case3Page.querySelector('[data-route="without"]');
  var routeW = case3Page.querySelector('[data-route="with"]');
  var slotsWo = case3Page.querySelector('[data-progress-slots="without"]');
  var slotsW = case3Page.querySelector('[data-progress-slots="with"]');
  if (scanWo) buildScanGrid(scanWo);
  if (scanW) buildScanGrid(scanW);
  if (routeWo) buildRouteLayer(routeWo);
  if (routeW) buildRouteLayer(routeW);
  if (slotsWo) buildProgressSlots(slotsWo, "without");
  if (slotsW) buildProgressSlots(slotsW, "with");

  reviewButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setState(btn.getAttribute("data-set-state"));
    });
  });

  /* Gate 1.5 review dock: drag by title to reposition within stage */
  (function enableReviewDockDrag() {
    var dock = document.querySelector(".review-dock");
    var handle = dock && dock.querySelector("[data-review-dock-handle]");
    if (!dock || !handle) return;

    var dragging = false;
    var grabX = 0;
    var grabY = 0;
    var STORAGE_KEY = "case3-review-dock-pos";

    function stageScale() {
      return stage.getBoundingClientRect().width / 1920;
    }

    function clamp(v, min, max) {
      return Math.max(min, Math.min(max, v));
    }

    function applyPos(x, y) {
      var maxX = 1920 - dock.offsetWidth;
      var maxY = 1080 - dock.offsetHeight;
      x = clamp(x, 0, maxX);
      y = clamp(y, 0, maxY);
      dock.style.left = x + "px";
      dock.style.top = y + "px";
      dock.style.right = "auto";
      dock.style.bottom = "auto";
      return { x: x, y: y };
    }

    try {
      var saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        var pos = JSON.parse(saved);
        if (typeof pos.x === "number" && typeof pos.y === "number") applyPos(pos.x, pos.y);
      }
    } catch (_) {
      /* ignore */
    }

    handle.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      dragging = true;
      handle.setPointerCapture(e.pointerId);
      var scale = stageScale();
      var dockRect = dock.getBoundingClientRect();
      grabX = (e.clientX - dockRect.left) / scale;
      grabY = (e.clientY - dockRect.top) / scale;
      dock.classList.add("is-dragging");
      e.preventDefault();
    });

    handle.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var scale = stageScale();
      var stageRect = stage.getBoundingClientRect();
      applyPos(
        (e.clientX - stageRect.left) / scale - grabX,
        (e.clientY - stageRect.top) / scale - grabY
      );
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      dock.classList.remove("is-dragging");
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            x: parseFloat(dock.style.left) || 0,
            y: parseFloat(dock.style.top) || 0,
          })
        );
      } catch (_) {
        /* ignore */
      }
    }

    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  })();

  tabs.forEach(function (btn) {
    btn.addEventListener("click", function () {
      showTab(btn.getAttribute("data-tab"));
    });
  });

  case3Page.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action]");
    if (!btn || btn.disabled) return;
    var action = btn.getAttribute("data-action");
    if (action === "start-without") setState("without-running");
    else if (action === "reset-without") setState("initial");
    else if (action === "start-with") setState("with-running");
    else if (action === "reset-with") setState("without-completed");
  });

  if (typeof SiteEnvWindow !== "undefined") {
    SiteEnvWindow.mount({
      stage: stage,
      assetBase: "./assets/",
      trigger: case3Page.querySelector("[data-site-env-trigger]"),
      feeds: [
        { label: "视频1 | 基站视角", image: "video-feed-1.png" },
        { label: "视频2 | 集装箱视角", image: "video-feed-2.png" },
      ],
    });
  }

  fitStage();
  window.addEventListener("resize", fitStage);

  var initialState = "initial";
  try {
    var params = new URLSearchParams(window.location.search);
    if (params.get("state") && STATES[params.get("state")]) {
      initialState = params.get("state");
    }
  } catch (_) {
    /* ignore */
  }
  setState(initialState);
  showTab("case3");
})();
