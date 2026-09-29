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

  // Estava aqui um conjunto de registos inventados, usado quando não havia
  // nada publicado. Saiu: o site não mostra pessoas, jogos nem resultados
  // que não existem. Sem dados publicados, a página diz que ainda não há.
  const DEFAULTS = [];

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
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Um evento cancelado não aparece em lado nenhum do site público:
          // nem na lista, nem no calendário. Mesma regra do
          // jsc_agenda_proximos() do api/conteudo.php.
          return parsed.filter(e => e && e.estado !== 'Cancelado');
        }
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
      return `<button class="news-filter-btn${jscEsc(active ? ' active' : '')}" data-tipo="${jscEsc(t === 'Todos' ? '' : t)}">${jscEsc(t)}</button>`;
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
        <button class="cal-nav__btn" id="calPrev">&#8592; ${jscEsc(prevTitle)}</button>
        <span class="cal-nav__title">${jscEsc(MESES[currentMonth].toUpperCase())} ${jscEsc(currentYear)}</span>
        <button class="cal-nav__btn" id="calNext">${jscEsc(nextTitle)} &#8594;</button>
      </div>
      <div class="cal-grid">
    `;

    // Day headers
    DIAS_SEMANA.forEach(d => {
      html += `<div class="cal-header-cell">${jscEsc(d)}</div>`;
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
        return `<span class="cal-dot" style="background:${jscEsc(color)}"></span>`;
      }).join('');

      html += `
        <div class="${jscEsc(cls)}" data-date="${jscEsc(dateStr)}">
          <span class="cal-day__num">${jscEsc(day)}</span>
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

      // Campo vazio não produz elemento: sem hora não há o ícone da hora,
      // sem local não há o do local, e sem nenhum dos três não há a linha.
      const hora  = (e.hora  || '').trim();
      const local = (e.local || '').trim();
      const esc   = (e.escalao && e.escalao !== 'Todos') ? e.escalao : '';
      const metas = [
        hora  ? `<span>&#128337; ${jscEsc(hora)}</span>`  : '',
        local ? `<span>&#128205; ${jscEsc(local)}</span>` : '',
        esc   ? `<span>&#127942; ${jscEsc(esc)}</span>`   : '',
      ].filter(Boolean).join('\n              ');

      // O botão leva a classe jsc-so-com-js porque precisa do JavaScript
      // para produzir o ficheiro; sem ele, o <noscript> da página tira-o.
      // O clique é ouvido no contentor, não aqui — ver mais abaixo.
      const icsBtn = past
        ? ''
        : `<button class="agenda-ics-btn jsc-so-com-js" data-ics="${jscEsc(encodeURIComponent(JSON.stringify({
             titulo: e.titulo, data: e.data, hora: e.hora, local: e.local, descricao: e.descricao, tipo: e.tipo,
           })))}" title="Adicionar ao calendário">&#128197; Adicionar ao calendário</button>`;

      return `
        <div class="agenda-pub-item${jscEsc(pastCls)}" style="border-left-color:${jscEsc(cor)}">
          <div class="agenda-pub-date">
            <span class="agenda-pub-date__day">${jscEsc(d)}</span>
            <span class="agenda-pub-date__month">${jscEsc(MESES_CURTOS[m])}</span>
          </div>
          <div class="agenda-pub-body">
            ${e.tipo ? `<span class="agenda-tipo-badge" style="background:${jscEsc(cor)}">${jscEsc(e.tipo)}</span>` : ''}
            <p class="agenda-pub-title">${jscEsc(e.titulo)}</p>
            ${metas ? `<p class="agenda-pub-meta">
              ${metas}
            </p>` : ''}
            ${icsBtn}
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

  // Quantos eventos é que a lista devia ter: de hoje em diante, sem os
  // cancelados (o loadAgenda já os deixa de fora). Tem de dar o mesmo número
  // que o jsc_agenda_proximos() do api/conteudo.php, senão o bloco gerado é
  // redesenhado sem ser preciso.
  function contarProximos() {
    const hojeStr = isoDate(today.getFullYear(), today.getMonth(), today.getDate());
    return loadAgenda().filter(e => e && (e.data || '') >= hojeStr).length;
  }

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', () => {
    // Os filtros e o calendário são controlos, não conteúdo: constroem-se
    // sempre, porque sem JavaScript não existem de qualquer maneira.
    renderFilters();
    renderCalendar();

    // A lista é conteúdo, e pode já vir escrita no HTML pelo servidor. Nesse
    // caso só se mexe se tiver deixado de servir: conteúdo mais recente
    // guardado, contagem diferente, ou a lista ter sido gerada noutro dia —
    // à meia-noite, um evento passa a ser passado.
    if (!jscBlocoAtual(document.getElementById('agendaList'), contarProximos(), jscHojeISO())) {
      renderList();
    }

    // O clique do "Adicionar ao calendário" é ouvido no contentor, e não em
    // cada botão: assim funciona igual sobre a lista que o servidor gerou e
    // sobre a que este ficheiro desenha.
    document.getElementById('agendaList')?.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.agenda-ics-btn');
      if (!btn || !window.JSC_ICS) return;
      try { window.JSC_ICS.download(JSON.parse(decodeURIComponent(btn.dataset.ics))); } catch (_) {}
    });

    // Listen for admin updates
    window.addEventListener('storage', e => {
      if (e.key === AGENDA_KEY) renderAll();
    });
  });

})();
