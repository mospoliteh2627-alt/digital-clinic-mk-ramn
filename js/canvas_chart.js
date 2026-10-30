/* ============================================================
   МИС «Цифровая клиника МК РАМН»
   js/canvas_chart.js — построение графика температурного листа 004/у
   на HTML5 Canvas: температура, пульс, артериальное давление.
   ============================================================ */
(function (global) {
  'use strict';

  var COLORS = {
    grid: '#e3edf6',
    gridStrong: '#c3d7e8',
    axis: '#7c93a8',
    text: '#5b7186',
    textStrong: '#12263a',
    temp: '#0b63b4',
    tempFill: 'rgba(30, 155, 233, 0.12)',
    pulse: '#c62828',
    pulseFill: 'rgba(198, 40, 40, 0.08)',
    sys: '#1b7a4b',
    dia: '#7b5cc7',
    critical: '#c62828',
    warning: '#a86400',
    normalBand: 'rgba(27, 122, 75, 0.06)'
  };

  var MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  function num(value) {
    if (value === null || value === undefined) return NaN;
    var v = String(value).replace(',', '.').replace(/[^\d.\-]/g, '');
    if (v === '' || v === '.' || v === '-') return NaN;
    var n = Number(v);
    return isFinite(n) ? n : NaN;
  }

  function parseAd(value) {
    var parts = String(value || '').split('/');
    return {
      sys: num(parts[0]),
      dia: num(parts[1])
    };
  }

  function dayLabel(dateStr, index) {
    if (!dateStr) return 'Д' + (index + 1);
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return 'Д' + (index + 1);
    return d.getDate() + '.' + (d.getMonth() + 1);
  }

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function TempChart(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.days = [];
    this.dpr = 1;
    this.width = 0;
    this.height = 0;
    this._onResize = this.resize.bind(this);
    this._observer = null;

    if (global.ResizeObserver) {
      this._observer = new ResizeObserver(this._onResize);
      this._observer.observe(canvas.parentElement || canvas);
    } else {
      global.addEventListener('resize', this._onResize);
    }
    this.resize();
  }

  TempChart.prototype.destroy = function () {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    } else {
      global.removeEventListener('resize', this._onResize);
    }
  };

  TempChart.prototype.setData = function (days) {
    this.days = Array.isArray(days) ? days : [];
    this.draw();
  };

  TempChart.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    var parent = this.canvas.parentElement;
    var w = rect.width || (parent ? parent.clientWidth : 0) || 320;
    var h = rect.height || (parent ? parent.clientHeight : 0) || 420;
    this.dpr = Math.min(global.devicePixelRatio || 1, 2);
    if (this.width === w && this.height === h &&
        this.canvas.width === Math.round(w * this.dpr)) {
      return;
    }
    this.width = w;
    this.height = h;
    this.canvas.width = Math.max(1, Math.round(w * this.dpr));
    this.canvas.height = Math.max(1, Math.round(h * this.dpr));
    this.draw();
  };

  TempChart.prototype.draw = function () {
    var ctx = this.ctx;
    var W = this.width;
    var H = this.height;
    if (!W || !H) return;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    var days = this.days || [];
    var pad = {
      left: W < 420 ? 38 : 46,
      right: W < 420 ? 14 : 22,
      top: 18,
      bottom: 34
    };
    var plotW = Math.max(10, W - pad.left - pad.right);
    var plotH = Math.max(10, H - pad.top - pad.bottom);

    var gap = 10;
    var tempH = Math.round(plotH * 0.52);
    var pulseH = Math.round(plotH * 0.23);
    var adH = plotH - tempH - pulseH - gap * 2;

    var panels = {
      temp: { y: pad.top, h: tempH, min: 34, max: 42, ticks: [34, 35, 36, 37, 38, 39, 40, 41, 42] },
      pulse: { y: pad.top + tempH + gap, h: pulseH, min: 40, max: 160, ticks: [40, 60, 80, 100, 120, 140, 160] },
      ad: { y: pad.top + tempH + pulseH + gap * 2, h: adH, min: 40, max: 200, ticks: [40, 80, 120, 160, 200] }
    };

    var self = this;

    function xAt(index) {
      if (days.length <= 1) return pad.left + plotW / 2;
      return pad.left + (index / (days.length - 1)) * plotW;
    }

    function yAt(panel, value) {
      var p = panels[panel];
      var clamped = Math.max(p.min, Math.min(p.max, value));
      return p.y + p.h - ((clamped - p.min) / (p.max - p.min)) * p.h;
    }

    /* ---------- фон и сетка ---------- */
    Object.keys(panels).forEach(function (key) {
      var p = panels[key];
      ctx.fillStyle = key === 'temp' ? '#fcfdff' : '#ffffff';
      ctx.fillRect(pad.left, p.y, plotW, p.h);

      ctx.font = '10px "Inter", "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      p.ticks.forEach(function (tick) {
        var y = yAt(key, tick);
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, Math.round(y) + 0.5);
        ctx.lineTo(pad.left + plotW, Math.round(y) + 0.5);
        ctx.stroke();

        ctx.fillStyle = COLORS.text;
        ctx.fillText(String(tick), pad.left - 7, y);
      });

      ctx.strokeStyle = COLORS.gridStrong;
      ctx.lineWidth = 1;
      ctx.strokeRect(pad.left + 0.5, p.y + 0.5, plotW - 1, p.h - 1);
    });

    /* ---------- вертикальная сетка по дням ---------- */
    var labelStep = 1;
    if (days.length > 10 && plotW < 640) labelStep = 2;
    if (days.length > 14) labelStep = Math.ceil(days.length / 12);

    for (var i = 0; i < days.length; i += 1) {
      var x = xAt(i);
      ctx.strokeStyle = i === 0 || i === days.length - 1 ? COLORS.gridStrong : COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, pad.top);
      ctx.lineTo(Math.round(x) + 0.5, pad.top + plotH);
      ctx.stroke();

      if (i % labelStep === 0 || i === days.length - 1) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = COLORS.textStrong;
        ctx.font = '600 10px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.fillText(dayLabel(days[i].date, i), x, pad.top + plotH + 8);
        ctx.fillStyle = COLORS.text;
        ctx.font = '9px "Inter", "Segoe UI", Arial, sans-serif';
        if (days[i].date) {
          var d = new Date(days[i].date + 'T00:00:00');
          if (!isNaN(d.getTime())) {
            ctx.fillText(MONTHS[d.getMonth()], x, pad.top + plotH + 20);
          }
        }
      }
    }

    if (!days.length) {
      ctx.fillStyle = COLORS.text;
      ctx.font = '13px "Inter", "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Нет данных для построения графика', pad.left + plotW / 2, pad.top + plotH / 2);
      ctx.textAlign = 'left';
      return;
    }

    /* ---------- клинические зоны ---------- */
    var tPanel = panels.temp;
    var zoneTop = yAt('temp', 42);
    var zone39 = yAt('temp', 39);
    var zone35 = yAt('temp', 35);
    ctx.fillStyle = 'rgba(198, 40, 40, 0.055)';
    ctx.fillRect(pad.left, zoneTop, plotW, zone39 - zoneTop);
    ctx.fillStyle = 'rgba(30, 155, 233, 0.055)';
    ctx.fillRect(pad.left, zone35, plotW, tPanel.y + tPanel.h - zone35);

    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(198, 40, 40, 0.55)';
    ctx.beginPath();
    ctx.moveTo(pad.left, zone39);
    ctx.lineTo(pad.left + plotW, zone39);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30, 155, 233, 0.55)';
    ctx.beginPath();
    ctx.moveTo(pad.left, zone35);
    ctx.lineTo(pad.left + plotW, zone35);
    ctx.stroke();
    ctx.restore();

    /* ---------- сбор рядов ---------- */
    var tempAm = [];
    var tempPm = [];
    var pulseAm = [];
    var pulsePm = [];
    var sys = [];
    var dia = [];

    days.forEach(function (day) {
      tempAm.push(num(day.tAm));
      tempPm.push(num(day.tPm));
      pulseAm.push(num(day.pulseAm));
      pulsePm.push(num(day.pulsePm));
      var ad1 = parseAd(day.adAm);
      var ad2 = parseAd(day.adPm);
      sys.push(isFinite(ad1.sys) ? ad1.sys : ad2.sys);
      dia.push(isFinite(ad1.dia) ? ad1.dia : ad2.dia);
    });

    function drawSeries(values, panel, color, options) {
      var opts = options || {};
      var valid = [];
      values.forEach(function (v, idx) {
        if (isFinite(v)) valid.push({ x: xAt(idx), y: yAt(panel, v), v: v, i: idx });
      });
      if (!valid.length) return;

      if (opts.area) {
        ctx.beginPath();
        ctx.moveTo(valid[0].x, panels[panel].y + panels[panel].h);
        valid.forEach(function (p) { ctx.lineTo(p.x, p.y); });
        ctx.lineTo(valid[valid.length - 1].x, panels[panel].y + panels[panel].h);
        ctx.closePath();
        var grad = ctx.createLinearGradient(0, panels[panel].y, 0, panels[panel].y + panels[panel].h);
        grad.addColorStop(0, opts.area);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.lineWidth = opts.width || 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      if (opts.dashed) ctx.setLineDash([5, 4]);
      valid.forEach(function (p, idx) {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      valid.forEach(function (p) {
        var critical = opts.isCritical ? opts.isCritical(p.v) : false;
        ctx.beginPath();
        ctx.arc(p.x, p.y, critical ? 4.5 : 3.2, 0, Math.PI * 2);
        ctx.fillStyle = critical ? COLORS.critical : color;
        ctx.fill();
        if (critical) {
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
        }
      });

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.font = '600 10px "Inter", "Segoe UI", Arial, sans-serif';
      if (opts.label) {
        ctx.fillText(opts.label, pad.left + plotW - 4, panels[panel].y + 10);
      }
    }

    drawSeries(tempAm, 'temp', COLORS.temp, {
      width: 2.4,
      area: COLORS.tempFill,
      isCritical: function (v) { return v >= 39 || v <= 35; }
    });
    drawSeries(tempPm, 'temp', '#55b8f2', {
      width: 1.8,
      dashed: true,
      isCritical: function (v) { return v >= 39 || v <= 35; }
    });
    drawSeries(pulseAm, 'pulse', COLORS.pulse, {
      width: 1.8,
      area: COLORS.pulseFill,
      isCritical: function (v) { return v > 120 || v < 50; }
    });
    drawSeries(pulsePm, 'pulse', '#ef8a8a', { width: 1.4, dashed: true });
    drawSeries(sys, 'ad', COLORS.sys, { width: 1.8, isCritical: function (v) { return v > 180 || v < 90; } });
    drawSeries(dia, 'ad', COLORS.dia, { width: 1.4, dashed: true });

    /* ---------- подписи панелей ---------- */
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.textStrong;
    ctx.font = '700 10px "Inter", "Segoe UI", Arial, sans-serif';
    ctx.fillText('ТЕМПЕРАТУРА, °C', pad.left + 6, pad.top + 9);
    ctx.font = '700 9px "Inter", "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText('ПУЛЬС, уд/мин', pad.left + 6, panels.pulse.y + 9);
    ctx.fillText('АД, мм рт. ст.', pad.left + 6, panels.ad.y + 9);

    /* ---------- ось X ---------- */
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + plotH + 0.5);
    ctx.lineTo(pad.left + plotW, pad.top + plotH + 0.5);
    ctx.stroke();

    /* ---------- подсказка о критических точках ---------- */
    var criticalCount = 0;
    days.forEach(function (day) {
      [num(day.tAm), num(day.tPm)].forEach(function (v) {
        if (isFinite(v) && (v >= 39 || v <= 35)) criticalCount += 1;
      });
      var p1 = num(day.pulseAm);
      var p2 = num(day.pulsePm);
      if ((isFinite(p1) && (p1 > 120 || p1 < 50)) || (isFinite(p2) && (p2 > 120 || p2 < 50))) {
        criticalCount += 1;
      }
    });
    if (criticalCount > 0) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = COLORS.critical;
      ctx.font = '600 10px "Inter", "Segoe UI", Arial, sans-serif';
      ctx.fillText('Критических точек: ' + criticalCount, pad.left + 6, H - 4);
    }

    this.lastStats = {
      days: days.length,
      critical: criticalCount,
      tempMax: (function () {
        var vals = tempAm.concat(tempPm).filter(isFinite);
        return vals.length ? Math.max.apply(null, vals) : null;
      })(),
      tempMin: (function () {
        var vals = tempAm.concat(tempPm).filter(isFinite);
        return vals.length ? Math.min.apply(null, vals) : null;
      })()
    };
  };

  TempChart.prototype.getStats = function () {
    return this.lastStats || { days: 0, critical: 0, tempMax: null, tempMin: null };
  };

  global.TempChart = TempChart;
  global.ClinicChart = { TempChart: TempChart, colors: COLORS };
})(window);
