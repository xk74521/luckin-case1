/* ============================================================
 * app.js — 渲染引擎 / 设置面板 / 内容编辑 / 配置存取
 * 纯原生 JS，无任何依赖。
 * ============================================================ */
(function () {
  "use strict";

  var DEFAULTS = window.SITE_CONFIG || {};
  var STORAGE_KEY = "case-site-config-v1";
  var mqDark = window.matchMedia("(prefers-color-scheme: dark)");
  var PRESET_COLORS = ["#2563eb", "#6366f1", "#0d9488", "#ea580c", "#e11d48", "#475569"];

  /* ---------------- 工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function getPath(obj, path) {
    return String(path).split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }
  function setPath(obj, path, value) {
    var keys = String(path).split(".");
    var cur = obj;
    for (var i = 0; i < keys.length - 1; i++) {
      var k = keys[i];
      if (cur[k] == null) cur[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      cur = cur[k];
    }
    cur[keys[keys.length - 1]] = value;
  }
  function isObj(v) { return v && typeof v === "object" && !Array.isArray(v); }
  function merge(base, over) {
    if (Array.isArray(base) || Array.isArray(over)) return over === undefined ? clone(base) : clone(over);
    if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(over).forEach(function (k) {
      out[k] = isObj(base[k]) && isObj(over[k]) ? merge(base[k], over[k]) : over[k];
    });
    return out;
  }

  /* ---------------- 状态 ---------------- */
  var config = load();
  var editMode = false;
  var saveTimer = null;
  var sectionIO = null;

  function load() {
    var base = clone(DEFAULTS);
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      var saved = JSON.parse(raw);
      if (!isObj(saved)) return base;
      return merge(base, saved);
    } catch (e) {
      return base;
    }
  }

  /* 只保存与 config.js 默认值的差异，这样以后改 config.js 仍然生效 */
  function diff(base, val) {
    if (isObj(base) && isObj(val)) {
      var out = {}, any = false;
      Object.keys(val).forEach(function (k) {
        var d = diff(base[k], val[k]);
        if (d !== undefined) { out[k] = d; any = true; }
      });
      return any ? out : undefined;
    }
    if (Array.isArray(base) && Array.isArray(val)) {
      return JSON.stringify(base) === JSON.stringify(val) ? undefined : clone(val);
    }
    return base === val ? undefined : val;
  }

  function save() {
    try {
      var d = diff(clone(DEFAULTS), config);
      if (d === undefined) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
      return true;
    } catch (e) {
      return false;
    }
  }

  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 250);
  }

  /* ---------------- 图标 ---------------- */
  var ICONS = {
    store: '<path d="M4 9.5 5.6 4h12.8L20 9.5"/><path d="M4 9.5h16"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-5.5h5V20"/>',
    handshake: '<path d="M8 12 3.5 7.5 7 4l4 4"/><path d="M16 12l4.5-4.5L17 4l-4 4"/><path d="M3.5 7.5V13l5.5 5.5 3-3 3 3L21 13V7.5"/><path d="m9 15.5 3-3"/>',
    spark: '<path d="M12 3.5 14 9l5.5 2-5.5 2-2 5.5-2-5.5L4.5 11 10 9Z"/><path d="M18.5 16.5 19.4 19l2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9Z" transform="translate(-1.5 -2.5) scale(.7)"/>',
    chip: '<rect x="7" y="7" width="10" height="10" rx="2.2"/><path d="M10 3v2M14 3v2M10 19v2M14 19v2M3 10h2M3 14h2M19 10h2M19 14h2"/>',
    dot: '<circle cx="12" cy="12" r="4"/>'
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[name] || ICONS.dot) + "</svg>";
  }

  /* ---------------- 主题 ---------------- */
  function contrastInk(hex) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.substr(0, 2), 16) / 255;
    var g = parseInt(h.substr(2, 2), 16) / 255;
    var b = parseInt(h.substr(4, 2), 16) / 255;
    if ([r, g, b].some(isNaN)) return "#ffffff";
    var lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.62 ? "#0b1220" : "#ffffff";
  }

  function applyTheme() {
    var t = config.theme || {};
    var root = document.documentElement;
    root.style.setProperty("--accent", t.accent || "#2563eb");
    root.style.setProperty("--accent-ink", contrastInk(t.accent || "#2563eb"));
    root.style.setProperty("--radius", (t.radius == null ? 16 : t.radius) + "px");
    root.setAttribute("data-theme", t.mode === "auto" ? (mqDark.matches ? "dark" : "light") : (t.mode || "light"));
    root.setAttribute("data-font", t.font || "sans");
    root.setAttribute("data-width", t.width || "normal");
    root.setAttribute("data-density", t.density || "comfortable");
    root.setAttribute("data-motion", t.motion === false ? "off" : "on");
    document.title = (config.meta && config.meta.title) || "经营案例分析";
  }

  mqDark.addEventListener("change", function () {
    if ((config.theme || {}).mode === "auto") applyTheme();
  });

  /* ---------------- 区块渲染 ---------------- */
  function head(c, id, num) {
    return '<header class="sec-head reveal">' +
      '<div class="sec-meta"><span class="sec-num">' + esc(num) + "</span>" +
      (c.kicker ? '<span class="sec-kicker" data-edit="content.' + id + '.kicker">' + esc(c.kicker) + "</span>" : "") +
      "</div>" +
      '<h2 data-edit="content.' + id + '.title">' + esc(c.title || "") + "</h2>" +
      (c.desc ? '<p data-edit="content.' + id + '.desc" data-multiline>' + esc(c.desc) + "</p>" : "") +
      "</header>";
  }

  function hero(c) {
    var tags = (c.tags || []).map(function (t, i) {
      return '<span class="tag" data-edit="content.hero.tags.' + i + '">' + esc(t) + "</span>";
    }).join("");

    var hl = (c.highlights || []).map(function (h, i) {
      return '<li><span class="hc-k" data-edit="content.hero.highlights.' + i + '.k">' + esc(h.k) + "</span>" +
        '<span class="hc-v" data-edit="content.hero.highlights.' + i + '.v">' + esc(h.v) + "</span></li>";
    }).join("");

    return '<section class="hero" id="sec-hero"><div class="wrap"><div class="hero-grid">' +
      '<div class="hero-copy">' +
        '<span class="badge"><i class="dot"></i><span data-edit="content.hero.badge">' + esc(c.badge || "") + "</span></span>" +
        '<h1><span data-edit="content.hero.title">' + esc(c.title || "") + "</span>" +
        '<span class="grad" data-edit="content.hero.titleAccent">' + esc(c.titleAccent || "") + "</span></h1>" +
        '<p class="lede" data-edit="content.hero.desc" data-multiline>' + esc(c.desc || "") + "</p>" +
        (tags ? '<div class="hero-tags">' + tags + "</div>" : "") +
        '<div class="hero-cta">' +
          '<a class="btn btn-primary" href="#sec-kpi" data-edit="content.hero.ctaPrimary">' + esc(c.ctaPrimary || "开始阅读") + "</a>" +
          '<button class="btn btn-ghost" id="hero-settings" type="button" data-edit="content.hero.ctaSecondary">' + esc(c.ctaSecondary || "自定义此页") + "</button>" +
        "</div>" +
      "</div>" +
      '<aside class="hero-card">' +
        '<div class="hc-head"><span class="hc-dot"></span><span>关键节点</span></div>' +
        '<ul class="hc-list">' + hl + "</ul>" +
        (c.cardFoot ? '<div class="hc-foot" data-edit="content.hero.cardFoot">' + esc(c.cardFoot) + "</div>" : "") +
      "</aside>" +
      "</div></div></section>";
  }

  function kpi(c, num) {
    var items = (c.items || []).map(function (it, i) {
      var p = "content.kpi.items." + i + ".";
      var tone = it.tone === "down" ? "down" : it.tone === "flat" ? "flat" : "up";
      return '<div class="kpi-card card reveal">' +
        '<div class="kpi-label" data-edit="' + p + 'label">' + esc(it.label) + "</div>" +
        '<div class="kpi-value"><span data-edit="' + p + 'value">' + esc(it.value) + "</span>" +
        (it.unit ? '<span class="kpi-unit" data-edit="' + p + 'unit">' + esc(it.unit) + "</span>" : "") + "</div>" +
        (it.delta ? '<div class="kpi-delta ' + tone + '"><span class="tri">' + (tone === "down" ? "▼" : "▲") + "</span>" +
          '<span data-edit="' + p + 'delta">' + esc(it.delta) + "</span></div>" : "") +
        "</div>";
    }).join("");

    return '<section class="section" id="sec-kpi"><div class="wrap">' + head(c, "kpi", num) +
      '<div class="kpi-grid">' + items + "</div>" +
      (c.note ? '<p class="note" data-edit="content.kpi.note">' + esc(c.note) + "</p>" : "") +
      "</div></section>";
  }

  function model(c, num) {
    var items = (c.items || []).map(function (it, i) {
      return '<article class="model-card card reveal">' +
        '<span class="mc-index">0' + (i + 1) + "</span>" +
        '<div class="mc-icon">' + icon(it.icon) + "</div>" +
        '<h3 data-edit="content.model.items.' + i + '.title">' + esc(it.title) + "</h3>" +
        '<p data-edit="content.model.items.' + i + '.text" data-multiline>' + esc(it.text) + "</p>" +
        "</article>";
    }).join("");

    return '<section class="section" id="sec-model"><div class="wrap">' + head(c, "model", num) +
      '<div class="model-grid">' + items + "</div></div></section>";
  }

  function timeline(c, num) {
    var items = (c.items || []).map(function (it, i) {
      return '<li class="tl-item reveal" data-tone="' + esc(it.tone || "normal") + '">' +
        '<span class="tl-year" data-edit="content.timeline.items.' + i + '.year">' + esc(it.year) + "</span>" +
        '<span class="tl-dot"></span>' +
        '<div class="tl-body"><h3 data-edit="content.timeline.items.' + i + '.title">' + esc(it.title) + "</h3>" +
        '<p data-edit="content.timeline.items.' + i + '.text" data-multiline>' + esc(it.text) + "</p></div>" +
        "</li>";
    }).join("");

    return '<section class="section" id="sec-timeline"><div class="wrap">' + head(c, "timeline", num) +
      '<ol class="timeline">' + items + "</ol></div></section>";
  }

  function finance(c, num) {
    var charts = (c.charts || []).map(function (ch, i) {
      var span = ch.type === "bar" ? "2" : "1";
      return '<figure class="chart-card card reveal" data-span="' + span + '">' +
        '<figcaption><h3 data-edit="content.finance.charts.' + i + '.title">' + esc(ch.title) + "</h3>" +
        '<p data-edit="content.finance.charts.' + i + '.desc">' + esc(ch.desc || "") + "</p>" +
        (ch.unit ? '<span class="chart-unit">单位：' + esc(ch.unit) + "</span>" : "") +
        "</figcaption>" +
        '<div class="chart-canvas" id="chart-fin-' + i + '"></div>' +
        "</figure>";
    }).join("");

    return '<section class="section" id="sec-finance"><div class="wrap">' + head(c, "finance", num) +
      '<div class="chart-grid">' + charts + "</div>" +
      (c.note ? '<p class="note" data-edit="content.finance.note">' + esc(c.note) + "</p>" : "") +
      "</div></section>";
  }

  function compare(c, num) {
    var t = c.table || { headers: [], rows: [] };
    var thead = (t.headers || []).map(function (h, i) {
      return '<th scope="col" class="' + (i === 1 ? "hl" : "") + '" data-edit="content.compare.table.headers.' + i + '">' + esc(h) + "</th>";
    }).join("");

    var tbody = (t.rows || []).map(function (row, ri) {
      var cells = (row || []).map(function (cell, ci) {
        if (ci === 0) return '<th scope="row" data-edit="content.compare.table.rows.' + ri + '.0">' + esc(cell) + "</th>";
        return '<td class="' + (ci === 1 ? "hl" : "") + '" data-edit="content.compare.table.rows.' + ri + "." + ci + '">' + esc(cell) + "</td>";
      }).join("");
      return "<tr>" + cells + "</tr>";
    }).join("");

    return '<section class="section" id="sec-compare"><div class="wrap">' + head(c, "compare", num) +
      '<div class="table-wrap card"><table class="cmp"><thead><tr>' + thead + "</tr></thead><tbody>" + tbody + "</tbody></table></div>" +
      (c.note ? '<p class="note" data-edit="content.compare.note">' + esc(c.note) + "</p>" : "") +
      "</div></section>";
  }

  function swot(c, num) {
    var order = [
      { k: "s", tag: "S", name: "优势 Strengths" },
      { k: "w", tag: "W", name: "劣势 Weaknesses" },
      { k: "o", tag: "O", name: "机会 Opportunities" },
      { k: "t", tag: "T", name: "威胁 Threats" }
    ];
    var cards = order.map(function (o) {
      var list = (c.items && c.items[o.k]) || [];
      var lis = list.map(function (txt, i) {
        return '<li data-edit="content.swot.items.' + o.k + "." + i + '" data-multiline>' + esc(txt) + "</li>";
      }).join("");
      return '<div class="swot-card card reveal" data-tone="' + o.k + '">' +
        '<div class="swot-h"><span class="swot-tag">' + o.tag + "</span><span>" + esc(o.name) + "</span></div>" +
        "<ul>" + lis + "</ul></div>";
    }).join("");

    return '<section class="section" id="sec-swot"><div class="wrap">' + head(c, "swot", num) +
      '<div class="swot-grid">' + cards + "</div></div></section>";
  }

  function risk(c, num) {
    var items = (c.items || []).map(function (it, i) {
      return '<li class="risk-item card reveal" data-level="' + esc(it.level || "中") + '">' +
        '<span class="risk-level">' + esc(it.level || "中") + "</span>" +
        '<div class="risk-body"><h3 data-edit="content.risk.items.' + i + '.title">' + esc(it.title) + "</h3>" +
        '<p data-edit="content.risk.items.' + i + '.text" data-multiline>' + esc(it.text) + "</p></div></li>";
    }).join("");

    return '<section class="section" id="sec-risk"><div class="wrap">' + head(c, "risk", num) +
      '<ul class="risk-list">' + items + "</ul></div></section>";
  }

  function takeaway(c, num) {
    var items = (c.items || []).map(function (txt, i) {
      return '<li class="tk-item reveal"><span class="tk-num">' + ("0" + (i + 1)).slice(-2) + "</span>" +
        '<p data-edit="content.takeaway.items.' + i + '" data-multiline>' + esc(txt) + "</p></li>";
    }).join("");

    return '<section class="section" id="sec-takeaway"><div class="wrap">' + head(c, "takeaway", num) +
      '<ol class="tk-list">' + items + "</ol>" +
      (c.closing ? '<blockquote class="closing reveal" data-edit="content.takeaway.closing" data-multiline>' + esc(c.closing) + "</blockquote>" : "") +
      "</div></section>";
  }

  var RENDERERS = { hero: hero, kpi: kpi, model: model, timeline: timeline, finance: finance, compare: compare, swot: swot, risk: risk, takeaway: takeaway };

  /* ---------------- 页面装配 ---------------- */
  function enabledModules() {
    return (config.modules || []).filter(function (m) { return m.enabled; });
  }

  function render() {
    var mods = enabledModules();
    var n = 0;
    var html = mods.map(function (m) {
      var c = (config.content && config.content[m.id]) || {};
      var fn = RENDERERS[m.id];
      if (!fn) return "";
      var num = "";
      if (m.id !== "hero") { n += 1; num = ("0" + n).slice(-2); }
      return fn(c, num);
    }).join("");

    $("#main").innerHTML = html;
    $("#site-footer").innerHTML = footerHTML();
    renderNav(mods);
    renderToc(mods);
    mountCharts();
    applyTheme();
    bindReveal();
    bindSections();
    if (editMode) setEdit(true);
  }

  function footerHTML() {
    var m = config.meta || {};
    return '<div class="wrap foot-inner">' +
      '<div class="foot-main">' +
        '<div class="foot-brand"><span class="brand-mark" aria-hidden="true"></span>' +
        '<span data-edit="meta.brand">' + esc(m.brand || "") + "</span></div>" +
        (m.footerNote ? '<p data-edit="meta.footerNote" data-multiline>' + esc(m.footerNote) + "</p>" : "") +
        (m.disclaimer ? '<p class="foot-fine" data-edit="meta.disclaimer" data-multiline>' + esc(m.disclaimer) + "</p>" : "") +
      "</div>" +
      '<div class="foot-links no-print">' +
        '<button class="link-btn" id="foot-settings" type="button">打开设置</button>' +
        '<button class="link-btn" id="foot-top" type="button">回到顶部 ↑</button>' +
      "</div>" +
      "</div>";
  }

  function renderNav(mods) {
    $("#nav").innerHTML = mods.map(function (m) {
      return '<a href="#sec-' + esc(m.id) + '" data-sec="' + esc(m.id) + '">' + esc(m.label) + "</a>";
    }).join("");
  }

  function renderToc(mods) {
    var toc = $("#toc");
    var show = !config.meta || config.meta.showToc !== false;
    if (!show || mods.length < 2) { toc.innerHTML = ""; toc.hidden = true; return; }
    toc.hidden = false;
    toc.innerHTML = mods.map(function (m) {
      return '<a class="toc-item" href="#sec-' + esc(m.id) + '" data-sec="' + esc(m.id) + '"><i></i><span>' + esc(m.label) + "</span></a>";
    }).join("");
  }

  function mountCharts() {
    var f = config.content && config.content.finance;
    if (!f || !Array.isArray(f.charts) || !window.Charts) return;
    f.charts.forEach(function (spec, i) {
      var el = document.getElementById("chart-fin-" + i);
      if (!el) return;
      try {
        if (spec.type === "bar") window.Charts.bar(el, spec);
        else if (spec.type === "line") window.Charts.line(el, spec);
        else if (spec.type === "donut") window.Charts.donut(el, spec);
      } catch (err) {
        el.textContent = "图表渲染失败";
        if (window.console) console.error(err);
      }
    });
  }

  function bindReveal() {
    var items = $$(".reveal");
    if (config.theme && config.theme.motion === false) {
      items.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    revealCheck();
  }

  /* 用位置判断代替 IntersectionObserver：更可预测，打印/截图也不会空白 */
  var revealQueued = false;
  function revealCheck() {
    revealQueued = false;
    var vh = window.innerHeight || 800;
    var items = $$(".reveal:not(.in)");
    for (var i = 0; i < items.length; i++) {
      var r = items[i].getBoundingClientRect();
      if (r.top < vh * 0.95 && r.bottom > -20) items[i].classList.add("in");
    }
  }
  function queueReveal() {
    if (revealQueued) return;
    revealQueued = true;
    window.requestAnimationFrame(revealCheck);
  }

  function bindSections() {
    if (sectionIO) sectionIO.disconnect();
    var secs = $$("main .section, main .hero");
    if (!("IntersectionObserver" in window)) return;
    sectionIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = en.target.id.replace(/^sec-/, "");
        $$("[data-sec]").forEach(function (a) {
          a.classList.toggle("active", a.getAttribute("data-sec") === id);
        });
      });
    }, { rootMargin: "-42% 0px -52% 0px", threshold: 0 });
    secs.forEach(function (s) { sectionIO.observe(s); });
  }

  /* ---------------- 滚动进度 ---------------- */
  var ticking = false;
  function onScroll() {
    queueReveal();
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, h.scrollTop / max)) : 0;
      var bar = $("#progress");
      if (bar) bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
      ticking = false;
    });
  }

  /* ---------------- 编辑模式 ---------------- */
  function setEdit(on) {
    editMode = !!on;
    document.body.classList.toggle("is-editing", editMode);
    $$("[data-edit]").forEach(function (el) {
      if (editMode) {
        el.setAttribute("contenteditable", "true");
        el.setAttribute("spellcheck", "false");
      } else {
        el.removeAttribute("contenteditable");
      }
    });
    var bar = $("#editbar");
    if (bar) bar.hidden = !editMode;
    var top = $("#btn-edit-top");
    if (top) top.setAttribute("aria-pressed", String(editMode));
    var panelBtn = $("#btn-edit-panel");
    if (panelBtn) panelBtn.textContent = editMode ? "关闭编辑模式" : "开启编辑模式";
  }

  document.addEventListener("focusout", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-edit]") : null;
    if (!el || !editMode) return;
    var path = el.getAttribute("data-edit");
    if (!path) return;
    var val = (el.innerText || "").replace(/\s+$/, "");
    if (getPath(config, path) !== val) {
      setPath(config, path, val);
      saveSoon();
    }
  });

  document.addEventListener("keydown", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-edit]") : null;
    if (el && editMode) {
      if (e.key === "Enter" && !el.hasAttribute("data-multiline")) { e.preventDefault(); el.blur(); return; }
      if (e.key === "Escape") { el.blur(); return; }
    }
    if (e.key === "Escape") {
      if ($("#drawer").classList.contains("open")) closeDrawer();
    }
  });

  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href^='#']") : null;
    if (a && editMode) e.preventDefault();
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest("#foot-settings") || t.closest("#hero-settings")) { e.preventDefault(); openDrawer("look"); }
    if (t.closest("#foot-top")) { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }, true);

  /* ---------------- 设置面板 ---------------- */
  var drawer = $("#drawer");
  var scrim = $("#scrim");

  function openDrawer(tab) {
    renderModList();
    syncControls();
    drawer.classList.add("open");
    scrim.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
    if (tab) switchTab(tab);
    drawer.focus({ preventScroll: true });
  }
  function closeDrawer() {
    drawer.classList.remove("open");
    scrim.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
  }
  function switchTab(name) {
    $$(".tab").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-tab") === name); });
    $$(".tab-panel").forEach(function (p) { p.classList.toggle("active", p.getAttribute("data-panel") === name); });
  }

  function renderSwatches() {
    var box = $("#swatches");
    if (!box) return;
    box.innerHTML = PRESET_COLORS.map(function (c) {
      return '<button type="button" class="swatch" data-color="' + c + '" style="--sw:' + c + '" aria-label="主题色 ' + c + '"></button>';
    }).join("");
  }

  function renderModList() {
    var ul = $("#mod-list");
    if (!ul) return;
    var mods = config.modules || [];
    ul.innerHTML = mods.map(function (m, i) {
      return '<li class="mod-row" data-idx="' + i + '">' +
        '<label class="mod-name"><input type="checkbox" data-act="toggle" ' + (m.enabled ? "checked" : "") + " />" +
        "<span>" + esc(m.label) + "</span></label>" +
        '<span class="mod-moves">' +
          '<button type="button" class="icon-btn sm" data-act="up" ' + (i === 0 ? "disabled" : "") + ' aria-label="上移">' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button>' +
          '<button type="button" class="icon-btn sm" data-act="down" ' + (i === mods.length - 1 ? "disabled" : "") + ' aria-label="下移">' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg></button>' +
        "</span></li>";
    }).join("");
  }

  function syncControls() {
    $$(".segmented").forEach(function (seg) {
      var key = seg.getAttribute("data-key");
      var val = String(getPath(config, key));
      $$("button", seg).forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-val") === val); });
    });
    $$("[data-key]").forEach(function (el) {
      if (el.classList.contains("segmented")) return;
      var key = el.getAttribute("data-key");
      var v = getPath(config, key);
      if (el.type === "checkbox") el.checked = !!v;
      else if (el.type === "range") { el.value = v; }
      else el.value = v == null ? "" : v;
    });
    var out = $("#radius-out");
    if (out) out.textContent = (config.theme && config.theme.radius != null ? config.theme.radius : 16) + "px";
    $$(".swatch").forEach(function (b) {
      b.classList.toggle("active", (b.getAttribute("data-color") || "").toLowerCase() === String((config.theme || {}).accent || "").toLowerCase());
    });
  }

  function toast(msg) {
    var t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  /* ---------------- 导出 / 导入 / 重置 ---------------- */
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function exportConfig() {
    try {
      download("site-config.json", JSON.stringify(config, null, 2));
      toast("已导出 site-config.json");
    } catch (e) {
      toast("导出失败，浏览器可能限制下载");
    }
  }

  /* 把「面板里改过的内容」固化成可以直接上传的 config.js */
  function exportConfigJs() {
    try {
      var text = "/* 由页面设置面板导出：当前全部设置与文字 */\n" +
        "window.SITE_CONFIG = " + JSON.stringify(config, null, 2) + ";\n";
      download("config.js", text, "text/javascript;charset=utf-8");
      toast("已下载 config.js，覆盖 js/config.js 后即可上传");
    } catch (e) {
      toast("导出失败，浏览器可能限制下载");
    }
  }

  function importConfig(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        if (!isObj(data)) throw new Error("bad");
        config = merge(clone(DEFAULTS), data);
        save();
        render();
        renderModList();
        syncControls();
        toast("配置已导入");
      } catch (e) {
        toast("导入失败：文件不是有效的 JSON 配置");
      }
    };
    reader.readAsText(file);
  }

  function resetConfig() {
    if (!window.confirm("确定要清除本机保存的所有修改，恢复 config.js 的初始状态吗？")) return;
    try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    config = clone(DEFAULTS);
    save();
    render();
    renderModList();
    syncControls();
    toast("已恢复默认设置");
  }

  /* ---------------- 绑定 ---------------- */
  function bindStatic() {
    $("#btn-settings").addEventListener("click", function () { openDrawer("look"); });
    $("#drawer-close").addEventListener("click", closeDrawer);
    scrim.addEventListener("click", closeDrawer);

    $$(".tab").forEach(function (b) {
      b.addEventListener("click", function () { switchTab(b.getAttribute("data-tab")); });
    });

    $("#btn-edit-top").addEventListener("click", function () { setEdit(!editMode); });
    $("#editbar-done").addEventListener("click", function () { setEdit(false); });
    var panelBtn = $("#btn-edit-panel");
    if (panelBtn) panelBtn.addEventListener("click", function () { setEdit(!editMode); closeDrawer(); });

    /* 分段按钮 */
    $$(".segmented").forEach(function (seg) {
      seg.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-val]");
        if (!btn) return;
        setPath(config, seg.getAttribute("data-key"), btn.getAttribute("data-val"));
        applyTheme();
        syncControls();
        if (seg.getAttribute("data-key") === "theme.motion") bindReveal();
        saveSoon();
      });
    });

    /* 开关 / 滑杆 / 取色器 */
    $$("[data-key]").forEach(function (el) {
      if (el.classList.contains("segmented") || el.classList.contains("swatch")) return;
      var key = el.getAttribute("data-key");
      var evt = (el.type === "range" || el.type === "color") ? "input" : "change";
      el.addEventListener(evt, function () {
        var v = el.type === "checkbox" ? el.checked : el.value;
        if (el.type === "range") v = Number(v);
        setPath(config, key, v);
        if (key === "theme.radius") { var out = $("#radius-out"); if (out) out.textContent = v + "px"; }
        applyTheme();
        syncControls();
        if (key === "meta.showToc") renderToc(enabledModules());
        if (key === "theme.motion") bindReveal();
        saveSoon();
      });
    });

    /* 预设色 */
    $("#swatches").addEventListener("click", function (e) {
      var b = e.target.closest(".swatch");
      if (!b) return;
      setPath(config, "theme.accent", b.getAttribute("data-color"));
      applyTheme();
      syncControls();
      saveSoon();
    });

    /* 模块列表 */
    $("#mod-list").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-act]");
      if (!btn) return;
      var li = btn.closest("[data-idx]");
      var i = Number(li.getAttribute("data-idx"));
      var act = btn.getAttribute("data-act");
      var mods = config.modules;
      if (act === "up" && i > 0) { var a = mods[i - 1]; mods[i - 1] = mods[i]; mods[i] = a; }
      if (act === "down" && i < mods.length - 1) { var b = mods[i + 1]; mods[i + 1] = mods[i]; mods[i] = b; }
      renderModList();
      render();
      saveSoon();
    });

    $("#mod-list").addEventListener("change", function (e) {
      var cb = e.target.closest("input[data-act='toggle']");
      if (!cb) return;
      var i = Number(cb.closest("[data-idx]").getAttribute("data-idx"));
      config.modules[i].enabled = cb.checked;
      if (enabledModules().length === 0) {
        config.modules[i].enabled = true;
        cb.checked = true;
        toast("至少保留一个模块");
        return;
      }
      render();
      renderModList();
      saveSoon();
    });

    /* 配置操作 */
    $("#btn-export").addEventListener("click", exportConfig);
    $("#btn-export-js").addEventListener("click", exportConfigJs);
    $("#btn-import").addEventListener("click", function () { $("#file-input").click(); });
    $("#file-input").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) importConfig(f);
      e.target.value = "";
    });
    $("#btn-reset").addEventListener("click", resetConfig);

    /* 键盘 */
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && drawer.classList.contains("open")) closeDrawer();
    });

    window.addEventListener("scroll", onScroll, { passive: true });
    var rt = null;
    window.addEventListener("resize", function () {
      onScroll();
      clearTimeout(rt);
      rt = setTimeout(mountCharts, 180);
    });
  }

  function checkStorage() {
    var el = $("#store-status");
    if (!el) return;
    var ok = true;
    try {
      window.localStorage.setItem("__probe__", "1");
      window.localStorage.removeItem("__probe__");
    } catch (e) {
      ok = false;
    }
    el.textContent = ok
      ? "本地存储可用，改动会自动保存到当前浏览器（换浏览器或清理缓存会丢失，建议定期导出备份）。"
      : "本地存储不可用（可能被浏览器隐私设置禁用），改动只在本次打开时生效，请用「导出配置」保存。";
  }

  /* ---------------- 访问统计 ---------------- */
  function initAnalytics() {
    var a = config.analytics || {};
    var p = String(a.provider || "").toLowerCase();
    var id = String(a.id || "").trim();
    if (!p || !id) return;
    if (navigator.doNotTrack === "1") return;

    var head = document.head || document.documentElement;
    var s;

    if (p === "baidu") {
      window._hmt = window._hmt || [];
      s = document.createElement("script");
      s.async = true;
      s.src = "https://hm.baidu.com/hm.js?" + encodeURIComponent(id);
      head.appendChild(s);
      return;
    }

    if (p === "51la" || p === "51.la") {
      s = document.createElement("script");
      s.charset = "UTF-8";
      s.id = "LA_COLLECT";
      s.src = "https://sdk.51.la/js-sdk-pro.min.js";
      s.onload = function () {
        if (window.LA && window.LA.init) {
          window.LA.init({ id: id, ck: String(a.ck || ""), autoTrack: true });
        }
      };
      head.appendChild(s);
      return;
    }

    if (p === "ga4" || p === "google") {
      s = document.createElement("script");
      s.async = true;
      s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
      head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", id);
      return;
    }

    if (p === "goatcounter") {
      s = document.createElement("script");
      s.async = true;
      s.setAttribute("data-goatcounter", "https://" + id + ".goatcounter.com/count");
      s.src = "https://gc.zgo.at/count.js";
      head.appendChild(s);
      return;
    }

    if (p === "umami") {
      s = document.createElement("script");
      s.async = true;
      s.defer = true;
      s.setAttribute("data-website-id", id);
      s.src = a.src || "https://cloud.umami.is/script.js";
      head.appendChild(s);
    }
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    applyTheme();
    renderSwatches();
    render();
    bindStatic();
    checkStorage();
    initAnalytics();
    onScroll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
