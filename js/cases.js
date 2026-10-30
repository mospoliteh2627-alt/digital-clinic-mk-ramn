/* ============================================================
   МИС «Цифровая клиника МК РАМН»
   js/cases.js — клинические кейсы, эталонные данные и заложенные ошибки
   ============================================================ */
(function (global) {
  'use strict';

  function clone(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(clone);
    var out = {};
    Object.keys(value).forEach(function (k) {
      out[k] = clone(value[k]);
    });
    return out;
  }

  function mergeDeep(target, source) {
    Object.keys(source || {}).forEach(function (key) {
      var sv = source[key];
      if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
        if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
          target[key] = {};
        }
        mergeDeep(target[key], sv);
      } else {
        target[key] = clone(sv);
      }
    });
    return target;
  }

  function shortPatientName(fio) {
    var parts = String(fio || '').trim().split(/\s+/);
    if (parts.length < 2) return String(fio || '');
    var initials = parts.slice(1).map(function (p) { return p.charAt(0).toUpperCase() + '.'; }).join(' ');
    return parts[0] + ' ' + initials;
  }

  function operationMinutes(start, end) {
    if (!start || !end) return '';
    var a = String(start).split(':');
    var b = String(end).split(':');
    if (a.length < 2 || b.length < 2) return '';
    var diff = (Number(b[0]) * 60 + Number(b[1])) - (Number(a[0]) * 60 + Number(a[1]));
    if (!isFinite(diff)) return '';
    if (diff < 0) diff += 1440;
    return String(diff);
  }

  /*
   * Дополнительные формы, которые появились после расширения комплекса.
   * Для учебных кейсов 1–3 журнал 008/у, дневник и согласие формируются
   * из уже заполненных протокола операции, осмотра и назначений.
   * Сводная ведомость 016/у и журнал 157/у остаются для самостоятельного
   * заполнения: они зависят от итогового периода и профиля исследований.
   */
  function buildExtraForms(item) {
    var data = item.data || {};
    var card = data.card003 || {};
    var treatment = data.treatment || {};
    var op = treatment.operation || {};
    var an = treatment.anesthesia || {};
    var exam = treatment.exam || {};
    var pre = treatment.preop || {};
    var presc = treatment.prescriptions || {};

    var result = {
      operations008: { started: '', ended: '', departmentCode: '', rows: [] },
      summary016: { department: '', period: '', rows: [] },
      endoscopy: { started: '', ended: '', department: '', rows: [] },
      diary: { rows: [] },
      consent: {}
    };

    if (!op.opName) return result;

    result.operations008 = {
      started: op.opDate || card.admissionDate || '',
      ended: '',
      departmentCode: 'ХО-2',
      rows: [{
        num: '1',
        cardNo: card.cardNo || '',
        fio: card.fio || '',
        sex: card.sex || '',
        birth: card.birth || '',
        date: op.opDate || '',
        start: an.anesthStart || '',
        end: an.anesthEnd || '',
        duration: operationMinutes(an.anesthStart, an.anesthEnd),
        diagMain: card.prelimMain || '',
        diagComplication: card.prelimComplication || '',
        diagConcomitant: card.prelimConcomitant || '',
        diagExternal: card.prelimExternal || '',
        diagExtra: '',
        opName: op.opName || '',
        opCode: op.opCode || '',
        hitech: 'Нет',
        equipment: /лапароскоп/i.test(op.opName) ? 'Эндоскопическая' : 'Не применялась',
        multiplicity: 'Первичная',
        micro: /микро/i.test(op.opName) ? 'Да' : 'Нет',
        premed: pre.anesthPremed || an.anesthPremed || '',
        anesthesiaType: an.anesthType || '',
        description: [op.opAccess, op.opCourse].filter(Boolean).join(' '),
        outcome: 'Благоприятный',
        deathDate: '',
        deathTime: '',
        material: op.opFindings ? ('Операционный материал: ' + op.opFindings) : '',
        complications: op.opComplications || 'Нет',
        postMain: card.clinicalMain || card.prelimMain || '',
        postComplication: card.clinicalComplication || '',
        postConcomitant: card.clinicalConcomitant || '',
        postExternal: card.clinicalExternal || '',
        surgeon: op.opSurgeon || '',
        assistant: op.opAssistant || '',
        opNurse: op.opNurse || '',
        anesthesiologist: op.opAnesthesiologist || an.anesthDoctor || '',
        anesthetistNurse: ''
      }]
    };

    var nurse = presc.nurse || '';
    result.diary = {
      rows: [{
        date: op.opDate || card.admissionDate || '',
        time: an.anesthEnd || '12:00',
        complaints: exam.complaints || '',
        condition: [exam.generalCondition || '',
          exam.temperature ? 'температура ' + exam.temperature + ' °C' : '',
          exam.bpSystolic ? 'АД ' + exam.bpSystolic + '/' + exam.bpDiastolic + ' мм рт. ст.' : '',
          exam.hr ? 'ЧСС ' + exam.hr + ' уд/мин' : ''].filter(Boolean).join(', '),
        objective: [exam.skin || '', exam.abdomen || ''].filter(Boolean).join(' '),
        appointments: exam.plan || '',
        doctor: card.doctor || exam.doctor || '',
        nurse: nurse
      }]
    };

    result.consent = {
      fio: card.fio || '',
      birth: card.birth || '',
      decision: 'Согласен на медицинское вмешательство',
      diagnosis: [card.clinicalMain || card.prelimMain || '', card.clinicalIcd || card.prelimIcd || ''].filter(Boolean).join(' '),
      intervention: op.opName || '',
      anesthesia: an.anesthType || '',
      risks: 'Кровотечение, инфекционные осложнения, повреждение окружающих тканей, аллергическая реакция, тромбоэмболические осложнения.',
      alternatives: 'Консервативная терапия или иной объём оперативного вмешательства. При отказе — прогрессирование заболевания и риск гнойно-септических осложнений.',
      doctor: card.doctor || '',
      date: op.opDate || card.admissionDate || '',
      time: an.anesthStart || '',
      patientSign: shortPatientName(card.fio),
      witness: '',
      refusalReason: '',
      infoExplained: true,
      capacity: true,
      consentGiven: true
    };

    return result;
  }

  function getPath(obj, path) {
    return String(path).split('.').reduce(function (acc, key) {
      if (acc === null || acc === undefined) return undefined;
      return acc[key];
    }, obj);
  }

  var CASES = {
    list: [],

    get: function (id) {
      var num = Number(id);
      for (var i = 0; i < this.list.length; i += 1) {
        if (this.list[i].id === num) return this.list[i];
      }
      return null;
    },

    difficultyClass: function (diff) {
      if (diff === 'easy') return 'badge-easy';
      if (diff === 'medium') return 'badge-medium';
      if (diff === 'independent') return 'badge-independent';
      return 'badge-hard';
    },

    /*
     * Переносит данные кейса в состояние МИС.
     * Разделы документации заменяются целиком, сессия и интерфейс сохраняются.
     */
    apply: function (state, id) {
      var item = this.get(id);
      if (!item) return false;
      state.caseId = item.id;
      state.patient = clone(item.data.patient || {});
      state.j001 = clone(item.data.j001 || { selected: 0, rows: [] });
      (state.j001.rows || []).forEach(function (row) {
        if (!row.referralIcd && row.injuryIcd && /^[A-Z]\d/.test(row.injuryIcd)) {
          row.referralIcd = row.injuryIcd;
          row.injuryIcd = '';
        }
      });
      state.card003 = clone(item.data.card003 || {});
      state.treatment = clone(item.data.treatment || {});
      state.stat066 = clone(item.data.stat066 || {});
      var caseCard = state.card003 || {};
      var caseDischarge = getPath(state, 'treatment.discharge') || {};
      if (state.stat066 && caseCard.fio) {
        state.stat066.bloodGroup = state.stat066.bloodGroup || caseCard.bloodGroup || '';
        state.stat066.rhFactor = state.stat066.rhFactor || caseCard.rhFactor || '';
        state.stat066.kell = state.stat066.kell || caseCard.kell || '';
        state.stat066.finalMain = state.stat066.finalMain || caseCard.clinicalMain || caseCard.prelimMain || '';
        state.stat066.finalIcd = state.stat066.finalIcd || caseCard.clinicalIcd || caseCard.prelimIcd || '';
        state.stat066.finalComplication = state.stat066.finalComplication || caseCard.clinicalComplication || '';
        state.stat066.finalConcomitant = state.stat066.finalConcomitant || caseCard.clinicalConcomitant || '';
        state.stat066.dischargeDate = state.stat066.dischargeDate || caseDischarge.date || '';
        state.stat066.hivTest = state.stat066.hivTest || 'Нет';
        state.stat066.syphilisTest = state.stat066.syphilisTest || 'Нет';
        state.stat066.hepatitisTest = state.stat066.hepatitisTest || 'Нет';
        state.stat066.headDoctor = state.stat066.headDoctor || 'Иванов И. И.';
        if (!Array.isArray(state.stat066.movements)) state.stat066.movements = [];
        if (!state.stat066.movements.length) {
          state.stat066.movements.push({
            department: caseCard.department || '',
            profile: caseCard.profile || '',
            doctor: caseCard.doctor || '',
            admissionDate: caseCard.admissionDate || '',
            dischargeDate: caseDischarge.date || '',
            dischargeTime: caseDischarge.date ? '10:00' : '',
            main: caseCard.clinicalMain || caseCard.prelimMain || '',
            icd: caseCard.clinicalIcd || caseCard.prelimIcd || '',
            days: caseCard.days || ''
          });
        }
      }
      state.dept007 = clone(item.data.dept007 || { date: '', department: '', rows: [] });
      state.nutrition = clone(item.data.nutrition || { date: '', department: '', rows: [], signatures: {} });
      state.cso = clone(item.data.cso || { rows: [] });
      var extra = buildExtraForms(item);
      state.operations008 = clone(extra.operations008);
      state.summary016 = clone(extra.summary016);
      state.endoscopy = clone(extra.endoscopy);
      state.diary = clone(extra.diary);
      state.consent = clone(extra.consent);
      state.meta = { checkedAt: null, result: null };
      return true;
    },

    /*
     * Возвращает список заложенных в кейс ошибок.
     */
    planted: function (id) {
      var item = this.get(id);
      return item ? clone(item.planted) : [];
    }
  };

  /* ============================================================
     КЕЙС 1. ОСТРЫЙ АППЕНДИЦИТ (базовый уровень)
     ============================================================ */
  CASES.list.push({
    id: 1,
    title: 'Петров Иван Сергеевич, 34 года',
    shortTitle: 'Петров И. С., 34 года',
    diagnosis: 'Острый флегмонозный аппендицит (K35.8)',
    diagnosisCode: 'K35.8',
    difficulty: 'easy',
    difficultyLabel: 'Базовый',
    department: 'Хирургическое отделение № 2',
    summary: 'Плановая отработка маршрута приёмного отделения. Пациент доставлен бригадой скорой помощи с клиникой острого аппендицита, экстренно госпитализирован, прооперирован в течение 6 часов.',
    tasks: [
      'Оформить журнал 001/у и синхронизировать данные в 003/у и 066/у',
      'Проверить группу крови перед переливанием',
      'Сверить лист назначений с отметками медсестры',
      'Проверить журнал операций 008/у, дневник наблюдения и согласие на операцию',
      'Свести баланс коек в 007/у, порционник 1-84 и сводную ведомость 016/у'
    ],
    planted: [
      {
        code: 'blood_group_mismatch',
        label: 'Группа крови в титульном листе 003/у не совпадает с листом трансфузии',
        severity: 'critical',
        hint: 'Приведите группу крови реципиента в листе трансфузии в соответствие с титульным листом 003/у (A(II)).'
      },
      {
        code: 'cancelled_med_done',
        label: 'Медсестра отметила выполнение отменённого цефтриаксона',
        severity: 'critical',
        hint: 'Снимите отметку о выполнении отменённого препарата: отмена зафиксирована врачом 29.10.2026 в 09:10.'
      },
      {
        code: 'bed_balance',
        label: 'Баланс коек в 007/у не сходится: графа 19 завышена на 1',
        severity: 'critical',
        hint: 'Пересчитайте графу 19: 18 находилось + 3 поступило − 2 выписано = 19.'
      },
      {
        code: 'diet_excess',
        label: 'Порционник 1-84: сумма диет превышает число пациентов на 1 порцию',
        severity: 'major',
        hint: 'Сумма порций по диетам должна равняться числу питающихся (18).'
      }
    ],
    data: {
      patient: {
        fio: 'Петров Иван Сергеевич',
        birth: '1991-03-12',
        sex: 'Мужской',
        snils: '123-456-789 01',
        oms: '7701000000000001',
        passport: '4510 123456',
        cardNo: '1245/26',
        department: 'Хирургическое отделение № 2',
        diagnosis: 'Острый флегмонозный аппендицит',
        icd: 'K35.8',
        admissionDate: '2026-10-28',
        admissionTime: '21:40',
        bloodGroup: 'A(II)',
        rh: 'Rh+',
        kell: 'K−'
      },
      j001: {
        selected: 0,
        rows: [
          {
            date: '2026-10-28',
            time: '21:40',
            fio: 'Петров Иван Сергеевич',
            birth: '1991-03-12',
            sex: 'Мужской',
            passport: '4510 123456',
            citizenship: 'Российская Федерация',
            addressLive: 'г. Москва, ул. Поликарпова, д. 12, кв. 45',
            addressStay: 'г. Москва, ул. Поликарпова, д. 12, кв. 45',
            phone: '+7 (916) 123-45-67',
            snils: '123-456-789 01',
            oms: '7701000000000001',
            delivered: 'Выездной бригадой скорой медицинской помощи',
            cardNo: '1245/26',
            referralDiag: 'Острый аппендицит',
            injuryIcd: 'K35.8',
            alcohol: 'Не употреблял, признаков опьянения нет',
            department: 'Хирургическое отделение № 2',
            outcome: 'Госпитализирован',
            outcomeDate: '2026-10-28',
            outcomeTime: '22:05',
            notify: '2026-10-28 22:10, законный представитель уведомлён по телефону',
            refusalReason: '',
            refusalWorker: '',
            extra: 'Номер направления 4821 от 28.10.2026'
          }
        ]
      },
      card003: {
        cardNo: '1245/26',
        fio: 'Петров Иван Сергеевич',
        birth: '1991-03-12',
        sex: 'Мужской',
        admissionType: 'Поступил в стационар',
        admissionDate: '2026-10-28',
        admissionTime: '21:40',
        hoursAfter: '6',
        referral: 'Выездной бригадой скорой медицинской помощи',
        referralOrg: 'ГБУЗ «Городская клиническая больница № 1»',
        referralNo: '4821',
        referralDate: '2026-10-28',
        admissionOrder: 'Первично',
        careForm: 'Экстренная',
        department: 'Хирургическое отделение № 2',
        profile: 'Хирургические койки',
        ward: '7',
        transferDept: '',
        transferProfile: '',
        transferWard: '',
        transferDate: '',
        transferTime: '',
        dischargeDate: '',
        dischargeTime: '',
        days: '',
        referralDiag: 'Острый аппендицит',
        referralIcd: 'K35.8',
        prelimMain: 'Острый аппендицит',
        prelimIcd: 'K35.8',
        prelimComplication: 'Перитонит не выявлен',
        prelimCompIcd: '',
        prelimExternal: '',
        prelimExtIcd: '',
        prelimConcomitant: 'Хронический гастрит вне обострения',
        prelimConcIcd: 'K29.5',
        diagDate: '2026-10-28',
        diagTime: '22:10',
        historyTb: 'Нет',
        historyHiv: 'Нет',
        historyHepatitis: 'Нет',
        historySyphilis: 'Нет',
        historyCovid: 'Нет',
        pediculosis: 'Нет',
        pediculosisResult: 'Живые вши и гниды не обнаружены',
        allergy: 'Аллергические реакции на лекарственные препараты отрицает',
        transfusionHistory: 'Переливания крови и её компонентов ранее не проводились',
        bloodGroup: 'A(II)',
        rhFactor: 'Rh+',
        kell: 'K−',
        bloodOther: 'Anti-A1 не выявлены',
        clinicalMain: 'Острый флегмонозный аппендицит',
        clinicalIcd: 'K35.8',
        clinicalComplication: 'Местный перитонит не выявлен',
        clinicalCompIcd: '',
        clinicalExternal: '',
        clinicalExtIcd: '',
        clinicalConcomitant: 'Хронический гастрит вне обострения',
        clinicalConcIcd: 'K29.5',
        clinicalDiagDate: '2026-10-28',
        clinicalDiagTime: '23:30',
        outcome: 'Выписан',
        transferOrg: '',
        result: 'Выздоровление',
        deathDept: '',
        deathDate: '',
        deathTime: '',
        deathPregnant: '',
        sickLeaveNo: '012 345 678 901',
        sickLeaveDate: '2026-10-29',
        sickLeaveFrom: '2026-10-29',
        sickLeaveTo: '2026-11-07',
        sickLeaveContinued: '',
        returnWork: '2026-11-08',
        appearanceDate: '',
        sickLeaveCare: '',
        mseDate: '',
        informant: 'Петрова Мария Ивановна, супруга',
        informantPhone: '+7 (916) 765-43-21',
        doctor: 'Иванов Игорь Иванович',
        doctorSpecialty: 'Врач-хирург',
        doctorSign: 'Иванов И. И.'
      },
      stat066: {
        cardNo: '1245/26',
        fio: 'Петров Иван Сергеевич',
        birth: '1991-03-12',
        sex: 'Мужской',
        citizenship: 'Российская Федерация',
        regLiveSubject: 'г. Москва',
        regLiveDistrict: 'Северный административный округ',
        regLiveCity: 'Москва',
        regLiveSettlement: '—',
        regLiveStreet: 'ул. Поликарпова',
        regLiveHouse: '12',
        regLiveBuilding: '1',
        regLiveFlat: '45',
        regStaySubject: 'г. Москва',
        regStayDistrict: 'Северный административный округ',
        regStayCity: 'Москва',
        regStaySettlement: '—',
        regStayStreet: 'ул. Поликарпова',
        regStayHouse: '12',
        regStayBuilding: '1',
        regStayFlat: '45',
        locality: 'Городская',
        marital: 'Состоит в зарегистрированном браке',
        education: 'Среднее профессиональное образование',
        employment: 'Работает',
        childStatus: '',
        workplace: 'ООО «Стройтехмонтаж»',
        position: 'Инженер-механик',
        disability: 'Нет',
        radiation: 'Нет',
        oms: '7701000000000001',
        omsDate: '2020-02-14',
        insurer: 'ООО «Страховая медицинская компания «Медстрах»',
        snils: '123-456-789 01',
        admissionDate: '2026-10-28',
        admissionTime: '21:40',
        hoursAfter: '6',
        referral: 'Выездной бригадой скорой медицинской помощи',
        admissionOrder: 'Первично',
        careForm: 'Экстренная',
        alcohol: 'Не употреблял, признаков опьянения нет',
        payment: 'Обязательное медицинское страхование',
        referralDiag: 'Острый аппендицит',
        referralIcd: 'K35.8',
        prelimMain: 'Острый аппендицит',
        prelimIcd: 'K35.8',
        prelimComplication: 'Перитонит не выявлен',
        prelimCompIcd: '',
        prelimExternal: '',
        prelimExtIcd: '',
        prelimConcomitant: 'Хронический гастрит вне обострения',
        prelimConcIcd: 'K29.5',
        outcome: 'Выписан',
        result: 'Выздоровление',
        bedDays: '7',
        profile: 'Хирургические койки',
        operations: 'Аппендэктомия 28.10.2026',
        doctor: 'Иванов Игорь Иванович'
      },
      treatment: {
        exam: {
          examDate: '2026-10-28',
          examTime: '22:20',
          complaints: 'Боли в правой подвздошной области, тошнота, однократная рвота, повышение температуры тела до 37,8 °C.',
          diseaseAnamnesis: 'Заболел остро около 6 часов назад, когда появились боли в эпигастрии, затем сместившиеся в правую подвздошную область. Вызвана скорая медицинская помощь.',
          lifeAnamnesis: 'Ранее практически здоров. Хронический гастрит. Вредные привычки отрицает. Наследственность не отягощена.',
          epidAnamnesis: 'Контакты с инфекционными больными отрицает. За пределы Российской Федерации в последние 21 день не выезжал.',
          generalCondition: 'Средней тяжести',
          consciousness: 'Ясное',
          position: 'Вынужденное, на правом боку',
          skin: 'Кожные покровы обычной окраски, умеренной влажности, сыпи нет',
          mucosa: 'Слизистые оболочки розовые, чистые',
          lymphNodes: 'Периферические лимфатические узлы не увеличены',
          respRate: '18',
          lungAuscultation: 'Дыхание везикулярное, хрипов нет',
          heartSounds: 'Тоны сердца ясные, ритмичные',
          hr: '92',
          bpSystolic: '125',
          bpDiastolic: '78',
          abdomen: 'Живот не вздут, участвует в акте дыхания. При пальпации выраженная болезненность в правой подвздошной области, симптомы Щёткина — Блюмберга, Ситковского, Ровзинга положительные.',
          stool: 'Стул был вчера, оформленный',
          urine: 'Диурез достаточный, моча светлая',
          height: '178',
          weight: '82',
          bmi: '25.9',
          temperature: '37.8',
          diagnosis: 'Острый аппендицит. Перитонит?',
          plan: 'Экстренная госпитализация в хирургическое отделение. Общий анализ крови, мочи, биохимия, УЗИ органов брюшной полости, консультация хирурга, экстренная операция.',
          doctor: 'Иванов И. И.'
        },
        preop: {
          anesthDate: '2026-10-28',
          anesthTime: '22:50',
          anesthComplaints: 'Боли в правой подвздошной области',
          anesthAnamnesis: 'Острая хирургическая патология, операция в экстренном порядке',
          anesthAllergy: 'Не выявлено',
          anesthMallampati: 'II степень',
          anesthAirway: 'Трудных дыхательных путей не ожидается',
          anesthASA: 'II класс',
          anesthRisk: 'Умеренный риск, 1,2 %',
          anesthPlan: 'Общая анестезия с интубацией трахеи, ИВЛ, тотальная внутривенная анестезия',
          anesthPremed: 'Атропин 0,5 мг, димедрол 10 мг в/м за 30 минут до операции',
          anesthDoctor: 'Сидорова А. П.',
          epicrisisDate: '2026-10-28',
          epicrisisDiagnosis: 'Острый аппендицит (K35.8)',
          epicrisisIndication: 'Клиническая картина острого аппендицита, данные УЗИ, лейкоцитоз 14,2 × 10⁹/л',
          epicrisisExam: 'Общий анализ крови: лейкоцитоз, сдвиг формулы влево. УЗИ: утолщение червеобразного отростка до 9 мм.',
          epicrisisAnalyses: 'Группа крови A(II) Rh+, Kell K−. ВИЧ, гепатиты B и C, сифилис — отрицательно.',
          epicrisisRisk: 'ASA II, риск анестезии умеренный',
          epicrisisPlan: 'Лапароскопическая аппендэктомия в экстренном порядке',
          epicrisisDoctor: 'Иванов И. И.'
        },
        operation: {
          opDate: '2026-10-28',
          opName: 'Лапароскопическая аппендэктомия',
          opCode: 'A16.30.001',
          opIndication: 'Острый аппендицит',
          opAccess: 'Три троакарных доступа в брюшную полость',
          opCourse: 'Под эндотрахеальным наркозом выполнена лапароскопия. В правой подвздошной области — рыхлый инфильтрат, червеобразный отросток флегмонозно изменён, покрыт фибрином. Выполнена аппендэктомия, санация брюшной полости, дренирование.',
          opFindings: 'Флегмонозный аппендицит. Местный серозно-фибринозный перитонит.',
          opBloodLoss: '50',
          opComplications: 'Нет',
          opSurgeon: 'Иванов И. И.',
          opAssistant: 'Петрова О. С.',
          opAnesthesiologist: 'Сидорова А. П.',
          opNurse: 'Кузнецова Е. В.',
          opInstrumentsBefore: '24',
          opInstrumentsAfter: '24',
          opTamponsBefore: '10',
          opTamponsAfter: '10',
          opCountResult: 'Инструменты и салфетки сходятся'
        },
        anesthesia: {
          anesthType: 'Общая анестезия с интубацией трахеи',
          anesthStart: '22:55',
          anesthEnd: '00:35',
          anesthPremed: 'Атропин 0,5 мг, димедрол 10 мг',
          anesthInduction: 'Пропофол 200 мг, фентанил 0,2 мг, рокуроний 50 мг',
          anesthMaintenance: 'Севофлуран 2,0 об. %, фентанил дробно',
          anesthRelaxant: 'Рокуроний 50 мг',
          anesthVentilator: 'Dräger Primus',
          anesthRespRate: '14',
          tidalVolume: '520',
          minuteVolume: '7.3',
          peep: '5',
          fio2: '0.45',
          anesthGasFreshFlow: '2.0',
          anesthO2: '1.0',
          anesthN2O: '0.0',
          anesthSevoflurane: '2.0',
          anesthPropofol: '200',
          anesthFentanyl: '0.3',
          anesthMorphine: '0',
          anesthBloodLoss: '50',
          anesthUrine: '150',
          anesthAwakening: 'Полное, через 10 минут после окончания операции',
          anesthComplications: 'Нет',
          anesthDoctor: 'Сидорова А. П.',
          monitor: [
            { time: '23:00', bp: '120/75', hr: '86', spo2: '99', etco2: '36', temp: '36.7' },
            { time: '23:30', bp: '115/70', hr: '80', spo2: '99', etco2: '35', temp: '36.5' },
            { time: '00:00', bp: '118/72', hr: '82', spo2: '98', etco2: '36', temp: '36.6' },
            { time: '00:30', bp: '122/76', hr: '84', spo2: '99', etco2: '35', temp: '36.7' }
          ]
        },
        icu: {
          admissionDate: '2026-10-29',
          admissionTime: '00:50',
          diagnosis: 'Состояние после лапароскопической аппендэктомии',
          condition: 'Средней тяжести, стабильное',
          monitoring: 'АД, ЧСС, SpO₂, диурез почасовой',
          ventilatorMode: 'Самостоятельное дыхание',
          ventilatorParams: '—',
          catheter: 'Периферический венозный катетер, уретральный катетер',
          diuresisHourly: '50',
          rows: [
            { hour: '01:00', parenteral: 'Раствор Рингера 500 мл', parenteralVolume: '500', enteral: '—', enteralVolume: '0', urine: '60', losses: '20', balance: '+420' },
            { hour: '02:00', parenteral: 'Раствор Рингера 500 мл', parenteralVolume: '500', enteral: '—', enteralVolume: '0', urine: '70', losses: '15', balance: '+415' },
            { hour: '03:00', parenteral: 'Глюкоза 5 % 400 мл', parenteralVolume: '400', enteral: 'Вода 100 мл', enteralVolume: '100', urine: '55', losses: '10', balance: '+435' },
            { hour: '04:00', parenteral: '—', parenteralVolume: '0', enteral: 'Вода 100 мл', enteralVolume: '100', urine: '50', losses: '5', balance: '+45' }
          ],
          totalIn: '1600',
          totalOut: '300',
          totalBalance: '+1300',
          doctor: 'Сидорова А. П.'
        },
        prescriptions: {
          rows: [
            { date: '2026-10-29', drug: 'Цефтриаксон', dose: '1 г', route: 'Внутривенно капельно', frequency: '2 раза в сутки', diet: 'ОВД', mode: 'Палатный', status: 'Отменён', markDate: '2026-10-29', markTime: '10:00', markSign: 'Кузнецова Е. В.', markDone: true, note: 'Отменён врачом 29.10.2026 в 09:10 в связи с аллергической реакцией' },
            { date: '2026-10-29', drug: 'Метронидазол', dose: '500 мг', route: 'Внутривенно капельно', frequency: '3 раза в сутки', diet: 'ОВД', mode: 'Палатный', status: 'Назначен', markDate: '2026-10-29', markTime: '11:00', markSign: 'Кузнецова Е. В.', markDone: true, note: '' },
            { date: '2026-10-29', drug: 'Кеторолак', dose: '30 мг', route: 'Внутримышечно', frequency: '3 раза в сутки', diet: 'ОВД', mode: 'Палатный', status: 'Назначен', markDate: '2026-10-29', markTime: '12:00', markSign: 'Кузнецова Е. В.', markDone: true, note: 'При болях' },
            { date: '2026-10-30', drug: 'Раствор Рингера', dose: '500 мл', route: 'Внутривенно капельно', frequency: '2 раза в сутки', diet: 'ОВД', mode: 'Палатный', status: 'Назначен', markDate: '2026-10-30', markTime: '08:00', markSign: 'Кузнецова Е. В.', markDone: true, note: '' },
            { date: '2026-10-30', drug: 'Омепразол', dose: '20 мг', route: 'Внутрь', frequency: '2 раза в сутки', diet: 'ОВД', mode: 'Палатный', status: 'Назначен', markDate: '', markTime: '', markSign: '', markDone: false, note: '' }
          ],
          nurse: 'Кузнецова Е. В.',
          doctor: 'Иванов И. И.'
        },
        transfusion: {
          date: '2026-10-29',
          time: '14:30',
          recipientFio: 'Петров Иван Сергеевич',
          recipientGroup: 'B(III)',
          recipientRh: 'Rh+',
          recipientKell: 'K−',
          donorName: 'Свежезамороженная плазма, донор № 7781',
          donorGroup: 'B(III)',
          donorRh: 'Rh+',
          donorKell: 'K−',
          donorUnitNo: 'PL-2026-10457',
          donorDate: '2026-10-27',
          testGroup: 'B(III)',
          testRh: 'Rh+',
          testKell: 'K−',
          biologicalTest: 'Трёхкратная биологическая проба',
          biologicalTestResult: 'Отрицательная',
          crossMatch: 'Проба на индивидуальную совместимость',
          crossMatchResult: 'Совместима',
          transfusionStart: '14:35',
          transfusionEnd: '15:20',
          volume: '250',
          reaction: 'Нет',
          reactionDesc: '',
          doctor: 'Иванов И. И.',
          nurse: 'Кузнецова Е. В.',
          consent: true
        },
        temp: {
          cardNo: '1245/26',
          ward: '7',
          fio: 'Петров Иван Сергеевич',
          days: [
            { date: '2026-10-29', pulseAm: '88', pulsePm: '92', adAm: '120/75', adPm: '118/72', tAm: '36.9', tPm: '37.4' },
            { date: '2026-10-30', pulseAm: '84', pulsePm: '86', adAm: '118/74', adPm: '120/76', tAm: '36.7', tPm: '37.0' },
            { date: '2026-10-31', pulseAm: '80', pulsePm: '82', adAm: '120/78', adPm: '122/78', tAm: '36.6', tPm: '36.8' },
            { date: '2026-11-01', pulseAm: '78', pulsePm: '80', adAm: '118/76', adPm: '120/75', tAm: '36.5', tPm: '36.7' }
          ],
          breath: ['16', '16', '15', '15'],
          weight: ['82', '81', '81', '80'],
          fluid: ['1800', '1900', '2000', '1950'],
          urine: ['1500', '1600', '1700', '1650'],
          stool: ['—', 'Был', '—', 'Был'],
          bath: ['—', 'Душ', '—', 'Душ']
        },
        radiation: {
          rows: [
            { date: '2026-10-28', study: 'УЗИ органов брюшной полости', area: 'Брюшная полость', dose: '0' },
            { date: '2026-10-28', study: 'Обзорная рентгеноскопия', area: 'Брюшная полость', dose: '1.2' }
          ],
          totalDose: '1.2',
          doctor: 'Иванов И. И.'
        },
        discharge: {
          date: '2026-11-05',
          diagnosisMain: 'Острый флегмонозный аппендицит',
          diagnosisIcd: 'K35.8',
          complications: 'Местный серозно-фибринозный перитонит',
          complicationIcd: '',
          concomitant: 'Хронический гастрит вне обострения',
          concomitantIcd: 'K29.5',
          examResults: 'Общий анализ крови при выписке: лейкоциты 6,8 × 10⁹/л, СОЭ 9 мм/ч. УЗИ: жидкостных образований нет.',
          treatmentDone: 'Лапароскопическая аппендэктомия 28.10.2026. Антибактериальная, инфузионная, обезболивающая терапия.',
          condition: 'Удовлетворительное',
          outcome: 'Выздоровление',
          recommendations: 'Диета ОВД 7 дней с расширением. Ограничение физической нагрузки 4 недели. Перевязки в поликлинике по месту жительства.',
          diet: 'ОВД',
          mode: 'Палатный, затем свободный',
          medications: 'Омепразол 20 мг 2 раза в сутки 7 дней внутрь',
          workAbility: 'Листок нетрудоспособности с 29.10.2026 по 07.11.2026, приступить к работе 08.11.2026',
          doctor: 'Иванов И. И.'
        }
      },
      dept007: {
        date: '2026-10-30',
        department: 'Хирургическое отделение № 2',
        rows: [
          { profile: 'Хирургические койки', beds: '24', closed: '2', before: '18', admitted: '3', fromDay: '0', fromRural: '1', children: '0', elderly: '6', transfIn: '0', transfOut: '0', discharged: '2', dischElderly: '1', dischDay: '0', dischHospital: '0', died: '0', diedChildren: '0', diedElderly: '0', current: '20', currentElderly: '7', caregivers: '1', freeM: '2', freeF: '0' }
        ]
      },
      nutrition: {
        date: '2026-10-30',
        department: 'Хирургическое отделение № 2',
        rows: [
          { department: 'Хирургическое отделение № 2', patients: '18', ovd: '10', shchd: '6', vbd: '3', nkd: '0', vkd: '0', ovd1: '0', highProtein: '0' }
        ],
        signatures: { head: 'Иванов И. И.', senior: 'Кузнецова Е. В.', diet: 'Смирнова Л. А.' }
      },
      cso: {
        rows: [
          { date: '2026-10-29', method: 'Ручной', agent: '«Биолот» 0,5 %', itemName: 'Зажим хирургический', qty: '12', contaminatedBlood: '0', contaminatedDetergent: '0', fio: 'Кузнецова Е. В.' },
          { date: '2026-10-29', method: 'Ручной', agent: '«Биолот» 0,5 %', itemName: 'Скальпель разборный', qty: '6', contaminatedBlood: '0', contaminatedDetergent: '0', fio: 'Кузнецова Е. В.' },
          { date: '2026-10-29', method: 'Механизированный', agent: '«Лизафин» 0,5 %', itemName: 'Лоток почкообразный', qty: '4', contaminatedBlood: '0', contaminatedDetergent: '0', fio: 'Кузнецова Е. В.' }
        ]
      }
    }
  });

  /* ============================================================
     КЕЙС 2. ОСТРЫЙ ХОЛЕЦИСТИТ (средний уровень)
     ============================================================ */
  CASES.list.push({
    id: 2,
    title: 'Смирнова Анна Викторовна, 67 лет',
    shortTitle: 'Смирнова А. В., 67 лет',
    diagnosis: 'Желчнокаменная болезнь. Острый калькулёзный холецистит (K81.0)',
    diagnosisCode: 'K81.0',
    difficulty: 'medium',
    difficultyLabel: 'Средний',
    department: 'Хирургическое отделение № 2',
    summary: 'Пациентка с сопутствующим сахарным диабетом 2 типа. Требуется внимательная сверка Rh-фактора, отмены метформина и подписей медсестры в листе назначений.',
    tasks: [
      'Заполнить журнал и синхронизировать паспортную часть',
      'Сверить Rh-фактор реципиента с титульным листом',
      'Проверить отмену метформина перед операцией',
      'Найти назначение без подписи медсестры',
      'Свести баланс коек, порционник и сводную ведомость 016/у',
      'Проверить журнал операций 008/у, дневник и согласие на операцию'
    ],
    planted: [
      {
        code: 'rh_mismatch',
        label: 'Rh-фактор в листе трансфузии не совпадает с титульным листом 003/у',
        severity: 'critical',
        hint: 'В титульном листе указан Rh+, в листе трансфузии — Rh−. Приведите данные реципиента к Rh+.'
      },
      {
        code: 'cancelled_med_done',
        label: 'Метформин отменён врачом, но медсестра отметила его выполнение',
        severity: 'critical',
        hint: 'Метформин отменён 29.10.2026 в 18:00 перед операцией. Отметка о выполнении должна быть снята.'
      },
      {
        code: 'prescription_no_signature',
        label: 'В листе назначений есть выполненное назначение без подписи медсестры',
        severity: 'major',
        hint: 'Каждая отметка о выполнении заверяется фамилией и подписью медицинской сестры.'
      },
      {
        code: 'bed_balance',
        label: 'Баланс коек в 007/у не сходится: графа 19 завышена на 1',
        severity: 'critical',
        hint: '22 находилось + 2 поступило − 1 выписано = 23, а не 24.'
      },
      {
        code: 'diet_excess',
        label: 'Порционник 1-84: сумма диет превышает число пациентов на 2 порции',
        severity: 'major',
        hint: 'Число питающихся — 22. Сумма порций по диетам должна быть равна 22.'
      }
    ],
    data: {
      patient: {
        fio: 'Смирнова Анна Викторовна',
        birth: '1959-06-04',
        sex: 'Женский',
        snils: '987-654-321 00',
        oms: '7702000000000002',
        passport: '4508 654321',
        cardNo: '1246/26',
        department: 'Хирургическое отделение № 2',
        diagnosis: 'Острый калькулёзный холецистит',
        icd: 'K81.0',
        admissionDate: '2026-10-29',
        admissionTime: '08:15',
        bloodGroup: 'O(I)',
        rh: 'Rh+',
        kell: 'K−'
      },
      j001: {
        selected: 1,
        rows: [
          {
            date: '2026-10-28',
            time: '21:40',
            fio: 'Петров Иван Сергеевич',
            birth: '1991-03-12',
            sex: 'Мужской',
            passport: '4510 123456',
            citizenship: 'Российская Федерация',
            addressLive: 'г. Москва, ул. Поликарпова, д. 12, кв. 45',
            addressStay: 'г. Москва, ул. Поликарпова, д. 12, кв. 45',
            phone: '+7 (916) 123-45-67',
            snils: '123-456-789 01',
            oms: '7701000000000001',
            delivered: 'Выездной бригадой скорой медицинской помощи',
            cardNo: '1245/26',
            referralDiag: 'Острый аппендицит',
            injuryIcd: 'K35.8',
            alcohol: 'Не употреблял',
            department: 'Хирургическое отделение № 2',
            outcome: 'Госпитализирован',
            outcomeDate: '2026-10-28',
            outcomeTime: '22:05',
            notify: '',
            refusalReason: '',
            refusalWorker: '',
            extra: ''
          },
          {
            date: '2026-10-29',
            time: '08:15',
            fio: 'Смирнова Анна Викторовна',
            birth: '1959-06-04',
            sex: 'Женский',
            passport: '4508 654321',
            citizenship: 'Российская Федерация',
            addressLive: 'г. Москва, ул. Зорге, д. 8, кв. 112',
            addressStay: 'г. Москва, ул. Зорге, д. 8, кв. 112',
            phone: '+7 (903) 222-33-44',
            snils: '987-654-321 00',
            oms: '7702000000000002',
            delivered: 'Поликлиникой',
            cardNo: '1246/26',
            referralDiag: 'Желчнокаменная болезнь. Острый холецистит',
            injuryIcd: 'K81.0',
            alcohol: 'Не употребляла',
            department: 'Хирургическое отделение № 2',
            outcome: 'Госпитализирована',
            outcomeDate: '2026-10-29',
            outcomeTime: '10:40',
            notify: '2026-10-29 09:00, дочь уведомлена по телефону',
            refusalReason: '',
            refusalWorker: '',
            extra: 'Направление формы 057/у-04 № 1187 от 29.10.2026'
          }
        ]
      },
      card003: {
        cardNo: '1246/26',
        fio: 'Смирнова Анна Викторовна',
        birth: '1959-06-04',
        sex: 'Женский',
        admissionType: 'Поступил в стационар',
        admissionDate: '2026-10-29',
        admissionTime: '08:15',
        hoursAfter: '48',
        referral: 'Поликлиникой',
        referralOrg: 'ГБУЗ «Городская поликлиника № 3»',
        referralNo: '1187',
        referralDate: '2026-10-28',
        admissionOrder: 'Повторно',
        careForm: 'Экстренная',
        department: 'Хирургическое отделение № 2',
        profile: 'Хирургические койки',
        ward: '8',
        transferDept: '',
        transferProfile: '',
        transferWard: '',
        transferDate: '',
        transferTime: '',
        dischargeDate: '',
        dischargeTime: '',
        days: '',
        referralDiag: 'Желчнокаменная болезнь. Острый холецистит',
        referralIcd: 'K81.0',
        prelimMain: 'Острый калькулёзный холецистит',
        prelimIcd: 'K81.0',
        prelimComplication: 'Перивезикальный инфильтрат под вопросом',
        prelimCompIcd: '',
        prelimExternal: '',
        prelimExtIcd: '',
        prelimConcomitant: 'Сахарный диабет 2 типа, артериальная гипертензия',
        prelimConcIcd: 'E11.9',
        diagDate: '2026-10-29',
        diagTime: '09:30',
        historyTb: 'Нет',
        historyHiv: 'Нет',
        historyHepatitis: 'Нет',
        historySyphilis: 'Нет',
        historyCovid: 'Нет',
        pediculosis: 'Нет',
        pediculosisResult: 'Живые вши и гниды не обнаружены',
        allergy: 'Аллергия на пенициллин — крапивница',
        transfusionHistory: 'Переливания крови не проводились',
        bloodGroup: 'O(I)',
        rhFactor: 'Rh+',
        kell: 'K−',
        bloodOther: '',
        clinicalMain: 'Острый калькулёзный холецистит',
        clinicalIcd: 'K81.0',
        clinicalComplication: 'Перивезикальный инфильтрат',
        clinicalCompIcd: '',
        clinicalExternal: '',
        clinicalExtIcd: '',
        clinicalConcomitant: 'Сахарный диабет 2 типа, артериальная гипертензия',
        clinicalConcIcd: 'E11.9',
        clinicalDiagDate: '2026-10-29',
        clinicalDiagTime: '11:00',
        outcome: 'Выписан',
        transferOrg: '',
        result: 'Улучшение',
        deathDept: '',
        deathDate: '',
        deathTime: '',
        deathPregnant: '',
        sickLeaveNo: '013 456 789 012',
        sickLeaveDate: '2026-10-29',
        sickLeaveFrom: '2026-10-29',
        sickLeaveTo: '2026-11-12',
        sickLeaveContinued: '',
        returnWork: '2026-11-13',
        appearanceDate: '',
        sickLeaveCare: '',
        mseDate: '',
        informant: 'Смирнова Ольга Петровна, дочь',
        informantPhone: '+7 (903) 555-66-77',
        doctor: 'Иванов Игорь Иванович',
        doctorSpecialty: 'Врач-хирург',
        doctorSign: 'Иванов И. И.'
      },
      stat066: {
        cardNo: '1246/26',
        fio: 'Смирнова Анна Викторовна',
        birth: '1959-06-04',
        sex: 'Женский',
        citizenship: 'Российская Федерация',
        regLiveSubject: 'г. Москва',
        regLiveDistrict: 'Северо-Западный административный округ',
        regLiveCity: 'Москва',
        regLiveSettlement: '—',
        regLiveStreet: 'ул. Зорге',
        regLiveHouse: '8',
        regLiveBuilding: '2',
        regLiveFlat: '112',
        regStaySubject: 'г. Москва',
        regStayDistrict: 'Северо-Западный административный округ',
        regStayCity: 'Москва',
        regStaySettlement: '—',
        regStayStreet: 'ул. Зорге',
        regStayHouse: '8',
        regStayBuilding: '2',
        regStayFlat: '112',
        locality: 'Городская',
        marital: 'Состоит в зарегистрированном браке',
        education: 'Среднее общее образование',
        employment: 'Пенсионер',
        childStatus: '',
        workplace: '—',
        position: '—',
        disability: 'Третья группа',
        radiation: 'Нет',
        oms: '7702000000000002',
        omsDate: '2019-11-05',
        insurer: 'АО «Страховая компания «Гарант-Мед»',
        snils: '987-654-321 00',
        admissionDate: '2026-10-29',
        admissionTime: '08:15',
        hoursAfter: '48',
        referral: 'Поликлиникой',
        admissionOrder: 'Повторно',
        careForm: 'Экстренная',
        alcohol: 'Не употребляла, признаков опьянения нет',
        payment: 'Обязательное медицинское страхование',
        referralDiag: 'Желчнокаменная болезнь. Острый холецистит',
        referralIcd: 'K81.0',
        prelimMain: 'Острый калькулёзный холецистит',
        prelimIcd: 'K81.0',
        prelimComplication: 'Перивезикальный инфильтрат под вопросом',
        prelimCompIcd: '',
        prelimExternal: '',
        prelimExtIcd: '',
        prelimConcomitant: 'Сахарный диабет 2 типа, артериальная гипертензия',
        prelimConcIcd: 'E11.9',
        outcome: 'Выписан',
        result: 'Улучшение',
        bedDays: '9',
        profile: 'Хирургические койки',
        operations: 'Лапароскопическая холецистэктомия 30.10.2026',
        doctor: 'Иванов Игорь Иванович'
      },
      treatment: {
        exam: {
          examDate: '2026-10-29',
          examTime: '08:40',
          complaints: 'Боли в правом подреберье, тошнота, горечь во рту, слабость. Повышение температуры до 38,0 °C.',
          diseaseAnamnesis: 'Считает себя больной около 2 суток, когда после погрешности в диете появились боли в правом подреберье. Принимала но-шпу без эффекта. Вызвана скорая помощь, госпитализирована.',
          lifeAnamnesis: 'Сахарный диабет 2 типа около 10 лет, принимает метформин 1000 мг 2 раза в сутки. Артериальная гипертензия. Операций не было.',
          epidAnamnesis: 'Контакты с инфекционными больными отрицает. Гемотрансфузии отрицает.',
          generalCondition: 'Средней тяжести',
          consciousness: 'Ясное',
          position: 'Вынужденное, на левом боку',
          skin: 'Кожные покровы обычной окраски, склеры субиктеричны',
          mucosa: 'Слизистые оболочки влажные, чистые',
          lymphNodes: 'Периферические лимфатические узлы не увеличены',
          respRate: '18',
          lungAuscultation: 'Дыхание везикулярное, хрипов нет',
          heartSounds: 'Тоны сердца приглушены, ритмичные',
          hr: '96',
          bpSystolic: '150',
          bpDiastolic: '90',
          abdomen: 'Живот не вздут. При пальпации болезненность в правом подреберье, симптом Мёрфи положительный, симптом Ортнера положительный.',
          stool: 'Стул был 2 дня назад',
          urine: 'Диурез достаточный, моча тёмная',
          height: '162',
          weight: '88',
          bmi: '33.5',
          temperature: '38.0',
          diagnosis: 'Острый калькулёзный холецистит. Сахарный диабет 2 типа.',
          plan: 'Госпитализация в хирургическое отделение. Общий анализ крови, мочи, биохимия, коагулограмма, УЗИ органов брюшной полости, консультация эндокринолога, оперативное лечение.',
          doctor: 'Иванов И. И.'
        },
        preop: {
          anesthDate: '2026-10-29',
          anesthTime: '18:30',
          anesthComplaints: 'Боли в правом подреберье',
          anesthAnamnesis: 'Острый калькулёзный холецистит, сопутствующий сахарный диабет 2 типа',
          anesthAllergy: 'Пенициллин — крапивница',
          anesthMallampati: 'III степень',
          anesthAirway: 'Прогнозируемые трудные дыхательные пути, подготовлен видеоларингоскоп',
          anesthASA: 'III класс',
          anesthRisk: 'Высокий риск, 3,5 %',
          anesthPlan: 'Общая анестезия с интубацией трахеи, ИВЛ, тотальная внутривенная анестезия',
          anesthPremed: 'Атропин 0,5 мг, дексаметазон 8 мг в/в',
          anesthDoctor: 'Сидорова А. П.',
          epicrisisDate: '2026-10-29',
          epicrisisDiagnosis: 'Острый калькулёзный холецистит (K81.0)',
          epicrisisIndication: 'Клиника острого холецистита, УЗИ-признаки конкрементов, лейкоцитоз 16,8 × 10⁹/л',
          epicrisisExam: 'УЗИ: желчный пузырь 11 × 5 см, стенка 5 мм, конкременты до 18 мм. Общий анализ крови: лейкоцитоз 16,8 × 10⁹/л.',
          epicrisisAnalyses: 'Группа крови O(I) Rh+, Kell K−. Глюкоза 9,8 ммоль/л. ВИЧ, гепатиты, сифилис — отрицательно.',
          epicrisisRisk: 'ASA III, риск анестезии высокий',
          epicrisisPlan: 'Лапароскопическая холецистэктомия после коррекции гликемии',
          epicrisisDoctor: 'Иванов И. И.'
        },
        operation: {
          opDate: '2026-10-30',
          opName: 'Лапароскопическая холецистэктомия',
          opCode: 'A16.30.005',
          opIndication: 'Острый калькулёзный холецистит',
          opAccess: 'Четыре троакарных доступа',
          opCourse: 'Под эндотрахеальным наркозом выполнена лапароскопия. Желчный пузырь увеличен, стенка утолщена, напряжён, вокруг инфильтрат. Выполнена холецистэктомия, гемостаз, дренирование подпечёночного пространства.',
          opFindings: 'Острый флегмонозный холецистит. Перивезикальный инфильтрат.',
          opBloodLoss: '100',
          opComplications: 'Нет',
          opSurgeon: 'Иванов И. И.',
          opAssistant: 'Петрова О. С.',
          opAnesthesiologist: 'Сидорова А. П.',
          opNurse: 'Кузнецова Е. В.',
          opInstrumentsBefore: '28',
          opInstrumentsAfter: '28',
          opTamponsBefore: '12',
          opTamponsAfter: '12',
          opCountResult: 'Инструменты и салфетки сходятся'
        },
        anesthesia: {
          anesthType: 'Общая анестезия с интубацией трахеи',
          anesthStart: '09:10',
          anesthEnd: '11:20',
          anesthPremed: 'Атропин 0,5 мг, дексаметазон 8 мг',
          anesthInduction: 'Пропофол 180 мг, фентанил 0,2 мг, рокуроний 50 мг',
          anesthMaintenance: 'Севофлуран 2,2 об. %, фентанил дробно',
          anesthRelaxant: 'Рокуроний 50 мг',
          anesthVentilator: 'Dräger Primus',
          anesthRespRate: '14',
          tidalVolume: '480',
          minuteVolume: '6.7',
          peep: '5',
          fio2: '0.50',
          anesthGasFreshFlow: '2.0',
          anesthO2: '1.0',
          anesthN2O: '0.0',
          anesthSevoflurane: '2.2',
          anesthPropofol: '180',
          anesthFentanyl: '0.3',
          anesthMorphine: '0',
          anesthBloodLoss: '100',
          anesthUrine: '200',
          anesthAwakening: 'Полное, через 15 минут',
          anesthComplications: 'Нет',
          anesthDoctor: 'Сидорова А. П.',
          monitor: [
            { time: '09:20', bp: '145/85', hr: '90', spo2: '99', etco2: '35', temp: '36.6' },
            { time: '10:00', bp: '135/80', hr: '82', spo2: '99', etco2: '36', temp: '36.5' },
            { time: '10:40', bp: '130/78', hr: '80', spo2: '98', etco2: '35', temp: '36.4' },
            { time: '11:10', bp: '140/82', hr: '84', spo2: '99', etco2: '36', temp: '36.6' }
          ]
        },
        icu: {
          admissionDate: '2026-10-30',
          admissionTime: '11:40',
          diagnosis: 'Состояние после лапароскопической холецистэктомии',
          condition: 'Средней тяжести, стабильное',
          monitoring: 'АД, ЧСС, SpO₂, гликемия, диурез почасовой',
          ventilatorMode: 'Самостоятельное дыхание',
          ventilatorParams: '—',
          catheter: 'Центральный венозный катетер, уретральный катетер, дренаж подпечёночного пространства',
          diuresisHourly: '55',
          rows: [
            { hour: '12:00', parenteral: 'Раствор Рингера 500 мл', parenteralVolume: '500', enteral: '—', enteralVolume: '0', urine: '70', losses: '40', balance: '+390' },
            { hour: '13:00', parenteral: 'Раствор Рингера 500 мл', parenteralVolume: '500', enteral: '—', enteralVolume: '0', urine: '65', losses: '25', balance: '+410' },
            { hour: '14:00', parenteral: 'Глюкоза 5 % 400 мл + инсулин', parenteralVolume: '400', enteral: 'Вода 100 мл', enteralVolume: '100', urine: '60', losses: '30', balance: '+410' },
            { hour: '15:00', parenteral: '—', parenteralVolume: '0', enteral: 'Вода 100 мл', enteralVolume: '100', urine: '55', losses: '15', balance: '+30' }
          ],
          totalIn: '1600',
          totalOut: '360',
          totalBalance: '+1240',
          doctor: 'Сидорова А. П.'
        },
        prescriptions: {
          rows: [
            { date: '2026-10-29', drug: 'Метформин', dose: '1000 мг', route: 'Внутрь', frequency: '2 раза в сутки', diet: 'ОВД', mode: 'Палатный', status: 'Отменён', markDate: '2026-10-29', markTime: '19:00', markSign: 'Кузнецова Е. В.', markDone: true, note: 'Отменён врачом 29.10.2026 в 18:00 на период операции и контраста' },
            { date: '2026-10-30', drug: 'Инсулин аспарт', dose: '4 ЕД', route: 'Подкожно', frequency: 'Перед едой', diet: 'ОВД', mode: 'Палатный', status: 'Назначен', markDate: '2026-10-30', markTime: '08:00', markSign: '', markDone: true, note: 'Гликемия 8,4 ммоль/л' },
            { date: '2026-10-30', drug: 'Цефазолин', dose: '2 г', route: 'Внутривенно', frequency: '1 раз в сутки', diet: 'ОВД', mode: 'Палатный', status: 'Назначен', markDate: '2026-10-30', markTime: '12:00', markSign: 'Кузнецова Е. В.', markDone: true, note: 'Аллергия на пенициллин — препарат выбора цефазолин' },
            { date: '2026-10-30', drug: 'Эноксапарин натрия', dose: '4000 анти-Ха МЕ', route: 'Подкожно', frequency: '1 раз в сутки', diet: 'ОВД', mode: 'Палатный', status: 'Назначен', markDate: '2026-10-30', markTime: '13:00', markSign: 'Кузнецова Е. В.', markDone: true, note: 'Профилактика тромбоэмболии' },
            { date: '2026-10-31', drug: 'Омепразол', dose: '20 мг', route: 'Внутрь', frequency: '2 раза в сутки', diet: 'ОВД', mode: 'Палатный', status: 'Назначен', markDate: '', markTime: '', markSign: '', markDone: false, note: '' }
          ],
          nurse: 'Кузнецова Е. В.',
          doctor: 'Иванов И. И.'
        },
        transfusion: {
          date: '2026-10-30',
          time: '16:00',
          recipientFio: 'Смирнова Анна Викторовна',
          recipientGroup: 'O(I)',
          recipientRh: 'Rh−',
          recipientKell: 'K−',
          donorName: 'Эритроцитная взвесь, донор № 4392',
          donorGroup: 'O(I)',
          donorRh: 'Rh−',
          donorKell: 'K−',
          donorUnitNo: 'ER-2026-20881',
          donorDate: '2026-10-28',
          testGroup: 'O(I)',
          testRh: 'Rh−',
          testKell: 'K−',
          biologicalTest: 'Трёхкратная биологическая проба',
          biologicalTestResult: 'Отрицательная',
          crossMatch: 'Проба на индивидуальную совместимость',
          crossMatchResult: 'Совместима',
          transfusionStart: '16:05',
          transfusionEnd: '17:10',
          volume: '280',
          reaction: 'Нет',
          reactionDesc: '',
          doctor: 'Иванов И. И.',
          nurse: 'Кузнецова Е. В.',
          consent: true
        },
        temp: {
          cardNo: '1246/26',
          ward: '8',
          fio: 'Смирнова Анна Викторовна',
          days: [
            { date: '2026-10-29', pulseAm: '98', pulsePm: '94', adAm: '150/90', adPm: '145/88', tAm: '37.8', tPm: '37.5' },
            { date: '2026-10-30', pulseAm: '90', pulsePm: '88', adAm: '140/85', adPm: '138/84', tAm: '37.2', tPm: '37.0' },
            { date: '2026-10-31', pulseAm: '86', pulsePm: '84', adAm: '135/82', adPm: '132/80', tAm: '36.9', tPm: '36.8' },
            { date: '2026-11-01', pulseAm: '82', pulsePm: '84', adAm: '130/80', adPm: '134/82', tAm: '36.7', tPm: '36.8' }
          ],
          breath: ['18', '17', '16', '16'],
          weight: ['88', '87', '87', '86'],
          fluid: ['1600', '1700', '1800', '1750'],
          urine: ['1400', '1500', '1600', '1550'],
          stool: ['—', 'Был', '—', 'Был'],
          bath: ['—', 'Душ', '—', 'Душ']
        },
        radiation: {
          rows: [
            { date: '2026-10-29', study: 'УЗИ органов брюшной полости', area: 'Брюшная полость', dose: '0' },
            { date: '2026-10-29', study: 'Компьютерная томография брюшной полости', area: 'Брюшная полость', dose: '8.5' }
          ],
          totalDose: '8.5',
          doctor: 'Иванов И. И.'
        },
        discharge: {
          date: '2026-11-07',
          diagnosisMain: 'Острый калькулёзный холецистит',
          diagnosisIcd: 'K81.0',
          complications: 'Перивезикальный инфильтрат',
          complicationIcd: '',
          concomitant: 'Сахарный диабет 2 типа, артериальная гипертензия',
          concomitantIcd: 'E11.9',
          examResults: 'Общий анализ крови: лейкоциты 7,2 × 10⁹/л, СОЭ 14 мм/ч. Глюкоза 7,1 ммоль/л. УЗИ: жидкостных образований нет.',
          treatmentDone: 'Лапароскопическая холецистэктомия 30.10.2026. Антибактериальная, инфузионная, сахароснижающая терапия.',
          condition: 'Удовлетворительное',
          outcome: 'Улучшение',
          recommendations: 'Диета ОВД, дробное питание. Контроль гликемии. Перевязки в поликлинике. Наблюдение эндокринолога.',
          diet: 'ОВД',
          mode: 'Палатный, затем свободный',
          medications: 'Метформин 1000 мг 2 раза в сутки после консультации эндокринолога',
          workAbility: 'Листок нетрудоспособности с 29.10.2026 по 12.11.2026, приступить к работе 13.11.2026',
          doctor: 'Иванов И. И.'
        }
      },
      dept007: {
        date: '2026-10-30',
        department: 'Хирургическое отделение № 2',
        rows: [
          { profile: 'Хирургические койки', beds: '24', closed: '1', before: '22', admitted: '2', fromDay: '0', fromRural: '0', children: '0', elderly: '9', transfIn: '0', transfOut: '0', discharged: '1', dischElderly: '1', dischDay: '0', dischHospital: '0', died: '0', diedChildren: '0', diedElderly: '0', current: '24', currentElderly: '9', caregivers: '0', freeM: '0', freeF: '1' }
        ]
      },
      nutrition: {
        date: '2026-10-30',
        department: 'Хирургическое отделение № 2',
        rows: [
          { department: 'Хирургическое отделение № 2', patients: '22', ovd: '12', shchd: '8', vbd: '4', nkd: '0', vkd: '0', ovd1: '0', highProtein: '0' }
        ],
        signatures: { head: 'Иванов И. И.', senior: 'Кузнецова Е. В.', diet: 'Смирнова Л. А.' }
      },
      cso: {
        rows: [
          { date: '2026-10-30', method: 'Ручной', agent: '«Биолот» 0,5 %', itemName: 'Зажим хирургический', qty: '10', contaminatedBlood: '0', contaminatedDetergent: '0', fio: 'Кузнецова Е. В.' },
          { date: '2026-10-30', method: 'Ручной', agent: '«Биолот» 0,5 %', itemName: 'Ножницы хирургические', qty: '5', contaminatedBlood: '0', contaminatedDetergent: '0', fio: 'Кузнецова Е. В.' },
          { date: '2026-10-30', method: 'Механизированный', agent: '«Лизафин» 0,5 %', itemName: 'Лоток почкообразный', qty: '3', contaminatedBlood: '0', contaminatedDetergent: '0', fio: 'Кузнецова Е. В.' }
        ]
      }
    }
  });

  /* ============================================================
     КЕЙС 3. ДЕСТРУКТИВНЫЙ ПАНКРЕАТИТ (продвинутый уровень)
     ============================================================ */
  CASES.list.push({
    id: 3,
    title: 'Кузнецов Дмитрий Олегович, 52 года',
    shortTitle: 'Кузнецов Д. О., 52 года',
    diagnosis: 'Острый деструктивный панкреатит (K85.9)',
    diagnosisCode: 'K85.9',
    difficulty: 'hard',
    difficultyLabel: 'Продвинутый',
    department: 'Хирургическое отделение № 2',
    summary: 'Тяжёлый пациент после лапаротомии, в реанимации. Несколько критических несоответствий: группа крови и Kell-антиген, отменённый препарат, разбалансировка коек, критическая температура без реакции.',
    tasks: [
      'Заполнить весь маршрут документации',
      'Сверить группу крови, Rh и Kell-антиген',
      'Проверить отмену октреотида и подписи',
      'Свести баланс коек, порционник и сводную ведомость 016/у',
      'Выявить критические значения температурного листа',
      'Проверить журнал операций 008/у, дневник и согласие на операцию'
    ],
    planted: [
      {
        code: 'blood_group_mismatch',
        label: 'Группа крови реципиента в листе трансфузии не совпадает с 003/у',
        severity: 'critical',
        hint: 'В титульном листе AB(IV), в листе трансфузии A(II). Приведите данные к AB(IV).'
      },
      {
        code: 'kell_mismatch',
        label: 'Kell-антиген в листе трансфузии не совпадает с титульным листом',
        severity: 'critical',
        hint: 'В титульном листе K+, в листе трансфузии K−. Данные должны совпадать.'
      },
      {
        code: 'cancelled_med_done',
        label: 'Октреотид отменён, но отмечен как выполненный',
        severity: 'critical',
        hint: 'Октреотид отменён 31.10.2026 в 08:00. Снимите отметку о выполнении.'
      },
      {
        code: 'bed_balance',
        label: 'Баланс коек в 007/у не сходится: графа 19 завышена на 2',
        severity: 'critical',
        hint: '27 находилось + 2 поступило + 1 переведено − 3 выписано − 1 умер = 26.'
      },
      {
        code: 'diet_excess',
        label: 'Порционник 1-84: сумма диет превышает число пациентов на 3 порции',
        severity: 'major',
        hint: 'Число питающихся — 26. Сумма порций по диетам должна быть равна 26.'
      },
      {
        code: 'temp_critical',
        label: 'Критическая температура 39,4 °C в температурном листе без отметки о реакции',
        severity: 'critical',
        hint: 'Вечерняя температура 39,4 °C требует врачебного осмотра и записи о принятых мерах. Снизьте значение или зафиксируйте реакцию.'
      }
    ],
    data: {
      patient: {
        fio: 'Кузнецов Дмитрий Олегович',
        birth: '1974-01-19',
        sex: 'Мужской',
        snils: '555-777-999 02',
        oms: '7703000000000003',
        passport: '4512 987654',
        cardNo: '1247/26',
        department: 'Хирургическое отделение № 2',
        diagnosis: 'Острый деструктивный панкреатит',
        icd: 'K85.9',
        admissionDate: '2026-10-27',
        admissionTime: '23:10',
        bloodGroup: 'AB(IV)',
        rh: 'Rh+',
        kell: 'K+'
      },
      j001: {
        selected: 2,
        rows: [
          {
            date: '2026-10-28',
            time: '21:40',
            fio: 'Петров Иван Сергеевич',
            birth: '1991-03-12',
            sex: 'Мужской',
            passport: '4510 123456',
            citizenship: 'Российская Федерация',
            addressLive: 'г. Москва, ул. Поликарпова, д. 12, кв. 45',
            addressStay: 'г. Москва, ул. Поликарпова, д. 12, кв. 45',
            phone: '+7 (916) 123-45-67',
            snils: '123-456-789 01',
            oms: '7701000000000001',
            delivered: 'Выездной бригадой скорой медицинской помощи',
            cardNo: '1245/26',
            referralDiag: 'Острый аппендицит',
            injuryIcd: 'K35.8',
            alcohol: 'Не употреблял',
            department: 'Хирургическое отделение № 2',
            outcome: 'Госпитализирован',
            outcomeDate: '2026-10-28',
            outcomeTime: '22:05',
            notify: '',
            refusalReason: '',
            refusalWorker: '',
            extra: ''
          },
          {
            date: '2026-10-29',
            time: '08:15',
            fio: 'Смирнова Анна Викторовна',
            birth: '1959-06-04',
            sex: 'Женский',
            passport: '4508 654321',
            citizenship: 'Российская Федерация',
            addressLive: 'г. Москва, ул. Зорге, д. 8, кв. 112',
            addressStay: 'г. Москва, ул. Зорге, д. 8, кв. 112',
            phone: '+7 (903) 222-33-44',
            snils: '987-654-321 00',
            oms: '7702000000000002',
            delivered: 'Поликлиникой',
            cardNo: '1246/26',
            referralDiag: 'Желчнокаменная болезнь. Острый холецистит',
            injuryIcd: 'K81.0',
            alcohol: 'Не употребляла',
            department: 'Хирургическое отделение № 2',
            outcome: 'Госпитализирована',
            outcomeDate: '2026-10-29',
            outcomeTime: '10:40',
            notify: '',
            refusalReason: '',
            refusalWorker: '',
            extra: ''
          },
          {
            date: '2026-10-27',
            time: '23:10',
            fio: 'Кузнецов Дмитрий Олегович',
            birth: '1974-01-19',
            sex: 'Мужской',
            passport: '4512 987654',
            citizenship: 'Российская Федерация',
            addressLive: 'г. Москва, ул. Маршала Тухачевского, д. 24, кв. 8',
            addressStay: 'г. Москва, ул. Маршала Тухачевского, д. 24, кв. 8',
            phone: '+7 (925) 444-55-66',
            snils: '555-777-999 02',
            oms: '7703000000000003',
            delivered: 'Выездной бригадой скорой медицинской помощи',
            cardNo: '1247/26',
            referralDiag: 'Острый панкреатит',
            injuryIcd: 'K85.9',
            alcohol: 'Употреблял алкоголь накануне, признаков опьянения нет',
            department: 'Хирургическое отделение № 2',
            outcome: 'Госпитализирован',
            outcomeDate: '2026-10-27',
            outcomeTime: '23:40',
            notify: '2026-10-28 00:05, супруга уведомлена по телефону',
            refusalReason: '',
            refusalWorker: '',
            extra: 'Тяжёлое состояние, доставлен минуя приёмное отделение по экстренным показаниям'
          }
        ]
      },
      card003: {
        cardNo: '1247/26',
        fio: 'Кузнецов Дмитрий Олегович',
        birth: '1974-01-19',
        sex: 'Мужской',
        admissionType: 'Поступил в стационар',
        admissionDate: '2026-10-27',
        admissionTime: '23:10',
        hoursAfter: '12',
        referral: 'Выездной бригадой скорой медицинской помощи',
        referralOrg: 'ГБУЗ «Станция скорой и неотложной медицинской помощи им. А. С. Пучкова»',
        referralNo: '7709',
        referralDate: '2026-10-27',
        admissionOrder: 'Первично',
        careForm: 'Экстренная',
        department: 'Хирургическое отделение № 2',
        profile: 'Хирургические койки',
        ward: '9',
        transferDept: 'Отделение реанимации и интенсивной терапии',
        transferProfile: 'Реанимационные койки',
        transferWard: '2',
        transferDate: '2026-10-28',
        transferTime: '02:30',
        dischargeDate: '',
        dischargeTime: '',
        days: '',
        referralDiag: 'Острый панкреатит',
        referralIcd: 'K85.9',
        prelimMain: 'Острый панкреатит',
        prelimIcd: 'K85.9',
        prelimComplication: 'Полиорганная недостаточность под вопросом',
        prelimCompIcd: '',
        prelimExternal: 'Алкогольная интоксикация',
        prelimExtIcd: 'T51.0',
        prelimConcomitant: 'Хронический панкреатит',
        prelimConcIcd: 'K86.1',
        diagDate: '2026-10-28',
        diagTime: '01:15',
        historyTb: 'Нет',
        historyHiv: 'Нет',
        historyHepatitis: 'Нет',
        historySyphilis: 'Нет',
        historyCovid: 'Нет',
        pediculosis: 'Нет',
        pediculosisResult: 'Живые вши и гниды не обнаружены',
        allergy: 'Не выявлено',
        transfusionHistory: 'Переливания крови не проводились',
        bloodGroup: 'AB(IV)',
        rhFactor: 'Rh+',
        kell: 'K+',
        bloodOther: '',
        clinicalMain: 'Острый деструктивный панкреатит',
        clinicalIcd: 'K85.9',
        clinicalComplication: 'Панкреонекроз, парапанкреатит',
        clinicalCompIcd: '',
        clinicalExternal: 'Алкогольная интоксикация',
        clinicalExtIcd: 'T51.0',
        clinicalConcomitant: 'Хронический панкреатит',
        clinicalConcIcd: 'K86.1',
        clinicalDiagDate: '2026-10-28',
        clinicalDiagTime: '06:00',
        outcome: 'Выписан',
        transferOrg: '',
        result: 'Улучшение',
        deathDept: '',
        deathDate: '',
        deathTime: '',
        deathPregnant: '',
        sickLeaveNo: '014 567 890 123',
        sickLeaveDate: '2026-10-28',
        sickLeaveFrom: '2026-10-28',
        sickLeaveTo: '2026-12-10',
        sickLeaveContinued: '015 678 901 234',
        returnWork: '2026-12-11',
        appearanceDate: '',
        sickLeaveCare: '',
        mseDate: '',
        informant: 'Кузнецова Елена Сергеевна, супруга',
        informantPhone: '+7 (925) 111-22-33',
        doctor: 'Иванов Игорь Иванович',
        doctorSpecialty: 'Врач-хирург',
        doctorSign: 'Иванов И. И.'
      },
      stat066: {
        cardNo: '1247/26',
        fio: 'Кузнецов Дмитрий Олегович',
        birth: '1974-01-19',
        sex: 'Мужской',
        citizenship: 'Российская Федерация',
        regLiveSubject: 'г. Москва',
        regLiveDistrict: 'Северо-Западный административный округ',
        regLiveCity: 'Москва',
        regLiveSettlement: '—',
        regLiveStreet: 'ул. Маршала Тухачевского',
        regLiveHouse: '24',
        regLiveBuilding: '1',
        regLiveFlat: '8',
        regStaySubject: 'г. Москва',
        regStayDistrict: 'Северо-Западный административный округ',
        regStayCity: 'Москва',
        regStaySettlement: '—',
        regStayStreet: 'ул. Маршала Тухачевского',
        regStayHouse: '24',
        regStayBuilding: '1',
        regStayFlat: '8',
        locality: 'Городская',
        marital: 'Состоит в зарегистрированном браке',
        education: 'Высшее образование',
        employment: 'Работает',
        childStatus: '',
        workplace: 'АО «Мосэнергострой»',
        position: 'Начальник участка',
        disability: 'Нет',
        radiation: 'Нет',
        oms: '7703000000000003',
        omsDate: '2021-07-19',
        insurer: 'ООО «Страховая медицинская компания «Медстрах»',
        snils: '555-777-999 02',
        admissionDate: '2026-10-27',
        admissionTime: '23:10',
        hoursAfter: '12',
        referral: 'Выездной бригадой скорой медицинской помощи',
        admissionOrder: 'Первично',
        careForm: 'Экстренная',
        alcohol: 'Употреблял алкоголь накануне, признаков опьянения нет',
        payment: 'Обязательное медицинское страхование',
        referralDiag: 'Острый панкреатит',
        referralIcd: 'K85.9',
        prelimMain: 'Острый панкреатит',
        prelimIcd: 'K85.9',
        prelimComplication: 'Полиорганная недостаточность под вопросом',
        prelimCompIcd: '',
        prelimExternal: 'Алкогольная интоксикация',
        prelimExtIcd: 'T51.0',
        prelimConcomitant: 'Хронический панкреатит',
        prelimConcIcd: 'K86.1',
        outcome: 'Выписан',
        result: 'Улучшение',
        bedDays: '14',
        profile: 'Хирургические койки',
        operations: 'Лапаротомия, некрэктомия, дренирование 29.10.2026',
        doctor: 'Иванов Игорь Иванович'
      },
      treatment: {
        exam: {
          examDate: '2026-10-27',
          examTime: '23:40',
          complaints: 'Интенсивные опоясывающие боли в верхней половине живота, многократная рвота, не приносящая облегчения, вздутие, слабость.',
          diseaseAnamnesis: 'Заболел остро около 12 часов назад после употребления алкоголя. Боли постепенно усилились, появилась многократная рвота. Вызвана скорая медицинская помощь.',
          lifeAnamnesis: 'Хронический панкреатит около 5 лет, периодически употребляет алкоголь. Операций не было.',
          epidAnamnesis: 'Контакты с инфекционными больными отрицает. Гемотрансфузии отрицает.',
          generalCondition: 'Тяжёлое',
          consciousness: 'Ясное, заторможен',
          position: 'Вынужденное, на левом боку с приведёнными ногами',
          skin: 'Кожные покровы бледные, влажные, акроцианоз',
          mucosa: 'Слизистые оболочки сухие',
          lymphNodes: 'Периферические лимфатические узлы не увеличены',
          respRate: '24',
          lungAuscultation: 'Дыхание везикулярное, ослаблено в нижних отделах, хрипов нет',
          heartSounds: 'Тоны сердца приглушены, ритмичные, тахикардия',
          hr: '112',
          bpSystolic: '100',
          bpDiastolic: '60',
          abdomen: 'Живот вздут, резко болезненный в эпигастрии и левом подреберье, перитонеальные симптомы сомнительные, перистальтика ослаблена.',
          stool: 'Стула не было 2 дня',
          urine: 'Диурез снижен, моча концентрированная',
          height: '176',
          weight: '94',
          bmi: '30.3',
          temperature: '38.2',
          diagnosis: 'Острый деструктивный панкреатит. Панкреонекроз?',
          plan: 'Экстренная госпитализация в реанимационное отделение. Общий анализ крови, мочи, биохимия, амилаза, КТ брюшной полости, инфузионная терапия, обезболивание, консультация хирурга.',
          doctor: 'Иванов И. И.'
        },
        preop: {
          anesthDate: '2026-10-29',
          anesthTime: '08:00',
          anesthComplaints: 'Боли в верхней половине живота',
          anesthAnamnesis: 'Острый деструктивный панкреатит, панкреонекроз, интоксикация',
          anesthAllergy: 'Не выявлено',
          anesthMallampati: 'II степень',
          anesthAirway: 'Трудных дыхательных путей не ожидается',
          anesthASA: 'IV класс',
          anesthRisk: 'Крайне высокий риск, 15 %',
          anesthPlan: 'Общая анестезия с интубацией трахеи, ИВЛ, продлённая эпидуральная анальгезия',
          anesthPremed: 'Атропин 0,5 мг, дексаметазон 8 мг в/в',
          anesthDoctor: 'Сидорова А. П.',
          epicrisisDate: '2026-10-29',
          epicrisisDiagnosis: 'Острый деструктивный панкреатит (K85.9)',
          epicrisisIndication: 'Панкреонекроз с признаками инфицирования, парапанкреатит, нарастание интоксикации',
          epicrisisExam: 'КТ: панкреонекроз до 50 % parenchyma, парапанкреатический инфильтрат, жидкостные скопления. Лейкоциты 22,4 × 10⁹/л, С-реактивный белок 280 мг/л.',
          epicrisisAnalyses: 'Группа крови AB(IV) Rh+, Kell K+. ВИЧ, гепатиты, сифилис — отрицательно. Альбумин 24 г/л.',
          epicrisisRisk: 'ASA IV, риск анестезии крайне высокий',
          epicrisisPlan: 'Лапаротомия, некрэктомия, дренирование забрюшинного пространства',
          epicrisisDoctor: 'Иванов И. И.'
        },
        operation: {
          opDate: '2026-10-29',
          opName: 'Лапаротомия, некрэктомия, дренирование забрюшинного пространства',
          opCode: 'A16.30.017',
          opIndication: 'Инфицированный панкреонекроз, парапанкреатит',
          opAccess: 'Срединная лапаротомия',
          opCourse: 'Под эндотрахеальным наркозом выполнена лапаротомия. В брюшной полости серозно-геморрагический выпот до 500 мл. Поджелудочная железа отёчна, участки некроза до 50 %. Выполнена некрэктомия, санация, дренирование забрюшинного пространства и брюшной полости.',
          opFindings: 'Деструктивный панкреатит, панкреонекроз, парапанкреатит.',
          opBloodLoss: '400',
          opComplications: 'Нет',
          opSurgeon: 'Иванов И. И.',
          opAssistant: 'Петрова О. С.',
          opAnesthesiologist: 'Сидорова А. П.',
          opNurse: 'Кузнецова Е. В.',
          opInstrumentsBefore: '32',
          opInstrumentsAfter: '32',
          opTamponsBefore: '16',
          opTamponsAfter: '16',
          opCountResult: 'Инструменты и салфетки сходятся'
        },
        anesthesia: {
          anesthType: 'Общая анестезия с интубацией трахеи',
          anesthStart: '08:30',
          anesthEnd: '12:10',
          anesthPremed: 'Атропин 0,5 мг, дексаметазон 8 мг',
          anesthInduction: 'Пропофол 150 мг, фентанил 0,2 мг, рокуроний 50 мг',
          anesthMaintenance: 'Севофлуран 1,8 об. %, фентанил дробно',
          anesthRelaxant: 'Рокуроний 50 мг',
          anesthVentilator: 'Dräger Primus',
          anesthRespRate: '16',
          tidalVolume: '500',
          minuteVolume: '8.0',
          peep: '8',
          fio2: '0.60',
          anesthGasFreshFlow: '2.0',
          anesthO2: '1.0',
          anesthN2O: '0.0',
          anesthSevoflurane: '1.8',
          anesthPropofol: '150',
          anesthFentanyl: '0.4',
          anesthMorphine: '0',
          anesthBloodLoss: '400',
          anesthUrine: '250',
          anesthAwakening: 'Полное, через 25 минут',
          anesthComplications: 'Гипотензия, скоррегирована инфузией',
          anesthDoctor: 'Сидорова А. П.',
          monitor: [
            { time: '08:40', bp: '95/55', hr: '118', spo2: '96', etco2: '34', temp: '37.9' },
            { time: '09:30', bp: '105/60', hr: '110', spo2: '97', etco2: '35', temp: '38.1' },
            { time: '10:30', bp: '110/65', hr: '104', spo2: '98', etco2: '36', temp: '38.0' },
            { time: '11:30', bp: '115/70', hr: '98', spo2: '98', etco2: '35', temp: '37.8' }
          ]
        },
        icu: {
          admissionDate: '2026-10-29',
          admissionTime: '12:40',
          diagnosis: 'Состояние после лапаротомии, некрэктомии, дренирования',
          condition: 'Тяжёлое, стабильное',
          monitoring: 'АД, ЧСС, SpO₂, ЦВД, диурез почасовой, гликемия',
          ventilatorMode: 'ИВЛ, SIMV',
          ventilatorParams: 'FiO₂ 50 %, PEEP 8, ЧД 16, ДО 500 мл',
          catheter: 'Центральный венозный катетер, уретральный катетер, дренажи брюшной полости и забрюшинного пространства',
          diuresisHourly: '40',
          rows: [
            { hour: '13:00', parenteral: 'Раствор Рингера 1000 мл', parenteralVolume: '1000', enteral: '—', enteralVolume: '0', urine: '50', losses: '60', balance: '+890' },
            { hour: '14:00', parenteral: 'Раствор Рингера 500 мл', parenteralVolume: '500', enteral: '—', enteralVolume: '0', urine: '45', losses: '40', balance: '+415' },
            { hour: '15:00', parenteral: 'Альбумин 20 % 100 мл', parenteralVolume: '100', enteral: '—', enteralVolume: '0', urine: '40', losses: '30', balance: '+30' },
            { hour: '16:00', parenteral: 'Раствор Рингера 500 мл', parenteralVolume: '500', enteral: 'Вода 50 мл', enteralVolume: '50', urine: '35', losses: '25', balance: '+490' }
          ],
          totalIn: '2600',
          totalOut: '380',
          totalBalance: '+2220',
          doctor: 'Сидорова А. П.'
        },
        prescriptions: {
          rows: [
            { date: '2026-10-30', drug: 'Октреотид', dose: '300 мкг', route: 'Подкожно', frequency: '3 раза в сутки', diet: 'НКД', mode: 'Строгий постельный', status: 'Отменён', markDate: '2026-10-31', markTime: '09:00', markSign: 'Кузнецова Е. В.', markDone: true, note: 'Отменён врачом 31.10.2026 в 08:00' },
            { date: '2026-10-31', drug: 'Меропенем', dose: '1 г', route: 'Внутривенно капельно', frequency: '3 раза в сутки', diet: 'НКД', mode: 'Строгий постельный', status: 'Назначен', markDate: '2026-10-31', markTime: '10:00', markSign: 'Кузнецова Е. В.', markDone: true, note: 'Инфицированный панкреонекроз' },
            { date: '2026-10-31', drug: 'Норадреналин', dose: '0,1 мкг/кг/мин', route: 'Внутривенно инфузомат', frequency: 'Постоянно', diet: 'НКД', mode: 'Строгий постельный', status: 'Назначен', markDate: '2026-10-31', markTime: '10:30', markSign: 'Кузнецова Е. В.', markDone: true, note: 'Поддержание АД' },
            { date: '2026-10-31', drug: 'Парацетамол', dose: '1000 мг', route: 'Внутривенно', frequency: 'При температуре выше 38,5 °C', diet: 'НКД', mode: 'Строгий постельный', status: 'Назначен', markDate: '2026-10-31', markTime: '20:00', markSign: 'Кузнецова Е. В.', markDone: true, note: 'Температура 39,4 °C' },
            { date: '2026-11-01', drug: 'Омепразол', dose: '40 мг', route: 'Внутривенно', frequency: '2 раза в сутки', diet: 'НКД', mode: 'Строгий постельный', status: 'Назначен', markDate: '', markTime: '', markSign: '', markDone: false, note: '' }
          ],
          nurse: 'Кузнецова Е. В.',
          doctor: 'Иванов И. И.'
        },
        transfusion: {
          date: '2026-10-30',
          time: '10:30',
          recipientFio: 'Кузнецов Дмитрий Олегович',
          recipientGroup: 'A(II)',
          recipientRh: 'Rh+',
          recipientKell: 'K−',
          donorName: 'Свежезамороженная плазма, донор № 9021',
          donorGroup: 'A(II)',
          donorRh: 'Rh+',
          donorKell: 'K−',
          donorUnitNo: 'PL-2026-11203',
          donorDate: '2026-10-29',
          testGroup: 'A(II)',
          testRh: 'Rh+',
          testKell: 'K−',
          biologicalTest: 'Трёхкратная биологическая проба',
          biologicalTestResult: 'Отрицательная',
          crossMatch: 'Проба на индивидуальную совместимость',
          crossMatchResult: 'Совместима',
          transfusionStart: '10:35',
          transfusionEnd: '11:25',
          volume: '300',
          reaction: 'Нет',
          reactionDesc: '',
          doctor: 'Иванов И. И.',
          nurse: 'Кузнецова Е. В.',
          consent: true
        },
        temp: {
          cardNo: '1247/26',
          ward: '9',
          fio: 'Кузнецов Дмитрий Олегович',
          days: [
            { date: '2026-10-29', pulseAm: '112', pulsePm: '108', adAm: '100/60', adPm: '105/65', tAm: '38.2', tPm: '38.6' },
            { date: '2026-10-30', pulseAm: '106', pulsePm: '102', adAm: '105/65', adPm: '110/70', tAm: '38.0', tPm: '38.4' },
            { date: '2026-10-31', pulseAm: '104', pulsePm: '110', adAm: '100/60', adPm: '95/55', tAm: '38.8', tPm: '39.4' },
            { date: '2026-11-01', pulseAm: '98', pulsePm: '96', adAm: '110/70', adPm: '112/72', tAm: '37.9', tPm: '38.1' }
          ],
          breath: ['22', '20', '20', '18'],
          weight: ['94', '95', '96', '95'],
          fluid: ['2200', '2400', '2500', '2400'],
          urine: ['1100', '1200', '1250', '1300'],
          stool: ['—', '—', '—', 'Был'],
          bath: ['—', '—', '—', '—']
        },
        radiation: {
          rows: [
            { date: '2026-10-28', study: 'Компьютерная томография брюшной полости', area: 'Брюшная полость', dose: '12.0' },
            { date: '2026-10-30', study: 'Компьютерная томография брюшной полости с контрастом', area: 'Брюшная полость', dose: '14.5' },
            { date: '2026-11-03', study: 'Обзорная рентгенография грудной клетки', area: 'Грудная клетка', dose: '0.3' }
          ],
          totalDose: '26.8',
          doctor: 'Иванов И. И.'
        },
        discharge: {
          date: '2026-11-10',
          diagnosisMain: 'Острый деструктивный панкреатит',
          diagnosisIcd: 'K85.9',
          complications: 'Панкреонекроз, парапанкреатит, полиорганная недостаточность',
          complicationIcd: '',
          concomitant: 'Хронический панкреатит',
          concomitantIcd: 'K86.1',
          examResults: 'Общий анализ крови: лейкоциты 8,1 × 10⁹/л, СОЭ 22 мм/ч. КТ: зона некроза уменьшилась, жидкостных скоплений нет. Альбумин 34 г/л.',
          treatmentDone: 'Лапаротомия, некрэктомия, дренирование 29.10.2026. Антибактериальная, инфузионная, нутритивная поддержка, обезболивание.',
          condition: 'Удовлетворительное',
          outcome: 'Улучшение',
          recommendations: 'Диета НКД с расширением. Дробное питание. Контроль амилазы, УЗИ через 1 месяц. Наблюдение хирурга. Полный отказ от алкоголя.',
          diet: 'НКД',
          mode: 'Палатный, затем свободный',
          medications: 'Омепразол 20 мг 2 раза в сутки 14 дней, ферментные препараты по назначению врача',
          workAbility: 'Листок нетрудоспособности с 28.10.2026 по 10.12.2026, приступить к работе 11.12.2026',
          doctor: 'Иванов И. И.'
        }
      },
      dept007: {
        date: '2026-10-31',
        department: 'Хирургическое отделение № 2',
        rows: [
          { profile: 'Хирургические койки', beds: '30', closed: '0', before: '27', admitted: '2', fromDay: '0', fromRural: '1', children: '0', elderly: '11', transfIn: '1', transfOut: '0', discharged: '3', dischElderly: '2', dischDay: '0', dischHospital: '0', died: '1', diedChildren: '0', diedElderly: '1', current: '27', currentElderly: '10', caregivers: '2', freeM: '1', freeF: '0' }
        ]
      },
      nutrition: {
        date: '2026-10-31',
        department: 'Хирургическое отделение № 2',
        rows: [
          { department: 'Хирургическое отделение № 2', patients: '26', ovd: '11', shchd: '9', vbd: '4', nkd: '5', vkd: '0', ovd1: '0', highProtein: '0' }
        ],
        signatures: { head: 'Иванов И. И.', senior: 'Кузнецова Е. В.', diet: 'Смирнова Л. А.' }
      },
      cso: {
        rows: [
          { date: '2026-10-31', method: 'Ручной', agent: '«Биолот» 0,5 %', itemName: 'Зажим хирургический', qty: '14', contaminatedBlood: '1', contaminatedDetergent: '0', fio: 'Кузнецова Е. В.' },
          { date: '2026-10-31', method: 'Ручной', agent: '«Биолот» 0,5 %', itemName: 'Скальпель разборный', qty: '8', contaminatedBlood: '0', contaminatedDetergent: '0', fio: 'Кузнецова Е. В.' },
          { date: '2026-10-31', method: 'Механизированный', agent: '«Лизафин» 0,5 %', itemName: 'Лоток почкообразный', qty: '5', contaminatedBlood: '0', contaminatedDetergent: '1', fio: 'Кузнецова Е. В.' }
        ]
      }
    }
  });

  /* ============================================================
     КЕЙС 4. САМОСТОЯТЕЛЬНОЕ ЗАПОЛНЕНИЕ (без заложенных ошибок)
     Формы клинических разделов пустые: студент ведёт документацию сам.
     ============================================================ */
  CASES.list.push({
    id: 4,
    title: 'Орлова Мария Сергеевна, 45 лет',
    shortTitle: 'Орлова М. С., 45 лет',
    diagnosis: 'Самостоятельная работа: пациентка с острым гнойным заболеванием перианальной области (K61.0)',
    diagnosisCode: 'K61.0',
    difficulty: 'independent',
    difficultyLabel: 'Самостоятельная работа',
    department: 'Хирургическое отделение № 2',
    summary: 'Кейс без автозаполнения клинических разделов. В журнал 001/у внесены только данные регистрации из приёмного отделения. Титульный лист 003/у, статистическая карта 066/у, все внутренние бланки, журнал операций 008/у, сводная ведомость 016/у, журнал эндоскопии 157/у, дневник наблюдения, согласие на операцию, 007/у, порционник 1-84, журнал 366/у и температурный лист заполняются студентом полностью самостоятельно. Заложенных ошибок нет: итоговая оценка зависит только от качества собственной работы.',
    tasks: [
      'Перенести данные регистрации из 001/у в 003/у и 066/у кнопкой «Синхронизировать»',
      'Самостоятельно сформулировать предварительный и клинический диагнозы с кодами МКБ-10',
      'Заполнить первичный осмотр, предоперационный блок, протокол операции и анестезии',
      'Оформить лист назначений, лист трансфузии, температурный лист и лучевую нагрузку',
      'Заполнить журнал операций 008/у, дневник наблюдения и согласие на операцию',
      'Свести лист 007/у, сводную ведомость 016/у, порционник 1-84 и журнал 366/у',
      'Заполнить журнал эндоскопии 157/у при наличии исследования',
      'Оформить выписной эпикриз и выполнить проверку до оценки 5,00'
    ],
    planted: [],
    data: {
      patient: {
        fio: 'Орлова Мария Сергеевна',
        birth: '1981-05-14',
        sex: 'Женский',
        snils: '321-654-987 03',
        oms: '7704000000000004',
        passport: '4513 246810',
        cardNo: '1248/26',
        department: 'Хирургическое отделение № 2',
        diagnosis: 'Острый парапроктит',
        icd: 'K61.0',
        admissionDate: '2026-10-31',
        admissionTime: '07:25'
      },
      j001: {
        selected: 0,
        rows: [
          {
            date: '2026-10-31',
            time: '07:25',
            fio: 'Орлова Мария Сергеевна',
            birth: '1981-05-14',
            sex: 'Женский',
            passport: '4513 246810',
            citizenship: 'Российская Федерация',
            addressLive: 'г. Москва, ул. Народного Ополчения, д. 15, кв. 63',
            addressStay: 'г. Москва, ул. Народного Ополчения, д. 15, кв. 63',
            phone: '+7 (926) 333-44-55',
            snils: '321-654-987 03',
            oms: '7704000000000004',
            delivered: 'Выездной бригадой скорой медицинской помощи',
            cardNo: '1248/26',
            referralDiag: 'Острый парапроктит',
            injuryIcd: 'K61.0',
            alcohol: 'Не употребляла, признаков опьянения нет',
            department: 'Хирургическое отделение № 2',
            outcome: 'Госпитализирована',
            outcomeDate: '2026-10-31',
            outcomeTime: '08:10',
            notify: '2026-10-31 08:15, супруг уведомлён по телефону',
            refusalReason: '',
            refusalWorker: '',
            extra: 'Направление 057/у-04 № 2043 от 31.10.2026'
          }
        ]
      },
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
        temp: {
          cardNo: '', ward: '', fio: '',
          days: [], breath: [], weight: [], fluid: [], urine: [], stool: [], bath: [],
          criticalNote: ''
        },
        radiation: { rows: [] },
        discharge: {}
      },
      dept007: { date: '', department: '', rows: [] },
      nutrition: { date: '', department: '', bedsReference: '', rows: [], signatures: {} },
      cso: { rows: [], controlMethod: '', shift: '', seniorNurse: '' }
    }
  });

  global.CASES = CASES;
})(window);
