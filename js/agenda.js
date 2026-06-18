// Agenda Pública — Juventude Sport Campinense
(function () {
  'use strict';

  const AGENDA_KEY = 'db_agenda';

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const MESES_CURTOS = ['JAN','FEV','MAR','ABR','MAI','JUN',
                        'JUL','AGO','SET','OUT','NOV','DEZ'];
  const DIAS_SEMANA = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

  const TIPO_COR = {
    'Jogo':    '#22a75e',
    'Torneio': '#f59e0b',
    'Treino':  '#3b82f6',
    'Reunião': '#8b5cf6',
    'Outro':   '#94a3b8',
  };

  const DEFAULTS = [
    { id:1, titulo:'Jogo Sub-17 vs FC Tavira',   tipo:'Jogo',    escalao:'Sub-17', data:'2026-04-12', hora:'15:00', local:'Est. Municipal Loulé',  descricao:'Campeonato Distrital AF Algarve', estado:'Agendado' },
    { id:2, titulo:'Torneio Primavera Sub-9',     tipo:'Torneio', escalao:'Sub-9',  data:'2026-04-13', hora:'09:00', local:'Campo Sintético Loulé',  descricao:'Torneio festivo de Primavera',    estado:'Agendado' },
    { id:3, titulo:'Reunião de Pais Sub-13',      tipo:'Reunião', escalao:'Sub-13', data:'2026-04-15', hora:'19:00', local:'Sede do Clube',           descricao:'Reunião trimestral com encarregados', estado:'Agendado' },
    { id:4, titulo:'Treino físico Sub-15',        tipo:'Treino',  escalao:'Sub-15', data:'2026-04-10', hora:'17:30', local:'Est. Municipal Loulé',  descricao:'Treino de preparação física',     estado:'Agendado' },
    { id:5, titulo:'Jogo Sub-19 vs Portimonense', tipo:'Jogo',    escalao:'Sub-19', data:'2026-04-11', hora:'17:00', local:'Est. Municipal Loulé',  descricao:'Liga Nacional Juvenis',           estado:'Agendado' },
    { id:6, titulo:'Festa de Encerramento',       tipo:'Outro',   escalao:'Todos',  data:'2026-06-15', hora:'18:00', local:'Pavilhão Municipal',     descricao:'Festa de fim de época',           estado:'Agendado' },
  ];

  // ---- State ----
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentYear  = today.getFullYear();
  let currentMonth = today.getMonth(); // 0-based
  let selectedDay  = null; // 'YYYY-MM-DD' string or null
  let tipoFiltro   = '';

  // ---- Data ----
  function loadAgenda() {
    try {
      const raw = localStorage.getItem(AGENDA_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) { /* fallback */ }
    return DEFAULTS;
  }

  // ---- Helpers ----
  function isoDate(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function parseISODate(str) {
    // Use UTC methods to avoid timezone shift
    const d = new Date(str);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
  }

  function isBeforeToday(dateStr) {
    const { y, m, d } = parseISODate(dateStr);
    const dt = new Date(y, m, d);
    return dt < today;
  }

  function eventsOnDay(events, dateStr) {
    return events.filter(e => e.data === dateStr);
  }

  // ---- Render: Filters ----
  function renderFilters() {
    const container = document.getElementById('agendaFilters');
    if (!container) return;

    const tipos = ['Todos', 'Jogo', 'Torneio', 'Treino', 'Reunião', 'Outro'];
    container.innerHTML = tipos.map(t => {
      const active = (t === 'Todos' && tipoFiltro === '') || t === tipoFiltro;
      return `<button class="news-filter-btn${active ? ' active' : ''}" data-tipo="${t === 'Todos' ? '' : t}">${t}</button>`;
    }).join('');

    container.querySelectorAll('.news-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tipoFiltro = btn.dataset.tipo;
        selectedDay = null;
        renderAll();
      });
    });
  }

  // ---- Render: Calendar ----
  function renderCalendar() {
    const container = document.getElementById('agendaCal');
    if (!container) return;

    const events = loadAgenda();

    // First day of month (0=Sun..6=Sat), convert to Mon-based (0=Mon..6=Sun)
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const startOffset = (firstDay + 6) % 7; // Mon=0 … Sun=6
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const prevTitle = currentMonth === 0
      ? `${MESES[11]} ${currentYear - 1}`
      : `${MESES[currentMonth - 1]} ${currentYear}`;
    const nextTitle = currentMonth === 11
      ? `${MESES[0]} ${currentYear + 1}`
      : `${MESES[currentMonth + 1]} ${currentYear}`;

    let html = `
      <div class="cal-nav">
        <button class="cal-nav__btn" id="calPrev">&#8592; ${prevTitle}</button>
        <span class="cal-nav__title">${MESES[currentMonth].toUpperCase()} ${currentYear}</span>
        <button class="cal-nav__btn" id="calNext">${nextTitle} &#8594;</button>
      </div>
      <div class="cal-grid">
    `;

    // Day headers
    DIAS_SEMANA.forEach(d => {
      html += `<div class="cal-header-cell">${d}</div>`;
    });

    // Empty cells before first day
    for (let i = 0; i < startOffset; i++) {
      html += `<div class="cal-day cal-day--empty"></div>`;
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = isoDate(currentYear, currentMonth, day);
      const isToday = dateStr === isoDate(today.getFullYear(), today.getMonth(), today.getDate());
      const isPast = new Date(currentYear, currentMonth, day) < today;
      const isSelected = selectedDay === dateStr;
      const dayEvents = eventsOnDay(events, dateStr);

      let cls = 'cal-day';
      if (isToday)    cls += ' cal-day--today';
      if (isPast)     cls += ' cal-day--past';
      if (isSelected) cls += ' cal-day--selected';

      const dots = dayEvents.map(e => {
        const color = TIPO_COR[e.tipo] || TIPO_COR['Outro'];
        return `<span class="cal-dot" style="background:${color}"></span>`;
      }).join('');

      html += `
        <div class="${cls}" data-date="${dateStr}">
          <span class="cal-day__num">${day}</span>
          ${dots ? `<div class="cal-day__dots">${dots}</div>` : ''}
        </div>
      `;
    }

    html += `</div>`; // close cal-grid
    container.innerHTML = html;

    // Navigation
    container.querySelector('#calPrev').addEventListener('click', () => {
      if (currentMonth === 0) { currentMonth = 11; currentYear--; }
      else { currentMonth--; }
      selectedDay = null;
      renderAll();
    });

    container.querySelector('#calNext').addEventListener('click', () => {
      if (currentMonth === 11) { currentMonth = 0; currentYear++; }
      else { currentMonth++; }
      selectedDay = null;
      renderAll();
    });

    // Day click
    container.querySelectorAll('.cal-day[data-date]').forEach(cell => {
      cell.addEventListener('click', () => {
        const date = cell.dataset.date;
        selectedDay = selectedDay === date ? null : date;
        renderAll();
      });
    });
  }

  // ---- Render: List ----
  function renderList() {
    const container = document.getElementById('agendaList');
    if (!container) return;

    const title = document.querySelector('.agenda-list-title');
    let events = loadAgenda();

    // Filter by tipo
    if (tipoFiltro) {
      events = events.filter(e => e.tipo === tipoFiltro);
    }

    if (selectedDay) {
      // Show events for selected day
      events = events.filter(e => e.data === selectedDay);
      if (title) {
        const { y, m, d } = parseISODate(selectedDay);
        title.textContent = `Eventos — ${d} de ${MESES[m]} de ${y}`;
      }
    } else {
      // Show all upcoming events (today onwards), sorted by date
      const todayStr = isoDate(today.getFullYear(), today.getMonth(), today.getDate());
      events = events
        .filter(e => e.data >= todayStr)
        .sort((a, b) => a.data.localeCompare(b.data));
      if (title) title.textContent = 'Próximos Eventos';
    }

    if (events.length === 0) {
      container.innerHTML = `<p class="agenda-pub-empty">Sem eventos agendados.</p>`;
      return;
    }

    container.innerHTML = events.map(e => {
      const { d, m } = parseISODate(e.data);
      const past = isBeforeToday(e.data);
      const cor = TIPO_COR[e.tipo] || TIPO_COR['Outro'];
      const pastCls = past ? ' agenda-pub-item--past' : '';

      const escalaoMeta = (e.escalao && e.escalao !== 'Todos')
        ? `<span>&#127942; ${e.escalao}</span>`
        : '';

      return `
        <div class="agenda-pub-item${pastCls}" style="border-left-color:${cor}">
          <div class="agenda-pub-date">
            <span class="agenda-pub-date__day">${d}</span>
            <span class="agenda-pub-date__month">${MESES_CURTOS[m]}</span>
          </div>
          <div class="agenda-pub-body">
            <span class="agenda-tipo-badge" style="background:${cor}">${e.tipo}</span>
            <p class="agenda-pub-title">${e.titulo}</p>
            <p class="agenda-pub-meta">
              <span>&#128337; ${e.hora}</span>
              <span>&#128205; ${e.local}</span>
              ${escalaoMeta}
            </p>
          </div>
        </div>
      `;
    }).join('');
  }

  // ---- Render all ----
  function renderAll() {
    renderFilters();
    renderCalendar();
    renderList();
  }

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', () => {
    renderAll();

    // Listen for admin updates
    window.addEventListener('storage', e => {
      if (e.key === AGENDA_KEY) renderAll();
    });
  });

})();
