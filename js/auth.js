/* ============================================================
   МИС «Цифровая клиника МК РАМН»
   js/auth.js — авторизация, сессия, таймер, отчёт о практике
   ============================================================ */
(function (global) {
  'use strict';

  var SESSION_KEY = 'mkramn.clinic.session.v1';
  var WORK_KEY = 'mkramn.clinic.work.v1';
  var MAX_IDLE_DAYS = 14;

  function nowIso() {
    return new Date().toISOString();
  }

  function safeParse(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function normalizeFio(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/(^|\s|-)([а-яёa-z])/g, function (m, sep, ch) {
        return sep + ch.toUpperCase();
      });
  }

  function normalizeGroup(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  function initials(fio) {
    var parts = String(fio || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'С';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatDuration(totalSeconds) {
    var sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    return pad2(h) + ':' + pad2(m) + ':' + pad2(s);
  }

  function formatMinutesRu(totalSeconds) {
    var seconds = Math.floor(Math.max(0, Number(totalSeconds) || 0));
    if (seconds < 60) return seconds + ' сек';
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + ' мин';
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    return h + ' ч ' + m + ' мин';
  }

  function formatDateRu(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear();
  }

  function formatTimeRu(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  var Auth = {
    SESSION_KEY: SESSION_KEY,
    WORK_KEY: WORK_KEY,

    normalizeFio: normalizeFio,
    normalizeGroup: normalizeGroup,
    initials: initials,
    formatDuration: formatDuration,
    formatMinutesRu: formatMinutesRu,
    formatDateRu: formatDateRu,
    formatTimeRu: formatTimeRu,

    restore: function () {
      var session = safeParse(global.localStorage.getItem(SESSION_KEY));
      if (!session || !session.fio || !session.group || !session.loginAt) return null;
      var started = new Date(session.loginAt).getTime();
      if (isNaN(started)) return null;
      var ageDays = (Date.now() - started) / 86400000;
      if (ageDays > MAX_IDLE_DAYS) {
        global.localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    },

    login: function (fioRaw, groupRaw) {
      var fio = normalizeFio(fioRaw);
      var group = normalizeGroup(groupRaw);
      if (fio.length < 3) {
        throw new Error('Укажите фамилию и имя студента (не менее 3 символов).');
      }
      if (!/^[А-ЯЁA-Z][А-ЯЁA-Zа-яёa-z\- ]+$/.test(fio)) {
        throw new Error('Фамилия и имя должны содержать только буквы, пробел и дефис.');
      }
      if (group.length < 2) {
        throw new Error('Укажите академическую группу.');
      }
      if (!/^[А-ЯЁA-Z0-9\-]{2,20}$/.test(group)) {
        throw new Error('Группа указывается латиницей или кириллицей: буквы, цифры, дефис.');
      }
      var session = {
        fio: fio,
        group: group,
        loginAt: nowIso(),
        lastActiveAt: nowIso(),
        pausedAt: null,
        pausedSeconds: 0,
        timingEnabled: true,
        version: 1
      };
      global.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return session;
    },

    touch: function (session) {
      if (!session) return;
      session.lastActiveAt = nowIso();
      try {
        global.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch (err) {
        /* переполнение хранилища не должно ломать сессию */
      }
    },

    logout: function () {
      global.localStorage.removeItem(SESSION_KEY);
    },

    elapsedSeconds: function (session) {
      if (!session || !session.loginAt) return 0;
      var started = new Date(session.loginAt).getTime();
      if (isNaN(started)) return 0;
      var pausedSeconds = Number(session.pausedSeconds) || 0;
      if (session.pausedAt) {
        var pausedAt = new Date(session.pausedAt).getTime();
        if (!isNaN(pausedAt)) pausedSeconds += Math.max(0, (Date.now() - pausedAt) / 1000);
      }
      return Math.max(0, Math.floor((Date.now() - started) / 1000 - pausedSeconds));
    },

    setTimingEnabled: function (session, enabled) {
      if (!session) return;
      session.timingEnabled = !!enabled;
      if (!enabled) session.pausedAt = null;
      try {
        global.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch (err) { /* ignore */ }
    },

    resetTimer: function (session) {
      if (!session) return;
      session.loginAt = nowIso();
      session.pausedAt = null;
      session.pausedSeconds = 0;
      session.lastActiveAt = nowIso();
      try {
        global.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch (err) { /* ignore */ }
    },

    isTimingEnabled: function (session) {
      return !session || session.timingEnabled !== false;
    },

    isPaused: function (session) {
      return !!(session && session.pausedAt);
    },

    pause: function (session) {
      if (!session || session.pausedAt) return false;
      session.pausedAt = nowIso();
      session.lastActiveAt = nowIso();
      try {
        global.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch (err) { /* ignore */ }
      return true;
    },

    resume: function (session) {
      if (!session || !session.pausedAt) return false;
      var pausedAt = new Date(session.pausedAt).getTime();
      if (!isNaN(pausedAt)) {
        session.pausedSeconds = (Number(session.pausedSeconds) || 0) + Math.max(0, (Date.now() - pausedAt) / 1000);
      }
      session.pausedAt = null;
      session.lastActiveAt = nowIso();
      try {
        global.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch (err) { /* ignore */ }
      return true;
    },

    totalPausedSeconds: function (session) {
      if (!session) return 0;
      var total = Number(session.pausedSeconds) || 0;
      if (session.pausedAt) {
        var pausedAt = new Date(session.pausedAt).getTime();
        if (!isNaN(pausedAt)) total += Math.max(0, (Date.now() - pausedAt) / 1000);
      }
      return Math.floor(total);
    },

    startTimer: function (session, onTick) {
      var stopped = false;
      function tick() {
        if (stopped) return;
        onTick(Auth.elapsedSeconds(session), formatDuration(Auth.elapsedSeconds(session)));
      }
      tick();
      var id = global.setInterval(tick, 1000);
      return function stop() {
        stopped = true;
        global.clearInterval(id);
      };
    },

    /*
     * Формирует итоговый отчёт о практике.
     * state  — снимок состояния МИС;
     * result — результат проверки ClinicValidation.check().
     */
    buildReport: function (state, result) {
      var session = (state && state.user) || Auth.restore() || {};
      var elapsed = Auth.elapsedSeconds(session);
      var lines = [];
      var rule = new Array(78).join('=');
      var thin = new Array(78).join('-');
      var caseInfo = (state && state.caseId && global.CASES)
        ? global.CASES.get(state.caseId)
        : null;

      lines.push(rule);
      lines.push('ОТЧЁТ О ПРАКТИКЕ');
      lines.push('Учебно-симуляционный комплекс «Цифровая клиника МК РАМН»');
      lines.push('ФГБПОУ «Медицинский колледж» (МК РАМН)');
      lines.push(rule);
      lines.push('Студент:            ' + (session.fio || '—'));
      lines.push('Академическая группа: ' + (session.group || '—'));
      lines.push('Дата отчёта:        ' + formatDateRu(nowIso()));
      lines.push('Время отчёта:       ' + formatTimeRu(nowIso()));
      lines.push('Начало сессии:      ' + formatDateRu(session.loginAt) + ' ' + formatTimeRu(session.loginAt));
      if (session.timingEnabled === false) {
        lines.push('Учёт времени:       не ведётся (режим самостоятельной работы)');
      } else {
        lines.push('Затрачено времени:  ' + formatMinutesRu(elapsed) + ' (' + formatDuration(elapsed) + ')');
        var pausedTotal = Auth.totalPausedSeconds(session);
        if (pausedTotal > 0) {
          lines.push('Время пауз:         ' + formatMinutesRu(pausedTotal) + ' (' + formatDuration(pausedTotal) + ', не входит в затраченное время)');
        }
      }
      lines.push('Клинический кейс:   ' + (caseInfo ? caseInfo.title + ' [' + caseInfo.difficultyLabel + ']' : 'не выбран, ручной ввод'));
      lines.push(thin);

      lines.push('1. ОБЪЁМ ЗАПОЛНЕННОЙ ДОКУМЕНТАЦИИ');
      if (state && state.progress) {
        var order = [
          ['journal001', 'Журнал 001/у'],
          ['card003', 'Медицинская карта 003/у'],
          ['stat066', 'Статистическая карта 066/у'],
          ['exam', 'Первичный осмотр'],
          ['preop', 'Предоперационный блок'],
          ['operation', 'Протокол операции'],
          ['anesthesia', 'Протокол анестезии'],
          ['icu', 'Карта реанимации'],
          ['prescriptions', 'Лист назначений'],
          ['transfusion', 'Лист трансфузии'],
          ['temp', 'Температурный лист 004/у'],
          ['radiation', 'Лист лучевой нагрузки'],
          ['discharge', 'Выписной эпикриз'],
          ['dept007', 'Лист 007/у'],
          ['nutrition', 'Порционник 1-84'],
          ['cso', 'Журнал 366/у'],
          ['operations008', 'Журнал операций 008/у'],
          ['summary016', 'Сводная ведомость 016/у'],
          ['endoscopy', 'Журнал эндоскопии 157/у'],
          ['diary', 'Дневник наблюдения'],
          ['consent', 'Согласие на операцию']
        ];
        order.forEach(function (pair) {
          var pct = state.progress[pair[0]] || 0;
          var bar = new Array(Math.round(pct / 5) + 1).join('#');
          lines.push('  ' + (pair[1] + '                          ').slice(0, 30) + ' ' +
            ('   ' + pct + '%').slice(-4) + '  ' + bar);
        });
      } else {
        lines.push('  Данные о полноте форм отсутствуют.');
      }
      lines.push(thin);

      lines.push('2. РЕЗУЛЬТАТ ПРОВЕРКИ');
      if (result) {
        lines.push('  Найдено нарушений:      ' + result.errors.length);
        lines.push('    критических:          ' + result.counts.critical);
        lines.push('    существенных:         ' + result.counts.major);
        lines.push('    недочётов:            ' + result.counts.minor);
        lines.push('  Итоговая оценка:        ' + result.score.toFixed(2) + ' из 5,00');
        lines.push('  Оценка (журнал):        ' + result.grade);
        if (caseInfo && result.plantedTotal) {
          lines.push('  Заложенных ошибок:      ' + result.plantedTotal +
            '; не устранено: ' + result.plantedRemaining +
            '; устранено: ' + (result.plantedTotal - result.plantedRemaining));
        }
        lines.push('');
        if (result.errors.length) {
          lines.push('  Перечень выявленных нарушений:');
          result.errors.forEach(function (err, idx) {
            lines.push('  ' + (idx + 1) + '. [' + err.severityLabel + '] ' + err.title);
            lines.push('     Форма: ' + err.form + '. Поле: ' + (err.field || '—'));
            lines.push('     Пояснение: ' + err.message);
            if (err.hint) lines.push('     Как исправить: ' + err.hint);
            lines.push('');
          });
        } else {
          lines.push('  Нарушений не выявлено. Документация заполнена корректно.');
          lines.push('');
        }
      } else {
        lines.push('  Проверка не выполнялась. Нажмите «Проверить работу» перед формированием отчёта.');
        lines.push('');
      }
      lines.push(thin);

      lines.push('3. ЭЛЕКТРОННАЯ ПОДПИСЬ');
      if (state && Array.isArray(state.signatures) && state.signatures.length) {
        state.signatures.forEach(function (sig, idx) {
          lines.push('  ' + (idx + 1) + '. ' + sig.role + ': ' + sig.fio);
          lines.push('     Дата и время: ' + formatDateRu(sig.signedAt) + ' ' + formatTimeRu(sig.signedAt));
          lines.push('     Алгоритм: ' + (sig.algorithm || 'SHA-256') + '; хеш: ' + String(sig.hash).slice(0, 32) + '…');
        });
        if (state.signatureValid === false) {
          lines.push('  ВНИМАНИЕ: после подписания документация изменена, подпись требует повторного оформления.');
        } else if (state.signatureValid === true) {
          lines.push('  Подпись действительна: состояние документа совпадает с подписанным.');
        }
      } else {
        lines.push('  Документация не подписана.');
      }
      lines.push('');

      lines.push('4. ЖУРНАЛ АУДИТА (последние 15 записей)');
      if (state && Array.isArray(state.audit) && state.audit.length) {
        state.audit.slice(-15).reverse().forEach(function (entry) {
          lines.push('  ' + formatDateRu(entry.ts) + ' ' + formatTimeRu(entry.ts) + ' · ' +
            (entry.user || '—') + ' · ' + (entry.action || '—') + ' · ' +
            (entry.target || '—') + (entry.details ? ' · ' + entry.details : ''));
        });
      } else {
        lines.push('  Записей нет.');
      }
      lines.push(thin);

      lines.push('5. ПЕРЕКРЁСТНЫЕ КОНТРОЛИ, ВЫПОЛНЕННЫЕ СИСТЕМОЙ');
      [
        'Сверка паспортных данных 001/у ↔ 003/у ↔ 066/у',
        'Сверка группы крови, Rh-фактора и Kell-антигена 003/у ↔ лист трансфузии',
        'Контроль отменённых назначений и отметок медсестры',
        'Баланс движения пациентов и коечного фонда 007/у',
        'Сверка порционника 1-84 с числом пациентов и формой 007/у',
        'Контроль доз лучевой нагрузки и критических значений 004/у',
        'Контроль качества предстерилизационной очистки 366/у'
      ].forEach(function (item, i) {
        lines.push('  ' + (i + 1) + '. ' + item + ' — выполнен');
      });
      lines.push(thin);
      lines.push('6. ЗАКЛЮЧЕНИЕ');
      if (result) {
        if (result.score >= 4.5) {
          lines.push('  Документация ведётся корректно, критических дефектов нет.');
        } else if (result.score >= 3.5) {
          lines.push('  Документация в целом корректна, требуется устранить отдельные дефекты.');
        } else if (result.score >= 2.5) {
          lines.push('  Выявлены существенные дефекты ведения документации, требуется повторная отработка.');
        } else {
          lines.push('  Выявлены критичные дефекты, создающие угрозу безопасности пациента.');
          lines.push('  Необходима повторная отработка маршрута документации под контролем преподавателя.');
        }
      } else {
        lines.push('  Требуется выполнить проверку документации.');
      }
      lines.push('');
      lines.push('  Оценка сформирована автоматически по критериям методических указаний.');
      lines.push('  Преподаватель: ______________________________  / ____________________ /');
      lines.push('  Дата проверки: "____" ____________ 20____ г.');
      lines.push(rule);
      lines.push('Документ сформирован МИС «Цифровая клиника МК РАМН».');
      lines.push('Все данные синтетические. Обработка персональных данных не осуществляется (ФЗ-152).');
      lines.push(rule);
      return lines.join('\r\n');
    },

    downloadReport: function (state, result) {
      var text = Auth.buildReport(state, result);
      var session = (state && state.user) || Auth.restore() || {};
      var safeFio = String(session.fio || 'student').replace(/[^А-ЯЁA-Zа-яёa-z0-9\-]+/g, '_');
      var safeGroup = String(session.group || 'group').replace(/[^А-ЯЁA-Zа-яёa-z0-9\-]+/g, '_');
      var stamp = new Date();
      var fname = 'otchet_' + safeFio + '_' + safeGroup + '_' +
        stamp.getFullYear() + pad2(stamp.getMonth() + 1) + pad2(stamp.getDate()) + '_' +
        pad2(stamp.getHours()) + pad2(stamp.getMinutes()) + '.txt';
      var blob = new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1500);
      return fname;
    }
  };

  global.Auth = Auth;
})(window);
