// =============================================
// EXPORTAÇÃO .ICS — "Adicionar ao calendário"
// Usado pela agenda pública e pelo widget "Próximo Jogo"
// =============================================
(function () {
  'use strict';

  function pad(n) { return String(n).padStart(2, '0'); }

  // Data local "flutuante" (sem timezone) — correto para eventos desportivos locais
  function fmtLocal(d) {
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
           'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00';
  }

  function esc(s) {
    return String(s || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  // evento: { titulo, data:'YYYY-MM-DD', hora:'HH:MM', local, descricao, tipo }
  function build(ev) {
    const start = new Date(ev.data + 'T' + (ev.hora || '09:00'));
    if (isNaN(start)) return null;
    // Jogos e torneios ~2h; restantes eventos ~1h30
    const durMs = (ev.tipo === 'Jogo' || ev.tipo === 'Torneio') ? 2 * 3600000 : 1.5 * 3600000;
    const end = new Date(start.getTime() + durMs);
    const now = new Date();
    const uid = 'jsc-' + start.getTime() + '-' + (ev.titulo || '').replace(/\W+/g, '').slice(0, 24) + '@jscampinense.pt';
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Juventude Sport Campinense//Agenda//PT',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + uid,
      'DTSTAMP:' + fmtLocal(now),
      'DTSTART:' + fmtLocal(start),
      'DTEND:' + fmtLocal(end),
      'SUMMARY:' + esc(ev.titulo),
      ev.local ? 'LOCATION:' + esc(ev.local) : '',
      ev.descricao ? 'DESCRIPTION:' + esc(ev.descricao) : '',
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      'DESCRIPTION:' + esc(ev.titulo),
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');
  }

  function download(ev) {
    const ics = build(ev);
    if (!ics) return;
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (ev.titulo || 'evento').replace(/[^\wÀ-ÿ ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.ics';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  window.JSC_ICS = { build, download };
})();
