/**
 * case1 Gate 1.5 静态页。
 * 示意数字只服务与 Pencil 对照，不是正式业务常量，不得迁入运行代码。
 * 不保存选择，刷新回首页。
 */
(function () {
  var DEMO = {
    off: "0.2",
    on: "0.4",
    delta: "50",
    unit: "%",
    offLabel: "RF off",
    onLabel: "RF on"
  };

  var stage = document.getElementById("stage");
  var page = document.getElementById("case1-page");
  var panels = {
    home: document.getElementById("panel-home"),
    geometry: document.getElementById("panel-geometry"),
    material: document.getElementById("panel-material"),
    rf: document.getElementById("panel-rf")
  };
  var view = "home";

  function fitStage() {
    var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = "scale(" + scale + ")";
  }

  function mountCharts() {
    var chart = [
      '<div class="c1-yaxis"><span>1.0</span><span>0.8</span><span>0.6</span><span>0.4</span><span>0.2</span><span>0.0</span></div>',
      '<div class="c1-plot">',
      '<div class="c1-val c1-val-off"></div>',
      '<div class="c1-val c1-val-on"><span class="c1-badge"><svg viewBox="0 0 15 30" width="15" height="30" aria-hidden="true"><path d="M7.5 0 L15 16 H10.3 V30 H4.7 V16 H0 Z" fill="#36c18d"/></svg><span class="c1-delta"><strong data-demo="delta"></strong><small data-demo="unit"></small></span></span><b class="c1-num" data-demo="on"></b></div>',
      '<div class="c1-barcell c1-barcell-off"><b class="c1-num" data-demo="off"></b><i class="c1-bar c1-bar-off"></i></div>',
      '<div class="c1-barcell"><i class="c1-bar c1-bar-on"><s></s><u></u></i></div>',
      '<em class="c1-xlabel" data-demo="offLabel"></em><em class="c1-xlabel" data-demo="onLabel"></em>',
      '<span class="c1-dash" aria-hidden="true"></span>',
      "</div>"
    ].join("");
    var slots = page.querySelectorAll(".c1-chart");
    for (var i = 0; i < slots.length; i += 1) slots[i].innerHTML = chart;
  }

  function paintKpis() {
    var nodes = page.querySelectorAll("[data-demo]");
    for (var i = 0; i < nodes.length; i += 1) {
      var key = nodes[i].getAttribute("data-demo");
      if (Object.prototype.hasOwnProperty.call(DEMO, key)) {
        nodes[i].textContent = DEMO[key];
      }
    }
  }

  function show(next) {
    view = next;
    page.setAttribute("data-view", view);
    Object.keys(panels).forEach(function (key) {
      if (key === "home") {
        panels.home.hidden = view !== "home";
        return;
      }
      panels[key].hidden = view !== key;
    });
    var diamonds = page.querySelectorAll(".c1-diamond");
    for (var i = 0; i < diamonds.length; i += 1) {
      var layer = diamonds[i].getAttribute("data-layer");
      var current = view !== "home" && layer === view;
      if (diamonds[i].tagName === "BUTTON") {
        diamonds[i].setAttribute("aria-pressed", current ? "true" : "false");
      }
    }
  }

  page.addEventListener("keydown", function (event) {
    var button = event.target.closest && event.target.closest("button.c1-diamond");
    if (!button) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    button.click();
  });

  page.addEventListener("click", function (event) {
    var button = event.target.closest(".c1-diamond");
    if (!button || button.tagName !== "BUTTON") return;
    var layer = button.getAttribute("data-layer");
    if (layer !== "geometry" && layer !== "material" && layer !== "rf") return;
    show(view === layer ? "home" : layer);
  });

  window.addEventListener("resize", fitStage);
  mountCharts();
  paintKpis();
  fitStage();
  show("home");

  window.__case1Static = {
    demo: DEMO,
    show: show,
    paintKpis: paintKpis
  };
})();
