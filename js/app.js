/* ============================================================
   МИС «Цифровая клиника МК РАМН»
   js/app.js — ядро SPA: состояние, маршрутизация, формы,
   синхронизация, проверка, панель преподавателя, отчёт.
   ============================================================ */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'mkramn.clinic.work.v1';
  var SAVE_DELAY = 350;

  var state = null;
  var session = null;
  var templates = {};
  var loadedIncludes = {};
  var loadedSubforms = {};
  var currentSubform = '003-osmotr';
  var chart = null;
  var chartDebounce = null;
  var saveTimer = null;
  var stopTimer = null;
  var lastFocus = null;
  var confirmCallback = null;
  var initialised = false;

  var TAB_META = {
    reception: { crumb: 'Приёмное отделение', title: 'Журнал учёта приёма пациентов' },
    treatment: { crumb: 'Лечебное отделение', title: 'Первичный осмотр' },
    department: { crumb: 'Учёт и питание', title: 'Движение пациентов и коечного фонда' },
    cso: { crumb: 'Процедурный кабинет и ЦСО', title: 'Контроль предстерилизационной очистки' },
    teacher: { crumb: 'Панель преподавателя', title: 'Контроль ошибок и оценивание' }
  };

  var SUBFORM_META = {
    '003-osmotr': { title: 'Первичный осмотр', file: '003-osmotr' },
    '003-preop': { title: 'Предоперационный осмотр и эпикриз', file: '003-preop' },
    '003-operaciya': { title: 'Протокол операции', file: '003-operaciya' },
    '003-anesteziya': { title: 'Протокол анестезии', file: '003-anesteziya' },
    '003-reanimaciya': { title: 'Карта реанимации', file: '003-reanimaciya' },
    '003-naznacheniya': { title: 'Лист назначений', file: '003-naznacheniya' },
    '003-transfuziya': { title: 'Лист трансфузии', file: '003-transfuziya' },
    '004u': { title: 'Температурный лист', file: '004u' },
    '003-luchevaya': { title: 'Лучевая нагрузка', file: '003-luchevaya' },
    '003-vypisnoy': { title: 'Выписной эпикриз', file: '003-vypisnoy' },
    '003-dnevnik': { title: 'Дневник наблюдения', file: '003-dnevnik' },
    '003-soglasie': { title: 'Согласие на операцию', file: '003-soglasie' },
    '008u': { title: 'Журнал операций 008/у', file: '008u' }
  };

  var FORM_TO_TAB = {
    'Журнал 001/у': { tab: 'reception', card: 'form001u' },
    'Медицинская карта 003/у': { tab: 'reception', card: 'form003u' },
    'Статистическая карта 066/у': { tab: 'reception', card: 'form066u' },
    'Первичный осмотр 003/у': { tab: 'treatment', sub: '003-osmotr' },
    'Предоперационный блок': { tab: 'treatment', sub: '003-preop' },
    'Протокол операции': { tab: 'treatment', sub: '003-operaciya' },
    'Протокол анестезии': { tab: 'treatment', sub: '003-anesteziya' },
    'Карта реанимации': { tab: 'treatment', sub: '003-reanimaciya' },
    'Лист назначений': { tab: 'treatment', sub: '003-naznacheniya' },
    'Лист трансфузии': { tab: 'treatment', sub: '003-transfuziya' },
    'Температурный лист 004/у': { tab: 'treatment', sub: '004u' },
    'Лист лучевой нагрузки': { tab: 'treatment', sub: '003-luchevaya' },
    'Выписной эпикриз': { tab: 'treatment', sub: '003-vypisnoy' },
    'Лист 007/у': { tab: 'department', card: 'form007u' },
    'Порционник 1-84': { tab: 'department', card: 'form184' },
    'Журнал 366/у': { tab: 'cso', card: 'form366u' }
  };

  var GROUPS = {
    reception: ['journal001', 'card003', 'stat066'],
    treatment: ['exam', 'preop', 'operation', 'anesthesia', 'icu', 'prescriptions', 'transfusion', 'temp', 'radiation', 'discharge', 'operations008', 'diary', 'consent'],
    department: ['dept007', 'nutrition', 'summary016'],
    cso: ['cso', 'endoscopy']
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var THEME_KEY = 'mkramn.clinic.theme.v1';

  function themeSettings() {
    try {
      var saved = JSON.parse(global.localStorage.getItem(THEME_KEY) || '{}');
      return {
        theme: saved.theme === 'dark' || saved.theme === 'system' ? saved.theme : 'light',
        highContrast: !!saved.highContrast
      };
    } catch (err) {
      return { theme: 'light', highContrast: false };
    }
  }

  function resolvedTheme(settings) {
    if (settings.theme === 'system') {
      return global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return settings.theme;
  }

  function applyTheme(settings, persist) {
    var resolved = resolvedTheme(settings);
    var root = document.documentElement;
    root.dataset.theme = resolved;
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
    root.style.colorScheme = resolved === 'dark' ? 'dark' : 'light';
    var btn = $('#btnAppearance');
    if (btn) {
      var icon = settings.theme === 'system' ? 'monitor' : (resolved === 'dark' ? 'moon' : 'sun');
      btn.innerHTML = iconSvg(icon);
      btn.title = 'Оформление: ' + (settings.theme === 'system' ? 'как в системе' : resolved === 'dark' ? 'тёмная тема' : 'светлая тема') +
        (settings.highContrast ? ', высокая контрастность' : '');
    }
    var contrast = $('#highContrastToggle');
    if (contrast) contrast.checked = settings.highContrast;
    $$('input[name="themeChoice"]').forEach(function (radio) {
      radio.checked = radio.value === settings.theme;
    });
    if (persist !== false) {
      try { global.localStorage.setItem(THEME_KEY, JSON.stringify(settings)); } catch (err) { /* ignore */ }
    }
  }

  function saveTheme(settings) {
    applyTheme(settings, true);
    if (typeof recordAudit === 'function') {
      recordAudit('theme', 'Оформление', (settings.theme === 'system' ? 'системная' : settings.theme) +
        (settings.highContrast ? ', высокая контрастность' : ''));
    }
  }

  function initTheme() {
    var settings = themeSettings();
    applyTheme(settings, false);
    var btn = $('#btnAppearance');
    if (btn) {
      btn.addEventListener('click', function () {
        applyTheme(themeSettings(), false);
        openModal('modalAppearance');
      });
    }
    $$('input[name="themeChoice"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (!radio.checked) return;
        var current = themeSettings();
        current.theme = radio.value;
        saveTheme(current);
      });
    });
    var contrast = $('#highContrastToggle');
    if (contrast) {
      contrast.addEventListener('change', function () {
        var current = themeSettings();
        current.highContrast = contrast.checked;
        saveTheme(current);
      });
    }
    if (global.matchMedia) {
      var media = global.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () {
        var current = themeSettings();
        if (current.theme === 'system') applyTheme(current, false);
      };
      if (media.addEventListener) media.addEventListener('change', onChange);
      else if (media.addListener) media.addListener(onChange);
    }
  }

  function iconSvg(name, cls) {
    return '<svg class="icon ' + (cls || '') + '" aria-hidden="true"><use href="assets/icons.svg#icon-' + name + '"></use></svg>';
  }

  function setIcon(el, name) {
    if (el) el.innerHTML = iconSvg(name);
  }

  function staggerReveal(root) {
    if (!root) return;
    $$('.form-card', root).forEach(function (card, index) {
      if (card.classList.contains('reveal')) return;
      card.style.setProperty('--reveal-delay', Math.min(index, 8) * 45 + 'ms');
      card.classList.add('reveal');
    });
  }

  function animateNumber(el, target, decimals) {
    if (!el) return;
    var start = 0;
    var duration = 520;
    var startAt = performance.now();
    function frame(now) {
      var t = Math.min(1, (now - startAt) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (start + (target - start) * eased).toFixed(decimals || 2);
      if (t < 1) global.requestAnimationFrame(frame);
    }
    global.requestAnimationFrame(frame);
  }

  function clone(value) {
    if (value === null || typeof value !== 'object') return value;
    return JSON.parse(JSON.stringify(value));
  }

  function deepMerge(base, override) {
    var out = clone(base);
    if (!override || typeof override !== 'object' || Array.isArray(override)) return out;
    Object.keys(override).forEach(function (key) {
      var ov = override[key];
      if (ov && typeof ov === 'object' && !Array.isArray(ov) &&
          out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])) {
        out[key] = deepMerge(out[key], ov);
      } else {
        out[key] = clone(ov);
      }
    });
    return out;
  }

  function getPath(obj, path) {
    if (!path) return undefined;
    return path.split('.').reduce(function (acc, key) {
      if (acc === null || acc === undefined) return undefined;
      return /^\d+$/.test(key) ? acc[Number(key)] : acc[key];
    }, obj);
  }

  function setPath(obj, path, value) {
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i += 1) {
      var key = parts[i];
      var nextIsIndex = /^\d+$/.test(parts[i + 1]);
      if (cur[key] === null || cur[key] === undefined || typeof cur[key] !== 'object') {
        cur[key] = nextIsIndex ? [] : {};
      }
      cur = cur[key];
    }
    cur[parts[parts.length - 1]] = value;
    return value;
  }

  function n(value) {
    var v = Number(value);
    return isFinite(v) ? v : 0;
  }

  function todayIso() {
    var d = new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function newRow001() {
    return {
      date: todayIso(), time: '', fio: '', birth: '', sex: '', passport: '', citizenship: 'Российская Федерация',
      addressLive: '', addressStay: '', phone: '', snils: '', oms: '', delivered: '', cardNo: '',
      referralDiag: '', referralIcd: '', injuryIcd: '', alcohol: '', department: '', outcome: '', outcomeDate: '',
      outcomeTime: '', notify: '', refusalReason: '', refusalWorker: '', extra: ''
    };
  }

  function defaultState() {
    return {
      version: 1,
      user: null,
      caseId: null,
      started: false,
      doc: {
        organization: 'ФГБПОУ «Медицинский колледж» (МК РАМН), г. Москва, ул. Поликарпова, д. 12',
        ogrn: '1027700132195',
        journalStarted: '',
        journalEnded: ''
      },
      patient: {},
      j001: { selected: 0, rows: [newRow001()] },
      card003: {},
      stat066: {},
      treatment: {
        exam: {},
        preop: {},
        operation: {},
        anesthesia: { monitor: [] },
        icu: { rows: [] },
        prescriptions: { rows: [] },
        transfusion: {},
        temp: { days: [], dayNumbers: [], stayDay: [], breath: [], weight: [], fluid: [], urine: [], stool: [], bath: [], criticalNote: '' },
        radiation: { rows: [] },
        discharge: {}
      },
      dept007: { date: '', department: '', rows: [] },
      nutrition: { date: '', department: '', bedsReference: '', rows: [], signatures: {} },
      cso: { rows: [], controlMethod: '', shift: '', seniorNurse: '' },
      diary: { rows: [] },
      consent: {},
      signatures: [],
      audit: [],
      signatureValid: null,
      operations008: { started: '', ended: '', departmentCode: '', rows: [] },
      summary016: { department: '', period: '', rows: [] },
      endoscopy: { started: '', ended: '', department: '', rows: [] },
      meta: { checkedAt: null, result: null },
      ui: { tab: 'reception', subform: '003-osmotr' },
      progress: {}
    };
  }

  function normalizeState(saved) {
    var base = defaultState();
    if (!saved || typeof saved !== 'object') return base;
    var merged = deepMerge(base, saved);
    if (!Array.isArray(merged.j001.rows) || !merged.j001.rows.length) merged.j001.rows = [newRow001()];
    if (merged.j001.selected >= merged.j001.rows.length) merged.j001.selected = 0;
    if (!merged.treatment.anesthesia.monitor) merged.treatment.anesthesia.monitor = [];
    if (!merged.treatment.icu.rows) merged.treatment.icu.rows = [];
    if (!merged.treatment.prescriptions.rows) merged.treatment.prescriptions.rows = [];
    if (!merged.treatment.temp.days) merged.treatment.temp.days = [];
    if (!merged.treatment.radiation.rows) merged.treatment.radiation.rows = [];
    if (!Array.isArray(merged.dept007.rows)) merged.dept007.rows = [];
    if (!Array.isArray(merged.nutrition.rows)) merged.nutrition.rows = [];
    if (!Array.isArray(merged.cso.rows)) merged.cso.rows = [];
    if (!merged.diary || !Array.isArray(merged.diary.rows)) merged.diary = { rows: [] };
    if (!merged.stat066 || typeof merged.stat066 !== 'object') merged.stat066 = {};
    if (!Array.isArray(merged.stat066.movements)) merged.stat066.movements = [];
    if (!Array.isArray(merged.signatures)) merged.signatures = [];
    if (!Array.isArray(merged.audit)) merged.audit = [];
    if (!merged.consent || typeof merged.consent !== 'object') merged.consent = {};
    if (!merged.operations008 || !Array.isArray(merged.operations008.rows)) {
      merged.operations008 = { started: '', ended: '', departmentCode: '', rows: [] };
    }
    if (!merged.summary016 || !Array.isArray(merged.summary016.rows)) {
      merged.summary016 = { department: '', period: '', rows: [] };
    }
    if (!merged.endoscopy || !Array.isArray(merged.endoscopy.rows)) {
      merged.endoscopy = { started: '', ended: '', department: '', rows: [] };
    }
    return merged;
  }

  function loadState() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return normalizeState(JSON.parse(raw));
    } catch (err) {
      return null;
    }
  }

  function saveNow(silent) {
    if (!state) return;
    try {
      state.progress = global.ClinicValidation.completeness(state);
      if (session) state.user = session;
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      var footer = $('#footerSave');
      if (footer) {
        footer.textContent = 'Сохранено ' + global.Auth.formatTimeRu(new Date().toISOString());
        footer.classList.remove('is-saving');
        void footer.offsetWidth;
        footer.classList.add('is-saving');
        global.setTimeout(function () { footer.classList.remove('is-saving'); }, 700);
      }
      updateProgressUI();
      if (state.signatures && state.signatures.length) scheduleSignatureCheck();
      if (!silent) { /* тихое сохранение */ }
    } catch (err) {
      var footer2 = $('#footerSave');
      if (footer2) footer2.textContent = 'Ошибка сохранения';
    }
  }

  function scheduleSave() {
    var footer = $('#footerSave');
    if (footer) footer.textContent = 'Сохранение…';
    global.clearTimeout(saveTimer);
    saveTimer = global.setTimeout(function () { saveNow(); }, SAVE_DELAY);
  }

  /* ============================================================
     УВЕДОМЛЕНИЯ И МОДАЛЬНЫЕ ОКНА
     ============================================================ */
  function toast(title, text, type) {
    var host = $('#toastHost');
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' is-' + type : '');
    el.innerHTML = '<div><strong>' + esc(title) + '</strong>' + (text ? '<span>' + esc(text) + '</span>' : '') + '</div>';
    host.appendChild(el);
    global.setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      el.style.transition = 'opacity .2s ease, transform .2s ease';
      global.setTimeout(function () { el.remove(); }, 220);
    }, 4600);
  }

  function openModal(id) {
    var modal = typeof id === 'string' ? document.getElementById(id) : id;
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    var focusable = modal.querySelector('button, input, select, textarea, [href]');
    if (focusable) global.setTimeout(function () { focusable.focus(); }, 40);
  }

  function closeModal(modal) {
    var el = typeof modal === 'string' ? document.getElementById(modal) : modal;
    if (!el) return;
    el.hidden = true;
    if (!$$('.modal:not([hidden])').length) document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) {
      try { lastFocus.focus(); } catch (err) { /* ignore */ }
    }
  }

  function askConfirm(title, text, acceptLabel, callback) {
    $('#confirmTitle').textContent = title;
    $('#confirmText').textContent = text;
    $('#confirmAccept').textContent = acceptLabel || 'Подтвердить';
    confirmCallback = callback;
    openModal('modalConfirm');
  }

  /* ============================================================
     ЭКРАНЫ И СЕССИЯ
     ============================================================ */
  function setScreen(name) {
    $('#screenLogin').hidden = name !== 'login';
    $('#screenWelcome').hidden = name !== 'welcome';
    $('#app').hidden = name !== 'app';
    document.body.dataset.screen = name;
  }

  function updateUserUI() {
    if (!session) return;
    $('#welcomeUser').textContent = session.fio + ' · ' + session.group;
    $('#userName').textContent = session.fio;
    $('#userGroup').textContent = 'Группа ' + session.group;
    $('#userAvatar').textContent = global.Auth.initials(session.fio);
  }

  function startTimer() {
    if (stopTimer) stopTimer();
    stopTimer = global.Auth.startTimer(session, function (seconds, formatted) {
      var el = $('#sessionTimer');
      if (el) el.textContent = global.Auth.isTimingEnabled(session) ? formatted : '—:—:—';
      if (seconds % 30 === 0) global.Auth.touch(session);
    });
    updatePauseUI();
  }

  function updatePauseUI() {
    var enabled = session ? global.Auth.isTimingEnabled(session) : true;
    var paused = enabled && session ? global.Auth.isPaused(session) : false;
    var btn = $('#btnPauseTimer');
    var icon = $('#pauseIcon');
    var label = $('#pauseLabel');
    var box = $('#sessionTimerBox');
    var timerLabel = $('#timerLabel');
    if (!btn) return;
    btn.disabled = !enabled;
    btn.classList.toggle('is-paused', paused);
    btn.classList.toggle('is-off', !enabled);
    btn.setAttribute('aria-pressed', paused ? 'true' : 'false');
    btn.title = !enabled ? 'В этом режиме время не учитывается'
      : (paused ? 'Возобновить отсчёт времени' : 'Остановить таймер на время перерыва');
    if (icon) icon.innerHTML = iconSvg(!enabled ? 'activity' : (paused ? 'play' : 'pause'));
    if (label) label.textContent = !enabled ? 'Без учёта' : (paused ? 'Продолжить' : 'Пауза');
    if (box) {
      box.classList.toggle('is-paused', paused);
      box.classList.toggle('is-off', !enabled);
    }
    if (timerLabel) timerLabel.textContent = !enabled ? 'Свободный режим' : (paused ? 'Пауза' : 'Время');
    var timer = $('#sessionTimer');
    if (timer && session) {
      timer.textContent = enabled ? global.Auth.formatDuration(global.Auth.elapsedSeconds(session)) : '—:—:—';
    }
  }

  function togglePause() {
    if (!session) return;
    if (!global.Auth.isTimingEnabled(session)) {
      toast('Время не учитывается', 'В режиме самостоятельной работы таймер отключён.', 'warn');
      return;
    }
    if (global.Auth.isPaused(session)) {
      global.Auth.resume(session);
      toast('Таймер возобновлён', 'Отсчёт чистого времени продолжен.', 'success');
    } else {
      global.Auth.pause(session);
      toast('Таймер остановлен', 'Время перерыва не войдёт в отчёт о практике.', 'warn');
    }
    updatePauseUI();
    saveNow(true);
  }

  function showLogin() {
    if (stopTimer) { stopTimer(); stopTimer = null; }
    setScreen('login');
  }

  function showWelcome() {
    if (stopTimer) { stopTimer(); stopTimer = null; }
    setScreen('welcome');
    updateUserUI();
    var resume = $('#welcomeResume');
    if (resume) {
      if (state && state.started) {
        resume.hidden = false;
        resume.textContent = 'Сессия восстановлена. Время работы: ' +
          global.Auth.formatMinutesRu(global.Auth.elapsedSeconds(session)) + '.';
      } else {
        resume.hidden = true;
      }
    }
  }

  function showApp() {
    setScreen('app');
    updateUserUI();
    applySidebarState();
    startTimer();
    updatePauseUI();
    switchTab(state.ui && state.ui.tab ? state.ui.tab : 'reception', true);
    updateCaseBanner();
    updateProgressUI();
    updateSignatureUI();
  }

  function handleLogin(event) {
    event.preventDefault();
    var fioEl = $('#studentFio');
    var groupEl = $('#studentGroup');
    var errorEl = $('#loginError');
    errorEl.hidden = true;
    clearFieldMessage('studentFio');
    clearFieldMessage('studentGroup');

    if (!$('#consentCheck').checked) {
      errorEl.hidden = false;
      errorEl.textContent = 'Подтвердите работу с синтетическими данными.';
      return;
    }
    try {
      session = global.Auth.login(fioEl.value, groupEl.value);
    } catch (err) {
      errorEl.hidden = false;
      errorEl.textContent = err.message;
      return;
    }
    state = defaultState();
    state.user = session;
    state.doc.journalStarted = todayIso();
    recordAudit('login', 'Вход в систему', 'Группа ' + session.group);
    saveNow();
    showWelcome();
    toast('Вход выполнен', 'Добро пожаловать, ' + session.fio.split(' ')[0] + '!', 'success');
  }

  function clearFieldMessage(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var field = el.closest('.field');
    if (!field) return;
    field.classList.remove('is-invalid');
    var msg = field.querySelector('.field-message');
    if (msg) msg.textContent = '';
  }

  function setFieldMessage(id, text) {
    var el = document.getElementById(id);
    if (!el) return;
    var field = el.closest('.field');
    if (!field) return;
    field.classList.add('is-invalid');
    var msg = field.querySelector('.field-message');
    if (!msg) {
      msg = document.createElement('p');
      msg.className = 'field-message';
      field.appendChild(msg);
    }
    msg.textContent = text;
  }

  function logout() {
    askConfirm('Выход из системы', 'Завершить сессию? Несохранённые изменения будут сохранены, отчёт можно сформировать повторно после входа.', 'Выйти', function () {
      recordAudit('logout', 'Выход из системы', '');
      saveNow();
      global.Auth.logout();
      if (stopTimer) { stopTimer(); stopTimer = null; }
      session = null;
      state = null;
      chart = null;
      loadedIncludes = {};
      loadedSubforms = {};
      $('#app').querySelectorAll('[data-include]').forEach(function (el) {
        el.innerHTML = '';
        delete el.dataset.loaded;
      });
      $('#treatmentContainer').innerHTML = '';
      $('#loginForm').reset();
      $('#consentCheck').checked = true;
      showLogin();
      toast('Сессия завершена', 'Данные сохранены на этом компьютере.', 'success');
    });
  }

  /* ============================================================
     ЗАГРУЗКА ФОРМ
     ============================================================ */
  function fetchTemplate(path) {
    if (templates[path]) return Promise.resolve(templates[path]);
    return fetch(path, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (html) {
        templates[path] = html;
        return html;
      });
  }

  function includeError(el, path) {
    el.innerHTML = '<div class="form-card"><div class="form-card-body"><p class="form-note is-danger">' +
      'Не удалось загрузить форму <strong>' + esc(path) + '</strong>. ' +
      'Запустите комплекс через файл <strong>start.command</strong> — он поднимает локальный сервер на порту 8080. ' +
      'Открывать index.html напрямую из папки нельзя: браузер блокирует загрузку локальных файлов.</p></div></div>';
  }

  async function loadIncludes(panel) {
    var slots = $$('[data-include]', panel);
    for (var i = 0; i < slots.length; i += 1) {
      var el = slots[i];
      var path = el.getAttribute('data-include');
      if (el.dataset.loaded === '1' || loadedIncludes[path]) {
        if (!el.innerHTML.trim() && loadedIncludes[path]) {
          el.innerHTML = templates[path] || '';
        }
        continue;
      }
      try {
        var html = await fetchTemplate(path);
        el.innerHTML = html;
        el.dataset.loaded = '1';
        loadedIncludes[path] = true;
        hydrate(el);
      } catch (err) {
        includeError(el, path);
      }
    }
    updateAll();
    staggerReveal(panel);
  }

  async function loadSubform(name) {
    var meta = SUBFORM_META[name] || SUBFORM_META['003-osmotr'];
    var container = $('#treatmentContainer');
    if (!container) return;
    currentSubform = name;
    var path = 'forms/' + meta.file + '.html';
    try {
      var html = templates[path] || (await fetchTemplate(path));
      container.innerHTML = html;
      loadedSubforms[name] = true;
      hydrate(container);
      staggerReveal(container);
    } catch (err) {
      includeError(container, path);
    }
    state.ui.subform = name;
    $$('#treatmentSubnav [data-subform]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-subform') === name);
    });
    var metaTab = TAB_META.treatment;
    $('#topbarCrumb').textContent = metaTab.crumb;
    $('#topbarTitle').textContent = meta.title;
  }

  async function ensureTab(tab) {
    var panel = $('[data-tab-panel="' + tab + '"]');
    if (!panel) return;
    if (tab === 'treatment') {
      var want = (state && state.ui && state.ui.subform) ? state.ui.subform : '003-osmotr';
      if (!loadedSubforms[want] || !$('#treatmentContainer').innerHTML.trim()) {
        await loadSubform(want);
      } else {
        $$('#treatmentSubnav [data-subform]').forEach(function (btn) {
          btn.classList.toggle('is-active', btn.getAttribute('data-subform') === want);
        });
      }
    } else {
      await loadIncludes(panel);
    }
  }

  /* ============================================================
     МАРШРУТИЗАЦИЯ
     ============================================================ */
  async function switchTab(tab, silent) {
    if (!TAB_META[tab]) tab = 'reception';
    state.ui.tab = tab;
    $$('.nav-item').forEach(function (btn) {
      var active = btn.getAttribute('data-tab') === tab;
      btn.classList.toggle('is-active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    $$('[data-tab-panel]').forEach(function (panel) {
      var active = panel.getAttribute('data-tab-panel') === tab;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
    $('#topbarCrumb').textContent = TAB_META[tab].crumb;
    $('#topbarTitle').textContent = TAB_META[tab].title;
    closeMobileMenu();
    await ensureTab(tab);
    if (tab === 'teacher') renderTeacher(state.meta.result);
    if (!silent) {
      global.scrollTo({ top: 0, behavior: 'smooth' });
      scheduleSave();
    }
  }

  function applySidebarState() {
    var collapsed = !!(state && state.ui && state.ui.sidebarCollapsed);
    var app = $('#app');
    if (app) app.classList.toggle('sidebar-collapsed', collapsed);
    var btn = $('#btnCollapseSidebar');
    if (btn) {
      btn.innerHTML = iconSvg(collapsed ? 'chevron-right' : 'chevron-left');
      btn.title = collapsed ? 'Развернуть боковую панель' : 'Свернуть боковую панель';
      btn.setAttribute('aria-label', btn.title);
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
  }

  function toggleSidebar() {
    if (!state) return;
    state.ui = state.ui || {};
    state.ui.sidebarCollapsed = !state.ui.sidebarCollapsed;
    applySidebarState();
    scheduleSave();
  }

  var paletteCurrent = [];
  var paletteActive = 0;

  function paletteItems() {
    var items = [];
    Object.keys(TAB_META).forEach(function (tab) {
      items.push({
        id: 'tab-' + tab,
        label: TAB_META[tab].crumb,
        hint: TAB_META[tab].title,
        icon: tab === 'reception' ? 'hospital' : tab === 'treatment' ? 'stethoscope' : tab === 'department' ? 'bed' : tab === 'cso' ? 'flask' : 'graduation',
        type: 'Раздел',
        run: function () { switchTab(tab, false); }
      });
    });
    Object.keys(SUBFORM_META).forEach(function (sub) {
      items.push({
        id: 'sub-' + sub,
        label: SUBFORM_META[sub].title,
        hint: 'Лечебное отделение · внутренний бланк 003/у',
        icon: 'file',
        type: 'Форма',
        sub: sub,
        run: function () {
          switchTab('treatment', true).then(function () { loadSubform(sub); });
        }
      });
    });
    [
      { id: 'form-001', label: 'Журнал 001/у', hint: 'Приёмное отделение · журнал приёма пациентов', icon: 'clipboard', type: 'Форма', run: function () { switchTab('reception', true).then(function () { var el = document.getElementById('form001u'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); } },
      { id: 'form-003', label: 'Медицинская карта 003/у', hint: 'Приёмное отделение · титульный лист', icon: 'clipboard', type: 'Форма', run: function () { switchTab('reception', true).then(function () { var el = document.getElementById('form003u'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); } },
      { id: 'form-066', label: 'Статистическая карта 066/у', hint: 'Приёмное отделение · паспортная часть и левая сторона', icon: 'clipboard', type: 'Форма', run: function () { switchTab('reception', true).then(function () { var el = document.getElementById('form066u'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); } },
      { id: 'form-007', label: 'Лист 007/у', hint: 'Учёт и питание · движение пациентов и коечного фонда', icon: 'clipboard', type: 'Форма', run: function () { switchTab('department', true).then(function () { var el = document.getElementById('form007u'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); } },
      { id: 'form-184', label: 'Порционник 1-84', hint: 'Учёт и питание · стандартные диеты', icon: 'clipboard', type: 'Форма', run: function () { switchTab('department', true).then(function () { var el = document.getElementById('form184'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); } },
      { id: 'form-016', label: 'Сводная ведомость 016/у', hint: 'Учёт и питание · движение за отчётный период', icon: 'clipboard', type: 'Форма', run: function () { switchTab('department', true).then(function () { var el = document.querySelector('[data-form-card="016u"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); } },
      { id: 'form-366', label: 'Журнал 366/у', hint: 'ЦСО · предстерилизационная очистка', icon: 'clipboard', type: 'Форма', run: function () { switchTab('cso', true).then(function () { var el = document.getElementById('form366u'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); } },
      { id: 'form-157', label: 'Журнал 157/у', hint: 'ЦСО · эндоскопические исследования', icon: 'clipboard', type: 'Форма', run: function () { switchTab('cso', true).then(function () { var el = document.querySelector('[data-form-card="157u"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); } }
    ].forEach(function (item) { items.push(item); });
    [
      { id: 'act-check', label: 'Проверить работу', hint: 'Перекрёстный контроль документации и оценка', icon: 'check', type: 'Действие', run: function () { runCheck(false); } },
      { id: 'act-report', label: 'Скачать отчёт о практике', hint: 'TXT с ФИО, группой, временем и ошибками', icon: 'download', type: 'Действие', run: downloadReport },
      { id: 'act-export', label: 'Экспорт и печать', hint: 'PDF через печать, DOCX текущего раздела или всей документации, JSON', icon: 'file', type: 'Действие', run: openExport },
      { id: 'act-sign', label: 'Подписать документацию', hint: 'Электронная подпись SHA-256 с фиксацией автора', icon: 'check-circle', type: 'Действие', run: openSignModal },
      { id: 'act-audit', label: 'Журнал аудита', hint: 'Кто, когда и что изменил', icon: 'clipboard', type: 'Действие', run: openAuditModal },
      { id: 'act-print', label: 'Печать текущего раздела', hint: 'Открыть печатную версию и сохранить в PDF', icon: 'file', type: 'Действие', run: function () { printCards(collectCurrentCards()); } },
      { id: 'act-cases', label: 'Выбрать клинический кейс', hint: '4 учебных кейса и режим «с нуля»', icon: 'clipboard', type: 'Действие', run: openCases },
      { id: 'act-blank', label: 'Заполнить с нуля', hint: 'Очистить документацию и заполнять самостоятельно', icon: 'plus', type: 'Действие', run: startBlankDocumentation },
      { id: 'act-instruction', label: 'Инструкция по заполнению', hint: 'Методичка по всем формам и критериям', icon: 'book', type: 'Действие', run: function () { openModal('modalInstruction'); } },
      { id: 'act-sidebar', label: 'Свернуть / развернуть боковую панель', hint: 'Больше места для формы', icon: 'chevron-left', type: 'Действие', run: toggleSidebar },
      { id: 'act-sitemap', label: 'Карта сайта', hint: 'Все разделы, формы и сервисы в одном окне', icon: 'map', type: 'Действие', run: openSitemap },
      { id: 'act-appearance', label: 'Тема и контрастность', hint: 'Светлая, тёмная тема и режим высокой контрастности', icon: 'sun', type: 'Действие', run: function () { applyTheme(themeSettings(), false); openModal('modalAppearance'); } },
      { id: 'act-logout', label: 'Выйти из системы', hint: 'Завершить сессию студента', icon: 'logout', type: 'Действие', run: logout }
    ].forEach(function (item) { items.push(item); });
    return items;
  }

  function renderPalette(query) {
    var list = $('#paletteList');
    if (!list) return;
    var q = String(query || '').trim().toLowerCase();
    paletteCurrent = paletteItems().filter(function (item) {
      if (!q) return true;
      return (item.label + ' ' + item.hint + ' ' + item.type).toLowerCase().indexOf(q) !== -1;
    });
    if (paletteActive >= paletteCurrent.length) paletteActive = 0;
    if (!paletteCurrent.length) {
      list.innerHTML = '<p class="palette-empty">Ничего не найдено. Попробуйте «операция», «007», «кейс» или «отчёт».</p>';
      return;
    }
    list.innerHTML = paletteCurrent.map(function (item, idx) {
      return '<button type="button" class="palette-item' + (idx === paletteActive ? ' is-active' : '') + '" data-palette-index="' + idx + '" role="option" aria-selected="' + (idx === paletteActive) + '">' +
        '<span class="palette-item-icon" aria-hidden="true">' + iconSvg(item.icon) + '</span>' +
        '<span class="palette-item-body"><strong>' + esc(item.label) + '</strong><small>' + esc(item.hint) + '</small></span>' +
        '<span class="palette-item-type">' + esc(item.type) + '</span></button>';
    }).join('');
    var active = list.querySelector('.palette-item.is-active');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  }

  function sitemapItem(tab, sub, card, code, label, hint) {
    return '<button type="button" class="sitemap-item"' +
      ' data-sitemap-tab="' + esc(tab) + '"' +
      (sub ? ' data-sitemap-sub="' + esc(sub) + '"' : '') +
      (card ? ' data-sitemap-card="' + esc(card) + '"' : '') + '>' +
      '<span class="sitemap-code">' + esc(code) + '</span>' +
      '<span class="sitemap-text"><strong>' + esc(label) + '</strong><small>' + esc(hint) + '</small></span>' +
      '<span class="sitemap-arrow" aria-hidden="true">→</span></button>';
  }

  function sitemapAction(action, code, label, hint) {
    return '<button type="button" class="sitemap-item sitemap-item-action" data-sitemap-action="' + esc(action) + '">' +
      '<span class="sitemap-code">' + esc(code) + '</span>' +
      '<span class="sitemap-text"><strong>' + esc(label) + '</strong><small>' + esc(hint) + '</small></span>' +
      '<span class="sitemap-arrow" aria-hidden="true">→</span></button>';
  }

  function buildSitemap() {
    var formsCount = 3 + Object.keys(SUBFORM_META).length + 3 + 2;
    var subCodes = {
      '003-osmotr': '003/у', '003-preop': '003/у', '003-operaciya': '003/у', '008u': '008/у',
      '003-anesteziya': '003/у', '003-reanimaciya': '003/у', '003-naznacheniya': '003/у',
      '003-transfuziya': '003/у', '004u': '004/у', '003-luchevaya': '003/у',
      '003-vypisnoy': '003/у', '003-dnevnik': '003/у', '003-soglasie': '003/у'
    };

    var html = '<div class="sitemap-summary">' +
      '<span class="badge badge-soft">5 разделов</span>' +
      '<span class="badge badge-soft">' + formsCount + ' интерактивный бланк</span>' +
      '<span class="badge badge-soft">4 кейса + режим «с нуля»</span>' +
      '<span class="badge badge-soft">панель преподавателя</span>' +
      '</div><div class="sitemap-grid">';

    html += '<section class="sitemap-card sitemap-card-wide"><h3>' + iconSvg('stethoscope') +
      ' Лечебное отделение <small>' + Object.keys(SUBFORM_META).length + ' форм</small></h3><div class="sitemap-list">';
    Object.keys(SUBFORM_META).forEach(function (key) {
      html += sitemapItem('treatment', key, null, subCodes[key] || '003/у', SUBFORM_META[key].title, 'Внутренний бланк 003/у');
    });
    html += '</div></section>';

    html += '<section class="sitemap-card"><h3>' + iconSvg('hospital') +
      ' Приёмное отделение <small>3 формы</small></h3><div class="sitemap-list">' +
      sitemapItem('reception', null, 'form001u', '001/у', 'Журнал учёта приёма пациентов', 'Регистрация, отказы, исходы госпитализации') +
      sitemapItem('reception', null, 'form003u', '003/у', 'Медицинская карта пациента', 'Титульный лист, диагнозы, группа крови') +
      sitemapItem('reception', null, 'form066u', '066/у', 'Статистическая карта выбывшего', 'Паспортная часть и левая сторона') +
      '</div></section>';

    html += '<section class="sitemap-card"><h3>' + iconSvg('bed') +
      ' Учёт отделения и питание <small>3 формы</small></h3><div class="sitemap-list">' +
      sitemapItem('department', null, 'form007u', '007/у', 'Лист движения пациентов и коечного фонда', 'Ежедневный учёт, баланс коек') +
      sitemapItem('department', null, 'form184', '1-84', 'Порционное требование на питание', 'Стандартные диеты, сверка с числом пациентов') +
      sitemapItem('department', null, 'form016u', '016/у', 'Сводная ведомость движения пациентов', 'Итоги за отчётный период') +
      '</div></section>';

    html += '<section class="sitemap-card"><h3>' + iconSvg('flask') +
      ' Процедурный кабинет и ЦСО <small>2 формы</small></h3><div class="sitemap-list">' +
      sitemapItem('cso', null, 'form366u', '366/у', 'Журнал предстерилизационной очистки', 'Азопирамовая и фенолфталеиновая пробы') +
      sitemapItem('cso', null, 'form157u', '157/у', 'Журнал эндоскопических исследований', 'Регистрация исследований и заключений') +
      '</div></section>';

    html += '<section class="sitemap-card"><h3>' + iconSvg('graduation') +
      ' Панель преподавателя <small>контроль</small></h3><div class="sitemap-list">' +
      sitemapItem('teacher', null, null, 'Кейсы', 'Клинические кейсы и заложенные ошибки', 'Эталон преподавателя и статус ошибок') +
      sitemapItem('teacher', null, null, 'Оценка', 'Проверка работы студента', 'Контрольный лист, оценка по 5-балльной шкале') +
      sitemapAction('report', 'Отчёт', 'Отчёт о практике', 'TXT с ФИО, группой, временем и ошибками') +
      '</div></section>';

    html += '<section class="sitemap-card sitemap-card-services"><h3>' + iconSvg('settings') +
      ' Сервисы <small>быстрый доступ</small></h3><div class="sitemap-list">' +
      sitemapAction('instruction', 'Инструкция', 'Инструкция по заполнению', 'Методичка по всем формам и критериям') +
      sitemapAction('palette', '⌘K', 'Быстрый переход', 'Палитра разделов, форм и действий') +
      sitemapAction('appearance', 'Тема', 'Тема и контрастность', 'Светлая, тёмная тема и высокая контрастность') +
      sitemapAction('export', 'Экспорт', 'Экспорт и печать', 'PDF через печать, DOCX, JSON') +
      sitemapAction('sign', 'Подпись', 'Электронная подпись', 'SHA-256 с фиксацией автора') +
      sitemapAction('audit', 'Аудит', 'Журнал аудита', 'Кто, когда и что изменил') +
      sitemapAction('cases', 'Кейсы', 'Выбрать клинический кейс', '4 кейса и режим «с нуля»') +
      sitemapAction('check', 'Проверка', 'Проверить работу', 'Перекрёстный контроль документации') +
      sitemapAction('sidebar', 'Панель', 'Свернуть / развернуть меню', 'Освободить место для таблиц') +
      sitemapAction('logout', 'Выход', 'Выйти из системы', 'Завершить сессию студента') +
      '</div></section>';

    html += '</div>';
    return html;
  }

  function openSitemap() {
    var body = $('#sitemapBody');
    if (body) body.innerHTML = buildSitemap();
    openModal('modalSitemap');
  }

  async function goSitemap(tab, sub, card) {
    closeModal('modalSitemap');
    await switchTab(tab, true);
    if (sub) {
      await loadSubform(sub);
    }
    if (card) {
      await new Promise(function (resolve) { global.setTimeout(resolve, 160); });
      var el = document.getElementById(card);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (sub) {
      var container = $('#treatmentContainer');
      if (container) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function runSitemapAction(action) {
    closeModal('modalSitemap');
    global.setTimeout(function () {
      if (action === 'instruction') openModal('modalInstruction');
      else if (action === 'palette') openPalette();
      else if (action === 'appearance') { applyTheme(themeSettings(), false); openModal('modalAppearance'); }
      else if (action === 'export') openExport();
      else if (action === 'sign') openSignModal();
      else if (action === 'audit') openAuditModal();
      else if (action === 'cases') openCases();
      else if (action === 'check') runCheck(false);
      else if (action === 'report') downloadReport();
      else if (action === 'sidebar') toggleSidebar();
      else if (action === 'logout') logout();
    }, 100);
  }

  function openPalette() {
    if (!state || $('#app').hidden) return;
    closeMobileMenu();
    paletteActive = 0;
    var input = $('#paletteInput');
    if (input) input.value = '';
    renderPalette('');
    openModal('modalPalette');
    global.setTimeout(function () {
      if (input) { input.focus(); input.select(); }
    }, 50);
  }

  function runPaletteItem(index) {
    var item = paletteCurrent[index];
    if (!item) return;
    closeModal('modalPalette');
    if (item.run) {
      global.setTimeout(function () { item.run(); }, 80);
    }
  }

  function movePalette(delta) {
    if (!paletteCurrent.length) return;
    paletteActive = (paletteActive + delta + paletteCurrent.length) % paletteCurrent.length;
    renderPalette($('#paletteInput') ? $('#paletteInput').value : '');
  }

  function closeMobileMenu() {
    var sidebar = $('#sidebar');
    var btn = $('#btnMenu');
    if (sidebar) sidebar.classList.remove('is-open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  /* ============================================================
     ГИДРАТАЦИЯ И ДИНАМИЧЕСКИЕ ТАБЛИЦЫ
     ============================================================ */
  function hydrate(root) {
    $$('[data-bind]', root).forEach(function (el) {
      var path = el.getAttribute('data-bind');
      var value = getPath(state, path);
      if (el.type === 'checkbox') {
        el.checked = value === true || value === 'true' || value === 'да';
      } else if (el.type === 'radio') {
        el.checked = String(value) === el.value;
      } else if (el.tagName === 'SELECT') {
        setSelectValue(el, value);
      } else {
        el.value = value === null || value === undefined ? '' : value;
      }
    });
    renderDynamic(root, false);
    if ($('#tempChart', root) || root.id === 'tempChart') initChart();
    updateAll();
  }

  function setSelectValue(el, value) {
    var v = value === null || value === undefined ? '' : String(value);
    if (!v) { el.value = ''; return; }
    var options = Array.prototype.slice.call(el.options);
    var match = options.filter(function (opt) { return opt.value === v; })[0];
    if (!match) {
      var normalized = v.replace(/[−–—]/g, '-');
      match = options.filter(function (opt) {
        return opt.value === normalized || opt.value.replace(/[−–—]/g, '-') === normalized;
      })[0];
    }
    if (!match) {
      match = document.createElement('option');
      match.value = v;
      match.textContent = v;
      el.appendChild(match);
    }
    el.value = match.value;
  }

  function renderDynamic(root, force) {
    $$('[data-render]', root).forEach(function (el) {
      if (!force && el.dataset.rendered === '1') return;
      var key = el.getAttribute('data-render');
      var renderer = RENDERERS[key];
      if (renderer) {
        renderer(el);
        el.dataset.rendered = '1';
      }
    });
  }

  function reRenderAll() {
    $$('[data-render]').forEach(function (el) { el.dataset.rendered = '0'; });
    renderDynamic(document, true);
    $$('[data-include]').forEach(function (el) {
      if (el.dataset.loaded === '1') {
        $$('[data-bind]', el).forEach(function (input) {
          var path = input.getAttribute('data-bind');
          var value = getPath(state, path);
          if (input.type === 'checkbox') input.checked = !!value;
          else if (input.type !== 'radio') input.value = value === null || value === undefined ? '' : value;
        });
      }
    });
    hydrate(document);
    refreshChart();
    updateAll();
  }

  function updateAll() {
    updateComputed();
    updateSummaries();
    updateCounters();
    updateProgressUI();
    updateCaseBanner();
  }

  /* ============================================================
     ХЕЛПЕРЫ РАЗМЕТКИ
     ============================================================ */
  function inputHtml(path, value, opts) {
    opts = opts || {};
    var attrs = ' class="' + (opts.cls || 'form-input') + '"';
    attrs += ' data-bind="' + esc(path) + '"';
    if (opts.type) attrs += ' type="' + esc(opts.type) + '"';
    if (opts.mask) attrs += ' data-mask="' + esc(opts.mask) + '"';
    if (opts.rule) attrs += ' data-rule="' + esc(opts.rule) + '"';
    if (opts.placeholder) attrs += ' placeholder="' + esc(opts.placeholder) + '"';
    if (opts.min !== undefined) attrs += ' min="' + esc(opts.min) + '"';
    if (opts.max !== undefined) attrs += ' max="' + esc(opts.max) + '"';
    if (opts.step !== undefined) attrs += ' step="' + esc(opts.step) + '"';
    if (opts.readonly) attrs += ' readonly';
    if (opts.title) attrs += ' title="' + esc(opts.title) + '"';
    if (opts.inputmode) attrs += ' inputmode="' + esc(opts.inputmode) + '"';
    return '<input' + attrs + ' value="' + esc(value) + '">';
  }

  function selectHtml(path, value, options, opts) {
    opts = opts || {};
    var html = '<select class="' + (opts.cls || 'form-select') + '" data-bind="' + esc(path) + '"' +
      (opts.rule ? ' data-rule="' + esc(opts.rule) + '"' : '') + '>';
    html += '<option value="">—</option>';
    options.forEach(function (opt) {
      var v = typeof opt === 'string' ? opt : opt.v;
      var l = typeof opt === 'string' ? opt : opt.l;
      html += '<option value="' + esc(v) + '"' + (String(value) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>';
    });
    return html + '</select>';
  }

  function checkboxHtml(path, checked) {
    return '<input type="checkbox" data-bind="' + esc(path) + '" data-type="bool"' + (checked ? ' checked' : '') + '>';
  }

  function numberOrZero(value) { return n(value); }
  function textareaHtml(path, value, opts) {
    opts = opts || {};
    return '<textarea class="form-textarea" data-bind="' + esc(path) + '"' +
      (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '') +
      (opts.rows ? ' rows="' + esc(opts.rows) + '"' : '') + '>' + esc(value) + '</textarea>';
  }

  function fieldBlock(label, control, span) {
    return '<div class="field span-' + (span || 4) + '"><label>' + esc(label) + '</label>' + control + '</div>';
  }


  /* ============================================================
     РЕНДЕРЕРЫ ДИНАМИЧЕСКИХ ТАБЛИЦ
     ============================================================ */
  var RENDERERS = {};

  RENDERERS.operations008 = function (el) {
    var rows = state.operations008.rows || [];
    if (!rows.length) {
      el.innerHTML = '<p class="muted">Записей нет. Добавьте операцию или заполните форму из протокола.</p>';
      return;
    }
    el.innerHTML = rows.map(function (row, idx) {
      var pre = 'operations008.rows.' + idx + '.';
      var title = '№ ' + (row.num || idx + 1) + ' · ' + (row.fio || 'без ФИО') + ' · ' + (row.opName || 'операция не указана');
      return '<details class="journal-entry"' + (idx === 0 ? ' open' : '') + '>' +
        '<summary><span>' + esc(title) + '</span><span class="journal-entry-date">' + esc(row.date || '') + '</span></summary>' +
        '<div class="journal-entry-body">' +
        '<div class="form-section"><h4>Паспортные данные и время операции</h4><div class="form-grid">' +
        fieldBlock('Номер операции', inputHtml(pre + 'num', row.num, { type: 'number', min: 1, max: 99999 }), 2) +
        fieldBlock('Номер карты пациента', inputHtml(pre + 'cardNo', row.cardNo), 2) +
        fieldBlock('Фамилия, имя, отчество', inputHtml(pre + 'fio', row.fio, { rule: 'fio' }), 4) +
        fieldBlock('Пол', selectHtml(pre + 'sex', row.sex, ['Мужской', 'Женский']), 2) +
        fieldBlock('Дата рождения', inputHtml(pre + 'birth', row.birth, { type: 'date' }), 2) +
        fieldBlock('Дата операции', inputHtml(pre + 'date', row.date, { type: 'date' }), 2) +
        fieldBlock('Начало', inputHtml(pre + 'start', row.start, { type: 'time' }), 2) +
        fieldBlock('Окончание', inputHtml(pre + 'end', row.end, { type: 'time' }), 2) +
        fieldBlock('Длительность, мин', inputHtml(pre + 'duration', row.duration, { type: 'number', min: 0, max: 1440 }), 2) +
        '</div></div>' +
        '<div class="form-section"><h4>Диагноз до операции</h4><div class="form-grid">' +
        fieldBlock('Основное заболевание', inputHtml(pre + 'diagMain', row.diagMain), 6) +
        fieldBlock('Осложнения', inputHtml(pre + 'diagComplication', row.diagComplication), 6) +
        fieldBlock('Сопутствующие заболевания', inputHtml(pre + 'diagConcomitant', row.diagConcomitant), 6) +
        fieldBlock('Внешняя причина', inputHtml(pre + 'diagExternal', row.diagExternal), 6) +
        fieldBlock('Дополнительные сведения', inputHtml(pre + 'diagExtra', row.diagExtra), 12) +
        '</div></div>' +
        '<div class="form-section"><h4>Характер вмешательства</h4><div class="form-grid">' +
        fieldBlock('Наименование операции', inputHtml(pre + 'opName', row.opName), 8) +
        fieldBlock('Код по номенклатуре', inputHtml(pre + 'opCode', row.opCode), 4) +
        fieldBlock('Высокотехнологичная помощь', selectHtml(pre + 'hitech', row.hitech, ['Да', 'Нет']), 3) +
        fieldBlock('Использованная аппаратура', selectHtml(pre + 'equipment', row.equipment, ['Не применялась', 'Лазерная', 'Криогенная', 'Эндоскопическая', 'Рентгеновская']), 3) +
        fieldBlock('Кратность', selectHtml(pre + 'multiplicity', row.multiplicity, ['Первичная', 'Повторная']), 3) +
        fieldBlock('Микрохирургическая операция', selectHtml(pre + 'micro', row.micro, ['Да', 'Нет']), 3) +
        fieldBlock('Премедикация (препараты, дозы)', textareaHtml(pre + 'premed', row.premed, { rows: 2 }), 6) +
        fieldBlock('Вид анестезиологического пособия', inputHtml(pre + 'anesthesiaType', row.anesthesiaType), 6) +
        '</div></div>' +
        '<div class="form-section"><h4>Описание, исход и материал</h4><div class="form-grid">' +
        fieldBlock('Описание хода операции', textareaHtml(pre + 'description', row.description, { rows: 4 }), 12) +
        fieldBlock('Исход операции', selectHtml(pre + 'outcome', row.outcome, ['Благоприятный', 'Летальный']), 4) +
        fieldBlock('Дата смерти', inputHtml(pre + 'deathDate', row.deathDate, { type: 'date' }), 4) +
        fieldBlock('Время смерти', inputHtml(pre + 'deathTime', row.deathTime, { type: 'time' }), 4) +
        fieldBlock('Операционный материал на патоморфологию', textareaHtml(pre + 'material', row.material, { rows: 2 }), 6) +
        fieldBlock('Осложнения в ходе операции', textareaHtml(pre + 'complications', row.complications, { rows: 2 }), 6) +
        '</div></div>' +
        '<div class="form-section"><h4>Диагноз после операции</h4><div class="form-grid">' +
        fieldBlock('Основное заболевание', inputHtml(pre + 'postMain', row.postMain), 6) +
        fieldBlock('Осложнения', inputHtml(pre + 'postComplication', row.postComplication), 6) +
        fieldBlock('Сопутствующие заболевания', inputHtml(pre + 'postConcomitant', row.postConcomitant), 6) +
        fieldBlock('Внешняя причина', inputHtml(pre + 'postExternal', row.postExternal), 6) +
        '</div></div>' +
        '<div class="form-section"><h4>Состав бригады</h4><div class="form-grid">' +
        fieldBlock('Оперирующий врач', inputHtml(pre + 'surgeon', row.surgeon), 4) +
        fieldBlock('Ассистирующий врач', inputHtml(pre + 'assistant', row.assistant), 4) +
        fieldBlock('Операционная медицинская сестра', inputHtml(pre + 'opNurse', row.opNurse), 4) +
        fieldBlock('Врач-анестезиолог-реаниматолог', inputHtml(pre + 'anesthesiologist', row.anesthesiologist), 6) +
        fieldBlock('Медицинская сестра-анестезист', inputHtml(pre + 'anesthetistNurse', row.anesthetistNurse), 6) +
        '</div></div>' +
        '<div class="journal-entry-actions"><button type="button" class="btn btn-sm btn-danger" data-action="op008-remove" data-idx="' + idx + '">Удалить запись</button></div>' +
        '</div></details>';
    }).join('');
  };

  RENDERERS.summary016 = function (el) {
    var rows = state.summary016.rows || [];
    el.innerHTML = rows.map(function (row, idx) {
      var pre = 'summary016.rows.' + idx + '.';
      var numCell = function (key) {
        return '<td>' + inputHtml(pre + key, row[key], { type: 'number', rule: 'number', min: 0, max: 999999 }) + '</td>';
      };
      return '<tr data-row="' + idx + '">' +
        '<td style="min-width:180px">' + inputHtml(pre + 'profile', row.profile) + '</td>' +
        numCell('beds') + numCell('avgBeds') + numCell('start') + numCell('admitted') + numCell('fromDay') +
        numCell('rural') + numCell('children') + numCell('elderly') + numCell('transfIn') + numCell('transfOut') +
        numCell('discharged') + numCell('dischElderly') + numCell('dischDay') + numCell('dischHospital') +
        numCell('died') + numCell('diedChildren') + numCell('diedElderly') + numCell('end') +
        numCell('bedDays') + numCell('closedBedDays') + numCell('careBedDays') + numCell('freeM') + numCell('freeF') +
        '<td class="row-actions"><button type="button" data-action="sum016-remove" data-idx="' + idx + '" title="Удалить строку">✕</button></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="25" class="muted">Нет строк. Добавьте профиль коек или перенесите данные из 007/у.</td></tr>';
  };

  RENDERERS.summary016Totals = function (el) {
    var rows = state.summary016.rows || [];
    if (!rows.length) {
      el.innerHTML = '<tr><td colspan="25" class="muted">Итоги появятся после заполнения.</td></tr>';
      return;
    }
    var keys = ['beds', 'avgBeds', 'start', 'admitted', 'fromDay', 'rural', 'children', 'elderly', 'transfIn',
      'transfOut', 'discharged', 'dischElderly', 'dischDay', 'dischHospital', 'died', 'diedChildren', 'diedElderly',
      'end', 'bedDays', 'closedBedDays', 'careBedDays', 'freeM', 'freeF'];
    var totals = {};
    keys.forEach(function (key) { totals[key] = rows.reduce(function (a, r) { return a + n(r[key]); }, 0); });
    el.innerHTML = '<tr><td>Итого</td>' + keys.map(function (k) {
      return '<td style="text-align:center">' + totals[k] + '</td>';
    }).join('') + '<td></td></tr>';
  };

  RENDERERS.stat066Movements = function (el) {
    var rows = getPath(state, 'stat066.movements') || [];
    if (!rows.length) {
      el.innerHTML = '<tr><td colspan="10" class="muted">Нет записей. Добавьте отделение.</td></tr>';
      return;
    }
    el.innerHTML = rows.map(function (row, idx) {
      var pre = 'stat066.movements.' + idx + '.';
      return '<tr data-row="' + idx + '">' +
        '<td class="col-num">' + (idx + 1) + '</td>' +
        '<td>' + inputHtml(pre + 'department', row.department) + '</td>' +
        '<td>' + inputHtml(pre + 'profile', row.profile) + '</td>' +
        '<td>' + inputHtml(pre + 'doctor', row.doctor) + '</td>' +
        '<td>' + inputHtml(pre + 'admissionDate', row.admissionDate, { type: 'date' }) + '</td>' +
        '<td><div style="display:flex;gap:4px">' + inputHtml(pre + 'dischargeDate', row.dischargeDate, { type: 'date' }) + inputHtml(pre + 'dischargeTime', row.dischargeTime, { type: 'time' }) + '</div></td>' +
        '<td>' + inputHtml(pre + 'main', row.main) + '</td>' +
        '<td>' + inputHtml(pre + 'icd', row.icd, { mask: 'icd', rule: 'icd' }) + '</td>' +
        '<td>' + inputHtml(pre + 'days', row.days, { type: 'number', min: 0, max: 9999, rule: 'number' }) + '</td>' +
        '<td class="row-actions"><button type="button" data-action="stat066-move-remove" data-idx="' + idx + '" title="Удалить строку">✕</button></td>' +
        '</tr>';
    }).join('');
  };

  RENDERERS.endoscopy = function (el) {
    var rows = state.endoscopy.rows || [];
    el.innerHTML = rows.map(function (row, idx) {
      var pre = 'endoscopy.rows.' + idx + '.';
      return '<tr data-row="' + idx + '">' +
        '<td class="col-num">' + (idx + 1) + '</td>' +
        '<td>' + inputHtml(pre + 'date', row.date, { type: 'date' }) + '</td>' +
        '<td>' + inputHtml(pre + 'fio', row.fio, { rule: 'fio' }) + '</td>' +
        '<td>' + inputHtml(pre + 'birthYear', row.birthYear, { type: 'number', min: 1900, max: 2030 }) + '</td>' +
        '<td>' + inputHtml(pre + 'address', row.address) + '</td>' +
        '<td>' + inputHtml(pre + 'referral', row.referral) + '</td>' +
        '<td>' + inputHtml(pre + 'diagnosis', row.diagnosis) + '</td>' +
        '<td>' + selectHtml(pre + 'method', row.method, ['Эзофагогастродуоденоскопия', 'Колоноскопия', 'Ректороманоскопия', 'Бронхоскопия', 'Лапароскопия', 'Цистоскопия', 'Другое']) + '</td>' +
        '<td>' + inputHtml(pre + 'conclusion', row.conclusion) + '</td>' +
        '<td>' + inputHtml(pre + 'notes', row.notes) + '</td>' +
        '<td class="row-actions"><button type="button" data-action="endo-remove" data-idx="' + idx + '" title="Удалить строку">✕</button></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="11" class="muted">Записей нет. Добавьте исследование.</td></tr>';
  };

  RENDERERS.endoscopyTotals = function (el) {
    var rows = state.endoscopy.rows || [];
    if (!rows.length) {
      el.innerHTML = '<tr><td colspan="11" class="muted">Итоги появятся после заполнения.</td></tr>';
      return;
    }
    var today = rows.filter(function (r) { return r.date; }).length;
    el.innerHTML = '<tr><td colspan="9">Всего исследований: ' + rows.length + '; с указанной датой: ' + today + '</td><td colspan="2"></td></tr>';
  };

  RENDERERS.diary = function (el) {
    var rows = state.diary.rows || [];
    el.innerHTML = rows.map(function (row, idx) {
      var pre = 'diary.rows.' + idx + '.';
      return '<tr data-row="' + idx + '">' +
        '<td>' + inputHtml(pre + 'date', row.date, { type: 'date' }) + '</td>' +
        '<td>' + inputHtml(pre + 'time', row.time, { type: 'time' }) + '</td>' +
        '<td>' + textareaHtml(pre + 'complaints', row.complaints, { rows: 3 }) + '</td>' +
        '<td>' + textareaHtml(pre + 'condition', row.condition, { rows: 3 }) + '</td>' +
        '<td>' + textareaHtml(pre + 'objective', row.objective, { rows: 3 }) + '</td>' +
        '<td>' + textareaHtml(pre + 'appointments', row.appointments, { rows: 3 }) + '</td>' +
        '<td>' + inputHtml(pre + 'doctor', row.doctor) + '</td>' +
        '<td>' + inputHtml(pre + 'nurse', row.nurse) + '</td>' +
        '<td class="row-actions"><button type="button" data-action="diary-remove" data-idx="' + idx + '" title="Удалить запись">✕</button></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="9" class="muted">Записей нет. Добавьте первую запись дневника.</td></tr>';
  };

  RENDERERS.journalSelect = function (el) {
    var rows = state.j001.rows || [];
    var selected = n(state.j001.selected);
    el.innerHTML = rows.map(function (row, idx) {
      return '<option value="' + idx + '"' + (idx === selected ? ' selected' : '') + '>#' + (idx + 1) + ' · ' +
        esc(row.fio || 'без ФИО') + ' · ' + esc(row.date || '') + '</option>';
    }).join('') || '<option value="">Нет записей</option>';
  };

  RENDERERS.journal001 = function (el) {
    var rows = state.j001.rows || [];
    var selected = n(state.j001.selected);
    el.innerHTML = rows.map(function (row, idx) {
      var pre = 'j001.rows.' + idx + '.';
      return '<tr data-row="' + idx + '"' + (idx === selected ? ' class="is-selected"' : '') + '>' +
        '<td class="col-num"><button type="button" class="icon-btn" style="width:28px;height:28px" data-action="journal-row-select" data-idx="' + idx + '" title="Выбрать запись">' + (idx + 1) + '</button></td>' +
        '<td class="col-date">' + inputHtml(pre + 'date', row.date, { type: 'date', rule: 'required|date' }) + '</td>' +
        '<td class="col-time">' + inputHtml(pre + 'time', row.time, { type: 'time' }) + '</td>' +
        '<td class="col-lg">' + inputHtml(pre + 'fio', row.fio, { rule: 'required|fio', placeholder: 'Фамилия Имя Отчество' }) + '</td>' +
        '<td class="col-date">' + inputHtml(pre + 'birth', row.birth, { type: 'date', rule: 'required|date' }) + '</td>' +
        '<td class="col-sm">' + selectHtml(pre + 'sex', row.sex, ['Мужской', 'Женский']) + '</td>' +
        '<td class="col-md">' + inputHtml(pre + 'passport', row.passport, { mask: 'passport', rule: 'passport', placeholder: '4510 123456' }) + '</td>' +
        '<td class="col-sm">' + inputHtml(pre + 'citizenship', row.citizenship) + '</td>' +
        '<td class="col-lg">' + inputHtml(pre + 'addressLive', row.addressLive) + '</td>' +
        '<td class="col-lg">' + inputHtml(pre + 'addressStay', row.addressStay) + '<div style="margin-top:4px">' + inputHtml(pre + 'phone', row.phone, { mask: 'phone', rule: 'phone', placeholder: '+7 (999) 123-45-67', type: 'tel' }) + '</div></td>' +
        '<td class="col-md">' + inputHtml(pre + 'snils', row.snils, { mask: 'snils', rule: 'snils', placeholder: '123-456-789 00' }) + '</td>' +
        '<td class="col-md">' + inputHtml(pre + 'oms', row.oms, { mask: 'oms', rule: 'oms', placeholder: '16 цифр' }) + '</td>' +
        '<td class="col-md">' + selectHtml(pre + 'delivered', row.delivered, ['Поликлиникой', 'Выездной бригадой скорой медицинской помощи', 'Полицией', 'Другой медицинской организацией', 'Другое', 'Обратился самостоятельно']) + '</td>' +
        '<td class="col-sm">' + inputHtml(pre + 'cardNo', row.cardNo) + '</td>' +
        '<td class="col-md">' + inputHtml(pre + 'referralDiag', row.referralDiag) +
        '<div style="margin-top:4px">' + inputHtml(pre + 'referralIcd', row.referralIcd, { mask: 'icd', rule: 'icd', placeholder: 'Код МКБ' }) + '</div></td>' +
        '<td class="col-md">' + inputHtml(pre + 'injuryIcd', row.injuryIcd, { mask: 'icd', rule: 'icd', placeholder: 'Код МКБ' }) + '</td>' +
        '<td class="col-md">' + inputHtml(pre + 'alcohol', row.alcohol) + '</td>' +
        '<td class="col-md">' + inputHtml(pre + 'department', row.department) + '</td>' +
        '<td class="col-lg">' + selectHtml(pre + 'outcome', row.outcome, ['Госпитализирован', 'Госпитализирована', 'Выписан', 'Переведён в другую медицинскую организацию', 'Умер', 'Отказ в госпитализации']) +
        '<div style="display:flex;gap:4px;margin-top:4px">' + inputHtml(pre + 'outcomeDate', row.outcomeDate, { type: 'date' }) + inputHtml(pre + 'outcomeTime', row.outcomeTime, { type: 'time' }) + '</div></td>' +
        '<td class="col-md">' + inputHtml(pre + 'notify', row.notify) + '</td>' +
        '<td class="col-md">' + selectHtml(pre + 'refusalReason', row.refusalReason, ['Отказался пациент', 'Отсутствие показаний', 'Помощь оказана в приёмном отделении', 'Направлен в другую медицинскую организацию', 'Иная причина']) + '</td>' +
        '<td class="col-md">' + inputHtml(pre + 'refusalWorker', row.refusalWorker) + '</td>' +
        '<td class="col-md">' + inputHtml(pre + 'extra', row.extra) + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="23" class="muted">Записей нет. Нажмите «Добавить запись» или загрузите кейс.</td></tr>';
  };

  RENDERERS.dept007 = function (el) {
    var rows = state.dept007.rows || [];
    el.innerHTML = rows.map(function (row, idx) {
      var pre = 'dept007.rows.' + idx + '.';
      function cnt(key) {
        return inputHtml(pre + key, row[key], { type: 'number', rule: 'number', min: 0, max: 9999 });
      }
      return '<tr data-row="' + idx + '">' +
        '<td style="min-width:180px">' + inputHtml(pre + 'profile', row.profile, { placeholder: 'Хирургические койки' }) + '</td>' +
        '<td>' + cnt('beds') + '</td><td>' + cnt('closed') + '</td><td>' + cnt('before') + '</td>' +
        '<td>' + cnt('admitted') + '</td><td>' + cnt('fromDay') + '</td><td>' + cnt('fromRural') + '</td>' +
        '<td>' + cnt('children') + '</td><td>' + cnt('elderly') + '</td><td>' + cnt('transfIn') + '</td>' +
        '<td>' + cnt('transfOut') + '</td><td>' + cnt('discharged') + '</td><td>' + cnt('dischElderly') + '</td>' +
        '<td>' + cnt('dischDay') + '</td><td>' + cnt('dischHospital') + '</td><td>' + cnt('died') + '</td>' +
        '<td>' + cnt('diedChildren') + '</td><td>' + cnt('diedElderly') + '</td>' +
        '<td class="cell-computed">' + inputHtml(pre + 'current', row.current, { type: 'number', rule: 'number', min: 0, max: 9999, cls: 'form-input' }) + '</td>' +
        '<td>' + cnt('currentElderly') + '</td><td>' + cnt('caregivers') + '</td>' +
        '<td>' + cnt('freeM') + '</td><td>' + cnt('freeF') + '</td>' +
        '<td class="row-actions"><button type="button" data-action="bed-remove" data-idx="' + idx + '" title="Удалить строку">✕</button></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="23" class="muted">Нет строк. Добавьте профиль коек или загрузите кейс.</td></tr>';
  };

  RENDERERS.dept007Totals = function (el) {
    var rows = state.dept007.rows || [];
    if (!rows.length) {
      el.innerHTML = '<tr><td colspan="23" class="muted">Итоги появятся после заполнения.</td></tr>';
      return;
    }
    var keys = ['beds', 'closed', 'before', 'admitted', 'fromDay', 'fromRural', 'children', 'elderly', 'transfIn',
      'transfOut', 'discharged', 'dischElderly', 'dischDay', 'dischHospital', 'died', 'diedChildren', 'diedElderly',
      'current', 'currentElderly', 'caregivers', 'freeM', 'freeF'];
    var totals = {};
    keys.forEach(function (key) {
      totals[key] = rows.reduce(function (acc, row) { return acc + n(row[key]); }, 0);
    });
    el.innerHTML = '<tr><td>Итого по отделению</td>' + keys.map(function (key) {
      return '<td style="text-align:center">' + totals[key] + '</td>';
    }).join('') + '<td></td></tr>';
  };

  RENDERERS.nutrition = function (el) {
    var rows = state.nutrition.rows || [];
    el.innerHTML = rows.map(function (row, idx) {
      var pre = 'nutrition.rows.' + idx + '.';
      var sum = ['ovd', 'shchd', 'vbd', 'nkd', 'vkd', 'ovd1', 'highProtein'].reduce(function (acc, key) {
        return acc + n(row[key]);
      }, 0);
      function cnt(key) {
        return inputHtml(pre + key, row[key], { type: 'number', rule: 'number', min: 0, max: 999 });
      }
      return '<tr data-row="' + idx + '">' +
        '<td style="min-width:220px">' + inputHtml(pre + 'department', row.department) + '</td>' +
        '<td>' + cnt('patients') + '</td>' + cnt('ovd') + cnt('shchd') + cnt('vbd') + cnt('nkd') + cnt('vkd') + cnt('ovd1') + cnt('highProtein') +
        '<td class="cell-computed" data-cell="diet-sum-' + idx + '">' + sum + '</td>' +
        '<td class="row-actions"><button type="button" data-action="diet-remove" data-idx="' + idx + '" title="Удалить строку">✕</button></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="11" class="muted">Нет строк. Добавьте отделение или загрузите кейс.</td></tr>';
  };

  RENDERERS.nutritionTotals = function (el) {
    var rows = state.nutrition.rows || [];
    if (!rows.length) {
      el.innerHTML = '<tr><td colspan="11" class="muted">Итоги появятся после заполнения.</td></tr>';
      return;
    }
    var keys = ['patients', 'ovd', 'shchd', 'vbd', 'nkd', 'vkd', 'ovd1', 'highProtein'];
    var totals = {};
    keys.forEach(function (key) { totals[key] = rows.reduce(function (a, r) { return a + n(r[key]); }, 0); });
    var sum = ['ovd', 'shchd', 'vbd', 'nkd', 'vkd', 'ovd1', 'highProtein'].reduce(function (a, k) { return a + totals[k]; }, 0);
    el.innerHTML = '<tr><td>Итого</td><td>' + totals.patients + '</td>' +
      ['ovd', 'shchd', 'vbd', 'nkd', 'vkd', 'ovd1', 'highProtein'].map(function (k) { return '<td>' + totals[k] + '</td>'; }).join('') +
      '<td>' + sum + '</td><td></td></tr>';
  };

  RENDERERS.cso = function (el) {
    var rows = state.cso.rows || [];
    el.innerHTML = rows.map(function (row, idx) {
      var pre = 'cso.rows.' + idx + '.';
      return '<tr data-row="' + idx + '">' +
        '<td>' + inputHtml(pre + 'date', row.date, { type: 'date', rule: 'date' }) + '</td>' +
        '<td>' + selectHtml(pre + 'method', row.method, ['Ручной', 'Механизированный', 'Полуавтоматический']) + '</td>' +
        '<td>' + inputHtml(pre + 'agent', row.agent, { placeholder: '«Биолот» 0,5 %' }) + '</td>' +
        '<td>' + inputHtml(pre + 'itemName', row.itemName) + '</td>' +
        '<td>' + inputHtml(pre + 'qty', row.qty, { type: 'number', rule: 'number', min: 0, max: 9999 }) + '</td>' +
        '<td>' + inputHtml(pre + 'contaminatedBlood', row.contaminatedBlood, { type: 'number', rule: 'number', min: 0, max: 9999 }) + '</td>' +
        '<td>' + inputHtml(pre + 'contaminatedDetergent', row.contaminatedDetergent, { type: 'number', rule: 'number', min: 0, max: 9999 }) + '</td>' +
        '<td>' + inputHtml(pre + 'fio', row.fio) + '</td>' +
        '<td class="row-actions"><button type="button" data-action="cso-remove" data-idx="' + idx + '" title="Удалить строку">✕</button></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="9" class="muted">Нет строк контроля. Добавьте строку.</td></tr>';
  };

  RENDERERS.csoTotals = function (el) {
    var rows = state.cso.rows || [];
    if (!rows.length) {
      el.innerHTML = '<tr><td colspan="9" class="muted">Итоги появятся после заполнения.</td></tr>';
      return;
    }
    var qty = rows.reduce(function (a, r) { return a + n(r.qty); }, 0);
    var blood = rows.reduce(function (a, r) { return a + n(r.contaminatedBlood); }, 0);
    var det = rows.reduce(function (a, r) { return a + n(r.contaminatedDetergent); }, 0);
    el.innerHTML = '<tr><td colspan="4">Итого</td><td>' + qty + '</td><td>' + blood + '</td><td>' + det + '</td><td colspan="2"></td></tr>';
  };

  RENDERERS.prescriptions = function (el) {
    var rows = getPath(state, 'treatment.prescriptions.rows') || [];
    el.innerHTML = rows.map(function (row, idx) {
      var pre = 'treatment.prescriptions.rows.' + idx + '.';
      var cancelled = /отмен/i.test(String(row.status || '')) || /отмен/i.test(String(row.note || ''));
      return '<tr data-row="' + idx + '"' + (cancelled ? ' class="rx-cancelled"' : '') + '>' +
        '<td>' + inputHtml(pre + 'date', row.date, { type: 'date' }) + '</td>' +
        '<td>' + inputHtml(pre + 'drug', row.drug, { placeholder: 'Препарат' }) +
        '<div style="margin-top:4px">' + inputHtml(pre + 'note', row.note, { placeholder: 'Примечание / причина отмены', cls: 'form-input', title: 'Примечание' }) + '</div></td>' +
        '<td>' + inputHtml(pre + 'dose', row.dose, { placeholder: '1 г' }) + '</td>' +
        '<td>' + inputHtml(pre + 'route', row.route, { placeholder: 'Внутривенно' }) + '</td>' +
        '<td>' + inputHtml(pre + 'frequency', row.frequency, { placeholder: '2 раза в сутки' }) + '</td>' +
        '<td>' + inputHtml(pre + 'diet', row.diet, { placeholder: 'ОВД' }) + '</td>' +
        '<td>' + inputHtml(pre + 'mode', row.mode, { placeholder: 'Палатный' }) + '</td>' +
        '<td>' + selectHtml(pre + 'status', row.status, ['Назначен', 'Выполнен', 'Отменён']) + '</td>' +
        '<td>' + inputHtml(pre + 'markDate', row.markDate, { type: 'date' }) + '</td>' +
        '<td>' + inputHtml(pre + 'markTime', row.markTime, { type: 'time' }) + '</td>' +
        '<td>' + inputHtml(pre + 'markSign', row.markSign, { placeholder: 'Фамилия И. О.' }) + '</td>' +
        '<td style="text-align:center">' + checkboxHtml(pre + 'markDone', row.markDone) + '</td>' +
        '<td class="row-actions"><button type="button" data-action="rx-remove" data-idx="' + idx + '" title="Удалить назначение">✕</button></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="13" class="muted">Назначений нет. Добавьте назначение или загрузите кейс.</td></tr>';
  };

  RENDERERS.anesthesiaMonitor = function (el) {
    var rows = getPath(state, 'treatment.anesthesia.monitor') || [];
    el.innerHTML = rows.map(function (row, idx) {
      var pre = 'treatment.anesthesia.monitor.' + idx + '.';
      return '<tr data-row="' + idx + '">' +
        '<td>' + inputHtml(pre + 'time', row.time, { type: 'time' }) + '</td>' +
        '<td>' + inputHtml(pre + 'bp', row.bp, { placeholder: '120/75' }) + '</td>' +
        '<td>' + inputHtml(pre + 'hr', row.hr, { type: 'number', rule: 'number', min: 20, max: 250 }) + '</td>' +
        '<td>' + inputHtml(pre + 'spo2', row.spo2, { type: 'number', rule: 'number', min: 50, max: 100 }) + '</td>' +
        '<td>' + inputHtml(pre + 'etco2', row.etco2, { type: 'number', rule: 'number', min: 10, max: 80 }) + '</td>' +
        '<td>' + inputHtml(pre + 'temp', row.temp, { type: 'number', step: '0.1', rule: 'number', min: 30, max: 45 }) + '</td>' +
        '<td class="row-actions"><button type="button" data-action="monitor-remove" data-idx="' + idx + '" title="Удалить точку">✕</button></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="7" class="muted">Нет точек мониторинга.</td></tr>';
  };

  RENDERERS.icu = function (el) {
    var rows = getPath(state, 'treatment.icu.rows') || [];
    el.innerHTML = rows.map(function (row, idx) {
      var pre = 'treatment.icu.rows.' + idx + '.';
      var balance = n(row.parenteralVolume) + n(row.enteralVolume) - n(row.urine) - n(row.losses);
      return '<tr data-row="' + idx + '">' +
        '<td>' + inputHtml(pre + 'hour', row.hour, { type: 'time' }) + '</td>' +
        '<td>' + inputHtml(pre + 'parenteral', row.parenteral, { placeholder: 'Раствор Рингера 500 мл' }) + '</td>' +
        '<td>' + inputHtml(pre + 'parenteralVolume', row.parenteralVolume, { type: 'number', rule: 'number', min: 0, max: 20000 }) + '</td>' +
        '<td>' + inputHtml(pre + 'enteral', row.enteral, { placeholder: 'Вода 100 мл' }) + '</td>' +
        '<td>' + inputHtml(pre + 'enteralVolume', row.enteralVolume, { type: 'number', rule: 'number', min: 0, max: 20000 }) + '</td>' +
        '<td>' + inputHtml(pre + 'urine', row.urine, { type: 'number', rule: 'number', min: 0, max: 20000 }) + '</td>' +
        '<td>' + inputHtml(pre + 'losses', row.losses, { type: 'number', rule: 'number', min: 0, max: 20000 }) + '</td>' +
        '<td class="cell-computed" data-cell="icu-balance-' + idx + '">' + (balance > 0 ? '+' : '') + balance + '</td>' +
        '<td class="row-actions"><button type="button" data-action="icu-remove" data-idx="' + idx + '" title="Удалить час">✕</button></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="9" class="muted">Нет записей.</td></tr>';
  };

  RENDERERS.icuTotals = function (el) {
    var rows = getPath(state, 'treatment.icu.rows') || [];
    if (!rows.length) {
      el.innerHTML = '<tr><td colspan="9" class="muted">Итоги появятся после заполнения.</td></tr>';
      return;
    }
    var inP = rows.reduce(function (a, r) { return a + n(r.parenteralVolume); }, 0);
    var inE = rows.reduce(function (a, r) { return a + n(r.enteralVolume); }, 0);
    var urine = rows.reduce(function (a, r) { return a + n(r.urine); }, 0);
    var losses = rows.reduce(function (a, r) { return a + n(r.losses); }, 0);
    var balance = inP + inE - urine - losses;
    el.innerHTML = '<tr><td colspan="2">Итого</td><td>' + inP + '</td><td></td><td>' + inE + '</td><td>' + urine + '</td><td>' + losses + '</td><td>' + (balance > 0 ? '+' : '') + balance + '</td><td></td></tr>';
  };

  RENDERERS.radiation = function (el) {
    var rows = getPath(state, 'treatment.radiation.rows') || [];
    el.innerHTML = rows.map(function (row, idx) {
      var pre = 'treatment.radiation.rows.' + idx + '.';
      return '<tr data-row="' + idx + '">' +
        '<td>' + inputHtml(pre + 'date', row.date, { type: 'date', rule: 'date' }) + '</td>' +
        '<td>' + inputHtml(pre + 'study', row.study, { placeholder: 'Компьютерная томография' }) + '</td>' +
        '<td>' + inputHtml(pre + 'area', row.area, { placeholder: 'Брюшная полость' }) + '</td>' +
        '<td>' + inputHtml(pre + 'dose', row.dose, { type: 'number', step: '0.1', rule: 'number', min: 0, max: '1000' }) + '</td>' +
        '<td class="row-actions"><button type="button" data-action="rad-remove" data-idx="' + idx + '" title="Удалить исследование">✕</button></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="5" class="muted">Нет исследований.</td></tr>';
  };

  RENDERERS.radiationTotals = function (el) {
    var rows = getPath(state, 'treatment.radiation.rows') || [];
    if (!rows.length) {
      el.innerHTML = '<tr><td colspan="5" class="muted">Итог появится после заполнения.</td></tr>';
      return;
    }
    var total = rows.reduce(function (a, r) { return a + n(r.dose); }, 0);
    el.innerHTML = '<tr><td colspan="3">Суммарная доза</td><td>' + total.toFixed(1) + ' мЗв</td><td></td></tr>';
  };

  RENDERERS.tempHead = function (el) {
    var days = getPath(state, 'treatment.temp.days') || [];
    if (!days.length) {
      el.innerHTML = '<th class="pair-col">Д1</th>';
      return;
    }
    el.innerHTML = days.map(function (day, idx) {
      return '<th class="pair-col">Д' + (idx + 1) +
        '<button type="button" data-action="temp-remove-day" data-idx="' + idx + '" title="Удалить день" style="margin-left:4px;border:0;background:transparent;color:#c62828;cursor:pointer">✕</button></th>';
    }).join('');
  };

  RENDERERS.tempBody = function (el) {
    var days = getPath(state, 'treatment.temp.days') || [];
    if (!days.length) {
      el.innerHTML = '<tr><td colspan="2" class="muted">Нет дней наблюдения. Нажмите «+ День наблюдения».</td></tr>';
      return;
    }
    ensureTempArrays(days.length);
    var extra = state.treatment.temp;

    function row(label, key) {
      var dayKeys = ['pulseAm', 'pulsePm', 'adAm', 'adPm', 'tAm', 'tPm'];
      var isDayValue = dayKeys.indexOf(key) !== -1;
      var isText = key === 'adAm' || key === 'adPm';
      var html = '<tr><td class="param-col">' + esc(label) + '</td>';
      days.forEach(function (day, idx) {
        var path;
        if (isDayValue) path = 'treatment.temp.days.' + idx + '.' + key;
        else path = 'treatment.temp.' + key + '.' + idx;
        var value = isDayValue ? day[key] : (extra[key] || [])[idx];
        var critical = (key === 'tAm' || key === 'tPm') && isCriticalTemp(value);
        html += '<td class="' + (critical ? 'is-critical' : '') + '" data-temp-cell="' + idx + '-' + key + '">' +
          inputHtml(path, value, {
            type: isText ? 'text' : 'number',
            step: (key === 'tAm' || key === 'tPm' || key === 'weight') ? '0.1' : undefined,
            min: key === 'pulseAm' || key === 'pulsePm' ? 20 : (key === 'tAm' || key === 'tPm' ? 30 : 0),
            max: key === 'pulseAm' || key === 'pulsePm' ? 250 : (key === 'tAm' || key === 'tPm' ? 45 : 10000),
            rule: isText ? '' : 'number'
          }) + '</td>';
      });
      return html + '</tr>';
    }

    el.innerHTML =
      '<tr><td class="param-col">День болезни</td>' + days.map(function (day, idx) {
        return '<td>' + inputHtml('treatment.temp.dayNumbers.' + idx, (extra.dayNumbers || [])[idx], { type: 'number', min: 0, max: 999, rule: 'number' }) + '</td>';
      }).join('') + '</tr>' +
      '<tr><td class="param-col">День пребывания в стационаре</td>' + days.map(function (day, idx) {
        return '<td>' + inputHtml('treatment.temp.stayDay.' + idx, (extra.stayDay || [])[idx], { type: 'number', min: 0, max: 999, rule: 'number' }) + '</td>';
      }).join('') + '</tr>' +
      '<tr><td class="param-col">Дата</td>' + days.map(function (day, idx) {
        return '<td>' + inputHtml('treatment.temp.days.' + idx + '.date', day.date, { type: 'date', rule: 'date' }) + '</td>';
      }).join('') + '</tr>' +
      row('Пульс, утро (П)', 'pulseAm') +
      row('Пульс, вечер (П)', 'pulsePm') +
      row('АД, утро (мм рт. ст.)', 'adAm') +
      row('АД, вечер (мм рт. ст.)', 'adPm') +
      row('Температура, утро (°C)', 'tAm') +
      row('Температура, вечер (°C)', 'tPm') +
      row('Дыхание, в минуту', 'breath') +
      row('Вес, кг', 'weight') +
      row('Выпито жидкости, мл', 'fluid') +
      row('Суточное количество мочи, мл', 'urine') +
      '<tr><td class="param-col">Стул</td>' + days.map(function (day, idx) {
        return '<td>' + inputHtml('treatment.temp.stool.' + idx, (extra.stool || [])[idx], {}) + '</td>';
      }).join('') + '</tr>' +
      '<tr><td class="param-col">Ванна</td>' + days.map(function (day, idx) {
        return '<td>' + inputHtml('treatment.temp.bath.' + idx, (extra.bath || [])[idx], {}) + '</td>';
      }).join('') + '</tr>';
  };

  function isCriticalTemp(value) {
    var raw = String(value === null || value === undefined ? '' : value).trim();
    if (!raw) return false;
    var v = Number(raw.replace(',', '.'));
    return isFinite(v) && v > 0 && (v >= 39 || v <= 35);
  }

  function ensureTempArrays(length) {
    var temp = state.treatment.temp;
    ['dayNumbers', 'stayDay', 'breath', 'weight', 'fluid', 'urine', 'stool', 'bath'].forEach(function (key) {
      if (!Array.isArray(temp[key])) temp[key] = [];
      while (temp[key].length < length) temp[key].push('');
      if (temp[key].length > length) temp[key] = temp[key].slice(0, length);
    });
  }

  /* ============================================================
     ВЫЧИСЛЯЕМЫЕ ПОКАЗАТЕЛИ
     ============================================================ */
  function updateComputed() {
    if (!state) return;

    var bmiEl = $('[data-computed="bmi"]');
    if (bmiEl) {
      var height = n(getPath(state, 'treatment.exam.height'));
      var weight = n(getPath(state, 'treatment.exam.weight'));
      if (height > 0 && weight > 0) {
        var bmi = weight / Math.pow(height / 100, 2);
        bmiEl.value = bmi.toFixed(1);
        bmiEl.title = bmi < 18.5 ? 'Дефицит массы тела' : bmi < 25 ? 'Норма' : bmi < 30 ? 'Избыточная масса тела' : 'Ожирение';
      } else {
        bmiEl.value = '';
      }
    }

    var instEl = $('[data-computed="instrumentConsistency"]');
    if (instEl) {
      var op = getPath(state, 'treatment.operation') || {};
      if (op.opInstrumentsBefore === '' || op.opInstrumentsAfter === '' || !op.opInstrumentsBefore || !op.opInstrumentsAfter) {
        instEl.textContent = 'Заполните количество инструментов и салфеток до и после операции.';
        instEl.className = 'consent-box';
      } else {
        var okInst = n(op.opInstrumentsBefore) === n(op.opInstrumentsAfter);
        var okTamp = n(op.opTamponsBefore) === n(op.opTamponsAfter);
        if (okInst && okTamp) {
          instEl.textContent = '✓ Инструменты и салфетки сходятся: ' + n(op.opInstrumentsBefore) + ' / ' + n(op.opTamponsBefore) + '.';
          instEl.className = 'consent-box';
          instEl.style.borderColor = '#b3e0c8';
          instEl.style.background = '#e9f7f0';
        } else {
          instEl.textContent = '✕ Расхождение подсчёта: инструменты ' + n(op.opInstrumentsBefore) + ' / ' + n(op.opInstrumentsAfter) +
            ', салфетки ' + n(op.opTamponsBefore) + ' / ' + n(op.opTamponsAfter) + '.';
          instEl.className = 'consent-box';
          instEl.style.borderColor = '#efb6b6';
          instEl.style.background = '#fdecec';
        }
      }
    }

    var matchEl = $('[data-computed="transfusionMatch"]');
    if (matchEl) {
      var card = state.card003 || {};
      var trans = getPath(state, 'treatment.transfusion') || {};
      var problems = [];
      if (trans.recipientGroup && card.bloodGroup &&
          global.ClinicValidation.normBlood(trans.recipientGroup) !== global.ClinicValidation.normBlood(card.bloodGroup)) {
        problems.push('группа крови');
      }
      if (trans.recipientRh && card.rhFactor &&
          global.ClinicValidation.normRh(trans.recipientRh) !== global.ClinicValidation.normRh(card.rhFactor)) {
        problems.push('резус');
      }
      if (trans.recipientKell && card.kell &&
          global.ClinicValidation.normKell(trans.recipientKell) !== global.ClinicValidation.normKell(card.kell)) {
        problems.push('Kell');
      }
      if (!trans.recipientGroup && !trans.recipientRh) {
        matchEl.textContent = 'Проверка совместимости';
        matchEl.className = 'badge badge-soft';
      } else if (problems.length) {
        matchEl.textContent = 'Несовпадение: ' + problems.join(', ');
        matchEl.className = 'badge badge-critical';
      } else {
        matchEl.textContent = 'Данные реципиента совпадают с 003/у';
        matchEl.className = 'badge badge-ok';
      }
    }

    var consentEl = $('[data-computed="consentStatus"]');
    if (consentEl) {
      var cons = state.consent || {};
      var consDecision = String(cons.decision || '');
      var consHasData = ['fio', 'diagnosis', 'intervention', 'decision', 'patientSign'].some(function (k) { return !!cons[k]; });
      if (!consHasData) {
        consentEl.textContent = 'Не оформлено';
        consentEl.className = 'badge badge-soft';
      } else if (/отказ/i.test(consDecision)) {
        consentEl.textContent = 'Отказ зафиксирован';
        consentEl.className = 'badge badge-hard';
      } else if (/соглас/i.test(consDecision) && cons.consentGiven && cons.patientSign) {
        consentEl.textContent = 'Согласие оформлено';
        consentEl.className = 'badge badge-ok';
      } else {
        consentEl.textContent = 'Требует оформления';
        consentEl.className = 'badge badge-major';
      }
    }

    var rxEl = $('[data-computed="rxSummary"]');
    if (rxEl) {
      var rxRows = getPath(state, 'treatment.prescriptions.rows') || [];
      var done = rxRows.filter(function (r) { return r.markDone; }).length;
      var cancelled = rxRows.filter(function (r) { return /отмен/i.test(String(r.status || '')) || /отмен/i.test(String(r.note || '')); }).length;
      rxEl.textContent = rxRows.length + ' назначений · выполнено ' + done + ' · отменено ' + cancelled;
    }

    var statsEl = $('#tempChartStats');
    if (statsEl && chart) {
      var st = chart.getStats();
      if (st.days) {
        statsEl.textContent = 'Дней: ' + st.days + '. Температура: ' + (st.tempMin !== null ? st.tempMin.toFixed(1) : '—') +
          '–' + (st.tempMax !== null ? st.tempMax.toFixed(1) : '—') + ' °C. Критических точек: ' + st.critical + '.';
      }
    }
  }

  function updateSummaries() {
    if (!state) return;
    var jRow = (state.j001.rows || [])[n(state.j001.selected)] || {};
    setText('[data-summary="journalPatient"]', jRow.fio || '—');
    setText('[data-summary="journalCard"]', jRow.cardNo || '—');
    setText('[data-summary="journalDept"]', jRow.department || '—');
    setText('[data-summary="journalOutcome"]', jRow.outcome || '—');

    var bedRows = state.dept007.rows || [];
    var beds = bedRows.reduce(function (a, r) { return a + n(r.beds); }, 0);
    var current = bedRows.reduce(function (a, r) { return a + n(r.current); }, 0);
    var free = bedRows.reduce(function (a, r) { return a + n(r.freeM) + n(r.freeF); }, 0);
    setText('[data-summary="bedsTotal"]', String(beds));
    setText('[data-summary="bedsCurrent"]', String(current));
    setText('[data-summary="bedsFree"]', String(free));
    var bedDiff = 0;
    bedRows.forEach(function (r) {
      var expected = n(r.before) + n(r.admitted) + n(r.transfIn) - n(r.transfOut) - n(r.discharged) - n(r.died);
      bedDiff += n(r.current) - expected;
    });
    var bedBox = $('[data-summary-box="bedsBalance"]');
    if (bedBox) {
      bedBox.classList.toggle('is-bad', bedDiff !== 0);
      bedBox.classList.toggle('is-good', bedRows.length > 0 && bedDiff === 0);
    }
    setText('[data-summary="bedsBalance"]', bedRows.length ? (bedDiff === 0 ? 'сходится' : (bedDiff > 0 ? '+' : '') + bedDiff) : '—');

    var foodRows = state.nutrition.rows || [];
    var patients = foodRows.reduce(function (a, r) { return a + n(r.patients); }, 0);
    var portions = foodRows.reduce(function (a, r) {
      return a + ['ovd', 'shchd', 'vbd', 'nkd', 'vkd', 'ovd1', 'highProtein'].reduce(function (b, k) { return b + n(r[k]); }, 0);
    }, 0);
    setText('[data-summary="dietPatients"]', String(patients));
    setText('[data-summary="dietPortions"]', String(portions));
    var dietDiff = portions - patients;
    var dietBox = $('[data-summary-box="dietDelta"]');
    if (dietBox) {
      dietBox.classList.toggle('is-bad', foodRows.length > 0 && dietDiff !== 0);
      dietBox.classList.toggle('is-good', foodRows.length > 0 && dietDiff === 0);
    }
    setText('[data-summary="dietDelta"]', foodRows.length ? (dietDiff > 0 ? '+' : '') + dietDiff : '0');

    var csoRows = state.cso.rows || [];
    var qty = csoRows.reduce(function (a, r) { return a + n(r.qty); }, 0);
    var blood = csoRows.reduce(function (a, r) { return a + n(r.contaminatedBlood); }, 0);
    var det = csoRows.reduce(function (a, r) { return a + n(r.contaminatedDetergent); }, 0);
    setText('[data-summary="csoQty"]', String(qty));
    setText('[data-summary="csoBlood"]', String(blood));
    setText('[data-summary="csoDetergent"]', String(det));
    var qualityBox = $('[data-summary-box="csoQuality"]');
    if (qualityBox) {
      qualityBox.classList.toggle('is-bad', (blood + det) > 0);
      qualityBox.classList.toggle('is-good', qty > 0 && (blood + det) === 0);
    }
    setText('[data-summary="csoQuality"]', qty ? (((blood + det) === 0) ? 'удовлетворительно' : 'требует повторной обработки') : '—');

    var icuRows = getPath(state, 'treatment.icu.rows') || [];
    var inP = icuRows.reduce(function (a, r) { return a + n(r.parenteralVolume) + n(r.enteralVolume); }, 0);
    var outP = icuRows.reduce(function (a, r) { return a + n(r.urine) + n(r.losses); }, 0);
    setText('[data-summary="icuIn"]', String(inP));
    setText('[data-summary="icuOut"]', String(outP));
    setText('[data-summary="icuBalance"]', (inP - outP > 0 ? '+' : '') + (inP - outP));
    var icuBox = $('[data-summary-box="icuBalance"]');
    if (icuBox) {
      icuBox.classList.toggle('is-bad', icuRows.length > 0 && Math.abs(inP - outP) > 1500);
    }

    var s016Rows = state.summary016.rows || [];
    var s016End = s016Rows.reduce(function (a, r) { return a + n(r.end); }, 0);
    var s016BedDays = s016Rows.reduce(function (a, r) { return a + n(r.bedDays); }, 0);
    var s016Free = s016Rows.reduce(function (a, r) { return a + n(r.freeM) + n(r.freeF); }, 0);
    setText('[data-summary="s016End"]', String(s016End));
    setText('[data-summary="s016BedDays"]', String(s016BedDays));
    setText('[data-summary="s016Free"]', String(s016Free));
    var s016Diff = 0;
    s016Rows.forEach(function (r) {
      var expected = n(r.start) + n(r.admitted) + n(r.transfIn) - n(r.transfOut) - n(r.discharged) - n(r.died);
      s016Diff += n(r.end) - expected;
    });
    var s016Box = $('[data-summary-box="s016Balance"]');
    if (s016Box) {
      s016Box.classList.toggle('is-bad', s016Diff !== 0);
      s016Box.classList.toggle('is-good', s016Rows.length > 0 && s016Diff === 0);
    }
    setText('[data-summary="s016Balance"]', s016Rows.length ? (s016Diff === 0 ? 'сходится' : (s016Diff > 0 ? '+' : '') + s016Diff) : '—');

    var result = state.meta && state.meta.result;
    var progress = result && result.progress ? result.progress : (state.progress || global.ClinicValidation.completeness(state));
    setText('[data-summary="teacherReception"]', avgProgress(progress, GROUPS.reception) + ' %');
    setText('[data-summary="teacherTreatment"]', avgProgress(progress, GROUPS.treatment) + ' %');
    setText('[data-summary="teacherDepartment"]', avgProgress(progress, GROUPS.department) + ' %');
    setText('[data-summary="teacherCso"]', avgProgress(progress, GROUPS.cso) + ' %');
  }

  function avgProgress(progress, keys) {
    var sum = 0;
    keys.forEach(function (k) { sum += (progress[k] || 0); });
    return keys.length ? Math.round(sum / keys.length) : 0;
  }

  function setText(selector, text) {
    $$(selector).forEach(function (el) { el.textContent = text; });
  }

  function updateCounters() {
    if (!state) return;
    setText('[data-counter="journalRows"]', String((state.j001.rows || []).length));
    setText('[data-counter="bedRows"]', String((state.dept007.rows || []).length));
    setText('[data-counter="dietRows"]', String((state.nutrition.rows || []).length));
    setText('[data-counter="csoRows"]', String((state.cso.rows || []).length));
    setText('[data-counter="tempDays"]', String(getPath(state, 'treatment.temp.days.length') || 0));
    setText('[data-counter="monitorRows"]', String(getPath(state, 'treatment.anesthesia.monitor.length') || 0));
    setText('[data-counter="icuRows"]', String(getPath(state, 'treatment.icu.rows.length') || 0));
    setText('[data-counter="radRows"]', String(getPath(state, 'treatment.radiation.rows.length') || 0));
    var rxRows = getPath(state, 'treatment.prescriptions.rows') || [];
    setText('[data-counter="rxRows"]', String(rxRows.length));
    setText('[data-counter="rxDone"]', String(rxRows.filter(function (r) { return r.markDone; }).length));
    setText('[data-counter="rxCancelled"]', String(rxRows.filter(function (r) {
      return /отмен/i.test(String(r.status || '')) || /отмен/i.test(String(r.note || ''));
    }).length));
    setText('[data-counter="op008Rows"]', String((state.operations008.rows || []).length));
    setText('[data-counter="s066MoveRows"]', String((getPath(state, 'stat066.movements') || []).length));
    setText('[data-counter="s016Rows"]', String((state.summary016.rows || []).length));
    setText('[data-counter="endoRows"]', String((state.endoscopy.rows || []).length));
    setText('[data-counter="diaryRows"]', String((state.diary.rows || []).length));
  }

  function updateProgressUI() {
    if (!state) return;
    var progress = global.ClinicValidation.completeness(state);
    state.progress = progress;
    var fill = $('#progressFill');
    if (fill) fill.style.width = progress.total + '%';
    setText('#progressLabel', 'Заполнено ' + progress.total + '%');
  }

  /* ============================================================
     ГРАФИК
     ============================================================ */
  function initChart() {
    var canvas = document.getElementById('tempChart');
    if (!canvas || !global.TempChart) return;
    if (chart && chart.canvas !== canvas) {
      chart.destroy();
      chart = null;
    }
    if (!chart) chart = new global.TempChart(canvas);
    refreshChart();
  }

  function refreshChart() {
    if (!chart) return;
    var days = getPath(state, 'treatment.temp.days') || [];
    chart.setData(days);
    var empty = $('#tempChartEmpty');
    if (empty) empty.hidden = days.length > 0;
    var statsEl = $('#tempChartStats');
    var st = chart.getStats();
    if (statsEl) {
      if (st.days) {
        statsEl.textContent = 'Дней: ' + st.days + '. Температура: ' +
          (st.tempMin !== null ? st.tempMin.toFixed(1) : '—') + '–' +
          (st.tempMax !== null ? st.tempMax.toFixed(1) : '—') + ' °C. Критических точек: ' + st.critical + '.';
      } else {
        statsEl.textContent = 'Нет данных';
      }
    }
  }

  function scheduleChart() {
    global.clearTimeout(chartDebounce);
    chartDebounce = global.setTimeout(function () {
      refreshChart();
      updateComputed();
    }, 140);
  }

  /* ============================================================
     ОБРАБОТКА ВВОДА
     ============================================================ */
  function paintField(el) {
    var field = el.closest('.field');
    var res = global.ClinicValidation.validateInput(el, false);
    if (field) {
      field.classList.toggle('is-invalid', res.level === 'error' && String(el.value || '').length > 0);
      var msg = field.querySelector('.field-message');
      if (!msg) {
        msg = document.createElement('p');
        msg.className = 'field-message';
        field.appendChild(msg);
      }
      if (res.level === 'error' && String(el.value || '').length > 0) {
        msg.textContent = res.message;
        msg.dataset.invalid = '1';
      } else if (msg.dataset.invalid === '1') {
        msg.textContent = '';
        delete msg.dataset.invalid;
      }
    } else {
      el.classList.toggle('is-warn', res.level === 'error' && String(el.value || '').length > 0);
      if (res.level === 'error' && String(el.value || '').length > 0) el.title = res.message;
      else el.removeAttribute('title');
    }
  }

  function handleBoundInput(el, eventType) {
    var path = el.getAttribute('data-bind');
    if (!path) return;
    if (el.getAttribute('data-mask') && eventType === 'input') {
      global.ClinicValidation.applyMask(el);
    }
    var value;
    if (el.type === 'checkbox') value = el.checked;
    else if (el.type === 'radio') {
      if (!el.checked) return;
      value = el.value;
    } else {
      value = el.value;
    }
    setPath(state, path, value);
    el.classList.remove('is-invalid');
    if (eventType === 'input' || eventType === 'change') paintField(el);
    if (eventType === 'change') recordAudit('edit', path, String(value).slice(0, 200));
    afterChange(path);
    scheduleSave();
  }

  function afterChange(path) {
    if (path.indexOf('treatment.temp.') === 0) {
      scheduleChart();
      if (/tAm|tPm/.test(path)) {
        var parts = path.split('.');
        var idx = Number(parts[parts.length - 1]);
        var field = parts[parts.length - 2];
        var val = getPath(state, path);
        var cell = $('[data-temp-cell="' + idx + '-' + field + '"]');
        if (cell) cell.classList.toggle('is-critical', isCriticalTemp(val));
      }
    }
    if (path.indexOf('treatment.icu.rows.') === 0) {
      var icuParts = path.split('.');
      var icuIdx = Number(icuParts[3]);
      var row = getPath(state, 'treatment.icu.rows.' + icuIdx);
      if (row) {
        var balance = n(row.parenteralVolume) + n(row.enteralVolume) - n(row.urine) - n(row.losses);
        var cellBal = $('[data-cell="icu-balance-' + icuIdx + '"]');
        if (cellBal) cellBal.textContent = (balance > 0 ? '+' : '') + balance;
        var elBal = $('[data-bind="treatment.icu.totalBalance"]');
        if (elBal) {
          var allRows = getPath(state, 'treatment.icu.rows') || [];
          var total = allRows.reduce(function (a, r) {
            return a + n(r.parenteralVolume) + n(r.enteralVolume) - n(r.urine) - n(r.losses);
          }, 0);
          setPath(state, 'treatment.icu.totalBalance', (total > 0 ? '+' : '') + total);
          elBal.value = (total > 0 ? '+' : '') + total;
        }
      }
      var totalsTbody = $('[data-render="icuTotals"]');
      if (totalsTbody) { totalsTbody.dataset.rendered = '0'; renderDynamic(totalsTbody.parentElement, true); }
    }
    if (path.indexOf('nutrition.rows.') === 0) {
      var dietParts = path.split('.');
      var dietIdx = Number(dietParts[2]);
      var dietRow = getPath(state, 'nutrition.rows.' + dietIdx);
      if (dietRow) {
        var sumCell = $('[data-cell="diet-sum-' + dietIdx + '"]');
        if (sumCell) {
          var sum = ['ovd', 'shchd', 'vbd', 'nkd', 'vkd', 'ovd1', 'highProtein'].reduce(function (a, k) {
            return a + n(dietRow[k]);
          }, 0);
          sumCell.textContent = sum;
        }
        var totalsEl = $('[data-render="nutritionTotals"]');
        if (totalsEl) { totalsEl.dataset.rendered = '0'; RENDERERS.nutritionTotals(totalsEl); }
      }
    }
    if (path.indexOf('dept007.rows.') === 0) {
      var bedEl = $('[data-render="dept007Totals"]');
      if (bedEl) { bedEl.dataset.rendered = '0'; RENDERERS.dept007Totals(bedEl); }
    }
    if (path.indexOf('treatment.radiation.rows.') === 0) {
      var radRows = getPath(state, 'treatment.radiation.rows') || [];
      var radTotal = radRows.reduce(function (a, r) { return a + n(r.dose); }, 0);
      setPath(state, 'treatment.radiation.totalDose', radTotal ? radTotal.toFixed(1) : '');
      var radEl = $('[data-bind="treatment.radiation.totalDose"]');
      if (radEl) radEl.value = radTotal ? radTotal.toFixed(1) : '';
      var radTotals = $('[data-render="radiationTotals"]');
      if (radTotals) { radTotals.dataset.rendered = '0'; RENDERERS.radiationTotals(radTotals); }
    }
    if (path.indexOf('treatment.prescriptions.rows.') === 0) {
      var rxTbody = $('[data-render="prescriptions"]');
      if (rxTbody) {
        var rxParts = path.split('.');
        var rxIdx = Number(rxParts[3]);
        var rxRow = getPath(state, 'treatment.prescriptions.rows.' + rxIdx);
        var tr = $('tr[data-row="' + rxIdx + '"]', rxTbody);
        if (tr && rxRow) {
          tr.classList.toggle('rx-cancelled', /отмен/i.test(String(rxRow.status || '')) || /отмен/i.test(String(rxRow.note || '')));
        }
      }
    }
    updateComputed();
    updateSummaries();
    updateCounters();
    updateProgressUI();
  }

  /* ============================================================
     ДЕЙСТВИЯ
     ============================================================ */
  function addJournalRow() {
    state.j001.rows.push(newRow001());
    state.j001.selected = state.j001.rows.length - 1;
    reRenderJournal();
    scheduleSave();
    toast('Запись добавлена', 'Заполните графы журнала 001/у.', 'success');
  }

  function reRenderJournal() {
    var tbody = $('[data-render="journal001"]');
    if (tbody) { tbody.dataset.rendered = '0'; RENDERERS.journal001(tbody); tbody.dataset.rendered = '1'; }
    var sel = $('[data-render="journalSelect"]');
    if (sel) { sel.dataset.rendered = '0'; RENDERERS.journalSelect(sel); sel.dataset.rendered = '1'; }
    updateSummaries();
    updateCounters();
  }

  function selectJournalRow(idx) {
    state.j001.selected = Number(idx);
    reRenderJournal();
    var sel = $('[data-render="journalSelect"]');
    if (sel) sel.value = String(idx);
    scheduleSave();
  }

  function addBedRow() {
    state.dept007.rows.push({
      profile: '', beds: '', closed: '0', before: '', admitted: '0', fromDay: '0', fromRural: '0',
      children: '0', elderly: '0', transfIn: '0', transfOut: '0', discharged: '0', dischElderly: '0',
      dischDay: '0', dischHospital: '0', died: '0', diedChildren: '0', diedElderly: '0',
      current: '', currentElderly: '0', caregivers: '0', freeM: '0', freeF: '0'
    });
    reRender007();
    scheduleSave();
  }

  function reRender007() {
    var tbody = $('[data-render="dept007"]');
    if (tbody) { tbody.dataset.rendered = '0'; RENDERERS.dept007(tbody); tbody.dataset.rendered = '1'; }
    var totals = $('[data-render="dept007Totals"]');
    if (totals) { totals.dataset.rendered = '0'; RENDERERS.dept007Totals(totals); totals.dataset.rendered = '1'; }
    updateSummaries();
    updateCounters();
  }

  function recalcBeds() {
    (state.dept007.rows || []).forEach(function (row, idx) {
      var expected = n(row.before) + n(row.admitted) + n(row.transfIn) - n(row.transfOut) - n(row.discharged) - n(row.died);
      row.current = String(expected);
      var input = $('[data-bind="dept007.rows.' + idx + '.current"]');
      if (input) input.value = expected;
    });
    reRender007();
    saveNow();
    var diffs = (state.dept007.rows || []).length;
    toast('Баланс коек пересчитан', diffs ? 'Графа 19 приведена к формуле движения пациентов.' : 'Нет строк для расчёта.', 'success');
  }

  function addDietRow() {
    state.nutrition.rows.push({
      department: state.nutrition.department || '', patients: '', ovd: '0', shchd: '0', vbd: '0',
      nkd: '0', vkd: '0', ovd1: '0', highProtein: '0'
    });
    reRenderNutrition();
    scheduleSave();
  }

  function reRenderNutrition() {
    var tbody = $('[data-render="nutrition"]');
    if (tbody) { tbody.dataset.rendered = '0'; RENDERERS.nutrition(tbody); tbody.dataset.rendered = '1'; }
    var totals = $('[data-render="nutritionTotals"]');
    if (totals) { totals.dataset.rendered = '0'; RENDERERS.nutritionTotals(totals); totals.dataset.rendered = '1'; }
    updateSummaries();
    updateCounters();
  }

  function recalcDiets() {
    var rows = state.nutrition.rows || [];
    var patients = rows.reduce(function (a, r) { return a + n(r.patients); }, 0);
    var portions = rows.reduce(function (a, r) {
      return a + ['ovd', 'shchd', 'vbd', 'nkd', 'vkd', 'ovd1', 'highProtein'].reduce(function (b, k) { return b + n(r[k]); }, 0);
    }, 0);
    updateSummaries();
    if (!rows.length) {
      toast('Порционник пуст', 'Добавьте отделение и заполните диеты.', 'warn');
      return;
    }
    if (patients === portions) {
      toast('Порционник сходится', 'Число порций соответствует числу пациентов: ' + patients + '.', 'success');
    } else {
      toast('Расхождение в порционнике', 'Пациентов: ' + patients + ', порций: ' + portions + '. Разница: ' + (portions - patients > 0 ? '+' : '') + (portions - patients) + '.', 'warn');
      var box = $('[data-summary-box="dietDelta"]');
      if (box) box.classList.add('is-bad');
    }
  }

  function addCsoRow() {
    state.cso.rows.push({
      date: todayIso(), method: 'Ручной', agent: '', itemName: '', qty: '', contaminatedBlood: '0',
      contaminatedDetergent: '0', fio: ''
    });
    reRenderCso();
    scheduleSave();
  }

  function reRenderCso() {
    var tbody = $('[data-render="cso"]');
    if (tbody) { tbody.dataset.rendered = '0'; RENDERERS.cso(tbody); tbody.dataset.rendered = '1'; }
    var totals = $('[data-render="csoTotals"]');
    if (totals) { totals.dataset.rendered = '0'; RENDERERS.csoTotals(totals); totals.dataset.rendered = '1'; }
    updateSummaries();
    updateCounters();
  }

  function addTempDay() {
    var days = getPath(state, 'treatment.temp.days') || [];
    var last = days[days.length - 1];
    var nextDate = last && last.date ? nextDay(last.date) : todayIso();
    days.push({ date: nextDate, pulseAm: '', pulsePm: '', adAm: '', adPm: '', tAm: '', tPm: '' });
    state.treatment.temp.days = days;
    ensureTempArrays(days.length);
    reRenderTemp();
    scheduleSave();
  }

  function nextDay(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return todayIso();
    d.setDate(d.getDate() + 1);
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function reRenderTemp() {
    var head = $('[data-render="tempHead"]');
    if (head) { head.dataset.rendered = '0'; RENDERERS.tempHead(head); head.dataset.rendered = '1'; }
    var body = $('[data-render="tempBody"]');
    if (body) { body.dataset.rendered = '0'; RENDERERS.tempBody(body); body.dataset.rendered = '1'; }
    updateCounters();
    scheduleChart();
  }

  function fillTempWeek() {
    var days = getPath(state, 'treatment.temp.days') || [];
    var start = days[0] && days[0].date ? days[0].date : todayIso();
    for (var i = 0; i < 7; i += 1) {
      if (!days[i]) {
        days.push({ date: nextDayOffset(start, i), pulseAm: '', pulsePm: '', adAm: '', adPm: '', tAm: '', tPm: '' });
      }
    }
    state.treatment.temp.days = days;
    ensureTempArrays(days.length);
    reRenderTemp();
    saveNow();
    toast('Создано 7 дней наблюдения', 'Заполните показатели утром и вечером.', 'success');
  }

  function nextDayOffset(start, offset) {
    var d = new Date(start + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function addPrescription() {
    var rows = getPath(state, 'treatment.prescriptions.rows') || [];
    rows.push({
      date: todayIso(), drug: '', dose: '', route: '', frequency: '', diet: '', mode: 'Палатный',
      status: 'Назначен', markDate: '', markTime: '', markSign: '', markDone: false, note: ''
    });
    state.treatment.prescriptions.rows = rows;
    reRenderPrescriptions();
    scheduleSave();
  }

  function reRenderPrescriptions() {
    var tbody = $('[data-render="prescriptions"]');
    if (tbody) { tbody.dataset.rendered = '0'; RENDERERS.prescriptions(tbody); tbody.dataset.rendered = '1'; }
    updateCounters();
    updateComputed();
  }

  function addMonitor() {
    var rows = getPath(state, 'treatment.anesthesia.monitor') || [];
    rows.push({ time: '', bp: '', hr: '', spo2: '', etco2: '', temp: '' });
    state.treatment.anesthesia.monitor = rows;
    var tbody = $('[data-render="anesthesiaMonitor"]');
    if (tbody) { tbody.dataset.rendered = '0'; RENDERERS.anesthesiaMonitor(tbody); tbody.dataset.rendered = '1'; }
    updateCounters();
    scheduleSave();
  }

  function addIcuHour() {
    var rows = getPath(state, 'treatment.icu.rows') || [];
    rows.push({ hour: '', parenteral: '', parenteralVolume: '', enteral: '', enteralVolume: '', urine: '', losses: '', balance: '' });
    state.treatment.icu.rows = rows;
    reRenderIcu();
    scheduleSave();
  }

  function reRenderIcu() {
    var tbody = $('[data-render="icu"]');
    if (tbody) { tbody.dataset.rendered = '0'; RENDERERS.icu(tbody); tbody.dataset.rendered = '1'; }
    var totals = $('[data-render="icuTotals"]');
    if (totals) { totals.dataset.rendered = '0'; RENDERERS.icuTotals(totals); totals.dataset.rendered = '1'; }
    updateCounters();
    updateSummaries();
  }

  function recalcIcu() {
    var rows = getPath(state, 'treatment.icu.rows') || [];
    var totalIn = 0;
    var totalOut = 0;
    rows.forEach(function (row) {
      totalIn += n(row.parenteralVolume) + n(row.enteralVolume);
      totalOut += n(row.urine) + n(row.losses);
    });
    state.treatment.icu.totalIn = String(totalIn);
    state.treatment.icu.totalOut = String(totalOut);
    state.treatment.icu.totalBalance = (totalIn - totalOut > 0 ? '+' : '') + (totalIn - totalOut);
    reRenderIcu();
    hydrate(document.getElementById('treatmentContainer'));
    refreshChart();
    scheduleSave();
    toast('Гидробаланс пересчитан', 'Введено ' + totalIn + ' мл, выведено ' + totalOut + ' мл, баланс ' + (totalIn - totalOut > 0 ? '+' : '') + (totalIn - totalOut) + ' мл.', 'success');
  }

  function addRadiation() {
    var rows = getPath(state, 'treatment.radiation.rows') || [];
    rows.push({ date: todayIso(), study: '', area: '', dose: '' });
    state.treatment.radiation.rows = rows;
    var tbody = $('[data-render="radiation"]');
    if (tbody) { tbody.dataset.rendered = '0'; RENDERERS.radiation(tbody); tbody.dataset.rendered = '1'; }
    var totals = $('[data-render="radiationTotals"]');
    if (totals) { totals.dataset.rendered = '0'; RENDERERS.radiationTotals(totals); totals.dataset.rendered = '1'; }
    updateCounters();
    scheduleSave();
  }

  function importTransfusionGroup() {
    var card = state.card003 || {};
    var trans = state.treatment.transfusion || {};
    trans.recipientFio = card.fio || trans.recipientFio;
    trans.recipientGroup = card.bloodGroup || trans.recipientGroup;
    trans.recipientRh = card.rhFactor || trans.recipientRh;
    trans.recipientKell = card.kell || trans.recipientKell;
    state.treatment.transfusion = trans;
    hydrate($('#treatmentContainer'));
    scheduleSave();
    toast('Данные реципиента перенесены', 'Группа крови, резус и Kell взяты из титульного листа 003/у.', 'success');
  }

  function autofillDischarge() {
    var card = state.card003 || {};
    var op = getPath(state, 'treatment.operation') || {};
    var dis = state.treatment.discharge || {};
    dis.date = dis.date || todayIso();
    dis.diagnosisMain = dis.diagnosisMain || card.clinicalMain || card.prelimMain || '';
    dis.diagnosisIcd = dis.diagnosisIcd || card.clinicalIcd || card.prelimIcd || '';
    dis.complications = dis.complications || card.clinicalComplication || '';
    dis.concomitant = dis.concomitant || card.clinicalConcomitant || '';
    dis.condition = dis.condition || 'Удовлетворительное';
    dis.outcome = dis.outcome || card.result || '';
    if (!dis.treatmentDone && op.opName) {
      dis.treatmentDone = op.opName + (op.opDate ? ' ' + op.opDate : '') + '. Послеоперационный период без осложнений.';
    }
    dis.doctor = dis.doctor || card.doctor || '';
    state.treatment.discharge = dis;
    hydrate($('#treatmentContainer'));
    scheduleSave();
    toast('Данные подставлены', 'Проверьте и дополните выписной эпикриз.', 'success');
  }

  function copyPatientData() {
    var card = state.card003 || {};
    var exam = state.treatment.exam || {};
    exam.examDate = exam.examDate || card.admissionDate || todayIso();
    exam.examTime = exam.examTime || card.admissionTime || '';
    exam.doctor = exam.doctor || card.doctor || '';
    state.treatment.exam = exam;
    hydrate($('#treatmentContainer'));
    scheduleSave();
    toast('Паспортные данные перенесены', 'Дата, время и врач заполнены из медицинской карты.', 'success');
  }

  /* ============================================================
     СИНХРОНИЗАЦИЯ 001 → 003 → 066
     ============================================================ */
  function selectedJournalRow() {
    return (state.j001.rows || [])[n(state.j001.selected)] || {};
  }

  function openSyncPreview() {
    var row = selectedJournalRow();
    if (!row.fio) {
      toast('Нет данных для синхронизации', 'Выберите заполненную запись в журнале 001/у.', 'warn');
      return;
    }
    var items = [
      ['ФИО', row.fio],
      ['Дата рождения', row.birth || '—'],
      ['Пол', row.sex || '—'],
      ['Номер медицинской карты', row.cardNo || '—'],
      ['Отделение', row.department || '—'],
      ['Дата поступления', row.date || '—'],
      ['Время поступления', row.time || '—'],
      ['СНИЛС', row.snils || '—'],
      ['Полис ОМС', row.oms || '—'],
      ['Диагноз при направлении', row.referralDiag || '—']
    ];
    $('#syncPreview').innerHTML = items.map(function (item) {
      return '<li><span>' + esc(item[0]) + '</span><span>' + esc(item[1]) + '</span></li>';
    }).join('');
    openModal('modalSync');
  }

  function applySync() {
    var row = selectedJournalRow();
    if (!row.fio) return;
    var card = state.card003 || {};
    card.cardNo = row.cardNo || card.cardNo;
    card.fio = row.fio;
    card.birth = row.birth;
    card.sex = row.sex;
    card.admissionDate = row.date;
    card.admissionTime = row.time;
    card.referralDiag = row.referralDiag;
    card.referralIcd = row.referralIcd || card.referralIcd;
    card.prelimMain = card.prelimMain || row.referralDiag;
    card.department = row.department || card.department;
    card.doctor = card.doctor || 'Иванов Игорь Иванович';
    state.card003 = card;

    var stat = state.stat066 || {};
    stat.cardNo = row.cardNo || stat.cardNo;
    stat.fio = row.fio;
    stat.birth = row.birth;
    stat.sex = row.sex;
    stat.snils = row.snils || stat.snils;
    stat.oms = row.oms || stat.oms;
    stat.admissionDate = row.date;
    stat.admissionTime = row.time;
    stat.bloodGroup = card.bloodGroup || stat.bloodGroup;
    stat.rhFactor = card.rhFactor || stat.rhFactor;
    stat.kell = card.kell || stat.kell;
    stat.referral = row.delivered || stat.referral;
    stat.referralDiag = row.referralDiag || stat.referralDiag;
    stat.referralIcd = row.referralIcd || stat.referralIcd;
    stat.prelimMain = stat.prelimMain || row.referralDiag;
    state.stat066 = stat;

    state.patient = {
      fio: row.fio, birth: row.birth, sex: row.sex, snils: row.snils, oms: row.oms,
      cardNo: row.cardNo, department: row.department, admissionDate: row.date, admissionTime: row.time
    };

    var trans = state.treatment.transfusion || {};
    trans.recipientFio = row.fio;
    state.treatment.transfusion = trans;
    var temp = state.treatment.temp || { days: [] };
    temp.fio = row.fio;
    temp.cardNo = row.cardNo;
    state.treatment.temp = temp;

    state.doc.journalEnded = state.doc.journalEnded || row.date;
    closeModal('modalSync');
    reRenderAll();
    recordAudit('sync', 'Синхронизация 001 → 003 → 066', row.fio + ', карта ' + (row.cardNo || '—'));
    saveNow();
    toast('Синхронизация выполнена', 'Данные перенесены в медицинскую карту 003/у и статистическую карту 066/у.', 'success');
  }

  /* ============================================================
     КЛИНИЧЕСКИЕ КЕЙСЫ
     ============================================================ */
  function openCases() {
    var grid = $('#casesGrid');
    var blankCard = '<article class="case-card case-card-blank">' +
      '<div class="case-num">' + iconSvg('plus') + '</div>' +
      '<div><h3>Заполнить с нуля, без кейса</h3>' +
      '<p>Все формы пустые: студент самостоятельно регистрирует пациента, формулирует диагнозы, ведёт все разделы и сдаёт документацию. Заложенных ошибок нет.</p>' +
      '<div class="case-meta"><span class="badge badge-independent">Ручной режим</span>' +
      '<span class="badge badge-soft">Без заложенных ошибок</span></div></div>' +
      '<div class="case-card-actions"><button type="button" class="btn btn-sm btn-primary" data-action="start-blank">Начать</button></div>' +
      '</article>';
    grid.innerHTML = blankCard + global.CASES.list.map(function (item) {
      var active = state.caseId === item.id;
      return '<article class="case-card' + (active ? ' is-active' : '') + '">' +
        '<div class="case-num">' + item.id + '</div>' +
        '<div><h3>' + esc(item.title) + '</h3>' +
        '<p>' + esc(item.diagnosis) + '</p>' +
        '<div class="case-meta">' +
        '<span class="badge ' + global.CASES.difficultyClass(item.difficulty) + '">' + esc(item.difficultyLabel) + '</span>' +
        '<span class="badge badge-soft">' + esc(item.department) + '</span>' +
        '<span class="badge badge-soft">' + (item.planted.length ? 'Ошибок: ' + item.planted.length : 'Самостоятельное заполнение') + '</span>' +
        '</div></div>' +
        '<div class="case-card-actions">' +
        '<button type="button" class="btn btn-sm ' + (active ? 'btn-outline' : 'btn-primary') + '" data-action="load-case" data-case-id="' + item.id + '">' +
        (active ? 'Перезагрузить' : 'Выбрать') + '</button>' +
        '</div></article>';
    }).join('');
    openModal('modalCases');
  }

  function loadCase(id) {
    var item = global.CASES.get(id);
    if (!item) return;
    closeModal('modalCases');
    var apply = function () {
      global.CASES.apply(state, id);
      state.started = true;
      state.signatures = [];
      state.signatureValid = null;
      if (session) {
        if (item.planted.length) {
          global.Auth.setTimingEnabled(session, true);
          global.Auth.resetTimer(session);
        } else {
          global.Auth.setTimingEnabled(session, false);
        }
      }
      updatePauseUI();
      state.ui.tab = 'reception';
      state.ui.subform = state.ui.subform || '003-osmotr';
      state.doc.journalStarted = state.doc.journalStarted || todayIso();
      if (!state.doc.ogrn) state.doc.ogrn = '1027700132195';
      saveNow();
      reRenderAll();
      switchTab('reception', true);
      updateCaseBanner();
      updateSignatureUI();
      recordAudit('case', 'Загрузка кейса', item.title + ' · ' + item.difficultyLabel);
      toast('Кейс загружен: ' + item.shortTitle, item.planted.length
        ? 'Таймер запущен автоматически. Формы заполнены — найдите и устраните заложенные ошибки.'
        : 'Свободный режим: время не учитывается. Заполните документацию самостоятельно.', 'success');
    };
    if (state.started || (state.j001.rows || []).some(function (r) { return r.fio; })) {
      askConfirm('Загрузить кейс?', 'Текущие данные документации будут заменены данными кейса «' + item.title + '». Несохранённые правки будут потеряны.', 'Загрузить кейс', apply);
    } else {
      apply();
    }
  }

  function startBlankDocumentation() {
    var reset = function () {
      var user = state.user;
      var collapsed = !!(state.ui && state.ui.sidebarCollapsed);
      state = defaultState();
      state.user = user;
      state.ui = { tab: 'reception', subform: '003-osmotr', sidebarCollapsed: collapsed };
      state.started = true;
      state.signatures = [];
      state.signatureValid = null;
      state.doc.journalStarted = todayIso();
      if (session) global.Auth.setTimingEnabled(session, false);
      updatePauseUI();
      saveNow();
      reRenderAll();
      switchTab('reception', true);
      updateCaseBanner();
      updatePauseUI();
      updateSignatureUI();
      recordAudit('blank', 'Режим «С нуля»', 'Документация очищена');
      toast('Ручной режим включён', 'Все формы пусты. Заполните журнал 001/у и синхронизируйте данные в 003/у и 066/у.', 'success');
    };
    var hasData = (state.j001.rows || []).some(function (row) { return row.fio; }) ||
      (state.card003 && state.card003.fio) || state.caseId;
    if (hasData) {
      askConfirm('Начать заполнение с нуля?', 'Текущая документация будет полностью очищена. Сессия студента и таймер сохранятся.', 'Очистить и начать', reset);
    } else {
      reset();
    }
  }

  function closeCase() {
    askConfirm('Сбросить кейс?', 'Все заполненные формы будут очищены. Сессия студента и таймер сохранятся.', 'Сбросить', function () {
      var user = state.user;
      var ui = state.ui;
      state = defaultState();
      state.user = user;
      state.ui = ui;
      state.doc.journalStarted = todayIso();
      saveNow();
      reRenderAll();
      updateCaseBanner();
      toast('Кейс сброшен', 'Формы очищены, можно начать заново.', 'success');
    });
  }

  function updateCaseBanner() {
    var banner = $('#caseBanner');
    var nameEl = $('#sidebarCaseName');
    if (!banner) return;
    var item = state.caseId && global.CASES ? global.CASES.get(state.caseId) : null;
    if (!item) {
      banner.hidden = true;
      if (nameEl) nameEl.textContent = 'Не выбран';
      var badge = $('#treatmentCaseBadge');
      if (badge) badge.textContent = 'Кейс не выбран';
      return;
    }
    banner.hidden = false;
    $('#caseBannerTitle').textContent = item.title;
    $('#caseBannerDiag').textContent = item.diagnosis;
    var diff = $('#caseBannerDifficulty');
    diff.textContent = item.difficultyLabel;
    diff.className = 'badge ' + global.CASES.difficultyClass(item.difficulty);
    if (nameEl) nameEl.textContent = item.shortTitle;
    var badge2 = $('#treatmentCaseBadge');
    if (badge2) badge2.textContent = 'Кейс: ' + item.shortTitle;
  }

  /* ============================================================
     ПРОВЕРКА
     ============================================================ */
  function runCheck(silent) {
    if (!state) return null;
    state.progress = global.ClinicValidation.completeness(state);
    var result = global.ClinicValidation.check(state);
    state.meta = { checkedAt: result.checkedAt, result: result };
    recordAudit('check', 'Проверка документации', 'Нарушений: ' + result.errors.length + ', оценка ' + result.score.toFixed(2));
    saveNow(true);
    applyErrorHighlights(result);
    renderCheckModal(result);
    renderTeacher(result);
    updateAll();
    if (!silent) openModal('modalCheck');
    return result;
  }

  function sortedErrors(result) {
    var order = { critical: 0, major: 1, minor: 2 };
    return result.errors.slice().sort(function (a, b) {
      return (order[a.severity] - order[b.severity]) || a.title.localeCompare(b.title, 'ru');
    });
  }

  function renderCheckModal(result) {
    var errors = sortedErrors(result);
    var counts = result.counts;
    var cls = !errors.length ? 'is-perfect' : (result.score < 3.5 ? 'is-bad' : '');
    var html = '<div class="check-summary ' + cls + '">' +
      '<div class="check-grade"><strong>' + result.score.toFixed(2) + '</strong><span>из 5,00</span><br><span>' + esc(result.grade) + '</span></div>' +
      '<div><h3>' + (errors.length ? 'Обнаружены нарушения в документации' : 'Документация заполнена корректно') + '</h3>' +
      '<p>' + (errors.length
        ? 'Проверка выполнена по формальным правилам, перекрёстным сверкам и клиническим несоответствиям кейса. Устраните нарушения и повторите проверку.'
        : 'Все обязательные реквизиты заполнены, перекрёстные контроли пройдены. Работа может быть оценена на «отлично».') + '</p>' +
      '<div class="check-stats">' +
      '<span class="badge badge-critical">Критических: ' + counts.critical + '</span>' +
      '<span class="badge badge-major">Существенных: ' + counts.major + '</span>' +
      '<span class="badge badge-minor">Недочётов: ' + counts.minor + '</span>' +
      (result.plantedTotal ? '<span class="badge badge-soft">Заложено ошибок: ' + result.plantedTotal + ' · не устранено: ' + result.plantedRemaining + '</span>' : '') +
      '</div></div></div>';

    if (!errors.length) {
      html += '<div class="error-empty">✓ Нарушений не выявлено. Документация соответствует требованиям приказа № 530н. Скачайте отчёт о практике.</div>';
    } else {
      html += '<ul class="error-list">' + errors.map(function (err, idx) {
        var icon = err.severity === 'critical' ? '⛔' : err.severity === 'major' ? '⚠' : 'ℹ';
        return '<li class="error-item is-' + err.severity + '">' +
          '<div class="error-icon">' + icon + '</div>' +
          '<div><h4>' + esc(err.title) + '</h4>' +
          '<p>' + esc(err.message) + '</p>' +
          (err.hint ? '<p class="field-hint"><strong>Как исправить:</strong> ' + esc(err.hint) + '</p>' : '') +
          '<p class="error-target">' + esc(err.form) + ' · ' + esc(err.field) + '</p></div>' +
          '<div class="error-actions"><span class="badge badge-' + err.severity + '">' + esc(err.severityLabel) + '</span>' +
          (err.paths && err.paths.length ? '<button type="button" class="btn btn-sm btn-outline" data-action="goto-error" data-error-index="' + idx + '">Показать поле</button>' : '') +
          '</div></li>';
      }).join('') + '</ul>';
    }

    $('#checkBody').innerHTML = html;
    var scoreEl = $('#checkBody .check-grade strong');
    if (scoreEl) animateNumber(scoreEl, result.score, 2);
    $('#checkFootNote').textContent = 'Проверено ' + global.Auth.formatDateRu(result.checkedAt) + ' в ' +
      global.Auth.formatTimeRu(result.checkedAt) + '. Оценка автоматическая, преподаватель может скорректировать её.';
    state.meta.result = result;
    state.meta.sortedErrors = errors;
  }

  function applyErrorHighlights(result) {
    $$('.is-error-hl').forEach(function (el) {
      el.classList.remove('is-error-hl');
      el.removeAttribute('data-error-hl');
    });
    $$('.form-card.is-errored').forEach(function (el) { el.classList.remove('is-errored'); });
    if (!result || !result.errors.length) return;
    result.errors.forEach(function (err) {
      (err.paths || []).forEach(function (path) {
        var el = $('[data-bind="' + path.replace(/"/g, '\\"') + '"]');
        if (el) {
          el.classList.add('is-error-hl');
          el.setAttribute('data-error-hl', '1');
          var card = el.closest('.form-card');
          if (card) card.classList.add('is-errored');
        }
      });
    });
  }

  async function gotoError(err) {
    if (!err) return;
    var target = FORM_TO_TAB[err.form];
    if (!target) {
      closeModal('modalCheck');
      return;
    }
    closeModal('modalCheck');
    await switchTab(target.tab, true);
    if (target.sub && target.sub !== currentSubform) {
      await loadSubform(target.sub);
    }
    if (target.card) {
      var card = document.getElementById(target.card);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    var path = (err.paths || [])[0];
    var el = path ? $('[data-bind="' + path.replace(/"/g, '\\"') + '"]') : null;
    if (el) {
      global.setTimeout(function () {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        try { el.focus({ preventScroll: true }); } catch (err2) { el.focus(); }
      }, 260);
    }
  }

  function downloadReport() {
    if (!state) return;
    if (!state.meta || !state.meta.result) {
      runCheck(true);
      toast('Проверка выполнена', 'Отчёт сформирован с результатами автоматической проверки.', 'success');
    }
    state.progress = global.ClinicValidation.completeness(state);
    var filename = global.Auth.downloadReport(state, state.meta.result);
    recordAudit('report', 'Формирование отчёта', filename);
    toast('Отчёт сохранён', filename, 'success');
  }

  /* ============================================================
     ПАНЕЛЬ ПРЕПОДАВАТЕЛЯ
     ============================================================ */
  function renderTeacher(result) {
    var area = $('#teacherCaseArea');
    if (!area) return;
    var item = state.caseId && global.CASES ? global.CASES.get(state.caseId) : null;

    if (!item) {
      area.innerHTML = '<p class="muted">Кейс не выбран. Выберите клинический кейс — в него заложены логические ошибки, которые студент должен выявить и устранить.</p>' +
        '<div class="teacher-actions"><button type="button" class="btn btn-primary btn-sm" data-action="select-case">Выбрать кейс</button></div>';
    } else {
      var resultStatus = result && result.plantedDetails ? result.plantedDetails : null;
      area.innerHTML = '<article class="teacher-case-card">' +
        '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">' +
        '<div><h3>' + esc(item.title) + '</h3><p class="muted" style="margin:0">' + esc(item.diagnosis) + '</p></div>' +
        '<span class="badge ' + global.CASES.difficultyClass(item.difficulty) + '">' + esc(item.difficultyLabel) + '</span></div>' +
        '<div class="case-facts">' +
        '<div class="case-fact"><span>Отделение</span><strong>' + esc(item.department) + '</strong></div>' +
        '<div class="case-fact"><span>Код МКБ</span><strong>' + esc(item.diagnosisCode) + '</strong></div>' +
        '<div class="case-fact"><span>Заложено ошибок</span><strong>' + item.planted.length + '</strong></div>' +
        '<div class="case-fact"><span>Не устранено</span><strong>' + (result ? result.plantedRemaining : '—') + '</strong></div>' +
        '</div>' +
        '<p>' + esc(item.summary) + '</p>' +
        '<p class="small muted" style="margin-bottom:4px"><strong>Задачи студента:</strong></p>' +
        '<ul class="small">' + item.tasks.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
        '<div class="teacher-actions">' +
        '<button type="button" class="btn btn-sm btn-primary" data-action="load-case" data-case-id="' + item.id + '">Заполнить формы кейсом</button>' +
        '<button type="button" class="btn btn-sm btn-outline" data-action="teacher-reset">Сбросить результаты</button>' +
        '</div></article>';

      var plantedEl = $('#teacherPlanted');
      if (plantedEl && !item.planted.length) {
        plantedEl.innerHTML = '<li><span class="planted-state is-fixed">✓</span>' +
          '<span><strong>Заложенных ошибок нет</strong><br><span class="muted small">' +
          'Студент заполняет документацию полностью самостоятельно. Оценка формируется только по его работе.</span></span></li>';
      } else if (plantedEl) {
        plantedEl.innerHTML = item.planted.map(function (p) {
          var status = resultStatus ? resultStatus.filter(function (d) { return d.code === p.code; })[0] : null;
          var remains = status ? status.remains : null;
          var mark = remains === null ? '•' : (remains ? '✕' : '✓');
          var cls = remains === null ? 'muted' : (remains ? 'is-found' : 'is-fixed');
          var label = remains === null ? 'не проверено' : (remains ? 'не устранено' : 'устранено');
          return '<li><span class="planted-state ' + cls + '">' + mark + '</span>' +
            '<span><strong>' + esc(p.label) + '</strong><br><span class="muted small">' + label + ' · ' + esc(p.hint) + '</span></span></li>';
        }).join('');
      }
    }

    var progress = result && result.progress ? result.progress : global.ClinicValidation.completeness(state);
    $('#teacherScoreValue').textContent = result ? result.score.toFixed(2) : '—';
    $('#teacherGrade').textContent = result ? result.grade : 'Проверка не выполнялась';
    $('#teacherCritical').textContent = result ? result.counts.critical : '0';
    $('#teacherMajor').textContent = result ? result.counts.major : '0';
    $('#teacherMinor').textContent = result ? result.counts.minor : '0';
    $('#teacherCheckedAt').textContent = 'Дата проверки: ' + (result ? global.Auth.formatDateRu(result.checkedAt) + ' ' + global.Auth.formatTimeRu(result.checkedAt) : '—');

    var checklist = $('#teacherChecklist');
    if (checklist) {
      var rows = [
        ['Журнал 001/у', 'journal001', ['Журнал 001/у']],
        ['Медицинская карта 003/у', 'card003', ['Медицинская карта 003/у']],
        ['Статистическая карта 066/у', 'stat066', ['Статистическая карта 066/у']],
        ['Первичный осмотр', 'exam', ['Первичный осмотр 003/у']],
        ['Предоперационный блок', 'preop', ['Предоперационный блок']],
        ['Протокол операции', 'operation', ['Протокол операции']],
        ['Протокол анестезии', 'anesthesia', ['Протокол анестезии']],
        ['Карта реанимации', 'icu', ['Карта реанимации']],
        ['Лист назначений', 'prescriptions', ['Лист назначений']],
        ['Лист трансфузии', 'transfusion', ['Лист трансфузии']],
        ['Температурный лист 004/у', 'temp', ['Температурный лист 004/у']],
        ['Лучевая нагрузка', 'radiation', ['Лист лучевой нагрузки']],
        ['Выписной эпикриз', 'discharge', ['Выписной эпикриз']],
        ['Лист 007/у', 'dept007', ['Лист 007/у']],
        ['Порционник 1-84', 'nutrition', ['Порционник 1-84']],
        ['Журнал 366/у', 'cso', ['Журнал 366/у']],
        ['Журнал операций 008/у', 'operations008', ['Журнал операций 008/у']],
        ['Сводная ведомость 016/у', 'summary016', ['Сводная ведомость 016/у']],
        ['Журнал эндоскопии 157/у', 'endoscopy', ['Журнал эндоскопии 157/у']],
        ['Дневник наблюдения', 'diary', ['Дневник наблюдения']],
        ['Согласие на операцию', 'consent', ['Согласие на операцию']]
      ];
      var html = '<table class="checklist-table"><thead><tr><th>Форма / раздел</th><th>Полнота</th><th>Нарушения</th><th>Статус</th></tr></thead><tbody>';
      rows.forEach(function (pair) {
        var pct = progress[pair[1]] || 0;
        var count = result ? result.errors.filter(function (e) { return pair[2].indexOf(e.form) !== -1; }).length : 0;
        var status = !result ? '<span class="badge badge-soft">не проверено</span>' :
          (count ? '<span class="badge badge-major">есть нарушения</span>' : '<span class="badge badge-ok">проверено</span>');
        html += '<tr><td>' + esc(pair[0]) + '</td><td>' + pct + ' %</td><td>' + (result ? count : '—') + '</td><td>' + status + '</td></tr>';
      });
      html += '</tbody></table>';
      checklist.innerHTML = html;
    }
  }

  /* ============================================================
     ДЕЙСТВИЯ ОБРАБОТЧИКОВ
     ============================================================ */
  function newOperation008() {
    return {
      num: '', cardNo: '', fio: '', sex: '', birth: '', date: todayIso(), start: '', end: '', duration: '',
      diagMain: '', diagComplication: '', diagConcomitant: '', diagExternal: '', diagExtra: '',
      opName: '', opCode: '', hitech: 'Нет', equipment: 'Не применялась', multiplicity: 'Первичная', micro: 'Нет',
      premed: '', anesthesiaType: '', description: '', outcome: 'Благоприятный',
      deathDate: '', deathTime: '', material: '', complications: '',
      postMain: '', postComplication: '', postConcomitant: '', postExternal: '',
      surgeon: '', assistant: '', opNurse: '', anesthesiologist: '', anesthetistNurse: ''
    };
  }

  function renderOperations008() {
    var el = $('[data-render="operations008"]');
    if (el) { el.dataset.rendered = '0'; RENDERERS.operations008(el); el.dataset.rendered = '1'; }
    updateCounters();
    updateProgressUI();
  }

  function addOperation008() {
    var rows = state.operations008.rows || (state.operations008.rows = []);
    var row = newOperation008();
    row.num = String(rows.length + 1);
    rows.push(row);
    renderOperations008();
    scheduleSave();
    toast('Операция добавлена', 'Заполните 17 пунктов журнала 008/у.', 'success');
  }

  function minutesBetween(start, end) {
    if (!start || !end) return '';
    var a = start.split(':');
    var b = end.split(':');
    if (a.length < 2 || b.length < 2) return '';
    var diff = (Number(b[0]) * 60 + Number(b[1])) - (Number(a[0]) * 60 + Number(a[1]));
    if (!isFinite(diff)) return '';
    if (diff < 0) diff += 1440;
    return String(diff);
  }

  function fillOperationFromProtocol() {
    var op = getPath(state, 'treatment.operation') || {};
    if (!op.opName) {
      toast('Протокол операции не заполнен', 'Сначала заполните раздел «Операция».', 'warn');
      return;
    }
    var card = state.card003 || {};
    var anesth = getPath(state, 'treatment.anesthesia') || {};
    var pre = getPath(state, 'treatment.preop') || {};
    var rows = state.operations008.rows || (state.operations008.rows = []);
    var row = newOperation008();
    row.num = String(rows.length + 1);
    row.cardNo = card.cardNo || '';
    row.fio = card.fio || '';
    row.sex = card.sex || '';
    row.birth = card.birth || '';
    row.date = op.opDate || '';
    row.start = anesth.anesthStart || '';
    row.end = anesth.anesthEnd || '';
    row.duration = minutesBetween(anesth.anesthStart, anesth.anesthEnd);
    row.diagMain = card.prelimMain || '';
    row.diagComplication = card.prelimComplication || '';
    row.diagConcomitant = card.prelimConcomitant || '';
    row.diagExternal = card.prelimExternal || '';
    row.opName = op.opName || '';
    row.opCode = op.opCode || '';
    row.hitech = 'Нет';
    row.equipment = /лапароскоп/i.test(op.opName) ? 'Эндоскопическая' : 'Не применялась';
    row.multiplicity = 'Первичная';
    row.micro = /микро/i.test(op.opName) ? 'Да' : 'Нет';
    row.premed = pre.anesthPremed || anesth.anesthPremed || '';
    row.anesthesiaType = anesth.anesthType || '';
    row.description = [op.opAccess, op.opCourse].filter(Boolean).join(' ');
    row.outcome = 'Благоприятный';
    row.material = op.opFindings ? ('Операционный материал: ' + op.opFindings) : '';
    row.complications = op.opComplications || 'Нет';
    row.postMain = card.clinicalMain || card.prelimMain || '';
    row.postComplication = card.clinicalComplication || '';
    row.postConcomitant = card.clinicalConcomitant || '';
    row.postExternal = card.clinicalExternal || '';
    row.surgeon = op.opSurgeon || '';
    row.assistant = op.opAssistant || '';
    row.opNurse = op.opNurse || '';
    row.anesthesiologist = op.opAnesthesiologist || anesth.anesthDoctor || '';
    row.anesthetistNurse = '';
    rows.push(row);
    renderOperations008();
    saveNow();
    toast('Данные перенесены из протокола', 'Проверьте диагнозы, исход и состав бригады.', 'success');
  }

  function newSummary016Row() {
    return {
      profile: '', beds: '', avgBeds: '', start: '', admitted: '', fromDay: '', rural: '', children: '',
      elderly: '', transfIn: '0', transfOut: '0', discharged: '', dischElderly: '', dischDay: '', dischHospital: '',
      died: '', diedChildren: '', diedElderly: '', end: '', bedDays: '', closedBedDays: '', careBedDays: '',
      freeM: '', freeF: ''
    };
  }

  function renderSummary016() {
    var body = $('[data-render="summary016"]');
    if (body) { body.dataset.rendered = '0'; RENDERERS.summary016(body); body.dataset.rendered = '1'; }
    var totals = $('[data-render="summary016Totals"]');
    if (totals) { totals.dataset.rendered = '0'; RENDERERS.summary016Totals(totals); totals.dataset.rendered = '1'; }
    updateCounters();
    updateSummaries();
    updateProgressUI();
  }

  function addSummary016Row() {
    var rows = state.summary016.rows || (state.summary016.rows = []);
    rows.push(newSummary016Row());
    renderSummary016();
    scheduleSave();
  }

  function recalcSummary016() {
    (state.summary016.rows || []).forEach(function (row, idx) {
      var expected = n(row.start) + n(row.admitted) + n(row.transfIn) - n(row.transfOut) - n(row.discharged) - n(row.died);
      row.end = String(expected);
      var input = $('[data-bind="summary016.rows.' + idx + '.end"]');
      if (input) input.value = expected;
    });
    renderSummary016();
    saveNow();
    toast('Сводная ведомость пересчитана', 'Графа «Состояло на конец периода» приведена к балансу движения.', 'success');
  }

  function monthLabelFromDate(dateStr) {
    var d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    if (isNaN(d.getTime())) d = new Date();
    var months = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
    return months[d.getMonth()] + ' ' + d.getFullYear();
  }

  function pullSummary016From007() {
    var bedRows = state.dept007.rows || [];
    if (!bedRows.length) {
      toast('Лист 007/у не заполнен', 'Сначала заполните движение пациентов.', 'warn');
      return;
    }
    state.summary016.department = state.dept007.department || state.summary016.department;
    state.summary016.period = monthLabelFromDate(state.dept007.date);
    var deptInput = $('[data-bind="summary016.department"]');
    var periodInput = $('[data-bind="summary016.period"]');
    if (deptInput) deptInput.value = state.summary016.department;
    if (periodInput) periodInput.value = state.summary016.period;
    state.summary016.rows = bedRows.map(function (r) {
      return {
        profile: r.profile || '',
        beds: r.beds || '',
        avgBeds: r.beds || '',
        start: r.before || '',
        admitted: r.admitted || '',
        fromDay: r.fromDay || '',
        rural: r.fromRural || '',
        children: r.children || '',
        elderly: r.elderly || '',
        transfIn: r.transfIn || '0',
        transfOut: r.transfOut || '0',
        discharged: r.discharged || '',
        dischElderly: r.dischElderly || '',
        dischDay: r.dischDay || '',
        dischHospital: r.dischHospital || '',
        died: r.died || '',
        diedChildren: r.diedChildren || '',
        diedElderly: r.diedElderly || '',
        end: r.current || '',
        bedDays: '',
        closedBedDays: '',
        careBedDays: '',
        freeM: r.freeM || '',
        freeF: r.freeF || ''
      };
    });
    renderSummary016();
    saveNow();
    toast('Данные перенесены из 007/у', 'Койко-дни за отчётный период заполните вручную: 007/у содержит суточные данные.', 'success');
  }

  function newEndoscopyRow() {
    var card = state.card003 || {};
    var jRow = selectedJournalRow();
    return {
      date: todayIso(),
      fio: card.fio || jRow.fio || '',
      birthYear: card.birth ? String(card.birth).slice(0, 4) : '',
      address: jRow.addressLive || '',
      referral: [card.department, card.doctor].filter(Boolean).join(', '),
      diagnosis: card.prelimMain || '',
      method: '',
      conclusion: '',
      notes: ''
    };
  }

  function renderEndoscopy() {
    var body = $('[data-render="endoscopy"]');
    if (body) { body.dataset.rendered = '0'; RENDERERS.endoscopy(body); body.dataset.rendered = '1'; }
    var totals = $('[data-render="endoscopyTotals"]');
    if (totals) { totals.dataset.rendered = '0'; RENDERERS.endoscopyTotals(totals); totals.dataset.rendered = '1'; }
    updateCounters();
    updateProgressUI();
  }

  function addEndoscopy() {
    var rows = state.endoscopy.rows || (state.endoscopy.rows = []);
    rows.push(newEndoscopyRow());
    renderEndoscopy();
    scheduleSave();
    toast('Исследование добавлено', 'Укажите метод и заключение эндоскопии.', 'success');
  }

  function newDiaryRow() {
    var exam = getPath(state, 'treatment.exam') || {};
    var card = state.card003 || {};
    var now = new Date();
    var time = (now.getHours() < 10 ? '0' : '') + now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
    return {
      date: todayIso(),
      time: time,
      complaints: exam.complaints || '',
      condition: [exam.generalCondition, exam.temperature ? 'Температура ' + exam.temperature + ' °C' : '',
        exam.bpSystolic ? 'АД ' + exam.bpSystolic + '/' + exam.bpDiastolic + ' мм рт. ст.' : '',
        exam.hr ? 'ЧСС ' + exam.hr + ' уд/мин' : ''].filter(Boolean).join(', '),
      objective: [exam.skin, exam.abdomen].filter(Boolean).join(' '),
      appointments: exam.plan || '',
      doctor: card.doctor || exam.doctor || '',
      nurse: getPath(state, 'treatment.prescriptions.nurse') || ''
    };
  }

  function renderDiary() {
    var body = $('[data-render="diary"]');
    if (body) { body.dataset.rendered = '0'; RENDERERS.diary(body); body.dataset.rendered = '1'; }
    updateCounters();
    updateProgressUI();
  }

  function addDiaryRecord() {
    var rows = state.diary.rows || (state.diary.rows = []);
    rows.push(newDiaryRow());
    renderDiary();
    scheduleSave();
    toast('Запись дневника добавлена', 'Дополните динамику состояния и назначения.', 'success');
  }

  function fillConsent() {
    var card = state.card003 || {};
    var op = getPath(state, 'treatment.operation') || {};
    var anesth = getPath(state, 'treatment.anesthesia') || {};
    var consent = state.consent || {};
    consent.fio = card.fio || consent.fio || '';
    consent.birth = card.birth || consent.birth || '';
    consent.diagnosis = [card.clinicalMain || card.prelimMain || '', card.clinicalIcd || card.prelimIcd || ''].filter(Boolean).join(' ');
    consent.intervention = op.opName || consent.intervention || '';
    consent.anesthesia = anesth.anesthType || consent.anesthesia || '';
    consent.risks = consent.risks || 'Кровотечение, инфекционные осложнения, повреждение окружающих тканей, аллергическая реакция, тромбоэмболические осложнения.';
    consent.alternatives = consent.alternatives || 'Консервативная терапия или иной объём оперативного вмешательства. При отказе — прогрессирование заболевания, риск гнойно-септических осложнений.';
    consent.doctor = card.doctor || consent.doctor || '';
    consent.date = consent.date || todayIso();
    consent.time = consent.time || '';
    state.consent = consent;
    hydrate(document.getElementById('treatmentContainer'));
    saveNow();
    toast('Данные для согласия подставлены', 'Укажите решение пациента, подписи и свидетеля.', 'success');
  }

  /* ============================================================
     ЭКСПОРТ: ПЕЧАТЬ, PDF, DOCX, JSON
     ============================================================ */
  function xmlEscape(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function controlValue(control) {
    if (!control) return '—';
    if (control.type === 'checkbox') return control.checked ? 'да' : 'нет';
    var value = String(control.value || '').trim();
    return value || '—';
  }

  function extractField(field) {
    var label = field.querySelector('label');
    var control = field.querySelector('input, select, textarea');
    if (!label || !control) return null;
    var text = label.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return null;
    return { type: 'field', label: text, value: controlValue(control) };
  }

  function extractTable(table) {
    var headers = [];
    var headRow = table.querySelector('thead tr:last-child') || table.querySelector('thead tr');
    if (headRow) {
      Array.prototype.forEach.call(headRow.querySelectorAll('th'), function (th) {
        headers.push(th.textContent.replace(/\s+/g, ' ').trim());
      });
    }
    var rows = [];
    Array.prototype.forEach.call(table.querySelectorAll('tbody tr, tfoot tr'), function (tr) {
      var cells = [];
      Array.prototype.forEach.call(tr.querySelectorAll('td'), function (td) {
        if (td.classList.contains('row-actions') || td.querySelector('button[data-action$="-remove"]')) {
          cells.push('');
          return;
        }
        var control = td.querySelector('input, select, textarea');
        var value = control ? controlValue(control) : td.textContent.replace(/\s+/g, ' ').trim();
        cells.push(value === '—' ? '' : value);
      });
      if (cells.some(function (v) { return v !== ''; })) rows.push(cells);
    });
    var width = Math.max(headers.length, rows.reduce(function (max, row) { return Math.max(max, row.length); }, 0));
    if (width === 0 || rows.length === 0) return null;
    return { type: 'table', headers: headers, rows: rows, wide: width > 10 };
  }

  function walkForm(node, blocks) {
    Array.prototype.forEach.call(node.children, function (child) {
      if (child.matches('.form-section')) {
        var heading = child.querySelector('h4');
        if (heading) blocks.push({ type: 'section', text: heading.textContent.replace(/\s+/g, ' ').trim() });
        walkForm(child, blocks);
      } else if (child.matches('.journal-entry')) {
        var summary = child.querySelector('summary');
        if (summary) blocks.push({ type: 'section', text: summary.textContent.replace(/\s+/g, ' ').trim() });
        var body = child.querySelector('.journal-entry-body');
        if (body) walkForm(body, blocks);
      } else if (child.matches('.table-wrap')) {
        var table = child.querySelector('table.data-table');
        var extracted = table ? extractTable(table) : null;
        if (extracted) blocks.push(extracted);
      } else if (child.matches('.field')) {
        var field = extractField(child);
        if (field) blocks.push(field);
      } else if (child.matches('.form-note, .signature-line, .table-toolbar, .form-card-head, script, style')) {
        return;
      } else if (child.matches('.form-grid, .form-card-body, .form-section, .form-section > div, .consent-box, .journal-entry-body, details, .form-card')) {
        walkForm(child, blocks);
      } else if (child.children.length) {
        walkForm(child, blocks);
      }
    });
  }

  function extractForm(card) {
    var title = card.querySelector('.form-card-head h3');
    var blocks = [];
    var body = card.querySelector('.form-card-body');
    if (body) walkForm(body, blocks);
    return {
      title: title ? title.textContent.replace(/\s+/g, ' ').trim() : 'Форма',
      blocks: blocks
    };
  }

  function documentMeta() {
    var card = state.card003 || {};
    var caseInfo = state.caseId && global.CASES ? global.CASES.get(state.caseId) : null;
    return {
      organization: state.doc.organization,
      patient: card.fio || 'Пациент не выбран',
      cardNo: card.cardNo || '—',
      caseTitle: caseInfo ? caseInfo.title : 'Ручной режим',
      student: session ? session.fio : '—',
      group: session ? session.group : '—',
      date: global.Auth.formatDateRu(new Date().toISOString())
    };
  }

  function collectCurrentCards() {
    var panel = $('.tab-panel.is-active');
    if (!panel) return [];
    return $$('.form-card', panel);
  }

  async function collectAllCards() {
    var paths = [
      'forms/001u.html', 'forms/003u.html', 'forms/066u.html'
    ];
    Object.keys(SUBFORM_META).forEach(function (key) {
      paths.push('forms/' + SUBFORM_META[key].file + '.html');
    });
    paths.push('forms/007u.html', 'forms/1-84.html', 'forms/016u.html');
    paths.push('forms/366u.html', 'forms/157u.html');
    var cards = [];
    for (var i = 0; i < paths.length; i += 1) {
      try {
        var html = await fetchTemplate(paths[i]);
        var staging = document.createElement('div');
        staging.innerHTML = html;
        hydrate(staging);
        var card = staging.querySelector('.form-card');
        if (card) cards.push(card);
      } catch (err) {
        /* форму пропускаем, остальные экспортируются */
      }
    }
    return cards;
  }

  function docxTextRun(text, opts) {
    opts = opts || {};
    var rPr = '<w:rPr>' +
      '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>' +
      (opts.bold ? '<w:b/>' : '') +
      (opts.italic ? '<w:i/>' : '') +
      '<w:sz w:val="' + (opts.size || 20) + '"/><w:szCs w:val="' + (opts.size || 20) + '"/>' +
      (opts.color ? '<w:color w:val="' + opts.color + '"/>' : '') +
      '</w:rPr>';
    return '<w:r>' + rPr + '<w:t xml:space="preserve">' + xmlEscape(text) + '</w:t></w:r>';
  }

  function docxParagraph(text, opts) {
    opts = opts || {};
    var pPr = '<w:pPr>' +
      (opts.align ? '<w:jc w:val="' + opts.align + '"/>' : '') +
      '<w:spacing w:before="' + (opts.before || 0) + '" w:after="' + (opts.after === undefined ? 60 : opts.after) + '"/>' +
      '</w:pPr>';
    return '<w:p>' + pPr + (text ? docxTextRun(text, opts) : '') + '</w:p>';
  }

  function docxCell(text, opts) {
    opts = opts || {};
    return '<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>' +
      (opts.header ? '<w:shd w:val="clear" w:color="auto" w:fill="EAF4FD"/>' : '') +
      '<w:tcMar><w:top w:w="30" w:type="dxa"/><w:left w:w="50" w:type="dxa"/><w:bottom w:w="30" w:type="dxa"/><w:right w:w="50" w:type="dxa"/></w:tcMar>' +
      '</w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr>' +
      docxTextRun(text || ' ', { bold: opts.header, size: opts.size || 16 }) + '</w:p></w:tc>';
  }

  function docxTable(headers, rows) {
    var width = Math.max(headers.length, rows.reduce(function (max, row) { return Math.max(max, row.length); }, 0));
    var xml = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="autofit"/>' +
      '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="8FAEC7"/><w:left w:val="single" w:sz="4" w:color="8FAEC7"/><w:bottom w:val="single" w:sz="4" w:color="8FAEC7"/><w:right w:val="single" w:sz="4" w:color="8FAEC7"/><w:insideH w:val="single" w:sz="4" w:color="8FAEC7"/><w:insideV w:val="single" w:sz="4" w:color="8FAEC7"/></w:tblBorders></w:tblPr>';
    if (headers.length) {
      xml += '<w:tr>' + headers.map(function (h) { return docxCell(h, { header: true, size: 15 }); }).join('') + '</w:tr>';
    }
    rows.forEach(function (row) {
      xml += '<w:tr>';
      for (var i = 0; i < width; i += 1) xml += docxCell(row[i] || '', { size: 15 });
      xml += '</w:tr>';
    });
    return xml + '</w:tbl>' + docxParagraph('', { after: 40 });
  }

  function buildDocxXml(cards) {
    var meta = documentMeta();
    var body = '';
    body += docxParagraph('УЧЕБНО-СИМУЛЯЦИОННЫЙ КОМПЛЕКС', { bold: true, size: 22, align: 'center', after: 20 });
    body += docxParagraph('«ЦИФРОВАЯ КЛИНИКА МК РАМН»', { bold: true, size: 30, align: 'center', after: 40 });
    body += docxParagraph('Документация стационарного пациента', { bold: true, size: 24, align: 'center', after: 120 });
    body += docxParagraph('Пациент: ' + meta.patient + ' · карта № ' + meta.cardNo, { size: 20 });
    body += docxParagraph('Студент: ' + meta.student + ' · группа ' + meta.group + ' · ' + meta.date, { size: 20 });
    body += docxParagraph('Кейс: ' + meta.caseTitle, { size: 18, italic: true, after: 140 });
    body += docxParagraph('Документ сформирован автоматически. Данные синтетические, персональные данные не используются.', { size: 16, italic: true, color: '5B7186', after: 180 });

    cards.forEach(function (card, index) {
      var form = extractForm(card);
      if (index > 0) body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      body += docxParagraph(form.title, { bold: true, size: 24, after: 100 });
      form.blocks.forEach(function (block) {
        if (block.type === 'section') {
          body += docxParagraph(block.text.toUpperCase(), { bold: true, size: 18, color: '0B63B4', before: 100, after: 40 });
        } else if (block.type === 'field') {
          body += '<w:p><w:pPr><w:spacing w:after="40"/></w:pPr>' +
            docxTextRun(block.label + ': ', { bold: true, size: 18 }) +
            docxTextRun(block.value, { size: 18 }) + '</w:p>';
        } else if (block.type === 'table') {
          if (block.wide) {
            block.rows.forEach(function (row) {
              body += docxParagraph(row.filter(Boolean).join(' · '), { size: 14, after: 20 });
            });
          } else {
            body += docxTable(block.headers, block.rows);
          }
        }
      });
    });

    var sectPr = '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>' +
      '<w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr>';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<w:body>' + body + sectPr + '</w:body></w:document>';
  }

  function crc32(bytes) {
    var table = crc32.table;
    if (!table) {
      table = crc32.table = new Uint32Array(256);
      for (var n = 0; n < 256; n += 1) {
        var c = n;
        for (var k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
      }
    }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i += 1) crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function zipStore(files) {
    var encoder = new TextEncoder();
    var entries = [];
    var offset = 0;
    var parts = [];
    function u16(n) { return [n & 255, (n >>> 8) & 255]; }
    function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
    files.forEach(function (file) {
      var nameBytes = encoder.encode(file.name);
      var data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
      var crc = crc32(data);
      var header = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0));
      parts.push(new Uint8Array(header), nameBytes, data);
      entries.push({ nameBytes: nameBytes, crc: crc, size: data.length, offset: offset });
      offset += header.length + nameBytes.length + data.length;
    });
    var central = [];
    entries.forEach(function (entry) {
      var header = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
        u32(entry.crc), u32(entry.size), u32(entry.size), u16(entry.nameBytes.length), u16(0), u16(0),
        u16(0), u16(0), u32(0), u32(entry.offset));
      central.push(new Uint8Array(header), entry.nameBytes);
    });
    var centralSize = central.reduce(function (sum, part) { return sum + part.length; }, 0);
    var eocd = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
      u32(centralSize), u32(offset), u16(0)));
    var all = parts.concat(central, [eocd]);
    var total = all.reduce(function (sum, part) { return sum + part.length; }, 0);
    var out = new Uint8Array(total);
    var pos = 0;
    all.forEach(function (part) { out.set(part, pos); pos += part.length; });
    return out;
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function safeFilePart(value) {
    return String(value || '').replace(/[^А-ЯЁA-Zа-яёa-z0-9\-]+/g, '_').slice(0, 60);
  }

  function docxPackage(cards) {
    var docXml = buildDocxXml(cards);
    var files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '</Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '</Relationships>' },
      { name: 'word/document.xml', data: docXml },
      { name: 'word/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="20"/></w:rPr></w:rPrDefault></w:docDefaults>' +
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
        '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style>' +
        '</w:styles>' },
      { name: 'word/_rels/document.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>' },
      { name: 'docProps/core.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        '<dc:title>Цифровая клиника МК РАМН</dc:title><dc:creator>МИС «Цифровая клиника»</dc:creator>' +
        '<cp:lastModifiedBy>' + xmlEscape(session ? session.fio : '') + '</cp:lastModifiedBy>' +
        '<dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString() + '</dcterms:created>' +
        '</cp:coreProperties>' }
    ];
    return new Blob([zipStore(files)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  function printStyles() {
    return '<style>' +
      '@page{size:A4 landscape;margin:10mm}' +
      'body{font-family:"Times New Roman",serif;font-size:10pt;color:#111;margin:0}' +
      'header{display:flex;gap:14px;align-items:center;border-bottom:2px solid #0b63b4;padding-bottom:8px;margin-bottom:12px}' +
      'header img{width:62px;height:62px;object-fit:contain}' +
      'header h1{font-size:15pt;margin:0;color:#08375f}header p{margin:2px 0;font-size:9pt;color:#555}' +
      '.pf{display:grid;grid-template-columns:minmax(160px,32%) 1fr;gap:6px;border-bottom:1px dotted #bbb;padding:3px 0;page-break-inside:avoid}' +
      '.pf span{font-weight:bold;color:#333}.pf b{font-weight:normal}' +
      '.print-form{page-break-before:always;margin-top:12px}.print-form:first-of-type{page-break-before:auto}' +
      '.print-form h2{font-size:12pt;color:#0b63b4;border-bottom:1px solid #9cc7e8;padding-bottom:4px;margin:0 0 8px}' +
      '.print-section{font-size:9pt;font-weight:bold;text-transform:uppercase;color:#0b63b4;margin:10px 0 4px}' +
      'table{width:100%;border-collapse:collapse;font-size:7.5pt;margin:6px 0;page-break-inside:auto}' +
      'th,td{border:1px solid #999;padding:2px 3px;vertical-align:top;text-align:left}th{background:#eaf4fd}' +
      '.print-lines{font-size:8pt;line-height:1.35}.print-lines div{border-bottom:1px dotted #ccc;padding:2px 0}' +
      'footer{margin-top:10px;border-top:1px solid #999;padding-top:4px;font-size:7.5pt;color:#666}' +
      '@media print{.no-print{display:none}}' +
      '</style>';
  }

  function buildPrintHtml(cards) {
    var meta = documentMeta();
    var logo = new URL('assets/logo-emblem.png', location.href).href;
    var html = '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Документация — ' + xmlEscape(meta.patient) + '</title>' + printStyles() + '</head><body>';
    html += '<header><img src="' + logo + '" alt="Герб"><div><h1>Учебно-симуляционный комплекс «Цифровая клиника МК РАМН»</h1>' +
      '<p>' + xmlEscape(meta.organization) + '</p>' +
      '<p>Пациент: <b>' + xmlEscape(meta.patient) + '</b> · карта № ' + xmlEscape(meta.cardNo) + ' · студент: ' + xmlEscape(meta.student) + ' · группа ' + xmlEscape(meta.group) + ' · ' + xmlEscape(meta.date) + '</p></div></header>';
    cards.forEach(function (card) {
      var form = extractForm(card);
      html += '<section class="print-form"><h2>' + xmlEscape(form.title) + '</h2>';
      form.blocks.forEach(function (block) {
        if (block.type === 'section') html += '<div class="print-section">' + xmlEscape(block.text) + '</div>';
        else if (block.type === 'field') html += '<div class="pf"><span>' + xmlEscape(block.label) + '</span><b>' + xmlEscape(block.value) + '</b></div>';
        else if (block.type === 'table') {
          if (block.wide) {
            html += '<div class="print-lines">' + block.rows.map(function (row) { return '<div>' + xmlEscape(row.filter(Boolean).join(' · ')) + '</div>'; }).join('') + '</div>';
          } else {
            html += '<table><thead><tr>' + block.headers.map(function (h) { return '<th>' + xmlEscape(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
              block.rows.map(function (row) { return '<tr>' + row.map(function (cell) { return '<td>' + xmlEscape(cell) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
          }
        }
      });
      html += '</section>';
    });
    html += '<footer>Сформировано ' + xmlEscape(new Date().toLocaleString('ru-RU')) + '. Все данные синтетические, ФЗ-152 не нарушается.</footer></body></html>';
    return html;
  }

  function printCards(cards, preOpenedWindow) {
    if (!cards.length) {
      if (preOpenedWindow) preOpenedWindow.close();
      toast('Нет форм для печати', 'Откройте раздел с документацией.', 'warn');
      return;
    }
    var win = preOpenedWindow || global.open('', '_blank');
    if (!win) {
      toast('Браузер заблокировал окно', 'Разрешите всплывающие окна для печати.', 'error');
      return;
    }
    win.document.open();
    win.document.write(buildPrintHtml(cards));
    win.document.close();
    win.focus();
    setTimeout(function () { win.print(); }, 500);
    recordAudit('print', 'Печать документации', cards.length + ' форм');
  }

  async function exportDocx(cards, scope) {
    if (!cards.length) {
      toast('Нет форм для экспорта', 'Откройте раздел с документацией.', 'warn');
      return;
    }
    try {
      var blob = docxPackage(cards);
      var meta = documentMeta();
      var name = 'klinika_' + safeFilePart(meta.patient) + '_' + safeFilePart(meta.group) + '_' + scope + '_' +
        new Date().toISOString().slice(0, 10) + '.docx';
      downloadBlob(blob, name);
      recordAudit('export', 'Экспорт DOCX', scope + ': ' + cards.length + ' форм');
      toast('DOCX сформирован', name, 'success');
    } catch (err) {
      toast('Ошибка экспорта DOCX', err.message, 'error');
    }
  }

  function exportJson() {
    var copy = JSON.parse(JSON.stringify(state));
    delete copy.user;
    var blob = new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, 'klinika_backup_' + new Date().toISOString().slice(0, 10) + '.json');
    recordAudit('export', 'Резервная копия JSON', '');
    toast('Резервная копия сохранена', 'JSON содержит документацию без данных сессии.', 'success');
  }

  function openExport() {
    updateSignatureUI();
    refreshSignatureStatus();
    openModal('modalExport');
  }

  async function handleExport(action) {
    if (action === 'print-current') {
      printCards(collectCurrentCards());
    } else if (action === 'print-all') {
      closeModal('modalExport');
      var printWindow = global.open('', '_blank');
      if (!printWindow) {
        toast('Браузер заблокировал окно', 'Разрешите всплывающие окна для печати.', 'error');
        return;
      }
      printWindow.document.write('<p style="font-family:sans-serif;padding:24px">Подготовка документации к печати…</p>');
      toast('Подготовка печати', 'Загружаем все формы…', 'success');
      var all = await collectAllCards();
      printCards(all, printWindow);
    } else if (action === 'docx-current') {
      await exportDocx(collectCurrentCards(), 'current');
    } else if (action === 'docx-all') {
      closeModal('modalExport');
      toast('Подготовка DOCX', 'Загружаем все формы…', 'success');
      var allDocx = await collectAllCards();
      await exportDocx(allDocx, 'all');
    } else if (action === 'json') {
      exportJson();
    } else if (action === 'txt') {
      downloadReport();
    }
  }

  /* ============================================================
     АУДИТ И ЭЛЕКТРОННАЯ ПОДПИСЬ
     ============================================================ */
  var AUDIT_LABELS = {
    login: 'Вход в систему',
    logout: 'Выход из системы',
    case: 'Загрузка кейса',
    blank: 'Режим «С нуля»',
    sync: 'Синхронизация 001 → 003 → 066',
    check: 'Проверка документации',
    report: 'Формирование отчёта',
    export: 'Экспорт документа',
    print: 'Печать документации',
    sign: 'Электронная подпись',
    theme: 'Оформление',
    edit: 'Изменение поля',
    reset: 'Сброс данных'
  };

  function recordAudit(action, target, details) {
    if (!state) return;
    state.audit = state.audit || [];
    state.audit.push({
      id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
      ts: new Date().toISOString(),
      user: session ? session.fio : '—',
      group: session ? session.group : '—',
      action: action,
      target: String(target || '').slice(0, 200),
      details: String(details || '').slice(0, 600)
    });
    if (state.audit.length > 1000) state.audit = state.audit.slice(-1000);
    if (typeof scheduleSave === 'function') scheduleSave();
  }

  function canonicalJson(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
    return '{' + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ':' + canonicalJson(value[key]);
    }).join(',') + '}';
  }

  function signaturePayload() {
    var copy = JSON.parse(JSON.stringify(state || {}));
    ['signatures', 'audit', 'meta', 'ui', 'progress', 'user', 'signatureValid'].forEach(function (key) {
      delete copy[key];
    });
    return canonicalJson(copy);
  }

  function sha256Fallback(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    var hex = (hash >>> 0).toString(16);
    while (hex.length < 8) hex = '0' + hex;
    return hex + hex + hex + hex;
  }

  async function documentHash() {
    var payload = signaturePayload();
    if (global.crypto && global.crypto.subtle && global.TextEncoder) {
      try {
        var buffer = await global.crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
        return Array.prototype.map.call(new Uint8Array(buffer), function (b) {
          return ('0' + b.toString(16)).slice(-2);
        }).join('');
      } catch (err) {
        return sha256Fallback(payload);
      }
    }
    return sha256Fallback(payload);
  }

  function updateSignatureUI() {
    var badge = $('#btnSignatureBadge');
    var status = $('#exportSignatureStatus');
    var signatures = state && Array.isArray(state.signatures) ? state.signatures : [];
    if (!badge) return;
    if (!signatures.length) {
      badge.textContent = 'Не подписано';
      badge.className = 'signature-badge';
      badge.title = 'Документация не подписана';
      if (status) status.textContent = 'Документация не подписана. Подпишите её после проверки.';
      state.signatureValid = null;
      return;
    }
    var latest = signatures[signatures.length - 1];
    badge.textContent = (state.signatureValid === false ? 'Изменено после подписи' : 'Подписано: ' + latest.fio);
    badge.className = 'signature-badge ' + (state.signatureValid === false ? 'is-changed' : 'is-signed');
    badge.title = (state.signatureValid === false ? 'Документ изменён после подписания' : 'Документ подписан') +
      ': ' + latest.fio + ', ' + global.Auth.formatDateRu(latest.signedAt) + ' ' + global.Auth.formatTimeRu(latest.signedAt);
    if (status) {
      status.textContent = (state.signatureValid === false ? 'Документ изменён после подписания. Требуется повторная подпись. ' : 'Документация подписана. ') +
        latest.role + ': ' + latest.fio + ', ' + global.Auth.formatDateRu(latest.signedAt) + ' ' +
        global.Auth.formatTimeRu(latest.signedAt) + '. SHA-256: ' + latest.hash.slice(0, 16) + '…';
    }
  }

  var signatureCheckTimer = null;
  function scheduleSignatureCheck() {
    if (!state || !state.signatures || !state.signatures.length) return;
    global.clearTimeout(signatureCheckTimer);
    signatureCheckTimer = global.setTimeout(refreshSignatureStatus, 700);
  }

  async function refreshSignatureStatus() {
    if (!state || !state.signatures || !state.signatures.length) { updateSignatureUI(); return; }
    var latest = state.signatures[state.signatures.length - 1];
    var hash = await documentHash();
    state.signatureValid = hash === latest.hash;
    updateSignatureUI();
  }

  function openSignModal() {
    if (!state) return;
    var fio = $('#signFio');
    if (fio) fio.value = session ? session.fio : '';
    var role = $('#signRole');
    if (role) role.value = 'Студент';
    var confirm = $('#signConfirm');
    if (confirm) confirm.checked = false;
    var error = $('#signError');
    if (error) { error.hidden = true; error.textContent = ''; }
    openModal('modalSign');
  }

  async function submitSignature() {
    var fio = $('#signFio').value.trim().replace(/\s+/g, ' ');
    var role = $('#signRole').value;
    var confirm = $('#signConfirm').checked;
    var error = $('#signError');
    if (fio.length < 5 || fio.split(' ').length < 2) {
      error.hidden = false;
      error.textContent = 'Укажите фамилию и имя подписанта полностью.';
      return;
    }
    if (!confirm) {
      error.hidden = false;
      error.textContent = 'Подтвердите, что документация проверена и подпись ставится осознанно.';
      return;
    }
    error.hidden = true;
    var hash = await documentHash();
    state.signatures = state.signatures || [];
    state.signatures.push({
      id: 'sig-' + Date.now().toString(36),
      fio: fio,
      role: role,
      signedAt: new Date().toISOString(),
      hash: hash,
      algorithm: 'SHA-256'
    });
    state.signatureValid = true;
    recordAudit('sign', 'Электронная подпись', role + ': ' + fio + ', SHA-256 ' + hash.slice(0, 16) + '…');
    saveNow();
    updateSignatureUI();
    closeModal('modalSign');
    toast('Документация подписана', role + ': ' + fio + '. Хеш: ' + hash.slice(0, 16) + '…', 'success');
  }

  function auditActionLabel(action) {
    return AUDIT_LABELS[action] || action;
  }

  function renderAudit(query) {
    var body = $('#auditBody');
    if (!body) return;
    var q = String(query || '').trim().toLowerCase();
    var entries = (state.audit || []).slice().reverse().filter(function (entry) {
      if (!q) return true;
      return [entry.user, entry.group, auditActionLabel(entry.action), entry.target, entry.details, entry.ts]
        .join(' ').toLowerCase().indexOf(q) !== -1;
    });
    if (!entries.length) {
      body.innerHTML = '<tr><td colspan="5" class="muted">Записей нет.</td></tr>';
      return;
    }
    body.innerHTML = entries.slice(0, 500).map(function (entry) {
      return '<tr><td>' + esc(global.Auth.formatDateRu(entry.ts)) + ' ' + esc(global.Auth.formatTimeRu(entry.ts)) + '</td>' +
        '<td>' + esc(entry.user) + (entry.group ? '<br><span class="muted">' + esc(entry.group) + '</span>' : '') + '</td>' +
        '<td><span class="audit-action">' + esc(auditActionLabel(entry.action)) + '</span></td>' +
        '<td>' + esc(entry.target || '—') + '</td>' +
        '<td>' + esc(entry.details || '—') + '</td></tr>';
    }).join('');
  }

  function openAuditModal() {
    var search = $('#auditSearch');
    if (search) search.value = '';
    renderAudit('');
    openModal('modalAudit');
  }

  function exportAuditCsv() {
    var rows = [['Дата и время', 'Пользователь', 'Группа', 'Действие', 'Объект', 'Детали']];
    (state.audit || []).forEach(function (entry) {
      rows.push([entry.ts, entry.user, entry.group, auditActionLabel(entry.action), entry.target, entry.details]);
    });
    var csv = '\ufeff' + rows.map(function (row) {
      return row.map(function (cell) {
        return '"' + String(cell === undefined || cell === null ? '' : cell).replace(/"/g, '""') + '"';
      }).join(';');
    }).join('\r\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'audit_' + new Date().toISOString().slice(0, 10) + '.csv');
    toast('Журнал аудита сохранён', 'CSV с разделителем «;» для Excel.', 'success');
  }

  function renderStat066Movements() {
    var body = $('[data-render="stat066Movements"]');
    if (body) { body.dataset.rendered = '0'; RENDERERS.stat066Movements(body); body.dataset.rendered = '1'; }
    setText('[data-counter="s066MoveRows"]', String((getPath(state, 'stat066.movements') || []).length));
  }

  function addStat066Movement() {
    var card = state.card003 || {};
    var stat = state.stat066 || (state.stat066 = {});
    if (!Array.isArray(stat.movements)) stat.movements = [];
    stat.movements.push({
      department: card.department || '',
      profile: card.profile || '',
      doctor: card.doctor || '',
      admissionDate: card.admissionDate || '',
      dischargeDate: '',
      dischargeTime: '',
      main: card.clinicalMain || card.prelimMain || '',
      icd: card.clinicalIcd || card.prelimIcd || '',
      days: card.days || ''
    });
    renderStat066Movements();
    scheduleSave();
  }

  var ACTIONS = {
    'sync-all': function () { openSyncPreview(); },
    'sync-from-journal': function () { openSyncPreview(); },
    'journal-add': function () { addJournalRow(); },
    'journal-from-case': function () { openCases(); },
    'journal-clear': function () {
      askConfirm('Очистить журнал?', 'Все записи журнала 001/у будут удалены. Медицинская карта и статистическая карта не изменятся.', 'Очистить', function () {
        state.j001 = { selected: 0, rows: [newRow001()] };
        reRenderJournal();
        saveNow();
        toast('Журнал очищен', '', 'success');
      });
    },
    'journal-row-select': function (el) { selectJournalRow(el.getAttribute('data-idx')); },
    'bed-add': function () { addBedRow(); },
    'bed-clear': function () {
      askConfirm('Очистить лист 007/у?', 'Все строки движения пациентов будут удалены.', 'Очистить', function () {
        state.dept007.rows = [];
        reRender007();
        saveNow();
      });
    },
    'bed-remove': function (el) {
      var idx = Number(el.getAttribute('data-idx'));
      state.dept007.rows.splice(idx, 1);
      reRender007();
      scheduleSave();
    },
    'recalc-beds': function () { recalcBeds(); },
    'diet-add': function () {
      addDietRow();
      if (state.nutrition.rows.length === 1) {
        var beds = state.dept007.rows || [];
        if (beds.length) {
          var patients = beds.reduce(function (a, r) { return a + n(r.current); }, 0);
          if (patients) {
            state.nutrition.rows[0].patients = String(patients);
            var inp = $('[data-bind="nutrition.rows.0.patients"]');
            if (inp) inp.value = patients;
          }
        }
      }
    },
    'diet-clear': function () {
      askConfirm('Очистить порционник?', 'Все строки порционного требования будут удалены.', 'Очистить', function () {
        state.nutrition.rows = [];
        reRenderNutrition();
        saveNow();
      });
    },
    'diet-remove': function (el) {
      state.nutrition.rows.splice(Number(el.getAttribute('data-idx')), 1);
      reRenderNutrition();
      scheduleSave();
    },
    'recalc-diets': function () { recalcDiets(); },
    'cso-add': function () { addCsoRow(); },
    'cso-clear': function () {
      askConfirm('Очистить журнал 366/у?', 'Все строки контроля будут удалены.', 'Очистить', function () {
        state.cso.rows = [];
        reRenderCso();
        saveNow();
      });
    },
    'cso-remove': function (el) {
      state.cso.rows.splice(Number(el.getAttribute('data-idx')), 1);
      reRenderCso();
      scheduleSave();
    },
    'cso-recalc': function () {
      reRenderCso();
      updateSummaries();
      var qty = (state.cso.rows || []).reduce(function (a, r) { return a + n(r.qty); }, 0);
      toast('Журнал 366/у пересчитан', 'Проверено изделий: ' + qty + '.', 'success');
    },
    'temp-add-day': function () { addTempDay(); },
    'temp-remove-day': function (el) {
      var idx = Number(el.getAttribute('data-idx'));
      state.treatment.temp.days.splice(idx, 1);
      ['breath', 'weight', 'fluid', 'urine', 'stool', 'bath'].forEach(function (key) {
        if (Array.isArray(state.treatment.temp[key])) state.treatment.temp[key].splice(idx, 1);
      });
      reRenderTemp();
      scheduleSave();
    },
    'temp-clear': function () {
      askConfirm('Очистить температурный лист?', 'Все дни наблюдения и показатели будут удалены.', 'Очистить', function () {
        state.treatment.temp = { cardNo: '', ward: '', fio: '', days: [], dayNumbers: [], stayDay: [], breath: [], weight: [], fluid: [], urine: [], stool: [], bath: [], criticalNote: '' };
        reRenderTemp();
        saveNow();
      });
    },
    'temp-fill-week': function () { fillTempWeek(); },
    'rx-add': function () { addPrescription(); },
    'rx-remove': function (el) {
      state.treatment.prescriptions.rows.splice(Number(el.getAttribute('data-idx')), 1);
      reRenderPrescriptions();
      scheduleSave();
    },
    'rx-clear': function () {
      askConfirm('Очистить лист назначений?', 'Все назначения и отметки о выполнении будут удалены.', 'Очистить', function () {
        state.treatment.prescriptions.rows = [];
        reRenderPrescriptions();
        saveNow();
      });
    },
    'monitor-add': function () { addMonitor(); },
    'monitor-remove': function (el) {
      state.treatment.anesthesia.monitor.splice(Number(el.getAttribute('data-idx')), 1);
      var tbody = $('[data-render="anesthesiaMonitor"]');
      if (tbody) { tbody.dataset.rendered = '0'; RENDERERS.anesthesiaMonitor(tbody); tbody.dataset.rendered = '1'; }
      updateCounters();
      scheduleSave();
    },
    'icu-add': function () { addIcuHour(); },
    'icu-remove': function (el) {
      state.treatment.icu.rows.splice(Number(el.getAttribute('data-idx')), 1);
      reRenderIcu();
      scheduleSave();
    },
    'icu-recalc': function () { recalcIcu(); },
    'rad-add': function () { addRadiation(); },
    'rad-remove': function (el) {
      state.treatment.radiation.rows.splice(Number(el.getAttribute('data-idx')), 1);
      var tbody = $('[data-render="radiation"]');
      if (tbody) { tbody.dataset.rendered = '0'; RENDERERS.radiation(tbody); tbody.dataset.rendered = '1'; }
      var totals = $('[data-render="radiationTotals"]');
      if (totals) { totals.dataset.rendered = '0'; RENDERERS.radiationTotals(totals); totals.dataset.rendered = '1'; }
      var radRows = state.treatment.radiation.rows;
      var total = radRows.reduce(function (a, r) { return a + n(r.dose); }, 0);
      state.treatment.radiation.totalDose = total ? total.toFixed(1) : '';
      var inp = $('[data-bind="treatment.radiation.totalDose"]');
      if (inp) inp.value = total ? total.toFixed(1) : '';
      updateCounters();
      scheduleSave();
    },
    'rad-clear': function () {
      state.treatment.radiation.rows = [];
      state.treatment.radiation.totalDose = '';
      hydrate($('#treatmentContainer'));
      scheduleSave();
    },
    'op008-add': function () { addOperation008(); },
    'op008-from-protocol': function () { fillOperationFromProtocol(); },
    'op008-remove': function (el) {
      state.operations008.rows.splice(Number(el.getAttribute('data-idx')), 1);
      renderOperations008();
      scheduleSave();
    },
    'op008-clear': function () {
      askConfirm('Очистить журнал 008/у?', 'Все записи об операциях будут удалены.', 'Очистить', function () {
        state.operations008.rows = [];
        renderOperations008();
        saveNow();
      });
    },
    'stat066-move-add': function () { addStat066Movement(); },
    'stat066-move-remove': function (el) {
      state.stat066.movements.splice(Number(el.getAttribute('data-idx')), 1);
      renderStat066Movements();
      scheduleSave();
    },
    'sum016-add': function () { addSummary016Row(); },
    'sum016-remove': function (el) {
      state.summary016.rows.splice(Number(el.getAttribute('data-idx')), 1);
      renderSummary016();
      scheduleSave();
    },
    'sum016-clear': function () {
      askConfirm('Очистить ведомость 016/у?', 'Все строки сводной ведомости будут удалены.', 'Очистить', function () {
        state.summary016.rows = [];
        renderSummary016();
        saveNow();
      });
    },
    'sum016-recalc': function () { recalcSummary016(); },
    'sum016-pull': function () { pullSummary016From007(); },
    'endo-add': function () { addEndoscopy(); },
    'endo-from-card': function () { addEndoscopy(); },
    'endo-remove': function (el) {
      state.endoscopy.rows.splice(Number(el.getAttribute('data-idx')), 1);
      renderEndoscopy();
      scheduleSave();
    },
    'endo-clear': function () {
      askConfirm('Очистить журнал 157/у?', 'Все записи эндоскопических исследований будут удалены.', 'Очистить', function () {
        state.endoscopy.rows = [];
        renderEndoscopy();
        saveNow();
      });
    },
    'diary-add': function () { addDiaryRecord(); },
    'diary-from-exam': function () { addDiaryRecord(); },
    'diary-remove': function (el) {
      state.diary.rows.splice(Number(el.getAttribute('data-idx')), 1);
      renderDiary();
      scheduleSave();
    },
    'diary-clear': function () {
      askConfirm('Очистить дневник наблюдения?', 'Все записи дневника будут удалены.', 'Очистить', function () {
        state.diary.rows = [];
        renderDiary();
        saveNow();
      });
    },
    'consent-fill': function () { fillConsent(); },
    'transfusion-import': function () { importTransfusionGroup(); },
    'discharge-autofill': function () { autofillDischarge(); },
    'copy-patient': function () { copyPatientData(); },
    'select-case': function () { openCases(); },
    'load-case': function (el) { loadCase(Number(el.getAttribute('data-case-id'))); },
    'start-blank': function () {
      closeModal('modalCases');
      startBlankDocumentation();
    },
    'goto-error': function (el) {
      var idx = Number(el.getAttribute('data-error-index'));
      var err = state.meta.sortedErrors && state.meta.sortedErrors[idx];
      gotoError(err);
    },
    'focus-form': function (el) {
      var target = document.getElementById(el.getAttribute('data-target'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    'teacher-reset': function () {
      state.meta = { checkedAt: null, result: null };
      saveNow(true);
      renderTeacher(null);
      updateSummaries();
      toast('Результаты сброшены', 'Выполните проверку повторно.', 'success');
    },
    'open-instruction': function () { openModal('modalInstruction'); }
  };

  /* ============================================================
     ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ
     ============================================================ */
  function bindClick(selector, handler, type) {
    document.addEventListener(type || 'click', function (event) {
      var target = event.target.closest ? event.target.closest(selector) : null;
      if (!target) return;
      if ((type || 'click') === 'submit') event.preventDefault();
      handler(event, target);
    });
  }

  function bindEvents() {
    document.addEventListener('click', function (event) {
      var close = event.target.closest('[data-close-modal]');
      if (close) {
        event.preventDefault();
        closeModal(close.closest('.modal'));
        return;
      }
      var el = event.target.closest('[data-action]');
      if (!el) return;
      var action = el.getAttribute('data-action');
      if (action === 'journal-select') return;
      if (ACTIONS[action]) {
        event.preventDefault();
        ACTIONS[action](el, event);
      }
    });

    document.addEventListener('input', function (event) {
      var el = event.target.closest('[data-bind]');
      if (!el) return;
      if (el.type === 'checkbox' || el.type === 'radio') return;
      handleBoundInput(el, 'input');
    });

    document.addEventListener('change', function (event) {
      var target = event.target;
      if (target.matches('[data-action="journal-select"]')) {
        selectJournalRow(Number(target.value));
        return;
      }
      var el = target.closest('[data-bind]');
      if (!el) return;
      handleBoundInput(el, 'change');
    });

    document.addEventListener('blur', function (event) {
      var el = event.target;
      if (el && el.matches && el.matches('[data-bind][data-rule]')) paintField(el);
    }, true);

    bindClick('#loginForm', function (event) { handleLogin(event); }, 'submit');
    bindClick('#welcomeLogout', logout);
    bindClick('#btnLogout', logout);
    bindClick('#btnStartWorkspace', function () {
      state.started = true;
      saveNow();
      showApp();
      toast('Рабочее место открыто', 'Выберите отделение в боковом меню или загрузите клинический кейс.', 'success');
    });
    bindClick('#btnWelcomeInstruction', function () { openModal('modalInstruction'); });
    bindClick('#btnInstruction', function () { openModal('modalInstruction'); });
    bindClick('#btnPauseTimer', togglePause);
    bindClick('#btnPalette', function () { openPalette(); });
    bindClick('#btnExport', openExport);
    bindClick('[data-export]', function (event, el) { handleExport(el.getAttribute('data-export')); });
    bindClick('#btnSignDocument', openSignModal);
    bindClick('#btnOpenAudit', openAuditModal);
    bindClick('#signAccept', submitSignature);
    bindClick('#auditExport', exportAuditCsv);
    bindClick('#btnSignatureBadge', openExport);
    var auditSearch = $('#auditSearch');
    if (auditSearch) auditSearch.addEventListener('input', function () { renderAudit(auditSearch.value); });
    bindClick('#btnSitemap', function () { openSitemap(); });
    bindClick('#btnSitemapFooter', function () { openSitemap(); });
    bindClick('[data-sitemap-tab]', function (event, el) {
      goSitemap(el.getAttribute('data-sitemap-tab'), el.getAttribute('data-sitemap-sub'), el.getAttribute('data-sitemap-card'));
    });
    bindClick('[data-sitemap-action]', function (event, el) {
      runSitemapAction(el.getAttribute('data-sitemap-action'));
    });
    bindClick('#btnCollapseSidebar', function () { toggleSidebar(); });
    bindClick('#paletteList', function (event) {
      var btn = event.target.closest('[data-palette-index]');
      if (btn) runPaletteItem(Number(btn.getAttribute('data-palette-index')));
    });
    bindClick('#teacherOpenInstruction', function () { openModal('modalInstruction'); });
    bindClick('#btnCheck', function () { runCheck(false); });
    bindClick('#btnCheckFromTeacher', function () { runCheck(false); });
    bindClick('#teacherCheckBtn', function () { runCheck(false); });
    bindClick('#btnReport', downloadReport);
    bindClick('#btnReportFromCheck', downloadReport);
    bindClick('#teacherReportBtn', downloadReport);
    bindClick('#btnOpenCases', openCases);
    bindClick('#teacherChooseCase', openCases);
    bindClick('#btnCaseLoadForms', function () {
      if (state.caseId) loadCase(state.caseId);
    });
    bindClick('#btnCaseClose', closeCase);
    bindClick('#syncAccept', applySync);
    bindClick('#confirmAccept', function () {
      var cb = confirmCallback;
      confirmCallback = null;
      closeModal('modalConfirm');
      if (cb) cb();
    });
    bindClick('#btnMenu', function () {
      var sidebar = $('#sidebar');
      var open = sidebar.classList.toggle('is-open');
      $('#btnMenu').setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    bindClick('#sidebarNav', function (event) {
      var btn = event.target.closest('[data-tab]');
      if (btn) switchTab(btn.getAttribute('data-tab'), false);
    });
    bindClick('#treatmentSubnav', function (event) {
      var btn = event.target.closest('[data-subform]');
      if (btn) loadSubform(btn.getAttribute('data-subform'));
    });

    var scrollTicking = false;
    function onScroll() {
      if (scrollTicking) return;
      scrollTicking = true;
      global.requestAnimationFrame(function () {
        var doc = document.documentElement;
        var max = doc.scrollHeight - global.innerHeight;
        var pct = max > 0 ? Math.min(100, (global.scrollY / max) * 100) : 0;
        var bar = $('#scrollProgress');
        if (bar) bar.style.width = pct + '%';
        var topbar = $('.topbar');
        if (topbar) topbar.classList.toggle('is-scrolled', global.scrollY > 6);
        scrollTicking = false;
      });
    }
    global.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    document.addEventListener('click', function (event) {
      var button = event.target.closest('.btn, .nav-item, .subnav-item');
      if (!button || button.disabled || button.classList.contains('palette-item')) return;
      var rect = button.getBoundingClientRect();
      var ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.left = (event.clientX - rect.left) + 'px';
      ripple.style.top = (event.clientY - rect.top) + 'px';
      button.appendChild(ripple);
      global.setTimeout(function () { ripple.remove(); }, 600);
    });

    var paletteInput = $('#paletteInput');
    if (paletteInput) {
      paletteInput.addEventListener('input', function () {
        paletteActive = 0;
        renderPalette(paletteInput.value);
      });
    }

    document.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if ($('#modalPalette').hidden) openPalette();
        return;
      }
      if (!$('#modalPalette').hidden) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          movePalette(1);
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          movePalette(-1);
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          runPaletteItem(paletteActive);
          return;
        }
      }
      if (event.key === 'Escape') {
        var openModals = $$('.modal:not([hidden])');
        if (openModals.length) closeModal(openModals[openModals.length - 1]);
        else closeMobileMenu();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveNow();
        toast('Сохранено', 'Данные записаны в localStorage браузера.', 'success');
      }
      if (event.altKey && /^[1-5]$/.test(event.key)) {
        event.preventDefault();
        switchTab(['reception', 'treatment', 'department', 'cso', 'teacher'][Number(event.key) - 1], false);
      }
      if (event.key === 'Tab') {
        var modal = $$('.modal:not([hidden])').pop();
        if (!modal) return;
        var focusables = $$('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]', modal)
          .filter(function (el) { return el.offsetParent !== null; });
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    document.addEventListener('input', function (event) {
      if (event.target.classList && event.target.classList.contains('is-error-hl')) {
        event.target.classList.remove('is-error-hl');
        event.target.removeAttribute('data-error-hl');
      }
    });
  }

  /* ============================================================
     СТАРТ
     ============================================================ */
  function init() {
    if (initialised) return;
    initialised = true;
    initTheme();
    bindEvents();

    session = global.Auth.restore();
    if (!session) {
      showLogin();
      return;
    }
    state = loadState();
    if (!state) {
      state = defaultState();
      state.doc.journalStarted = todayIso();
    }
    state.user = session;
    if (state.caseId && global.CASES && global.CASES.get(state.caseId) &&
        global.CASES.get(state.caseId).planted.length === 0) {
      global.Auth.setTimingEnabled(session, false);
    }
    updateUserUI();
    if (state.started) {
      showApp();
      toast('Сессия восстановлена', 'Добро пожаловать, ' + session.fio + '. Таймер продолжает работу.', 'success');
    } else {
      showWelcome();
    }
  }

  var App = {
    init: init,
    state: function () { return state; },
    runCheck: runCheck,
    save: function () { saveNow(); },
    openInstruction: function () { openModal('modalInstruction'); },
    openCases: openCases,
    loadCase: loadCase,
    switchTab: switchTab
  };

  global.App = App;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
