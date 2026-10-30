/* ============================================================
   МИС «Цифровая клиника МК РАМН»
   js/validation.js — маски, валидация на лету, перекрёстная
   проверка документации, оценивание и подсчёт полноты форм.
   ============================================================ */
(function (global) {
  'use strict';

  var BLOOD_GROUPS = ['O(I)', 'A(II)', 'B(III)', 'AB(IV)'];
  var SEVERITY_WEIGHT = { critical: 0.7, major: 0.4, minor: 0.15 };
  var SEVERITY_LABEL = { critical: 'Критическая', major: 'Существенная', minor: 'Недочёт' };

  function str(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function filled(value) {
    return str(value).length > 0;
  }

  function digits(value) {
    return String(value || '').replace(/\D+/g, '');
  }

  function parseDate(value) {
    var v = str(value);
    if (!v) return null;
    var d = new Date(v.length === 10 ? v + 'T00:00:00' : v);
    return isNaN(d.getTime()) ? null : d;
  }

  function num(value) {
    var v = String(value === null || value === undefined ? '' : value)
      .replace(',', '.')
      .replace(/[^\d.\-]/g, '');
    if (!v || v === '.' || v === '-') return NaN;
    var n = Number(v);
    return isFinite(n) ? n : NaN;
  }

  function n(value) {
    return num(value);
  }

  function normBlood(value) {
    return str(value).toUpperCase().replace(/\s+/g, '').replace(/0/g, 'O');
  }

  function normRh(value) {
    var v = str(value).toUpperCase().replace(/\s+/g, '');
    if (v === 'RH+' || v === 'RH +' || v === '+') return 'Rh+';
    if (v === 'RH-' || v === 'RH−' || v === '−' || v === '-') return 'Rh-';
    return v;
  }

  function normKell(value) {
    var v = str(value).toUpperCase().replace(/\s+/g, '');
    if (v === 'K+' || v === '+') return 'K+';
    if (v === 'K-' || v === 'K−' || v === '-') return 'K-';
    return v;
  }

  function getPath(obj, path) {
    if (!obj || !path) return undefined;
    return path.split('.').reduce(function (acc, key) {
      if (acc === null || acc === undefined) return undefined;
      if (/^\d+$/.test(key)) return acc[Number(key)];
      return acc[key];
    }, obj);
  }

  function fmt(value) {
    var v = str(value);
    return v || '—';
  }

  function addDays(date, days) {
    if (!date) return null;
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }

  /* ============================================================
     МАСКИ ВВОДА
     ============================================================ */
  var MASKS = {
    snils: function (value) {
      var d = digits(value).slice(0, 11);
      if (d.length <= 3) return d;
      if (d.length <= 6) return d.slice(0, 3) + '-' + d.slice(3);
      if (d.length <= 9) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
      return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6, 9) + ' ' + d.slice(9);
    },
    oms: function (value) {
      var d = digits(value).slice(0, 16);
      return d.replace(/(\d{4})(?=\d)/g, '$1 ');
    },
    passport: function (value) {
      var d = digits(value).slice(0, 10);
      if (d.length <= 4) return d;
      return d.slice(0, 4) + ' ' + d.slice(4);
    },
    phone: function (value) {
      var d = digits(value);
      if (!d) return '';
      if (d.charAt(0) === '8') d = '7' + d.slice(1);
      if (d.charAt(0) !== '7' && d.length <= 10) d = '7' + d;
      d = d.slice(0, 11);
      var out = '+7';
      if (d.length > 1) out += ' (' + d.slice(1, 4);
      if (d.length >= 5) out += ') ' + d.slice(4, 7);
      if (d.length >= 8) out += '-' + d.slice(7, 9);
      if (d.length >= 10) out += '-' + d.slice(9, 11);
      return out;
    },
    icd: function (value) {
      return str(value).toUpperCase().replace(/[^A-Z0-9.]/g, '').slice(0, 6);
    },
    number: function (value) {
      return str(value).replace(/[^\d.,\-]/g, '');
    },
    blood: function (value) {
      var v = str(value).toUpperCase().replace(/\s+/g, '').replace(/0/g, 'O');
      if (!v) return '';
      if (v.indexOf('AB') === 0) return 'AB(IV)';
      if (v.indexOf('A') === 0) return 'A(II)';
      if (v.indexOf('B') === 0) return 'B(III)';
      if (v.indexOf('O') === 0) return 'O(I)';
      return str(value).toUpperCase();
    }
  };

  function applyMask(el) {
    if (!el || !el.getAttribute) return;
    var mask = el.getAttribute('data-mask');
    if (!mask || !MASKS[mask] || el.type === 'date' || el.type === 'time') return;
    var before = el.value;
    var after = MASKS[mask](before);
    if (before !== after) {
      el.value = after;
      try {
        el.setSelectionRange(after.length, after.length);
      } catch (err) {
        /* некоторые типы input не поддерживают выделение */
      }
    }
    if (mask === 'icd') {
      el.value = el.value.toUpperCase();
    }
  }

  /* ============================================================
     ВАЛИДАЦИЯ ПОЛЯ ПО DATA-RULE
     ============================================================ */
  function validateValue(value, rules, el) {
    var v = str(value);
    var list = String(rules || '').split('|').map(function (r) { return r.trim(); }).filter(Boolean);
    var min = el ? num(el.getAttribute('data-min')) : NaN;
    var max = el ? num(el.getAttribute('data-max')) : NaN;
    var isRequired = list.indexOf('required') !== -1;

    if (!v) {
      if (isRequired) return { level: 'error', message: 'Поле обязательно для заполнения.' };
      return { level: 'ok', message: '' };
    }

    for (var i = 0; i < list.length; i += 1) {
      var rule = list[i];
      if (rule === 'required') continue;
      if (rule === 'fio') {
        if (v.length < 5 || v.split(/\s+/).length < 2) {
          return { level: 'error', message: 'Укажите фамилию и имя полностью.' };
        }
        if (!/^[А-ЯЁA-Zа-яёa-z][А-ЯЁA-Zа-яёa-z\s\-]+$/.test(v)) {
          return { level: 'error', message: 'ФИО содержит недопустимые символы.' };
        }
      } else if (rule === 'snils') {
        if (!/^\d{3}-\d{3}-\d{3} \d{2}$/.test(v)) {
          return { level: 'error', message: 'СНИЛС: 11 цифр в формате 123-456-789 00.' };
        }
      } else if (rule === 'oms') {
        if (digits(v).length !== 16) {
          return { level: 'error', message: 'Полис ОМС: 16 цифр.' };
        }
      } else if (rule === 'passport') {
        if (!/^\d{4} \d{6}$/.test(v)) {
          return { level: 'error', message: 'Паспорт: серия 4 цифры, номер 6 цифр.' };
        }
      } else if (rule === 'phone') {
        if (!/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/.test(v)) {
          return { level: 'error', message: 'Телефон: +7 (999) 123-45-67.' };
        }
      } else if (rule === 'icd') {
        if (!/^[A-Z]\d{2}(\.\d{1,2})?$/.test(v)) {
          return { level: 'error', message: 'Код МКБ-10: латинская буква, 2 цифры, при необходимости .0–.9.' };
        }
      } else if (rule === 'blood') {
        if (BLOOD_GROUPS.indexOf(normBlood(v)) === -1) {
          return { level: 'error', message: 'Группа крови: O(I), A(II), B(III) или AB(IV).' };
        }
      } else if (rule === 'rh') {
        if (normRh(v) !== 'Rh+' && normRh(v) !== 'Rh-') {
          return { level: 'error', message: 'Резус-фактор: Rh+ или Rh−.' };
        }
      } else if (rule === 'kell') {
        if (normKell(v) !== 'K+' && normKell(v) !== 'K-') {
          return { level: 'error', message: 'Kell-антиген: K+ или K−.' };
        }
      } else if (rule === 'date') {
        if (!parseDate(v)) return { level: 'error', message: 'Некорректная дата.' };
      } else if (rule === 'time') {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) {
          return { level: 'error', message: 'Время в формате ЧЧ:ММ.' };
        }
      } else if (rule === 'number') {
        if (!isFinite(num(v))) return { level: 'error', message: 'Введите число.' };
      } else if (rule === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { level: 'error', message: 'Некорректный e-mail.' };
      }
    }

    var n = num(v);
    if (isFinite(min) && isFinite(n) && n < min) {
      return { level: 'error', message: 'Значение не может быть меньше ' + min + '.' };
    }
    if (isFinite(max) && isFinite(n) && n > max) {
      return { level: 'error', message: 'Значение не может быть больше ' + max + '.' };
    }

    return { level: 'ok', message: '' };
  }

  function validateInput(el, includeEmpty) {
    if (!el || !el.getAttribute) return { level: 'ok', message: '' };
    var value = el.type === 'checkbox' ? (el.checked ? 'да' : '') : el.value;
    var res = validateValue(value, el.getAttribute('data-rule'), el);
    if (!includeEmpty && !str(value) && res.level === 'error') {
      return { level: 'ok', message: '' };
    }
    return res;
  }

  /* ============================================================
     ПОЛНОТА РАЗДЕЛОВ
     ============================================================ */
  var SECTION_KEYS = {
    journal001: ['date', 'time', 'fio', 'birth', 'sex', 'passport', 'snils', 'oms', 'delivered', 'cardNo', 'referralDiag', 'referralIcd', 'department', 'outcome'],
    card003: ['fio', 'birth', 'sex', 'admissionDate', 'admissionTime', 'referral', 'department', 'profile', 'ward', 'prelimMain', 'prelimIcd', 'allergy', 'bloodGroup', 'rhFactor', 'kell', 'doctor'],
    stat066: ['fio', 'birth', 'sex', 'citizenship', 'regLiveSubject', 'locality', 'marital', 'education', 'employment', 'oms', 'snils', 'admissionDate', 'referral', 'payment', 'prelimMain', 'prelimIcd'],
    exam: ['examDate', 'complaints', 'diseaseAnamnesis', 'lifeAnamnesis', 'generalCondition', 'skin', 'respRate', 'hr', 'bpSystolic', 'bpDiastolic', 'abdomen', 'height', 'weight', 'diagnosis', 'plan', 'doctor'],
    preop: ['anesthDate', 'anesthComplaints', 'anesthASA', 'anesthPlan', 'anesthDoctor', 'epicrisisDiagnosis', 'epicrisisIndication', 'epicrisisPlan'],
    operation: ['opDate', 'opName', 'opCode', 'opIndication', 'opAccess', 'opCourse', 'opFindings', 'opBloodLoss', 'opSurgeon', 'opAssistant', 'opAnesthesiologist', 'opNurse', 'opCountResult'],
    anesthesia: ['anesthType', 'anesthStart', 'anesthEnd', 'anesthInduction', 'anesthMaintenance', 'anesthVentilator', 'anesthRespRate', 'tidalVolume', 'peep', 'fio2', 'anesthDoctor'],
    icu: ['admissionDate', 'admissionTime', 'diagnosis', 'condition', 'monitoring', 'catheter', 'doctor'],
    transfusion: ['date', 'time', 'recipientFio', 'recipientGroup', 'recipientRh', 'recipientKell', 'donorName', 'donorGroup', 'donorRh', 'donorKell', 'donorUnitNo', 'testGroup', 'biologicalTest', 'biologicalTestResult', 'crossMatch', 'crossMatchResult', 'volume', 'doctor', 'nurse'],
    temp: ['cardNo', 'fio', 'ward'],
    radiation: ['totalDose', 'doctor'],
    discharge: ['date', 'diagnosisMain', 'diagnosisIcd', 'examResults', 'treatmentDone', 'condition', 'outcome', 'recommendations', 'workAbility', 'doctor'],
    dept007: ['date', 'department'],
    nutrition: ['date', 'department'],
    cso: [],
    operations008: ['departmentCode'],
    summary016: ['department', 'period'],
    endoscopy: ['department'],
    diary: [],
    consent: ['fio', 'diagnosis', 'intervention', 'decision', 'doctor', 'date', 'time', 'patientSign']
  };

  function completenessOf(state) {
    var progress = {};

    function pct(keys, obj) {
      var total = keys.length;
      if (!total) return 0;
      var done = 0;
      keys.forEach(function (key) {
        if (filled(getPath(obj, key))) done += 1;
      });
      return Math.round((done / total) * 100);
    }

    var jRow = getPath(state, 'j001.rows.' + (getPath(state, 'j001.selected') || 0)) || {};
    progress.journal001 = pct(SECTION_KEYS.journal001, jRow);
    progress.card003 = pct(SECTION_KEYS.card003, state.card003 || {});
    progress.stat066 = pct(SECTION_KEYS.stat066, state.stat066 || {});
    progress.exam = pct(SECTION_KEYS.exam, getPath(state, 'treatment.exam') || {});
    progress.preop = pct(SECTION_KEYS.preop, getPath(state, 'treatment.preop') || {});
    progress.operation = pct(SECTION_KEYS.operation, getPath(state, 'treatment.operation') || {});
    progress.anesthesia = pct(SECTION_KEYS.anesthesia, getPath(state, 'treatment.anesthesia') || {});
    progress.icu = pct(SECTION_KEYS.icu, getPath(state, 'treatment.icu') || {});
    progress.transfusion = pct(SECTION_KEYS.transfusion, getPath(state, 'treatment.transfusion') || {});
    progress.radiation = pct(SECTION_KEYS.radiation, getPath(state, 'treatment.radiation') || {});
    progress.discharge = pct(SECTION_KEYS.discharge, getPath(state, 'treatment.discharge') || {});

    var prescribed = getPath(state, 'treatment.prescriptions.rows') || [];
    progress.prescriptions = prescribed.length
      ? Math.min(100, Math.round((prescribed.filter(function (r) {
        return filled(r.drug) && filled(r.dose) && filled(r.route);
      }).length / prescribed.length) * 100))
      : 0;

    var days = getPath(state, 'treatment.temp.days') || [];
    var filledDays = days.filter(function (d) {
      return filled(d.tAm) || filled(d.tPm) || filled(d.pulseAm) || filled(d.adAm);
    }).length;
    progress.temp = days.length ? Math.round((filledDays / days.length) * 100) : 0;

    var bedRows = getPath(state, 'dept007.rows') || [];
    progress.dept007 = bedRows.length
      ? Math.round((bedRows.filter(function (r) {
        return filled(r.profile) && filled(r.beds) && filled(r.before) && filled(r.current);
      }).length / bedRows.length) * 100)
      : 0;

    var foodRows = getPath(state, 'nutrition.rows') || [];
    progress.nutrition = foodRows.length
      ? Math.round((foodRows.filter(function (r) {
        return filled(r.department) && filled(r.patients);
      }).length / foodRows.length) * 100)
      : 0;

    var csoRows = getPath(state, 'cso.rows') || [];
    progress.cso = csoRows.length
      ? Math.round((csoRows.filter(function (r) {
        return filled(r.date) && filled(r.itemName) && filled(r.qty);
      }).length / csoRows.length) * 100)
      : 0;

    var op008Rows = getPath(state, 'operations008.rows') || [];
    progress.operations008 = op008Rows.length
      ? Math.round((op008Rows.filter(function (r) {
        return filled(r.cardNo) && filled(r.fio) && filled(r.date) && filled(r.opName);
      }).length / op008Rows.length) * 100)
      : 0;

    var s016Rows = getPath(state, 'summary016.rows') || [];
    progress.summary016 = s016Rows.length
      ? Math.round((s016Rows.filter(function (r) {
        return filled(r.profile) && filled(r.beds) && filled(r.start) && filled(r.end);
      }).length / s016Rows.length) * 100)
      : 0;

    var endoRows = getPath(state, 'endoscopy.rows') || [];
    progress.endoscopy = endoRows.length
      ? Math.round((endoRows.filter(function (r) {
        return filled(r.date) && filled(r.fio) && filled(r.method) && filled(r.conclusion);
      }).length / endoRows.length) * 100)
      : 0;

    var diaryRows = getPath(state, 'diary.rows') || [];
    progress.diary = diaryRows.length
      ? Math.round((diaryRows.filter(function (r) {
        return filled(r.date) && filled(r.complaints) && filled(r.condition) && filled(r.doctor);
      }).length / diaryRows.length) * 100)
      : 0;

    progress.consent = pct(SECTION_KEYS.consent, state.consent || {});

    var total = 0;
    var count = 0;
    Object.keys(progress).forEach(function (k) {
      total += progress[k];
      count += 1;
    });
    progress.total = count ? Math.round(total / count) : 0;
    return progress;
  }

  /* ============================================================
     ПЕРЕКРЁСТНАЯ ПРОВЕРКА
     ============================================================ */
  function makeError(code, severity, form, field, title, message, hint, paths) {
    return {
      code: code,
      severity: severity,
      severityLabel: SEVERITY_LABEL[severity],
      form: form,
      field: field,
      title: title,
      message: message,
      hint: hint || '',
      paths: paths || []
    };
  }

  function check(state) {
    var errors = [];
    var card = state.card003 || {};
    var stat = state.stat066 || {};
    var jRow = getPath(state, 'j001.rows.' + (getPath(state, 'j001.selected') || 0)) || {};
    var exam = getPath(state, 'treatment.exam') || {};
    var preop = getPath(state, 'treatment.preop') || {};
    var op = getPath(state, 'treatment.operation') || {};
    var anesth = getPath(state, 'treatment.anesthesia') || {};
    var icu = getPath(state, 'treatment.icu') || {};
    var presc = getPath(state, 'treatment.prescriptions') || { rows: [] };
    var trans = getPath(state, 'treatment.transfusion') || {};
    var temp = getPath(state, 'treatment.temp') || { days: [] };
    var rad = getPath(state, 'treatment.radiation') || { rows: [] };
    var dis = getPath(state, 'treatment.discharge') || {};
    var beds = getPath(state, 'dept007.rows') || [];
    var food = getPath(state, 'nutrition.rows') || [];
    var csoRows = getPath(state, 'cso.rows') || [];

    /* ---------- 1. Ключевые обязательные поля ---------- */
    var required = [
      ['card003.fio', 'fio', 'Медицинская карта 003/у', 'ФИО пациента', 'Не указано ФИО пациента в титульном листе медицинской карты.'],
      ['card003.birth', 'date', 'Медицинская карта 003/у', 'Дата рождения', 'Не указана дата рождения.'],
      ['card003.admissionDate', 'date', 'Медицинская карта 003/у', 'Дата поступления', 'Не указана дата поступления.'],
      ['card003.department', 'text', 'Медицинская карта 003/у', 'Отделение', 'Не указано отделение госпитализации.'],
      ['card003.prelimMain', 'text', 'Медицинская карта 003/у', 'Предварительный диагноз', 'Не заполнен предварительный диагноз.'],
      ['card003.prelimIcd', 'icd', 'Медицинская карта 003/у', 'Код МКБ', 'Не указан код МКБ предварительного диагноза.'],
      ['card003.bloodGroup', 'blood', 'Медицинская карта 003/у', 'Группа крови', 'Не указана группа крови — критично для безопасности трансфузий.'],
      ['card003.rhFactor', 'rh', 'Медицинская карта 003/у', 'Резус-фактор', 'Не указан резус-фактор.'],
      ['card003.doctor', 'text', 'Медицинская карта 003/у', 'Лечащий врач', 'Не указан лечащий врач.'],
      ['stat066.fio', 'fio', 'Статистическая карта 066/у', 'ФИО пациента', 'Не заполнена паспортная часть статистической карты.'],
      ['stat066.oms', 'oms', 'Статистическая карта 066/у', 'Полис ОМС', 'Не указан полис ОМС.'],
      ['stat066.snils', 'snils', 'Статистическая карта 066/у', 'СНИЛС', 'Не указан СНИЛС.'],
      ['j001', 'row', 'Журнал 001/у', 'Запись о приёме', 'В журнале приёма нет ни одной записи.'],
      ['treatment.exam.complaints', 'text', 'Первичный осмотр 003/у', 'Жалобы', 'Не заполнены жалобы при первичном осмотре.'],
      ['treatment.exam.diseaseAnamnesis', 'text', 'Первичный осмотр 003/у', 'Анамнез заболевания', 'Не заполнен анамнез заболевания.'],
      ['treatment.exam.diagnosis', 'text', 'Первичный осмотр 003/у', 'Диагноз', 'Не сформулирован диагноз первичного осмотра.'],
      ['dept007', 'rows', 'Лист 007/у', 'Движение пациентов', 'Не заполнен лист ежедневного учёта движения пациентов.'],
      ['nutrition', 'rows', 'Порционник 1-84', 'Порции по диетам', 'Не заполнен порционник на питание.']
    ];

    required.forEach(function (rule) {
      var path = rule[0];
      var kind = rule[1];
      var value;
      if (path === 'j001') value = (getPath(state, 'j001.rows') || []).length;
      else if (path === 'dept007') value = beds.length;
      else if (path === 'nutrition') value = food.length;
      else value = getPath(state, path);

      var missing = false;
      if (kind === 'rows') missing = !value || value === 0;
      else if (kind === 'row') missing = !value;
      else if (kind === 'icd') missing = !filled(value);
      else missing = !filled(value);

      if (missing) {
        errors.push(makeError(
          'required_' + path.replace(/\./g, '_'),
          'major',
          rule[2],
          rule[3],
          rule[4],
          'Поле «' + rule[3] + '» не заполнено. Документация не может быть принята без этого реквизита.',
          'Заполните поле в соответствующей форме.',
          [path]
        ));
      }
    });

    /* ---------- 2. Формат заполненных полей ---------- */
    function formatCheck(path, rule, ruleText, form, field) {
      var value = getPath(state, path);
      if (!filled(value)) return;
      var res = validateValue(value, rule, null);
      if (res.level === 'error') {
        errors.push(makeError(
          'format_' + path.replace(/\./g, '_'),
          'major',
          form,
          field,
          'Некорректный формат: ' + field,
          res.message + ' Текущее значение: «' + str(value) + '».',
          'Исправьте значение по правилу: ' + ruleText + '.',
          [path]
        ));
      }
    }

    [
      ['card003.fio', 'fio', 'Фамилия Имя Отчество', 'Медицинская карта 003/у', 'ФИО'],
      ['card003.prelimIcd', 'icd', 'K35.8', 'Медицинская карта 003/у', 'Код МКБ'],
      ['card003.clinicalIcd', 'icd', 'K35.8', 'Медицинская карта 003/у', 'Клинический код МКБ'],
      ['card003.bloodGroup', 'blood', 'A(II)', 'Медицинская карта 003/у', 'Группа крови'],
      ['card003.rhFactor', 'rh', 'Rh+', 'Медицинская карта 003/у', 'Резус-фактор'],
      ['card003.kell', 'kell', 'K−', 'Медицинская карта 003/у', 'Kell-антиген'],
      ['stat066.snils', 'snils', '123-456-789 00', 'Статистическая карта 066/у', 'СНИЛС'],
      ['stat066.oms', 'oms', '16 цифр', 'Статистическая карта 066/у', 'Полис ОМС'],
      ['stat066.referralIcd', 'icd', 'K35.8', 'Статистическая карта 066/у', 'Код МКБ'],
      ['j001', 'row', 'запись', 'Журнал 001/у', 'Запись'],
      ['discharge.diagnosisIcd', 'icd', 'K35.8', 'Выписной эпикриз', 'Код МКБ'],
      ['consent.fio', 'fio', 'Фамилия Имя Отчество', 'Согласие на операцию', 'ФИО пациента'],
      ['consent.birth', 'date', '01.01.2000', 'Согласие на операцию', 'Дата рождения'],
      ['transfusion.recipientGroup', 'blood', 'A(II)', 'Лист трансфузии', 'Группа крови реципиента'],
      ['transfusion.recipientRh', 'rh', 'Rh+', 'Лист трансфузии', 'Резус реципиента'],
      ['transfusion.recipientKell', 'kell', 'K−', 'Лист трансфузии', 'Kell реципиента']
    ].forEach(function (item) {
      if (item[0] === 'j001') {
        var row = jRow;
        ['snils', 'oms', 'passport', 'referralIcd', 'injuryIcd'].forEach(function (key) {
          if (filled(row[key])) {
            var rr = validateValue(row[key], key === 'referralIcd' || key === 'injuryIcd' ? 'icd' : key, null);
            if (rr.level === 'error') {
              errors.push(makeError('format_j001_' + key, 'major', 'Журнал 001/у', key,
                'Некорректный формат в журнале 001/у', rr.message, 'Исправьте значение в журнале приёма.', ['j001.rows.' + (state.j001.selected || 0) + '.' + key]));
            }
          }
        });
      } else {
        formatCheck(item[0], item[1], item[2], item[3], item[4]);
      }
    });

    /* ---------- 3. Даты ---------- */
    var adm = parseDate(card.admissionDate);
    var disDate = parseDate(dis.date);
    var opDate = parseDate(op.opDate);

    if (adm && disDate && disDate.getTime() < adm.getTime()) {
      errors.push(makeError('discharge_before_admission', 'critical', 'Выписной эпикриз', 'Дата выписки',
        'Дата выписки раньше даты поступления',
        'Дата выписки ' + str(dis.date) + ' предшествует дате поступления ' + str(card.admissionDate) + '.',
        'Проверьте даты госпитализации и выписки.', ['treatment.discharge.date', 'card003.admissionDate']));
    }
    if (adm && opDate && opDate.getTime() < adm.getTime()) {
      errors.push(makeError('operation_before_admission', 'major', 'Протокол операции', 'Дата операции',
        'Дата операции раньше даты поступления',
        'Операция не может быть выполнена до госпитализации.',
        'Проверьте дату оперативного вмешательства.', ['treatment.operation.opDate', 'card003.admissionDate']));
    }

    /* ---------- 4. Сверка группы крови / Rh / Kell ---------- */
    if (filled(trans.recipientGroup) && filled(card.bloodGroup) &&
        normBlood(trans.recipientGroup) !== normBlood(card.bloodGroup)) {
      errors.push(makeError('blood_group_mismatch', 'critical', 'Лист трансфузии', 'Группа крови реципиента',
        'Группа крови в листе трансфузии не совпадает с медицинской картой',
        'В карте 003/у указана группа ' + str(card.bloodGroup) + ', в листе трансфузии — ' + str(trans.recipientGroup) + '.',
        'Приведите группу крови реципиента в листе трансфузии в соответствие с титульным листом 003/у.',
        ['treatment.transfusion.recipientGroup', 'card003.bloodGroup']));
    }
    if (filled(trans.recipientRh) && filled(card.rhFactor) &&
        normRh(trans.recipientRh) !== normRh(card.rhFactor)) {
      errors.push(makeError('rh_mismatch', 'critical', 'Лист трансфузии', 'Резус-фактор реципиента',
        'Резус-фактор в листе трансфузии не совпадает с медицинской картой',
        'В карте 003/у указан ' + str(card.rhFactor) + ', в листе трансфузии — ' + str(trans.recipientRh) + '.',
        'Приведите резус-фактор реципиента в соответствие с титульным листом.',
        ['treatment.transfusion.recipientRh', 'card003.rhFactor']));
    }
    if (filled(trans.recipientKell) && filled(card.kell) &&
        normKell(trans.recipientKell) !== normKell(card.kell)) {
      errors.push(makeError('kell_mismatch', 'critical', 'Лист трансфузии', 'Kell-антиген реципиента',
        'Kell-антиген в листе трансфузии не совпадает с медицинской картой',
        'В карте 003/у указан ' + str(card.kell) + ', в листе трансфузии — ' + str(trans.recipientKell) + '.',
        'Приведите Kell-антиген реципиента в соответствие с титульным листом.',
        ['treatment.transfusion.recipientKell', 'card003.kell']));
    }
    var transFilled = Object.keys(trans).some(function (k) { return filled(trans[k]); });
    if (transFilled) {
      if (!trans.consent) {
        errors.push(makeError('transfusion_no_consent', 'critical', 'Лист трансфузии', 'Информированное согласие',
          'Отсутствует информированное добровольное согласие на трансфузию',
          'Перед переливанием крови и её компонентов необходимо оформить ИДС.',
          'Отметьте получение информированного согласия.', ['treatment.transfusion.consent']));
      }
      if (!filled(trans.biologicalTest) || !filled(trans.crossMatch)) {
        errors.push(makeError('transfusion_no_biology', 'critical', 'Лист трансфузии', 'Пробы на совместимость',
          'Не зафиксированы пробы на индивидуальную совместимость и биологическая проба',
          'Без проб переливание недопустимо.',
          'Укажите выполнение пробы на совместимость и трёхкратной биологической пробы.',
          ['treatment.transfusion.biologicalTest', 'treatment.transfusion.crossMatch']));
      }
    }

    /* ---------- 5. Отменённые назначения ---------- */
    var cancelled = (presc.rows || []).filter(function (r) {
      return /отмен/i.test(str(r.status)) || /отмен/i.test(str(r.note));
    });
    cancelled.forEach(function (r, idx) {
      if (r.markDone) {
        errors.push(makeError('cancelled_med_done', 'critical', 'Лист назначений', 'Отметка о выполнении',
          'Выполнение отменённого препарата',
          'Препарат «' + str(r.drug) + '» отменён, однако медсестра отметила его введение ' +
          str(r.markDate) + ' ' + str(r.markTime) + '.',
          'Снимите отметку о выполнении отменённого назначения.',
          ['treatment.prescriptions.rows.' + idx + '.markDone', 'treatment.prescriptions.rows.' + idx + '.status']));
      }
    });

    (presc.rows || []).forEach(function (r, idx) {
      var isCancelled = /отмен/i.test(str(r.status)) || /отмен/i.test(str(r.note));
      if (r.markDone && !isCancelled && !filled(r.markSign)) {
        errors.push(makeError('prescription_no_signature', 'major', 'Лист назначений', 'Подпись медсестры',
          'Отметка о выполнении без подписи медсестры',
          'Назначение «' + str(r.drug) + '» от ' + str(r.markDate) + ' ' + str(r.markTime) + ' не заверено подписью.',
          'Укажите фамилию и подпись медицинской сестры, выполнившей назначение.',
          ['treatment.prescriptions.rows.' + idx + '.markSign']));
      }
      if (r.markDone && !isCancelled && !filled(r.markDate)) {
        errors.push(makeError('prescription_no_date', 'minor', 'Лист назначений', 'Дата выполнения',
          'Не указана дата выполнения назначения',
          'Препарат «' + str(r.drug) + '» отмечен выполненным без даты.',
          'Укажите дату и время выполнения назначения.',
          ['treatment.prescriptions.rows.' + idx + '.markDate']));
      }
    });

    /* ---------- 6. Баланс коек 007/у ---------- */
    beds.forEach(function (row, idx) {
      var before = num(row.before);
      var admitted = num(row.admitted);
      var transfIn = num(row.transfIn) || 0;
      var transfOut = num(row.transfOut) || 0;
      var discharged = num(row.discharged);
      var died = num(row.died);
      var current = num(row.current);

      if (!isFinite(before) || !isFinite(admitted) || !isFinite(discharged) || !isFinite(died) || !isFinite(current)) {
        return;
      }
      var expected = before + admitted + transfIn - transfOut - discharged - died;
      if (Math.abs(expected - current) > 0.001) {
        var delta = current - expected;
        errors.push(makeError(
          'bed_balance',
          'critical',
          'Лист 007/у',
          'Графа 19 (состоит на начало текущего дня)',
          'Баланс движения пациентов не сходится',
          'По формуле: ' + before + ' + ' + admitted + (transfIn ? ' + ' + transfIn : '') +
          (transfOut ? ' − ' + transfOut : '') + ' − ' + discharged + ' − ' + died + ' = ' + expected +
          ', а в графе 19 указано ' + current + ' (расхождение ' + (delta > 0 ? '+' : '') + delta + ').',
          'Приведите графу 19 в соответствие с движением пациентов.',
          ['dept007.rows.' + idx + '.current']
        ));
      }
      if (discharged + died > before + admitted + transfIn) {
        errors.push(makeError('bed_overdischarge', 'critical', 'Лист 007/у', 'Выбытие',
          'Выбыло больше пациентов, чем находилось и поступило',
          'Сумма выписанных и умерших превышает число находившихся и поступивших.',
          'Проверьте графы 4, 5, 10–16.', ['dept007.rows.' + idx + '.discharged', 'dept007.rows.' + idx + '.died']));
      }
    });

    /* ---------- 7. Порционник 1-84 ---------- */
    food.forEach(function (row, idx) {
      var patients = num(row.patients);
      var sum = ['ovd', 'shchd', 'vbd', 'nkd', 'vkd', 'ovd1', 'highProtein'].reduce(function (acc, key) {
        var v = num(row[key]);
        return acc + (isFinite(v) ? v : 0);
      }, 0);
      if (isFinite(patients) && sum !== patients) {
        var diff = sum - patients;
        errors.push(makeError(
          'diet_excess',
          'major',
          'Порционник 1-84',
          'Сумма порций по диетам',
          diff > 0 ? 'Сумма диет превышает число пациентов' : 'Сумма диет меньше числа пациентов',
          'Число питающихся — ' + patients + ', сумма порций по диетам — ' + sum + ' (расхождение ' + (diff > 0 ? '+' : '') + diff + ').',
          'Сверьте назначенные диеты с числом пациентов отделения и графой 19 формы 007/у.',
          ['nutrition.rows.' + idx + '.patients']
        ));
      }
    });

    /* ---------- 8. Температурный лист 004/у ---------- */
    var criticalTemps = [];
    (temp.days || []).forEach(function (day, idx) {
      [['tAm', 'утро'], ['tPm', 'вечер']].forEach(function (pair) {
        var v = num(day[pair[0]]);
        if (isFinite(v) && (v >= 39 || v <= 35)) {
          criticalTemps.push({ idx: idx, key: pair[0], value: v, period: pair[1], date: day.date });
        }
      });
      [['pulseAm', 'утро'], ['pulsePm', 'вечер']].forEach(function (pair) {
        var v = num(day[pair[0]]);
        if (isFinite(v) && (v > 120 || v < 50)) {
          errors.push(makeError('pulse_critical', 'major', 'Температурный лист 004/у', 'Пульс',
            'Критическое значение пульса',
            'Пульс ' + v + ' уд/мин ' + pair[1] + ' ' + str(day.date) + ' — требует врачебного осмотра.',
            'Зафиксируйте осмотр врача и принятые меры в дневнике наблюдений.',
            ['treatment.temp.days.' + idx + '.' + pair[0]]));
        }
      });
    });
    if (criticalTemps.length && !filled(temp.criticalNote)) {
      criticalTemps.forEach(function (c) {
        errors.push(makeError('temp_critical', 'critical', 'Температурный лист 004/у', 'Температура тела',
          'Критическая температура без отметки о реакции',
          'Температура ' + c.value + ' °C ' + c.period + ' ' + str(c.date) + ' выходит за критические границы (35–39 °C).',
          'Внесите запись о врачебном осмотре и принятых мерах в поле «Отметка о критических значениях» или скорректируйте значение.',
          ['treatment.temp.days.' + c.idx + '.' + c.key, 'treatment.temp.criticalNote']));
      });
    }

    /* ---------- 9. Лучевая нагрузка ---------- */
    var radSum = 0;
    (rad.rows || []).forEach(function (r) {
      var v = num(r.dose);
      if (isFinite(v)) radSum += v;
    });
    if (radSum > 100) {
      errors.push(makeError('radiation_overdose', 'major', 'Лист лучевой нагрузки', 'Суммарная доза',
        'Превышена суммарная лучевая нагрузка',
        'Суммарная доза ' + radSum.toFixed(1) + ' мЗв превышает 100 мЗв за госпитализацию.',
        'Проверьте дозы исследований; при необходимости обоснуйте в эпикризе.',
        ['treatment.radiation.totalDose']));
    }

    /* ---------- 10. ЦСО 366/у ---------- */
    csoRows.forEach(function (row, idx) {
      var qty = num(row.qty);
      var blood = num(row.contaminatedBlood) || 0;
      var detergent = num(row.contaminatedDetergent) || 0;
      if (isFinite(qty) && (blood + detergent) > qty) {
        errors.push(makeError('cso_contaminated_excess', 'major', 'Журнал 366/у', 'Количество загрязнённых',
          'Число загрязнённых изделий превышает число проверенных',
          'Проверено ' + qty + ' изделий, загрязнённых — ' + (blood + detergent) + '.',
          'Проверьте результаты проб: загрязнённых не может быть больше общего числа.',
          ['cso.rows.' + idx + '.contaminatedBlood', 'cso.rows.' + idx + '.contaminatedDetergent']));
      }
      if (isFinite(qty) && qty <= 0) {
        errors.push(makeError('cso_zero_qty', 'minor', 'Журнал 366/у', 'Количество изделий',
          'Не указано количество проверенных изделий',
          'В строке ' + (idx + 1) + ' журнала 366/у количество изделий равно нулю.',
          'Укажите фактическое число проверенных изделий.', ['cso.rows.' + idx + '.qty']));
      }
    });

    /* ---------- 10.1. Сводная ведомость 016/у ---------- */
    (getPath(state, 'summary016.rows') || []).forEach(function (row, idx) {
      if (!filled(row.end)) return;
      var expected = n(row.start) + n(row.admitted) + n(row.transfIn) - n(row.transfOut) - n(row.discharged) - n(row.died);
      if (Math.abs(expected - n(row.end)) > 0.001) {
        errors.push(makeError(
          'summary016_balance',
          'major',
          'Сводная ведомость 016/у',
          'Состояло на конец периода',
          'Баланс сводной ведомости не сходится',
          'По строке «' + fmt(row.profile) + '»: ' + n(row.start) + ' + ' + n(row.admitted) +
          ' + ' + n(row.transfIn) + ' − ' + n(row.transfOut) + ' − ' + n(row.discharged) + ' − ' + n(row.died) +
          ' = ' + expected + ', указано ' + n(row.end) + '.',
          'Приведите графу «Состояло на конец периода» к балансу движения или нажмите «Пересчитать».',
          ['summary016.rows.' + idx + '.end']
        ));
      }
    });

    /* ---------- 10.2. Журнал операций 008/у ---------- */
    (getPath(state, 'operations008.rows') || []).forEach(function (row, idx) {
      var opDate = parseDate(row.date);
      if (adm && opDate && opDate.getTime() < adm.getTime()) {
        errors.push(makeError(
          'op008_before_admission',
          'major',
          'Журнал операций 008/у',
          'Дата операции',
          'Дата операции раньше даты поступления',
          'В журнале 008/у операция от ' + fmt(row.date) + ' предшествует госпитализации от ' + fmt(card.admissionDate) + '.',
          'Проверьте дату операции и дату поступления.',
          ['operations008.rows.' + idx + '.date']
        ));
      }
    });

    /* ---------- 10.3. Информированное согласие ---------- */
    var consent = state.consent || {};
    if (/соглас/i.test(str(consent.decision))) {
      if (!consent.consentGiven) {
        errors.push(makeError(
          'consent_not_confirmed',
          'major',
          'Согласие на операцию',
          'Подтверждение согласия',
          'Не отмечено добровольное согласие пациента',
          'В документе указано решение «' + str(consent.decision) + '», но отметка о добровольном согласии отсутствует.',
          'Отметьте подтверждение согласия, разъяснение информации и способность пациента выразить волю.',
          ['consent.consentGiven']
        ));
      }
      if (!filled(consent.patientSign)) {
        errors.push(makeError(
          'consent_no_signature',
          'major',
          'Согласие на операцию',
          'Подпись пациента',
          'Согласие не подписано пациентом',
          'Отсутствует подпись пациента или его законного представителя.',
          'Укажите фамилию и инициалы пациента, поставившего подпись.',
          ['consent.patientSign']
        ));
      }
    }

    /* ---------- 11. Полнота разделов ---------- */
    var progress = completenessOf(state);
    var progressLabels = {
      card003: 'Медицинская карта 003/у',
      stat066: 'Статистическая карта 066/у',
      exam: 'Первичный осмотр',
      preop: 'Предоперационный блок',
      operation: 'Протокол операции',
      anesthesia: 'Протокол анестезии',
      icu: 'Карта реанимации',
      prescriptions: 'Лист назначений',
      transfusion: 'Лист трансфузии',
      temp: 'Температурный лист 004/у',
      radiation: 'Лист лучевой нагрузки',
      discharge: 'Выписной эпикриз',
      dept007: 'Лист 007/у',
      nutrition: 'Порционник 1-84',
      cso: 'Журнал 366/у',
      operations008: 'Журнал операций 008/у',
      summary016: 'Сводная ведомость 016/у',
      endoscopy: 'Журнал эндоскопии 157/у',
      diary: 'Дневник наблюдения',
      consent: 'Согласие на операцию'
    };
    Object.keys(progressLabels).forEach(function (key) {
      var pct = progress[key] || 0;
      if (pct > 0 && pct < 60) {
        errors.push(makeError(
          'incomplete_' + key,
          'minor',
          progressLabels[key],
          'Полнота заполнения',
          'Раздел заполнен не полностью',
          'Заполнено ' + pct + '% полей раздела «' + progressLabels[key] + '».',
          'Дополните обязательные реквизиты раздела.',
          []
        ));
      }
    });

    /* ---------- 12. Заложенные ошибки кейса ---------- */
    var caseInfo = state.caseId && global.CASES ? global.CASES.get(state.caseId) : null;
    var plantedTotal = 0;
    var plantedRemaining = 0;
    var plantedFixed = 0;
    var plantedDetails = [];

    if (caseInfo) {
      var codes = errors.map(function (e) { return e.code; });
      caseInfo.planted.forEach(function (p) {
        plantedTotal += 1;
        var remains = codes.indexOf(p.code) !== -1;
        if (remains) plantedRemaining += 1;
        else plantedFixed += 1;
        plantedDetails.push({
          code: p.code,
          label: p.label,
          severity: p.severity,
          remains: remains
        });
      });
    }

    /* ---------- 13. Оценка ---------- */
    var counts = { critical: 0, major: 0, minor: 0 };
    errors.forEach(function (e) {
      counts[e.severity] = (counts[e.severity] || 0) + 1;
    });
    var penalty = counts.critical * SEVERITY_WEIGHT.critical +
      counts.major * SEVERITY_WEIGHT.major +
      counts.minor * SEVERITY_WEIGHT.minor;
    var score = Math.max(2, Math.min(5, 5 - penalty));
    score = Math.round(score * 100) / 100;
    var grade = score >= 4.5 ? 'отлично' : score >= 3.5 ? 'хорошо' : score >= 2.5 ? 'удовлетворительно' : 'неудовлетворительно';

    /* уникальные коды ошибок для панели преподавателя */
    var uniq = {};
    errors.forEach(function (e) { uniq[e.code] = true; });

    return {
      errors: errors,
      counts: counts,
      score: score,
      grade: grade,
      progress: progress,
      checkedAt: new Date().toISOString(),
      plantedTotal: plantedTotal,
      plantedRemaining: plantedRemaining,
      plantedFixed: plantedFixed,
      plantedDetails: plantedDetails,
      uniqueCodes: Object.keys(uniq)
    };
  }

  global.ClinicValidation = {
    BLOOD_GROUPS: BLOOD_GROUPS,
    weights: SEVERITY_WEIGHT,
    severityLabel: SEVERITY_LABEL,
    masks: MASKS,
    applyMask: applyMask,
    validateValue: validateValue,
    validateInput: validateInput,
    completeness: completenessOf,
    check: check,
    getPath: getPath,
    parseDate: parseDate,
    num: num,
    str: str,
    filled: filled,
    normBlood: normBlood,
    normRh: normRh,
    normKell: normKell,
    fmt: fmt,
    addDays: addDays
  };
})(window);
