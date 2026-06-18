// =============================================
// ESCALÃO INDIVIDUAL — escalao.js
// =============================================

(function () {

  // --------------------------------------------------
  // DEFAULT DATA (fallback when localStorage is empty)
  // --------------------------------------------------
  const DEFAULT_ESCALOES = [
    { id: 1, nome: 'Sub-9',  designacao: 'Petizes',    faixa: '7 a 9 anos',   atletas: 18, treinador: 'Ricardo Matos',  treinos: '3ª, 5ª — 17h30',      destaque: false },
    { id: 2, nome: 'Sub-11', designacao: 'Traquinas',  faixa: '10 a 11 anos', atletas: 22, treinador: 'Jorge Pinto',    treinos: '3ª, 5ª, Sáb — 17h30', destaque: false },
    { id: 3, nome: 'Sub-13', designacao: 'Benjamins',  faixa: '12 a 13 anos', atletas: 26, treinador: 'Nuno Carvalho',  treinos: '2ª, 4ª, 6ª — 18h00',  destaque: true  },
    { id: 4, nome: 'Sub-15', designacao: 'Infantis',   faixa: '14 a 15 anos', atletas: 24, treinador: 'Filipe Gomes',   treinos: '2ª, 4ª, 6ª — 18h30',  destaque: false },
    { id: 5, nome: 'Sub-17', designacao: 'Iniciados',  faixa: '16 a 17 anos', atletas: 20, treinador: 'André Monteiro', treinos: '2ª a 6ª — 18h30',     destaque: false },
    { id: 6, nome: 'Sub-19', designacao: 'Juvenis',    faixa: '18 a 19 anos', atletas: 18, treinador: 'Sérgio Fonseca', treinos: '2ª a 6ª — 19h00',     destaque: false },
  ];

  const DEFAULT_ATLETAS = [
    { id: 1,  nome: 'Diogo Nunes Marques',    escalao: 'Sub-9',  posicao: '',             dataNascimento: '2018-04-13', encarregado: 'Carlos Nunes',   telefone: '+351 915 678 901', estado: 'Activo'   },
    { id: 2,  nome: 'Rui Sousa Carvalho',      escalao: 'Sub-11', posicao: 'Médio',        dataNascimento: '2016-07-22', encarregado: 'Ana Carvalho',   telefone: '+351 962 789 012', estado: 'Activo'   },
    { id: 3,  nome: 'Luís Tavares Brito',      escalao: 'Sub-11', posicao: 'Avançado',     dataNascimento: '2015-11-08', encarregado: 'Mário Tavares',  telefone: '+351 935 111 222', estado: 'Activo'   },
    { id: 4,  nome: 'Rafael Castro Mota',      escalao: 'Sub-13', posicao: 'Extremo',      dataNascimento: '2014-03-30', encarregado: 'Paulo Castro',   telefone: '+351 912 222 333', estado: 'Activo'   },
    { id: 5,  nome: 'Gonçalo Pires Mendes',    escalao: 'Sub-13', posicao: 'Central',      dataNascimento: '2013-09-15', encarregado: 'Sofia Pires',    telefone: '+351 963 333 444', estado: 'Activo'   },
    { id: 6,  nome: 'Tiago Ferreira Lima',     escalao: 'Sub-15', posicao: 'Defesa Dir.',  dataNascimento: '2012-06-01', encarregado: 'Jorge Ferreira', telefone: '+351 934 444 555', estado: 'Activo'   },
    { id: 7,  nome: 'Bernardo Santos Cruz',    escalao: 'Sub-15', posicao: 'Médio Def.',   dataNascimento: '2011-02-19', encarregado: 'Carla Santos',   telefone: '+351 916 555 666', estado: 'Activo'   },
    { id: 8,  nome: 'Francisco Lopes Vaz',     escalao: 'Sub-17', posicao: 'Avançado',     dataNascimento: '2010-08-05', encarregado: 'António Lopes',  telefone: '+351 962 666 777', estado: 'Activo'   },
    { id: 9,  nome: 'Martim Costa Azevedo',    escalao: 'Sub-17', posicao: 'Extremo',      dataNascimento: '2009-12-27', encarregado: 'Rosa Costa',     telefone: '+351 933 777 888', estado: 'Activo'   },
    { id: 10, nome: 'Pedro Gomes Rodrigues',   escalao: 'Sub-19', posicao: 'Guarda-redes', dataNascimento: '2008-05-14', encarregado: '-',              telefone: '+351 916 901 234', estado: 'Activo'   },
    { id: 11, nome: 'Rodrigo Alves Monteiro',  escalao: 'Sub-19', posicao: 'Médio',        dataNascimento: '2007-10-03', encarregado: '-',              telefone: '+351 915 888 999', estado: 'Inactivo' },
  ];

  const DEFAULT_TREINADORES = [
    { id: 1, nome: 'Carlos Mendes',   cargo: 'Director Técnico',          escalao: 'Todos',  telefone: '+351 912 000 001', email: 'carlos@jscampinense.pt', desde: '2020', ativo: true  },
    { id: 2, nome: 'João Silva',      cargo: 'Treinador Principal',       escalao: 'Sub-17', telefone: '+351 912 000 002', email: 'joao@jscampinense.pt',   desde: '2021', ativo: true  },
    { id: 3, nome: 'Pedro Alves',     cargo: 'Treinador Principal',       escalao: 'Sub-15', telefone: '+351 912 000 003', email: 'pedro@jscampinense.pt',  desde: '2022', ativo: true  },
    { id: 4, nome: 'Rui Costa',       cargo: 'Treinador Adjunto',         escalao: 'Sub-17', telefone: '+351 912 000 004', email: 'rui@jscampinense.pt',    desde: '2023', ativo: true  },
    { id: 5, nome: 'Ana Rodrigues',   cargo: 'Preparadora Física',        escalao: 'Todos',  telefone: '+351 912 000 005', email: 'ana@jscampinense.pt',    desde: '2022', ativo: true  },
    { id: 6, nome: 'Miguel Ferreira', cargo: 'Treinador de Guarda-redes', escalao: 'Todos',  telefone: '+351 912 000 006', email: 'miguel@jscampinense.pt', desde: '2021', ativo: true  },
    { id: 7, nome: 'Sofia Lopes',     cargo: 'Psicóloga',                 escalao: 'Todos',  telefone: '+351 912 000 007', email: 'sofia@jscampinense.pt',  desde: '2023', ativo: true  },
    { id: 8, nome: 'António Gomes',   cargo: 'Team Manager',              escalao: 'Sub-19', telefone: '+351 912 000 008', email: 'antonio@jscampinense.pt',desde: '2020', ativo: false },
  ];

  const DEFAULT_JOGOS = [
    { id: 1,  escalao: 'Sub-17', casa: 'Sport Campinense', fora: 'CD Tavira',        gcasa: 3,    gfora: 1,    data: '2026-03-22', hora: '10:30', local: 'Est. Municipal Loulé',     estado: 'Realizado' },
    { id: 2,  escalao: 'Sub-17', casa: 'GD Silves',        fora: 'Sport Campinense', gcasa: 1,    gfora: 2,    data: '2026-03-15', hora: '15:00', local: 'Campo de Silves',          estado: 'Realizado' },
    { id: 3,  escalao: 'Sub-17', casa: 'Sport Campinense', fora: 'Olhanense',        gcasa: null, gfora: null, data: '2026-04-12', hora: '10:30', local: 'Est. Municipal Loulé',     estado: 'Agendado'  },
    { id: 4,  escalao: 'Sub-17', casa: 'CD Portimão',      fora: 'Sport Campinense', gcasa: null, gfora: null, data: '2026-04-19', hora: '11:00', local: 'Campo Municipal Portimão', estado: 'Agendado'  },
    { id: 5,  escalao: 'Sub-15', casa: 'Sport Campinense', fora: 'FC Quarteira',     gcasa: 3,    gfora: 0,    data: '2026-03-29', hora: '09:00', local: 'Est. Municipal Loulé',     estado: 'Realizado' },
    { id: 6,  escalao: 'Sub-15', casa: 'SC Farense',       fora: 'Sport Campinense', gcasa: 1,    gfora: 2,    data: '2026-03-22', hora: '09:30', local: 'Estádio Algarve',          estado: 'Realizado' },
    { id: 7,  escalao: 'Sub-15', casa: 'Sport Campinense', fora: 'Olhanense',        gcasa: null, gfora: null, data: '2026-04-12', hora: '09:00', local: 'Est. Municipal Loulé',     estado: 'Agendado'  },
    { id: 8,  escalao: 'Sub-13', casa: 'Sport Campinense', fora: 'GD Silves',        gcasa: 4,    gfora: 1,    data: '2026-03-29', hora: '09:00', local: 'Est. Municipal Loulé',     estado: 'Realizado' },
    { id: 9,  escalao: 'Sub-13', casa: 'Sport Campinense', fora: 'FC Quarteira',     gcasa: null, gfora: null, data: '2026-04-19', hora: '09:00', local: 'Est. Municipal Loulé',     estado: 'Agendado'  },
    { id: 10, escalao: 'Sub-19', casa: 'Sport Campinense', fora: 'SC Farense',       gcasa: 1,    gfora: 2,    data: '2026-03-28', hora: '15:00', local: 'Est. Municipal Loulé',     estado: 'Realizado' },
    { id: 11, escalao: 'Sub-19', casa: 'Sport Campinense', fora: 'SL Benfica B',     gcasa: null, gfora: null, data: '2026-04-11', hora: '15:00', local: 'Est. Municipal Loulé',     estado: 'Agendado'  },
  ];

  // --------------------------------------------------
  // DATA LOADERS
  // --------------------------------------------------
  function loadEscaloes() {
    try {
      const raw = localStorage.getItem('db_escaloes');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return DEFAULT_ESCALOES;
  }

  function loadAtletas() {
    try {
      const raw = localStorage.getItem('db_atletas');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return DEFAULT_ATLETAS;
  }

  function loadTreinadores() {
    try {
      const raw = localStorage.getItem('db_treinadores');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return DEFAULT_TREINADORES;
  }

  function loadJogos(escalaoNome) {
    try {
      const raw = localStorage.getItem('fpf_jogos_' + escalaoNome);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return DEFAULT_JOGOS.filter(function (j) { return j.escalao === escalaoNome; });
  }

  // --------------------------------------------------
  // HELPERS
  // --------------------------------------------------
  function calcAge(dataNascimento) {
    if (!dataNascimento) return null;
    // UTC-safe: split by '-'
    var parts = String(dataNascimento).split('-');
    if (parts.length < 3) return null;
    var birthYear = parseInt(parts[0], 10);
    var birthMonth = parseInt(parts[1], 10) - 1;
    var birthDay = parseInt(parts[2], 10);
    var today = new Date();
    var age = today.getFullYear() - birthYear;
    if (today.getMonth() < birthMonth || (today.getMonth() === birthMonth && today.getDate() < birthDay)) {
      age--;
    }
    return age;
  }

  function initials(nome) {
    var parts = (nome || '').trim().split(/\s+/);
    var first = parts[0] ? parts[0][0] : '';
    var last  = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  function isClub(nome) {
    var n = (nome || '').toLowerCase();
    return n.includes('campinense') || n.includes('sport camp');
  }

  function parseDate(str) {
    // UTC-safe parse: 'YYYY-MM-DD'
    var parts = String(str || '').split('-');
    if (parts.length < 3) return new Date(NaN);
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  var PT_MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  function normPos(pos) {
    var p = (pos || '').toLowerCase().trim();
    if (!p) return 'AVA';
    if (p.includes('guarda'))  return 'GR';
    if (p.includes('defesa') || p.includes('central') || p.includes('lateral')) return 'DEF';
    if (p.includes('médio') || p.includes('medio') || p.includes('extremo'))    return 'MEI';
    if (p.includes('avançado') || p.includes('avancado') || p.includes('ponta')) return 'AVA';
    return 'AVA';
  }

  // --------------------------------------------------
  // HERO
  // --------------------------------------------------
  function populateHero(escalao) {
    document.getElementById('escHeroBadge').textContent = escalao.nome;
    document.getElementById('escHeroTitle').textContent = escalao.designacao;
    document.getElementById('escHeroFaixa').textContent = escalao.faixa;
    document.getElementById('escStatAtletas').textContent = escalao.atletas || 0;

    var treinos = escalao.treinos || '—';
    if (treinos.length > 22) treinos = treinos.substring(0, 20) + '…';
    document.getElementById('escStatTreinos').textContent = treinos;

    document.getElementById('escStatTreinador').textContent = escalao.treinador || '—';
  }

  // --------------------------------------------------
  // PLANTEL
  // --------------------------------------------------
  function renderPlantel(atletas, escalaoNome) {
    var section = document.getElementById('escPlantel');
    if (!section) return;

    var activos = atletas.filter(function (a) {
      return a.escalao === escalaoNome && a.estado !== 'Inactivo';
    });

    var groups = [
      { key: 'GR',  label: 'Guarda-redes' },
      { key: 'DEF', label: 'Defesas' },
      { key: 'MEI', label: 'Médios' },
      { key: 'AVA', label: 'Avançados' },
    ];

    var html = '<div class="escalao-section__body">';

    if (!activos.length) {
      html += '<p class="esc-empty">Plantel ainda não publicado para este escalão.</p>';
    } else {
      groups.forEach(function (g) {
        var jogadores = activos.filter(function (a) { return normPos(a.posicao) === g.key; });
        if (!jogadores.length) return;

        html += '<div class="esc-pos-group">';
        html += '<p class="esc-pos-label">' + g.label + '</p>';
        html += '<div class="esc-player-list">';

        jogadores.forEach(function (a) {
          var age = calcAge(a.dataNascimento);
          var ageTxt = age !== null ? age + ' anos' : '';
          var avatarHtml = a.foto
            ? '<img src="' + a.foto + '" alt="' + a.nome + '" style="width:38px;height:38px;border-radius:50%;object-fit:cover" />'
            : initials(a.nome);
          html += '<a class="esc-player" href="atleta.html?id=' + a.id + '" style="text-decoration:none">';
          html += '<div class="esc-player__avatar">' + avatarHtml + '</div>';
          html += '<div>';
          html += '<div class="esc-player__name">' + a.nome + '</div>';
          html += '<div class="esc-player__meta">' + (a.posicao || g.label) + (ageTxt ? ' · ' + ageTxt : '') + '</div>';
          html += '</div>';
          html += '<span class="esc-player__arrow">›</span>';
          html += '</a>';
        });

        html += '</div></div>';
      });
    }

    html += '</div>';
    section.innerHTML = '<div class="escalao-section__head"><h2>Plantel</h2></div>' + html;
  }

  // --------------------------------------------------
  // TECHNICAL STAFF
  // --------------------------------------------------
  function renderTechnical(treinadores, escalaoNome) {
    var section = document.getElementById('escTechnical');
    if (!section) return;

    var staff = treinadores.filter(function (t) {
      return t.ativo !== false && (t.escalao === escalaoNome || t.escalao === 'Todos');
    });

    var html = '<div class="escalao-section__body"><div class="esc-staff-list">';

    if (!staff.length) {
      html += '<p class="esc-empty">Equipa técnica não disponível.</p>';
    } else {
      staff.forEach(function (t) {
        html += '<div class="esc-staff-card">';
        html += '<div class="esc-staff__avatar">' + initials(t.nome) + '</div>';
        html += '<div>';
        html += '<div class="esc-staff__name">' + t.nome + '</div>';
        html += '<div class="esc-staff__cargo">' + t.cargo + '</div>';
        html += '</div>';
        html += '</div>';
      });
    }

    html += '</div></div>';
    section.innerHTML = '<div class="escalao-section__head"><h2>Equipa Técnica</h2></div>' + html;
  }

  // --------------------------------------------------
  // SEASON STATS
  // --------------------------------------------------
  function renderStats(jogos) {
    var section = document.getElementById('escStats');
    if (!section) return;

    var realizados = jogos.filter(function (j) { return j.estado === 'Realizado'; });

    var jogosTotal = realizados.length;
    var vitorias = 0, empates = 0, derrotas = 0, gm = 0, gs = 0;

    realizados.forEach(function (j) {
      var clubEhCasa = isClub(j.casa);
      var gc = j.gcasa != null ? parseInt(j.gcasa, 10) : 0;
      var gf = j.gfora != null ? parseInt(j.gfora, 10) : 0;
      if (clubEhCasa) {
        gm += gc; gs += gf;
        if (gc > gf) vitorias++;
        else if (gc === gf) empates++;
        else derrotas++;
      } else {
        gm += gf; gs += gc;
        if (gf > gc) vitorias++;
        else if (gf === gc) empates++;
        else derrotas++;
      }
    });

    var html = '<div class="escalao-section__body">';
    html += '<div class="esc-stats-grid">';
    html += '<div class="esc-stat-box"><div class="esc-stat-box__num">' + jogosTotal + '</div><div class="esc-stat-box__label">Jogos</div></div>';
    html += '<div class="esc-stat-box"><div class="esc-stat-box__num esc-stat-box__num--v">' + vitorias + '</div><div class="esc-stat-box__label">Vitórias</div></div>';
    html += '<div class="esc-stat-box"><div class="esc-stat-box__num">' + empates + '</div><div class="esc-stat-box__label">Empates</div></div>';
    html += '<div class="esc-stat-box"><div class="esc-stat-box__num esc-stat-box__num--d">' + derrotas + '</div><div class="esc-stat-box__label">Derrotas</div></div>';
    html += '<div class="esc-stat-box"><div class="esc-stat-box__num">' + gm + '</div><div class="esc-stat-box__label">Golos Marc.</div></div>';
    html += '<div class="esc-stat-box"><div class="esc-stat-box__num">' + gs + '</div><div class="esc-stat-box__label">Golos Sof.</div></div>';
    html += '</div></div>';

    section.innerHTML = '<div class="escalao-section__head"><h2>Estatísticas da Época</h2></div>' + html;
  }

  // --------------------------------------------------
  // FIXTURES / RESULTS
  // --------------------------------------------------
  function renderFixtures(jogos) {
    var section = document.getElementById('escResultados');
    if (!section) return;

    var realizados = jogos
      .filter(function (j) { return j.estado === 'Realizado'; })
      .sort(function (a, b) { return parseDate(b.data) - parseDate(a.data); })
      .slice(0, 5);

    var agendados = jogos
      .filter(function (j) { return j.estado === 'Agendado'; })
      .sort(function (a, b) { return parseDate(a.data) - parseDate(b.data); })
      .slice(0, 3);

    function resultBadge(j) {
      var clubEhCasa = isClub(j.casa);
      var gc = parseInt(j.gcasa, 10);
      var gf = parseInt(j.gfora, 10);
      var clubGolos = clubEhCasa ? gc : gf;
      var advGolos  = clubEhCasa ? gf : gc;
      if (clubGolos > advGolos) return { cls: 'v', lbl: 'V' };
      if (clubGolos === advGolos) return { cls: 'e', lbl: 'E' };
      return { cls: 'd', lbl: 'D' };
    }

    function fixtureHTML(j) {
      var d = parseDate(j.data);
      var day   = d.getDate();
      var month = PT_MONTHS[d.getMonth()];
      var clubEhCasa = isClub(j.casa);
      var oponente = clubEhCasa ? j.fora : j.casa;
      var homeAway = clubEhCasa ? 'Casa' : 'Fora';

      if (j.estado === 'Realizado') {
        var res = resultBadge(j);
        var score = j.gcasa + ' – ' + j.gfora;
        return (
          '<div class="esc-fixture">' +
            '<div class="esc-fixture__date">' +
              '<div class="esc-fixture__date__day">' + day + '</div>' +
              '<div class="esc-fixture__date__month">' + month + '</div>' +
            '</div>' +
            '<div class="esc-fixture__teams">' +
              '<div style="font-size:0.88rem;font-weight:600;color:#1a2744">' + oponente + '</div>' +
              '<div style="font-size:0.75rem;color:#888">' + homeAway + '</div>' +
            '</div>' +
            '<div class="esc-fixture__score">' + score + '</div>' +
            '<div class="esc-fixture__result esc-fixture__result--' + res.cls + '">' + res.lbl + '</div>' +
          '</div>'
        );
      } else {
        return (
          '<div class="esc-fixture">' +
            '<div class="esc-fixture__date">' +
              '<div class="esc-fixture__date__day">' + day + '</div>' +
              '<div class="esc-fixture__date__month">' + month + '</div>' +
            '</div>' +
            '<div class="esc-fixture__teams">' +
              '<div style="font-size:0.88rem;font-weight:600;color:#1a2744">' + oponente + '</div>' +
              '<div style="font-size:0.75rem;color:#888">' + homeAway + ' · ' + j.hora + '</div>' +
            '</div>' +
            '<div class="esc-fixture__badge">Próximo</div>' +
          '</div>'
        );
      }
    }

    var html = '<div class="escalao-section__body">';

    if (realizados.length) {
      html += '<p class="esc-pos-label" style="margin-bottom:8px">Últimos resultados</p>';
      html += realizados.map(fixtureHTML).join('');
    }

    if (agendados.length) {
      if (realizados.length) html += '<div style="height:16px"></div>';
      html += '<p class="esc-pos-label" style="margin-bottom:8px">Próximos jogos</p>';
      html += agendados.map(fixtureHTML).join('');
    }

    if (!realizados.length && !agendados.length) {
      html += '<p class="esc-empty">Sem jogos registados.</p>';
    }

    html += '</div>';
    section.innerHTML = '<div class="escalao-section__head"><h2>Resultados &amp; Jogos</h2></div>' + html;
  }

  // --------------------------------------------------
  // ERROR STATE
  // --------------------------------------------------
  function showError() {
    var main = document.querySelector('main');
    if (!main) return;
    main.innerHTML = (
      '<div style="text-align:center;padding:80px 20px">' +
        '<div style="font-size:3.5rem;margin-bottom:16px">⚠️</div>' +
        '<h2 style="font-family:\'Bebas Neue\',sans-serif;font-size:2rem;color:#001f4d;margin-bottom:12px">Escalão não encontrado</h2>' +
        '<p style="color:#666;margin-bottom:24px">O escalão indicado não existe ou o endereço está incorreto.</p>' +
        '<a href="formacao.html" style="background:#001f4d;color:#FFD100;font-family:\'Bebas Neue\',sans-serif;letter-spacing:1px;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:1rem">← Voltar à Formação</a>' +
      '</div>'
    );
  }

  // --------------------------------------------------
  // INIT
  // --------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    var params = new URLSearchParams(location.search);
    var escalaoNome = params.get('escalao');

    if (!escalaoNome) {
      showError();
      return;
    }

    var escaloes    = loadEscaloes();
    var escalaoObj  = escaloes.find(function (e) { return e.nome === escalaoNome; });

    if (!escalaoObj) {
      showError();
      return;
    }

    // Page title
    document.title = escalaoNome + ' – Juventude Sport Campinense';

    // Hero
    populateHero(escalaoObj);

    // Data
    var atletas     = loadAtletas();
    var treinadores = loadTreinadores();
    var jogos       = loadJogos(escalaoNome);

    // Sections
    renderPlantel(atletas, escalaoNome);
    renderTechnical(treinadores, escalaoNome);
    renderStats(jogos);
    renderFixtures(jogos);
  });

  // Live update from admin in another tab
  window.addEventListener('storage', function (ev) {
    if (['db_atletas', 'db_escaloes', 'db_treinadores'].indexOf(ev.key) !== -1) {
      var params = new URLSearchParams(location.search);
      var escalaoNome = params.get('escalao');
      if (!escalaoNome) return;
      var escaloes = loadEscaloes();
      var escalaoObj = escaloes.find(function (e) { return e.nome === escalaoNome; });
      if (!escalaoObj) return;
      populateHero(escalaoObj);
      var atletas = loadAtletas();
      var treinadores = loadTreinadores();
      var jogos = loadJogos(escalaoNome);
      renderPlantel(atletas, escalaoNome);
      renderTechnical(treinadores, escalaoNome);
      renderStats(jogos);
      renderFixtures(jogos);
    }
  });

})();
