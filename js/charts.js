/* ============================================================
 * charts.js — 无依赖的 SVG 图表（柱状 / 折线 / 环形）
 * 颜色全部走 CSS 变量，所以换主题色、切深色模式会自动跟随。
 * ============================================================ */
(function (global) {
  "use strict";

  var uid = 0;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function num(v) {
    var n = Number(v) || 0;
    if (Math.abs(n - Math.round(n)) < 1e-9) return Math.round(n).toLocaleString("zh-CN");
    var parts = n.toFixed(1).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }

  /* 按容器实际宽度出图，保证字号不被缩放 */
  function dims(el, ratio) {
    var W = Math.max(300, Math.round(el.clientWidth || 680));
    var H = Math.round(Math.min(360, Math.max(238, W * (ratio || 0.5))));
    return { W: W, H: H };
  }

  /* 把最大值切成 4 段，得到「好看」的刻度 */
  function scale(maxValue, ticks) {
    ticks = ticks || 4;
    var raw = Math.max(maxValue, 1) / ticks;
    var pow = Math.pow(10, Math.floor(Math.log10(raw)));
    var f = raw / pow;
    var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
    return { step: step, max: step * ticks };
  }

  function bar(el, spec) {
    var labels = spec.labels || [];
    var values = (spec.values || []).map(Number);
    if (!labels.length) { el.innerHTML = ""; return; }

    var id = "c" + (++uid);
    var sc = scale(Math.max.apply(null, values.concat([1])));
    var d = dims(el, 0.42);
    var W = d.W, H = d.H;
    var m = { t: 24, r: 10, b: 46, l: 56 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var band = iw / labels.length;
    var bw = Math.min(76, band * 0.46);
    var y = function (v) { return m.t + ih * (1 - v / sc.max); };

    var s = "";
    s += '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(spec.title || "柱状图") + '">';
    s += '<defs><linearGradient id="g' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" style="stop-color:var(--accent);stop-opacity:.95"/>' +
      '<stop offset="1" style="stop-color:var(--accent);stop-opacity:.5"/></linearGradient></defs>';

    for (var i = 0; i <= 4; i++) {
      var v = sc.step * i;
      var yy = y(v);
      s += '<line x1="' + m.l + '" y1="' + yy + '" x2="' + (W - m.r) + '" y2="' + yy +
        '" stroke-width="1" style="stroke:var(--border)"' + (i === 0 ? "" : ' stroke-dasharray="3 5"') + "/>";
      s += '<text x="' + (m.l - 12) + '" y="' + (yy + 4) + '" text-anchor="end" class="ct">' + num(v) + "</text>";
    }

    labels.forEach(function (lb, i) {
      var cx = m.l + band * (i + 0.5);
      var h = Math.max(2, ih * (values[i] / sc.max));
      var top = y(values[i]);
      s += '<rect x="' + (cx - bw / 2) + '" y="' + top + '" width="' + bw + '" height="' + h +
        '" rx="7" fill="url(#g' + id + ')" class="cb">' +
        "<title>" + esc(lb) + "：" + num(values[i]) + esc(spec.unit || "") + "</title></rect>";
      s += '<text x="' + cx + '" y="' + (top - 10) + '" text-anchor="middle" class="cv">' + num(values[i]) + "</text>";
      s += '<text x="' + cx + '" y="' + (H - 18) + '" text-anchor="middle" class="cx">' + esc(lb) + "</text>";
    });

    s += "</svg>";
    el.innerHTML = s;
  }

  function line(el, spec) {
    var labels = spec.labels || [];
    var values = (spec.values || []).map(Number);
    if (!labels.length) { el.innerHTML = ""; return; }

    var id = "c" + (++uid);
    var sc = scale(Math.max.apply(null, values.concat([1])));
    var d = dims(el, 0.56);
    var W = d.W, H = d.H;
    var m = { t: 28, r: 26, b: 46, l: 64 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var x = function (i) { return labels.length === 1 ? m.l + iw / 2 : m.l + (iw / (labels.length - 1)) * i; };
    var y = function (v) { return m.t + ih * (1 - v / sc.max); };

    var pts = values.map(function (v, i) { return [x(i), y(v)]; });
    var linePath = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
    var areaPath = linePath + " L" + pts[pts.length - 1][0].toFixed(1) + " " + (m.t + ih) +
      " L" + pts[0][0].toFixed(1) + " " + (m.t + ih) + " Z";

    var s = "";
    s += '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(spec.title || "折线图") + '">';
    s += '<defs><linearGradient id="a' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" style="stop-color:var(--accent);stop-opacity:.26"/>' +
      '<stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>';

    for (var i = 0; i <= 4; i++) {
      var v = sc.step * i;
      var yy = y(v);
      s += '<line x1="' + m.l + '" y1="' + yy + '" x2="' + (W - m.r) + '" y2="' + yy +
        '" stroke-width="1" style="stroke:var(--border)"' + (i === 0 ? "" : ' stroke-dasharray="3 5"') + "/>";
      s += '<text x="' + (m.l - 12) + '" y="' + (yy + 4) + '" text-anchor="end" class="ct">' + num(v) + "</text>";
    }

    s += '<path d="' + areaPath + '" fill="url(#a' + id + ')"/>';
    s += '<path d="' + linePath + '" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="stroke:var(--accent)"/>';

    pts.forEach(function (p, i) {
      s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4.5" stroke-width="2.5" style="fill:var(--surface-2);stroke:var(--accent)"/>';
      s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="14" fill="transparent" class="ch">' +
        "<title>" + esc(labels[i]) + "：" + num(values[i]) + esc(spec.unit || "") + "</title></circle>";
      s += '<text x="' + p[0] + '" y="' + (p[1] - 14) + '" text-anchor="middle" class="cv">' + num(values[i]) + "</text>";
      s += '<text x="' + p[0] + '" y="' + (H - 18) + '" text-anchor="middle" class="cx">' + esc(labels[i]) + "</text>";
    });

    s += "</svg>";
    el.innerHTML = s;
  }

  function donut(el, spec) {
    var items = spec.items || [];
    var total = items.reduce(function (a, b) { return a + (Number(b.value) || 0); }, 0) || 1;
    var R = 64, SW = 22, C = 2 * Math.PI * R, S = 190, CX = S / 2, CY = S / 2;

    var palette = [
      "var(--accent)",
      "color-mix(in srgb, var(--accent) 48%, #8b5cf6)",
      "color-mix(in srgb, var(--accent) 18%, #94a3b8)",
      "#f59e0b"
    ];

    var s = '<div class="donut-wrap"><svg viewBox="0 0 ' + S + " " + S + '" role="img" aria-label="' + esc(spec.title || "环形图") + '">';
    s += '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '" fill="none" stroke-width="' + SW + '" style="stroke:var(--border)"/>';

    var acc = 0;
    items.forEach(function (it, i) {
      var v = Number(it.value) || 0;
      var len = (v / total) * C;
      var gap = Math.min(6, len * 0.06);
      var dash = Math.max(0, len - gap);
      var color = it.color || palette[i % palette.length];
      s += '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '" fill="none" stroke-width="' + SW +
        '" stroke-dasharray="' + dash.toFixed(2) + " " + (C - dash).toFixed(2) +
        '" stroke-dashoffset="' + (-acc).toFixed(2) +
        '" transform="rotate(-90 ' + CX + " " + CY + ')" class="cd" style="stroke:' + color + '">' +
        "<title>" + esc(it.label) + "：" + num(v) + "</title></circle>";
      acc += len;
    });

    s += '<text x="' + CX + '" y="' + (CY - 4) + '" text-anchor="middle" class="cd-center">' + Math.round((items[0] ? items[0].value : 0) / total * 100) + "%</text>";
    s += '<text x="' + CX + '" y="' + (CY + 18) + '" text-anchor="middle" class="cd-sub">' + esc(items[0] ? items[0].label : "") + "</text>";
    s += "</svg>";

    s += '<ul class="legend">';
    items.forEach(function (it, i) {
      var color = it.color || palette[i % palette.length];
      s += "<li><i style=\"background:" + color + '"></i><span>' + esc(it.label) + "</span><b>" +
        Math.round((Number(it.value) || 0) / total * 100) + "%</b></li>";
    });
    s += "</ul></div>";

    el.innerHTML = s;
  }

  global.Charts = { bar: bar, line: line, donut: donut };
})(window);
