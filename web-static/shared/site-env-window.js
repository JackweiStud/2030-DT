/**
 * Shared「现场环境」弹窗：打开 / 关闭 / 拖拽。
 * 挂在 1920×1080 stage 内，坐标按舞台空间计算（兼容 stage transform scale）。
 * 画面仅为图片占位，不播放真实视频；供 case2 / case3 / case4 复用。
 */
(function (global) {
  "use strict";

  var STAGE_W = 1920;
  var STAGE_H = 1080;
  var DEFAULT_LEFT = 400;
  var DEFAULT_TOP = 280;
  var DEFAULT_W = 1120;
  var DEFAULT_H = 520;

  var DEFAULT_FEEDS = [
    { label: "视频1 | 基站视角", image: "video-feed-1.png" },
    { label: "视频2 | 集装箱视角", image: "video-feed-2.png" },
  ];

  function resolveUrl(base, file) {
    if (!file) return "";
    if (/^(?:https?:|data:|blob:|\/)/i.test(file)) return file;
    var root = String(base || "").replace(/\/?$/, "/");
    return root + file.replace(/^\//, "");
  }

  function clientToStage(stage, clientX, clientY) {
    var rect = stage.getBoundingClientRect();
    var scaleX = rect.width / STAGE_W;
    var scaleY = rect.height / STAGE_H;
    return {
      x: (clientX - rect.left) / scaleX,
      y: (clientY - rect.top) / scaleY,
    };
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function createCloseIconSvg() {
    return (
      '<svg class="site-env-dialog__close-icon" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path fill="currentColor" d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z"/>' +
      "</svg>"
    );
  }

  function buildOverlay(opts) {
    var assetBase = opts.assetBase || "";
    var feeds = opts.feeds && opts.feeds.length ? opts.feeds : DEFAULT_FEEDS;
    var iconUrl = resolveUrl(assetBase, opts.icon || "video-icon.png");

    var overlay = document.createElement("div");
    overlay.className = "site-env-overlay";
    overlay.hidden = true;
    overlay.setAttribute("data-site-env-overlay", "");

    var mask = document.createElement("div");
    mask.className = "site-env-mask";
    mask.setAttribute("data-site-env-mask", "");
    overlay.appendChild(mask);

    var dialog = document.createElement("div");
    dialog.className = "site-env-dialog";
    dialog.setAttribute("data-site-env-dialog", "");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "现场环境");
    dialog.style.left = DEFAULT_LEFT + "px";
    dialog.style.top = DEFAULT_TOP + "px";

    var header = document.createElement("div");
    header.className = "site-env-dialog__header";
    header.setAttribute("data-site-env-drag", "");

    var title = document.createElement("h2");
    title.className = "site-env-dialog__title";
    title.textContent = opts.title || "现场环境";
    header.appendChild(title);

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "site-env-dialog__close";
    closeBtn.setAttribute("data-site-env-close", "");
    closeBtn.setAttribute("aria-label", "关闭");
    closeBtn.innerHTML = createCloseIconSvg();
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    var body = document.createElement("div");
    body.className = "site-env-dialog__body";

    feeds.forEach(function (feed) {
      var col = document.createElement("div");
      col.className = "site-env-feed";

      var labelRow = document.createElement("div");
      labelRow.className = "site-env-feed__label";

      var icon = document.createElement("img");
      icon.className = "site-env-feed__icon";
      icon.src = iconUrl;
      icon.alt = "";
      labelRow.appendChild(icon);

      var text = document.createElement("span");
      text.className = "site-env-feed__text";
      text.textContent = feed.label || "";
      labelRow.appendChild(text);
      col.appendChild(labelRow);

      var media = document.createElement("div");
      media.className = "site-env-feed__media";
      var img = document.createElement("img");
      img.src = resolveUrl(assetBase, feed.image);
      img.alt = feed.label || "";
      media.appendChild(img);
      col.appendChild(media);

      body.appendChild(col);
    });

    dialog.appendChild(body);
    overlay.appendChild(dialog);
    return overlay;
  }

  function createController(options) {
    var opts = options || {};
    var stage = opts.stage;
    if (!stage) throw new Error("SiteEnvWindow: stage is required");

    var existing = stage.querySelector("[data-site-env-overlay]");
    if (existing) existing.remove();

    var overlay = buildOverlay(opts);
    stage.appendChild(overlay);

    var dialog = overlay.querySelector("[data-site-env-dialog]");
    var mask = overlay.querySelector("[data-site-env-mask]");
    var closeBtn = overlay.querySelector("[data-site-env-close]");
    var dragHandle = overlay.querySelector("[data-site-env-drag]");

    var open = false;
    var dragging = false;
    var dragOffsetX = 0;
    var dragOffsetY = 0;
    var posLeft = DEFAULT_LEFT;
    var posTop = DEFAULT_TOP;

    function applyPosition(left, top) {
      var maxL = STAGE_W - DEFAULT_W;
      var maxT = STAGE_H - DEFAULT_H;
      posLeft = clamp(left, 0, Math.max(0, maxL));
      posTop = clamp(top, 0, Math.max(0, maxT));
      dialog.style.left = posLeft + "px";
      dialog.style.top = posTop + "px";
    }

    function openWindow() {
      if (open) return;
      open = true;
      applyPosition(DEFAULT_LEFT, DEFAULT_TOP);
      overlay.hidden = false;
      overlay.classList.add("is-open");
      closeBtn.focus();
    }

    function closeWindow() {
      if (!open) return;
      open = false;
      dragging = false;
      overlay.classList.remove("is-open");
      overlay.hidden = true;
    }

    function toggleWindow() {
      if (open) closeWindow();
      else openWindow();
    }

    function onPointerDown(e) {
      if (e.button != null && e.button !== 0) return;
      if (e.target.closest("[data-site-env-close]")) return;
      var pt = clientToStage(stage, e.clientX, e.clientY);
      dragging = true;
      dragOffsetX = pt.x - posLeft;
      dragOffsetY = pt.y - posTop;
      dragHandle.setPointerCapture(e.pointerId);
      e.preventDefault();
    }

    function onPointerMove(e) {
      if (!dragging) return;
      var pt = clientToStage(stage, e.clientX, e.clientY);
      applyPosition(pt.x - dragOffsetX, pt.y - dragOffsetY);
    }

    function onPointerUp(e) {
      if (!dragging) return;
      dragging = false;
      try {
        dragHandle.releasePointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
    }

    function onKeyDown(e) {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeWindow();
      }
    }

    mask.addEventListener("click", closeWindow);
    closeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      closeWindow();
    });
    dragHandle.addEventListener("pointerdown", onPointerDown);
    dragHandle.addEventListener("pointermove", onPointerMove);
    dragHandle.addEventListener("pointerup", onPointerUp);
    dragHandle.addEventListener("pointercancel", onPointerUp);
    document.addEventListener("keydown", onKeyDown);

    return {
      open: openWindow,
      close: closeWindow,
      toggle: toggleWindow,
      isOpen: function () {
        return open;
      },
      destroy: function () {
        document.removeEventListener("keydown", onKeyDown);
        closeWindow();
        overlay.remove();
      },
    };
  }

  /**
   * @param {object} options
   * @param {HTMLElement} options.stage 1920×1080 舞台根节点
   * @param {string} [options.assetBase] 占位图目录，相对当前页面
   * @param {string} [options.title]
   * @param {string} [options.icon]
   * @param {{label:string,image:string}[]} [options.feeds]
   * @param {Element|Element[]|NodeList|string} [options.trigger] 打开入口（如「现场环境 >」）
   */
  function mount(options) {
    var controller = createController(options);
    var trigger = options && options.trigger;
    var nodes = [];
    if (typeof trigger === "string") {
      nodes = Array.prototype.slice.call(document.querySelectorAll(trigger));
    } else if (trigger && trigger.length != null && !trigger.tagName) {
      nodes = Array.prototype.slice.call(trigger);
    } else if (trigger) {
      nodes = [trigger];
    }

    nodes.forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        controller.open();
      });
    });

    return controller;
  }

  global.SiteEnvWindow = {
    mount: mount,
    DEFAULT_FEEDS: DEFAULT_FEEDS,
  };
})(typeof window !== "undefined" ? window : this);
