/* ============================================================
   МИС «Цифровая клиника МК РАМН»
   js/dictionaries.js — локальные справочники и автодополнение
   МКБ-10, лекарственных препаратов и стандартных диет.
   ============================================================ */
(function (global) {
  'use strict';

  var ICD = [
    { code: 'A09', name: 'Диарея и гастроэнтерит предположительно инфекционного происхождения' },
    { code: 'B34.2', name: 'Коронавирусная инфекция неуточнённая' },
    { code: 'C18.9', name: 'Злокачественное новообразование ободочной кишки неуточнённой локализации' },
    { code: 'C50.9', name: 'Злокачественное новообразование молочной железы неуточнённой части' },
    { code: 'D25.9', name: 'Лейомиома матки неуточнённая' },
    { code: 'E10.9', name: 'Сахарный диабет 1 типа без осложнений' },
    { code: 'E11.9', name: 'Сахарный диабет 2 типа без осложнений' },
    { code: 'E78.5', name: 'Гиперлипидемия неуточнённая' },
    { code: 'I10', name: 'Эссенциальная (первичная) гипертензия' },
    { code: 'I25.1', name: 'Атеросклеротическая болезнь сердца' },
    { code: 'I48', name: 'Фибрилляция и трепетание предсердий' },
    { code: 'I50.9', name: 'Сердечная недостаточность неуточнённая' },
    { code: 'J18.9', name: 'Пневмония неуточнённая' },
    { code: 'J44.1', name: 'Хроническая обструктивная болезнь лёгких с обострением' },
    { code: 'J45.9', name: 'Астма неуточнённая' },
    { code: 'K25.9', name: 'Язва желудка неуточнённая как острая или хроническая без кровотечения или прободения' },
    { code: 'K26.9', name: 'Язва двенадцатиперстной кишки неуточнённая как острая или хроническая без кровотечения или прободения' },
    { code: 'K29.5', name: 'Хронический гастрит неуточнённый' },
    { code: 'K35.0', name: 'Острый аппендицит с генерализованным перитонитом' },
    { code: 'K35.8', name: 'Острый аппендицит другой и неуточнённый' },
    { code: 'K37', name: 'Аппендицит неуточнённый' },
    { code: 'K40.9', name: 'Паховая грыжа односторонняя или неуточнённая без непроходимости или гангрены' },
    { code: 'K56.6', name: 'Другая и неуточнённая кишечная непроходимость' },
    { code: 'K57.3', name: 'Дивертикулярная болезнь толстой кишки без прободения или абсцесса' },
    { code: 'K61.0', name: 'Анальный абсцесс' },
    { code: 'K63.5', name: 'Полип ободочной кишки' },
    { code: 'K80.0', name: 'Камни жёлчного пузыря с острым холециститом' },
    { code: 'K81.0', name: 'Острый холецистит' },
    { code: 'K85.9', name: 'Острый панкреатит неуточнённый' },
    { code: 'K86.1', name: 'Другие хронические панкреатиты' },
    { code: 'K92.2', name: 'Желудочно-кишечное кровотечение неуточнённое' },
    { code: 'M54.5', name: 'Боль внизу спины' },
    { code: 'N10', name: 'Острый тубулоинтерстициальный нефрит' },
    { code: 'N20.0', name: 'Камни почки' },
    { code: 'N39.0', name: 'Инфекция мочевыводящих путей без установленной локализации' },
    { code: 'O80', name: 'Роды одноплодные самопроизвольные' },
    { code: 'O82', name: 'Роды одноплодные посредством кесарева сечения' },
    { code: 'S72.0', name: 'Перелом шейки бедра' },
    { code: 'T51.0', name: 'Токсическое действие этанола' },
    { code: 'T81.4', name: 'Инфекция, связанная с процедурой, не классифицированная в других рубриках' },
    { code: 'U07.1', name: 'COVID-19, вирус идентифицирован' },
    { code: 'Z98.8', name: 'Другие уточнённые состояния после медицинских процедур' }
  ];

  var MEDS = [
    { name: 'Цефтриаксон', dose: '1 г', route: 'Внутривенно капельно' },
    { name: 'Цефазолин', dose: '2 г', route: 'Внутривенно капельно' },
    { name: 'Метронидазол', dose: '500 мг', route: 'Внутривенно капельно' },
    { name: 'Амоксициллин', dose: '500 мг', route: 'Внутрь' },
    { name: 'Меропенем', dose: '1 г', route: 'Внутривенно капельно' },
    { name: 'Кеторолак', dose: '30 мг', route: 'Внутримышечно' },
    { name: 'Парацетамол', dose: '1000 мг', route: 'Внутривенно' },
    { name: 'Омепразол', dose: '20 мг', route: 'Внутрь' },
    { name: 'Метформин', dose: '1000 мг', route: 'Внутрь' },
    { name: 'Инсулин аспарт', dose: '4 ЕД', route: 'Подкожно' },
    { name: 'Эноксапарин натрия', dose: '4000 анти-Ха МЕ', route: 'Подкожно' },
    { name: 'Октреотид', dose: '300 мкг', route: 'Подкожно' },
    { name: 'Норадреналин', dose: '0,1 мкг/кг/мин', route: 'Внутривенно инфузомат' },
    { name: 'Раствор Рингера', dose: '500 мл', route: 'Внутривенно капельно' },
    { name: 'Глюкоза 5 %', dose: '400 мл', route: 'Внутривенно капельно' },
    { name: 'Альбумин 20 %', dose: '100 мл', route: 'Внутривенно капельно' },
    { name: 'Атропин', dose: '0,5 мг', route: 'Внутримышечно' },
    { name: 'Димедрол', dose: '10 мг', route: 'Внутримышечно' },
    { name: 'Дексаметазон', dose: '8 мг', route: 'Внутривенно' },
    { name: 'Пропофол', dose: '200 мг', route: 'Внутривенно' },
    { name: 'Фентанил', dose: '0,2 мг', route: 'Внутривенно' },
    { name: 'Рокуроний', dose: '50 мг', route: 'Внутривенно' },
    { name: 'Севофлуран', dose: '2,0 об. %', route: 'Ингаляционно' },
    { name: 'Морфин', dose: '10 мг', route: 'Внутримышечно' },
    { name: 'Лидокаин', dose: '2 % — 4 мл', route: 'Местно' },
    { name: 'Гепарин натрия', dose: '5000 ЕД', route: 'Подкожно' },
    { name: 'Фуросемид', dose: '20 мг', route: 'Внутривенно' },
    { name: 'Папаверин', dose: '40 мг', route: 'Внутримышечно' },
    { name: 'Но-шпа', dose: '40 мг', route: 'Внутримышечно' },
    { name: 'Метоклопрамид', dose: '10 мг', route: 'Внутривенно' }
  ];

  var DIETS = [
    { code: 'ОВД', name: 'Основной вариант диеты' },
    { code: 'ЩД', name: 'Щадящая диета' },
    { code: 'ВБД', name: 'Высокобелковая диета' },
    { code: 'НКД', name: 'Низкокалорийная диета' },
    { code: 'ВКД', name: 'Высококалорийная диета' },
    { code: 'ОВД-1', name: 'Основной вариант диеты с механическим и химическим щажением' },
    { code: 'НБД', name: 'Низкобелковая диета' },
    { code: 'НКД-1', name: 'Низкокалорийная диета повышенной белковой ценности' },
    { code: 'Д', name: 'Диета при сахарном диабете' },
    { code: 'П', name: 'Диета при хроническом панкреатите' },
    { code: 'Н', name: 'Диета при хронической болезни почек' },
    { code: 'Т', name: 'Диета при туберкулёзе' },
    { code: 'М', name: 'Молочная диета' },
    { code: 'К', name: 'Кетогенная диета' }
  ];

  global.ClinicDictionaries = { icd: ICD, meds: MEDS, diets: DIETS };

  /* ============================================================
     АВТОДОПОЛНЕНИЕ
     ============================================================ */
  var menu = null;
  var activeInput = null;
  var activeType = null;
  var activeItems = [];
  var activeIndex = -1;

  function detectType(el) {
    if (!el || !el.getAttribute) return null;
    var bind = el.getAttribute('data-bind') || '';
    if (el.getAttribute('data-autocomplete') === 'off') return null;
    if (el.getAttribute('data-mask') === 'icd' || /(^|\|)icd(\||$)/.test(el.getAttribute('data-rule') || '')) return 'icd';
    if (/\.drug$/.test(bind)) return 'meds';
    if (/\.diet$/.test(bind)) return 'diets';
    return null;
  }

  function sourceFor(type) {
    if (type === 'icd') return ICD.map(function (i) { return { value: i.code, title: i.name, meta: '' }; });
    if (type === 'meds') return MEDS.map(function (m) { return { value: m.name, title: m.name, meta: m.dose + ' · ' + m.route, dose: m.dose, route: m.route }; });
    if (type === 'diets') return DIETS.map(function (d) { return { value: d.code, title: d.name, meta: d.code }; });
    return [];
  }

  function ensureMenu() {
    if (menu) return menu;
    menu = document.createElement('div');
    menu.className = 'autocomplete-menu';
    menu.id = 'clinicAutocomplete';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;
    document.body.appendChild(menu);
    menu.addEventListener('mousedown', function (event) {
      event.preventDefault();
      var item = event.target.closest('[data-ac-index]');
      if (item) select(Number(item.getAttribute('data-ac-index')));
    });
    return menu;
  }

  function position() {
    if (!activeInput || !menu) return;
    var rect = activeInput.getBoundingClientRect();
    var width = Math.max(rect.width, 300);
    var left = Math.min(rect.left, global.innerWidth - width - 12);
    menu.style.width = width + 'px';
    menu.style.left = Math.max(8, left) + 'px';
    var spaceBelow = global.innerHeight - rect.bottom;
    if (spaceBelow < 260 && rect.top > 280) {
      menu.style.top = 'auto';
      menu.style.bottom = (global.innerHeight - rect.top + 4) + 'px';
    } else {
      menu.style.bottom = 'auto';
      menu.style.top = (rect.bottom + 4) + 'px';
    }
  }

  function render(query) {
    var q = String(query || '').trim().toLowerCase();
    var items = sourceFor(activeType);
    activeItems = items.filter(function (item) {
      return !q || item.value.toLowerCase().indexOf(q) !== -1 || item.title.toLowerCase().indexOf(q) !== -1 || (item.meta || '').toLowerCase().indexOf(q) !== -1;
    }).slice(0, 9);
    activeIndex = activeItems.length ? 0 : -1;
    if (!activeItems.length) {
      hide();
      return;
    }
    menu.innerHTML = activeItems.map(function (item, idx) {
      return '<button type="button" class="autocomplete-item' + (idx === 0 ? ' is-active' : '') + '" data-ac-index="' + idx + '" role="option">' +
        '<span class="autocomplete-code">' + escapeHtml(item.value) + '</span>' +
        '<span class="autocomplete-body"><strong>' + escapeHtml(item.title || item.value) + '</strong>' +
        (item.meta ? '<small>' + escapeHtml(item.meta) + '</small>' : '') + '</span></button>';
    }).join('');
    menu.hidden = false;
    activeInput.setAttribute('aria-expanded', 'true');
    position();
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function show(el) {
    activeInput = el;
    activeType = detectType(el);
    if (!activeType) { hide(); return; }
    ensureMenu();
    render(el.value);
    activeInput.setAttribute('autocomplete', 'off');
    activeInput.setAttribute('aria-autocomplete', 'list');
    activeInput.setAttribute('aria-controls', 'clinicAutocomplete');
    activeInput.setAttribute('aria-expanded', 'false');
  }

  function hide() {
    if (menu) menu.hidden = true;
    if (activeInput) activeInput.setAttribute('aria-expanded', 'false');
    activeInput = null;
    activeType = null;
    activeItems = [];
    activeIndex = -1;
  }

  function highlight(index) {
    if (!activeItems.length) return;
    activeIndex = (index + activeItems.length) % activeItems.length;
    Array.prototype.forEach.call(menu.querySelectorAll('.autocomplete-item'), function (item, idx) {
      item.classList.toggle('is-active', idx === activeIndex);
      if (idx === activeIndex) item.scrollIntoView({ block: 'nearest' });
    });
  }

  function select(index) {
    var item = activeItems[index];
    if (!item || !activeInput) return;
    var input = activeInput;
    input.value = item.value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (activeType === 'meds') {
      var bind = input.getAttribute('data-bind') || '';
      var prefix = bind.replace(/drug$/, '');
      var dose = document.querySelector('[data-bind="' + prefix + 'dose"]');
      var route = document.querySelector('[data-bind="' + prefix + 'route"]');
      if (dose && !dose.value) {
        dose.value = item.dose;
        dose.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (route && !route.value) {
        route.value = item.route;
        route.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    hide();
    input.focus();
  }

  document.addEventListener('focusin', function (event) {
    var el = event.target;
    if (!el.matches || !detectType(el)) return;
    show(el);
  });

  document.addEventListener('input', function (event) {
    var el = event.target;
    if (!el.matches || !detectType(el)) return;
    if (activeInput !== el) show(el);
    else render(el.value);
  });

  document.addEventListener('keydown', function (event) {
    if (!menu || menu.hidden || !activeInput) return;
    if (event.target !== activeInput) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      highlight(activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      highlight(activeIndex - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      select(activeIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      hide();
    } else if (event.key === 'Tab') {
      hide();
    }
  });

  document.addEventListener('click', function (event) {
    if (menu && !menu.hidden && !menu.contains(event.target) && event.target !== activeInput) hide();
  });

  global.addEventListener('scroll', function () { if (menu && !menu.hidden) position(); }, true);
  global.addEventListener('resize', function () { if (menu && !menu.hidden) position(); });

  global.ClinicAutocomplete = { show: show, hide: hide, type: detectType };
})(window);
