/**
 * Gate 1.5 review-only state switching.
 * NOT a formal state machine. Do not reuse in production frontend.
 */
(function () {
  const STATES = {
    initial: {
      badge: "等待启动测试",
      startDisabled: false,
      clearDisabled: true,
    },
    calibrating: {
      badge: "测试运行中",
      startDisabled: true,
      clearDisabled: false,
    },
    failed: {
      badge: "测试失败",
      startDisabled: false,
      clearDisabled: false,
    },
    completed: {
      badge: "已完成",
      startDisabled: true,
      clearDisabled: false,
    },
  };

  const stage = document.getElementById("stage");
  const case2Page = document.getElementById("case2-page");
  const placeholder = document.getElementById("placeholder-page");
  const reviewButtons = document.querySelectorAll(".review-dock [data-set-state]");
  const tabs = document.querySelectorAll(".case-tab");

  function fitStage() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / 1920, vh / 1080);
    stage.style.transform = "scale(" + scale + ")";
  }

  function setState(state) {
    if (!STATES[state]) state = "initial";
    const cfg = STATES[state];
    case2Page.dataset.state = state;

    const badgeText = case2Page.querySelector("[data-status-badge] .status-text");
    if (badgeText) badgeText.textContent = cfg.badge;

    const startBtn = case2Page.querySelector('[data-action="start"]');
    const clearBtn = case2Page.querySelector('[data-action="clear"]');
    if (startBtn) startBtn.disabled = cfg.startDisabled;
    if (clearBtn) clearBtn.disabled = cfg.clearDisabled;

    const startLabel = case2Page.querySelector("[data-start-label]");
    if (startLabel) startLabel.textContent = state === "calibrating" ? "运行中" : "启动";

    reviewButtons.forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-set-state") === state);
    });

    const url = new URL(window.location.href);
    url.searchParams.set("state", state);
    url.searchParams.delete("tab");
    history.replaceState(null, "", url.toString());
  }

  const siteEnvWindow =
    typeof SiteEnvWindow !== "undefined"
      ? SiteEnvWindow.mount({
          stage: stage,
          assetBase: "../../04-runtime-assets/shell/site-env/",
          trigger: case2Page.querySelector("[data-site-env-trigger]"),
        })
      : null;

  function showTab(tab) {
    const isCase2 = tab === "case2";
    case2Page.hidden = !isCase2;
    placeholder.hidden = isCase2;
    tabs.forEach(function (t) {
      t.classList.toggle("is-active", t.getAttribute("data-tab") === tab);
    });
    if (!isCase2 && siteEnvWindow) siteEnvWindow.close();
    const url = new URL(window.location.href);
    if (isCase2) {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }
    history.replaceState(null, "", url.toString());
  }

  reviewButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      showTab("case2");
      setState(btn.getAttribute("data-set-state"));
    });
  });

  tabs.forEach(function (tabBtn) {
    tabBtn.addEventListener("click", function () {
      showTab(tabBtn.getAttribute("data-tab"));
    });
  });

  case2Page.querySelector('[data-action="start"]').addEventListener("click", function () {
    const cur = case2Page.dataset.state;
    if (cur === "initial" || cur === "failed") setState("calibrating");
  });

  case2Page.querySelector('[data-action="clear"]').addEventListener("click", function () {
    setState("initial");
  });

  window.addEventListener("resize", fitStage);
  fitStage();

  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  const state = params.get("state") || "initial";
  if (tab && tab !== "case2") {
    showTab(tab);
  } else {
    showTab("case2");
    setState(state);
  }
})();
