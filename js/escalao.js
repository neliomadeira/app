// =============================================
// ESCALÃO INDIVIDUAL — escalao.js
// =============================================

(function () {

  // --------------------------------------------------
  // DEFAULT DATA (fallback when localStorage is empty)
  // --------------------------------------------------
  const DEFAULT_ESCALOES = [
    { id: 7, nome: 'Sub-5',  designacao: 'Pré-Petizes', faixa: 'Até 5 anos',   atletas: 0, treinador: '', treinos: '', descricao: 'Para as crianças mais novas, focado no lúdico.', destaque: false },
    { id: 8, nome: 'Sub-7',  designacao: 'Petizes',     faixa: '6 a 7 anos',   atletas: 0, treinador: '', treinos: '', descricao: 'Fase de sensibilização, sem cariz competitivo oficial.', destaque: false },
    { id: 1, nome: 'Sub-9',  designacao: 'Traquinas',    faixa: '8 a 9 anos',   atletas: 0, treinador: '', treinos: '',      descricao: 'Actividades essencialmente recreativas e festas do futebol.', destaque: false },
    { id: 2, nome: 'Sub-11', designacao: 'Benjamins',  faixa: '10 a 11 anos', atletas: 0, treinador: '', treinos: '', descricao: 'Início de uma organização competitiva mais regrada.', destaque: false },
    { id: 3, nome: 'Sub-13', designacao: 'Infantis',  faixa: '12 a 13 anos', atletas: 0, treinador: '', treinos: '',  descricao: 'Passagem para modelos de jogo mais complexos.', destaque: true  },
    { id: 4, nome: 'Sub-15', designacao: 'Iniciados',   faixa: '14 a 15 anos', atletas: 0, treinador: '', treinos: '',  descricao: 'Escalão importante de transição e consolidação técnica e táctica.', destaque: false },
    { id: 5, nome: 'Sub-17', designacao: 'Juvenis',  faixa: '16 a 17 anos', atletas: 0, treinador: '', treinos: '',     descricao: 'Fase altamente competitiva de alto rendimento jovem.', destaque: false },
    { id: 6, nome: 'Sub-19', designacao: 'Juniores',    faixa: '18 a 19 anos', atletas: 0, treinador: '', treinos: '',     descricao: 'O último patamar da formação antes do salto para o futebol sénior ou sub-23.', destaque: false },
  ];

  // Estava aqui um conjunto de registos inventados, usado quando não havia
  // nada publicado. Saiu: o site não mostra pessoas, jogos nem resultados
  // que não existem. Sem dados publicados, a página diz que ainda não há.
  const DEFAULT_ATLETAS = [];

  const DEFAULT_TREINADORES = [];

  const DEFAULT_JOGOS = [];

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
    // Jogos geridos no admin (adicionar/editar/registar/apagar) têm prioridade
    try {
      const admin = JSON.parse(localStorage.getItem('db_jogos') || '[]')
        .filter(function (j) { return j.escalao === escalaoNome; });
      if (admin.length) return admin;
    } catch (e) {}
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
    // Só se mostra o que existir de facto. Sem contagem publicada não se
    // escreve "0 atletas", que soa a escalão sem ninguém quando o que se
    // passa é que o número ainda não foi introduzido.
    function estatistica(idBloco, idValor, valor) {
      var bloco = document.getElementById(idBloco);
      var span  = document.getElementById(idValor);
      if (!bloco || !span) return;
      if (valor === '' || valor === null || valor === undefined) { bloco.hidden = true; return; }
      span.textContent = valor;
      bloco.hidden = false;
    }

    var nAtletas = parseInt(escalao.atletas, 10);
    estatistica('escStatAtletasBloco', 'escStatAtletas',
      (isNaN(nAtletas) || nAtletas <= 0) ? '' : nAtletas);

    var treinos = (escalao.treinos || '').trim();
    if (treinos.length > 22) treinos = treinos.substring(0, 20) + '…';
    estatistica('escStatTreinosBloco', 'escStatTreinos', treinos);

    estatistica('escStatTreinadorBloco', 'escStatTreinador', (escalao.treinador || '').trim());
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
        html += '<p class="esc-pos-label">' + jscEsc(g.label) + '</p>';
        html += '<div class="esc-player-list">';

        jogadores.forEach(function (a) {
          var age = calcAge(a.dataNascimento);
          var ageTxt = age !== null ? age + ' anos' : '';
          var avatarHtml = a.foto
            ? '<img src="' + jscEscUrl(a.foto) + '" alt="' + jscEsc(a.nome) + '" style="width:38px;height:38px;border-radius:50%;object-fit:cover" />'
            : jscEsc(initials(a.nome));
          html += '<a class="esc-player" href="atleta.html?id=' + jscEsc(a.id) + '" style="text-decoration:none">';
          html += '<div class="esc-player__avatar">' + avatarHtml + '</div>';
          html += '<div>';
          html += '<div class="esc-player__name">' + jscEsc(a.nome) + '</div>';
          html += '<div class="esc-player__meta">' + jscEsc(a.posicao || g.label) + (ageTxt ? ' · ' + jscEsc(ageTxt) : '') + '</div>';
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
        var fotoStyle = t.foto
          ? ' style="background-image:url(\'' + jscEscUrl(t.foto) + '\');background-size:cover;background-position:center;color:transparent"'
          : '';
        html += '<div class="esc-staff-card">';
        html += '<div class="esc-staff__avatar"' + fotoStyle + '>' + jscEsc(initials(t.nome)) + '</div>';
        html += '<div>';
        html += '<div class="esc-staff__name">' + jscEsc(t.nome) + '</div>';
        html += '<div class="esc-staff__cargo">' + jscEsc(t.cargo) + '</div>';
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
      '<div class="esc-empty">' +
        '<div class="esc-empty__icon">⚠️</div>' +
        '<h1 class="esc-empty__title">Escalão não encontrado</h1>' +
        '<p class="esc-empty__text">O escalão indicado não existe ou o endereço está incorreto.</p>' +
        '<a href="formacao.html" class="esc-empty__btn">← Voltar à Formação</a>' +
      '</div>'
    );
  }

  // --------------------------------------------------
  // ANIVERSÁRIOS DO MÊS (do escalão)
  // --------------------------------------------------
  function renderAniversarios(atletas, escalaoNome) {
    var section = document.getElementById('escAniversarios');
    var listaEl = document.getElementById('escAniversariosLista');
    if (!section || !listaEl) return;

    var hoje = new Date();
    var dia  = hoje.getDate();
    var mes  = hoje.getMonth();

    var lista = atletas
      .filter(function (a) {
        if (a.escalao !== escalaoNome || !a.dataNascimento || a.estado === 'Inactivo') return false;
        var n = new Date(a.dataNascimento + 'T00:00:00');
        return !isNaN(n) && n.getMonth() === mes;
      })
      .map(function (a) {
        var n = new Date(a.dataNascimento + 'T00:00:00');
        return {
          nome: a.nome, foto: a.foto || '',
          _dia: n.getDate(),
          _idade: hoje.getFullYear() - n.getFullYear(),
          _hoje: n.getDate() === dia,
        };
      })
      .sort(function (a, b) { return (b._hoje - a._hoje) || (a._dia - b._dia); });

    if (!lista.length) { section.style.display = 'none'; return; }

    section.style.display = '';
    listaEl.innerHTML = lista.map(function (a) {
      var detalhe = a._hoje
        ? 'faz ' + a._idade + ' anos <strong>hoje</strong> 🎉'
        : 'dia ' + a._dia + ' &middot; faz ' + a._idade + ' anos';
      var avatar = a.foto
        ? '<img src="' + a.foto + '" alt="" class="birthday__foto" loading="lazy" ' +
          'onerror="this.outerHTML=\'<div class=&quot;birthday__icon&quot;>🎂</div>\'">'
        : '<div class="birthday__icon">🎂</div>';
      return '<div class="birthday__card' + (a._hoje ? ' birthday__card--today' : '') + '">' +
        avatar +
        '<div class="birthday__info">' +
          '<strong class="birthday__nome">' + a.nome + '</strong>' +
          '<span class="birthday__detalhe">' + detalhe + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
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
    renderAniversarios(atletas, escalaoNome);
  });

  // Live update from admin in another tab
  window.addEventListener('storage', function (ev) {
    if (['db_atletas', 'db_escaloes', 'db_treinadores', 'db_jogos'].indexOf(ev.key) !== -1) {
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
      renderAniversarios(atletas, escalaoNome);
    }
  });

})();
