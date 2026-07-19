// =============================================
// PESQUISA — site-wide search
// =============================================
(function () {
  'use strict';

  // ------------------------------------------------------------------
  // Default data (mirrors admin/js/data.js)
  // ------------------------------------------------------------------

  var DEFAULT_NOTICIAS = [
    { id: 1, titulo: 'Sub-17 vence Olhanense e avança às meias-finais do Campeonato Distrital', categoria: 'Resultado', data: '2026-04-05', publicada: true,  resumo: '' },
    { id: 2, titulo: 'Testes de seleção abertos para Sub-13 e Sub-15',                          categoria: 'Seleção',   data: '2026-03-28', publicada: true,  resumo: '' },
    { id: 3, titulo: 'Três atletas da formação convocados para a Seleção Regional do Algarve',  categoria: 'Conquista', data: '2026-03-15', publicada: true,  resumo: '' },
    { id: 4, titulo: 'Parceria com Escola Secundária de Loulé reforça formação académica',      categoria: 'Clube',     data: '2026-03-05', publicada: false, resumo: '' },
  ];

  var DEFAULT_ATLETAS = [
    { id: 1,  nome: 'Diogo Nunes Marques',       escalao: 'Sub-9',  posicao: ''              },
    { id: 2,  nome: 'Rui Sousa Carvalho',         escalao: 'Sub-11', posicao: 'Médio'         },
    { id: 3,  nome: 'Luís Tavares Brito',         escalao: 'Sub-11', posicao: 'Avançado'      },
    { id: 4,  nome: 'Rafael Castro Mota',         escalao: 'Sub-13', posicao: 'Extremo'       },
    { id: 5,  nome: 'Gonçalo Pires Mendes',       escalao: 'Sub-13', posicao: 'Central'       },
    { id: 6,  nome: 'Tiago Ferreira Lima',        escalao: 'Sub-15', posicao: 'Defesa Dir.'   },
    { id: 7,  nome: 'Bernardo Santos Cruz',       escalao: 'Sub-15', posicao: 'Médio Def.'    },
    { id: 8,  nome: 'Francisco Lopes Vaz',        escalao: 'Sub-17', posicao: 'Avançado'      },
    { id: 9,  nome: 'Martim Costa Azevedo',       escalao: 'Sub-17', posicao: 'Extremo'       },
    { id: 10, nome: 'Pedro Gomes Rodrigues',      escalao: 'Sub-19', posicao: 'Guarda-redes'  },
    { id: 11, nome: 'Rodrigo Alves Monteiro',     escalao: 'Sub-19', posicao: 'Médio'         },
  ];

  var DEFAULT_ESCALOES = [
    { id: 1, nome: 'Sub-9',  designacao: 'Petizes',   faixa: '7 a 9 anos',   treinador: 'Ricardo Matos'  },
    { id: 2, nome: 'Sub-11', designacao: 'Traquinas', faixa: '10 a 11 anos', treinador: 'Jorge Pinto'    },
    { id: 3, nome: 'Sub-13', designacao: 'Benjamins', faixa: '12 a 13 anos', treinador: 'Nuno Carvalho'  },
    { id: 4, nome: 'Sub-15', designacao: 'Infantis',  faixa: '14 a 15 anos', treinador: 'Filipe Gomes'   },
    { id: 5, nome: 'Sub-17', designacao: 'Iniciados', faixa: '16 a 17 anos', treinador: 'André Monteiro' },
    { id: 6, nome: 'Sub-19', designacao: 'Juvenis',   faixa: '18 a 19 anos', treinador: 'Sérgio Fonseca' },
  ];

  var DEFAULT_AGENDA = [
    { id: 1, titulo: 'Jogo Sub-17 vs FC Tavira',   tipo: 'Jogo',    escalao: 'Sub-17', data: '2026-04-12', hora: '15:00', local: 'Est. Municipal Loulé',   descricao: 'Campeonato Distrital AF Algarve'     },
    { id: 2, titulo: 'Torneio Primavera Sub-9',     tipo: 'Torneio', escalao: 'Sub-9',  data: '2026-04-13', hora: '09:00', local: 'Campo Sintético Loulé',   descricao: 'Torneio festivo de Primavera'         },
    { id: 3, titulo: 'Reunião de Pais Sub-13',      tipo: 'Reunião', escalao: 'Sub-13', data: '2026-04-15', hora: '19:00', local: 'Sede do Clube',            descricao: 'Reunião trimestral com encarregados' },
    { id: 4, titulo: 'Treino físico Sub-15',        tipo: 'Treino',  escalao: 'Sub-15', data: '2026-04-10', hora: '17:30', local: 'Est. Municipal Loulé',   descricao: 'Treino de preparação física'          },
    { id: 5, titulo: 'Jogo Sub-19 vs Portimonense', tipo: 'Jogo',    escalao: 'Sub-19', data: '2026-04-11', hora: '17:00', local: 'Est. Municipal Loulé',   descricao: 'Liga Nacional Juvenis'                },
    { id: 6, titulo: 'Festa de Encerramento',       tipo: 'Outro',   escalao: 'Todos',  data: '2026-06-15', hora: '18:00', local: 'Pavilhão Municipal',      descricao: 'Festa de fim de época'                },
  ];

  var DEFAULT_HISTORIA = [
    { id: 1, ano: 1947, titulo: 'Fundação do Clube',
      descricao: 'O Juventude Sport Campinense é fundado em Loulé a 12 de dezembro de 1947, ligado à juventude e à comunidade louletana. Pedro Correia Bota, jogador e fundador, orientou o clube nos primeiros anos.' },
    { id: 2, ano: 1948, titulo: 'Filiação desportiva',
      descricao: 'O clube é federado a 8 de janeiro, iniciando o seu percurso oficial na Associação de Futebol do Algarve.' },
    { id: 3, ano: 1950, titulo: 'Crescimento e implantação local',
      descricao: 'Ao longo das décadas de 1950 e 1960, o Campinense consolida a presença na vida desportiva de Loulé. O futebol torna-se a principal modalidade, com participação em competições regionais e distritais.' },
    { id: 4, ano: 1978, titulo: 'Ascensão competitiva',
      descricao: 'No final da década de 1970, o clube inicia uma das fases mais fortes da sua história no futebol sénior, afirmando-se nas competições nacionais.' },
    { id: 5, ano: 1982, titulo: 'Melhor campanha na Taça de Portugal',
      descricao: 'Na época de 1981/82, o clube alcança os 1/32 de final — a melhor campanha conhecida nas suas 12 participações na Taça de Portugal.' },
    { id: 6, ano: 1984, titulo: 'Campeão da Série F da III Divisão Nacional',
      descricao: 'Na época de 1983/84, o Campinense vence a Série F da III Divisão Nacional e conquista o acesso ao segundo escalão do futebol português.' },
    { id: 7, ano: 1985, titulo: 'II Divisão Nacional — Zona Sul',
      descricao: 'Em 1984/85, o clube disputa a II Divisão Nacional, o ponto competitivo mais elevado da sua história. No total: uma época na II Divisão, nove na III Divisão e doze presenças na Taça de Portugal.' },
    { id: 8, ano: 1988, titulo: 'Título distrital sénior',
      descricao: 'Registos ligados à história do clube apontam para a conquista de um título distrital sénior neste período.' },
    { id: 9, ano: 1994, titulo: 'Criação da secção de boxe',
      descricao: 'Nasce a secção de boxe, com atletas de formação, manutenção e competição — incluindo trabalho de inclusão através do boxe adaptado.' },
    { id: 10, ano: 1995, titulo: 'Medalha Municipal de Mérito — Grau Prata',
      descricao: 'A Câmara Municipal de Loulé distingue o clube pelo seu papel na promoção do desporto, na formação dos jovens e na vida social do concelho.' },
    { id: 11, ano: 2001, titulo: 'Utilidade pública',
      descricao: 'O clube é reconhecido como pessoa coletiva de utilidade pública, confirmando oficialmente a sua relevância social, associativa e desportiva.' },
    { id: 12, ano: 2006, titulo: 'Campeão Distrital e Taça do Algarve',
      descricao: 'Época dourada em 2005/06: conquista do Campeonato Distrital da 1.ª Divisão da AF Algarve e da Taça do Algarve, garantindo o regresso às competições nacionais.' },
    { id: 13, ano: 2007, titulo: 'Regresso aos campeonatos nacionais',
      descricao: 'O clube disputa três épocas consecutivas na III Divisão Nacional (2006/07 a 2008/09) e volta a marcar presença na Taça de Portugal.' },
    { id: 14, ano: 2010, titulo: 'Aposta reforçada na formação',
      descricao: 'Durante a década de 2010, a formação torna-se um dos pilares do projeto desportivo, com trabalho regular em vários escalões, dos mais jovens aos juniores.' },
    { id: 15, ano: 2017, titulo: 'Iniciados Campeões do Algarve',
      descricao: 'Na época de 2016/17, os Iniciados conquistam um título inédito de Campeões do Algarve e o acesso ao Campeonato Nacional de Iniciados.' },
    { id: 16, ano: 2018, titulo: 'Torneios e futsal feminino',
      descricao: 'Realiza-se o V Torneio Humberto «Laranjeira» Faísca e o clube promove o torneio e o Algarve Invitational de futsal feminino.' },
    { id: 17, ano: 2019, titulo: 'Kickboxing e formação em destaque',
      descricao: 'Atletas do clube conquistam títulos no kickboxing e os Traquinas A vencem a Mértola Cup.' },
    { id: 18, ano: 2020, titulo: 'Resiliência e multidesporto',
      descricao: 'O clube adapta-se às restrições da pandemia mantendo a ligação a atletas e famílias. Cristina Azevedo sagra-se vice-campeã nacional de ciclismo (Masters 40) em representação do Campinense.' },
    { id: 19, ano: 2021, titulo: 'Entidade Formadora de Três Estrelas',
      descricao: 'A FPF certifica o clube como Entidade Formadora de Três Estrelas. Nasce a Campinense Cup e o projeto de futsal feminino ganha novo impulso.' },
    { id: 20, ano: 2022, titulo: 'Iniciados vencem a Challenge Cup',
      descricao: 'Novo momento de destaque da formação, seguido do título distrital da 2.ª Divisão em 2022/23, com subida à 1.ª Divisão.' },
    { id: 21, ano: 2024, titulo: 'Futsal feminino em força',
      descricao: 'A equipa sénior feminina vence a Taça de Campeão de Inverno e o clube realiza a II Maratona de Futsal Feminino, dinamizando a modalidade no Algarve.' },
    { id: 22, ano: 2025, titulo: 'Campeão da Liga Algarve de Futsal Feminino',
      descricao: 'Título da Liga Algarve de Futsal Feminino em 2024/25, subida dos Juvenis (Sub-17) à 1.ª Divisão Distrital e quarta edição da Campinense Cup.' },
    { id: 23, ano: 2026, titulo: 'Âmbito nacional e novos torneios',
      descricao: 'A equipa sénior feminina participa na Taça Nacional de Futsal Feminino 2025/26. Realizam-se o IX Torneio Humberto Faísca e o II Torneio de Futebol Feminino.' },
  ];

  var DEFAULT_PALMARES = [
    { id: 1, competicao: 'III Divisão Nacional — Série F', escalao: 'Seniores', ano: 1984, observacao: 'Campeão — subida histórica à II Divisão' },
    { id: 2, competicao: 'Campeonato Distrital 1.ª Divisão AF Algarve', escalao: 'Seniores', ano: 2006, observacao: 'Campeão — dobradinha inédita' },
    { id: 3, competicao: 'Taça do Algarve', escalao: 'Seniores', ano: 2006, observacao: 'Vencedor — dobradinha inédita' },
    { id: 4, competicao: 'Campeonato do Algarve', escalao: 'Iniciados', ano: 2017, observacao: 'Campeão — acesso ao Nacional (feito inédito)' },
    { id: 5, competicao: 'Liga 2 Algarve', escalao: 'Iniciados', ano: 2023, observacao: 'Campeão — subida à Liga 1' },
    { id: 6, competicao: 'Challenge Cup', escalao: 'Iniciados', ano: 2022, observacao: 'Vencedor (torneio)' },
    { id: 7, competicao: 'Mértola Cup', escalao: 'Traquinas A', ano: 2019, observacao: 'Vencedor (torneio)' },
    { id: 8, competicao: 'Liga 2 Algarve', escalao: 'Juvenis (Sub-17)', ano: 2025, observacao: '2.º lugar — subida à Liga 1' },
    { id: 9, competicao: 'Liga Algarve de Futsal Feminino', escalao: 'Sen. Femininos', ano: 2025, observacao: 'Campeã' },
    { id: 10, competicao: 'Taça de Campeão de Inverno Feminina', escalao: 'Sen. Femininos', ano: 2024, observacao: 'Vencedora' },
    { id: 11, competicao: 'Taça do Algarve (Futsal Feminino)', escalao: 'Sen. Femininos', ano: 2025, observacao: 'Finalista' },
    { id: 12, competicao: 'Campeonato Nacional WKU (–73,5 kg)', escalao: 'Ângelo Cordeiro', ano: 2019, observacao: 'Campeão Nacional' },
    { id: 13, competicao: 'Kick-Light (–55 kg)', escalao: 'Matilde Hervê', ano: 2019, observacao: 'Vitória em Almodôvar' },
    { id: 14, competicao: 'Campeonato Nacional de Ciclismo — Masters 40', escalao: 'Cristina Azevedo', ano: 2020, observacao: 'Vice-campeã nacional' },
    { id: 15, competicao: '2.ª Divisão Nacional de Ténis de Mesa', escalao: 'Equipa', ano: 2012, observacao: 'Subida de divisão (2011/12)' },
  ];

  var DEFAULT_TREINADORES = [
    { id: 1, nome: 'Carlos Mendes',   cargo: 'Director Técnico',          escalao: 'Todos'  },
    { id: 2, nome: 'João Silva',      cargo: 'Treinador Principal',       escalao: 'Sub-17' },
    { id: 3, nome: 'Pedro Alves',     cargo: 'Treinador Principal',       escalao: 'Sub-15' },
    { id: 4, nome: 'Rui Costa',       cargo: 'Treinador Adjunto',         escalao: 'Sub-17' },
    { id: 5, nome: 'Ana Rodrigues',   cargo: 'Preparadora Física',        escalao: 'Todos'  },
    { id: 6, nome: 'Miguel Ferreira', cargo: 'Treinador de Guarda-redes', escalao: 'Todos'  },
    { id: 7, nome: 'Sofia Lopes',     cargo: 'Psicóloga',                 escalao: 'Todos'  },
    { id: 8, nome: 'António Gomes',   cargo: 'Team Manager',              escalao: 'Sub-19' },
  ];

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  var MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  function ptDate(d) {
    if (!d) return '';
    var dt = new Date(d + 'T00:00:00');
    if (isNaN(dt.getTime())) return d;
    return dt.getDate() + ' de ' + MESES[dt.getMonth()] + ', ' + dt.getFullYear();
  }

  function stripHtml(str) {
    return (str || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return fallback;
  }

  // ------------------------------------------------------------------
  // Build index
  // ------------------------------------------------------------------

  function buildIndex() {
    var index = [];

    // Notícias — only publicada:true
    var noticias = load('jsc_noticias', DEFAULT_NOTICIAS);
    noticias.filter(function (n) { return n.publicada; }).forEach(function (n) {
      var resumoPlain = stripHtml(n.resumo);
      index.push({
        type:     'noticia',
        title:    n.titulo || '',
        subtitle: (n.categoria || '') + (n.data ? ' · ' + ptDate(n.data) : ''),
        url:      'noticias.html?id=' + n.id,
        text:     [(n.titulo || ''), (n.categoria || ''), resumoPlain].join(' ').toLowerCase(),
      });
    });

    // Atletas
    var atletas = load('db_atletas', DEFAULT_ATLETAS);
    atletas.forEach(function (a) {
      index.push({
        type:     'atleta',
        title:    a.nome || '',
        subtitle: (a.posicao || '') + (a.escalao ? ' · ' + a.escalao : ''),
        url:      'atleta.html?id=' + a.id,
        text:     [(a.nome || ''), (a.posicao || ''), (a.escalao || '')].join(' ').toLowerCase(),
      });
    });

    // Escalões
    var escaloes = load('db_escaloes', DEFAULT_ESCALOES);
    escaloes.forEach(function (e) {
      index.push({
        type:     'escalao',
        title:    e.nome || '',
        subtitle: (e.designacao || '') + (e.faixa ? ' · ' + e.faixa : ''),
        url:      'escalao.html?escalao=' + encodeURIComponent(e.nome || ''),
        text:     [(e.nome || ''), (e.designacao || ''), (e.faixa || ''), (e.treinador || '')].join(' ').toLowerCase(),
      });
    });

    // Agenda
    var agenda = load('db_agenda', DEFAULT_AGENDA);
    agenda.forEach(function (ev) {
      var sub = (ev.tipo || '');
      if (ev.data) sub += ' · ' + ptDate(ev.data);
      if (ev.local) sub += ' · ' + ev.local;
      index.push({
        type:     'evento',
        title:    ev.titulo || '',
        subtitle: sub,
        url:      'agenda.html',
        text:     [(ev.titulo || ''), (ev.tipo || ''), (ev.escalao || ''), (ev.local || ''), stripHtml(ev.descricao)].join(' ').toLowerCase(),
      });
    });

    // História
    var historia = load('db_historia', DEFAULT_HISTORIA);
    historia.forEach(function (h) {
      index.push({
        type:     'historia',
        title:    h.titulo || '',
        subtitle: h.ano ? String(h.ano) : '',
        url:      'historia.html',
        text:     [(h.titulo || ''), stripHtml(h.descricao), (h.ano ? String(h.ano) : '')].join(' ').toLowerCase(),
      });
    });

    // Palmarés — type 'historia' too (links to historia.html)
    var palmares = load('db_palmares', DEFAULT_PALMARES);
    palmares.forEach(function (p) {
      var sub = (p.ano ? String(p.ano) : '') + (p.observacao ? ' · ' + p.observacao : '');
      index.push({
        type:     'historia',
        title:    (p.competicao || '') + (p.escalao ? ' — ' + p.escalao : ''),
        subtitle: sub,
        url:      'historia.html',
        text:     [(p.competicao || ''), (p.escalao || ''), (p.observacao || ''), (p.ano ? String(p.ano) : '')].join(' ').toLowerCase(),
      });
    });

    // Treinadores
    var treinadores = load('db_treinadores', DEFAULT_TREINADORES);
    treinadores.forEach(function (t) {
      index.push({
        type:     'treinador',
        title:    t.nome || '',
        subtitle: (t.cargo || '') + (t.escalao ? ' · ' + t.escalao : ''),
        url:      'formacao.html',
        text:     [(t.nome || ''), (t.cargo || ''), (t.escalao || '')].join(' ').toLowerCase(),
      });
    });

    // Vídeos
    var videos = load('db_videos', []);
    videos.forEach(function (v) {
      index.push({
        type:     'video',
        title:    v.titulo || '',
        subtitle: (v.categoria || '') + (v.data ? ' · ' + ptDate(v.data) : ''),
        url:      'videos.html',
        text:     [(v.titulo || ''), (v.categoria || ''), (v.descricao || '')].join(' ').toLowerCase(),
      });
    });

    return index;
  }

  // ------------------------------------------------------------------
  // Search
  // ------------------------------------------------------------------

  function search(query, index) {
    var words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];

    var results = index.filter(function (item) {
      return words.every(function (w) { return item.text.indexOf(w) !== -1; });
    });

    // Sort: exact title match first, then partial title, then rest
    var titleLower = query.toLowerCase().trim();
    results.sort(function (a, b) {
      var aExact = a.title.toLowerCase() === titleLower ? 0 : 1;
      var bExact = b.title.toLowerCase() === titleLower ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      var aPartial = a.title.toLowerCase().indexOf(titleLower) !== -1 ? 0 : 1;
      var bPartial = b.title.toLowerCase().indexOf(titleLower) !== -1 ? 0 : 1;
      return aPartial - bPartial;
    });

    return results;
  }

  // ------------------------------------------------------------------
  // Highlight
  // ------------------------------------------------------------------

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlight(str, words) {
    if (!str || !words || !words.length) return str || '';
    var result = str;
    words.forEach(function (w) {
      if (!w) return;
      var re = new RegExp('(' + escapeRegex(w) + ')', 'gi');
      result = result.replace(re, '<mark>$1</mark>');
    });
    return result;
  }

  // ------------------------------------------------------------------
  // Type metadata
  // ------------------------------------------------------------------

  var TYPE_META = {
    noticia:   { icon: '📰', label: 'Notícias'   },
    atleta:    { icon: '⚽', label: 'Atletas'     },
    escalao:   { icon: '👥', label: 'Escalões'    },
    evento:    { icon: '📅', label: 'Eventos'     },
    historia:  { icon: '🏆', label: 'História'    },
    treinador: { icon: '👨‍🏫', label: 'Treinadores' },
    video:     { icon: '🎥', label: 'Vídeos'      },
  };

  // Group order
  var TYPE_ORDER = ['noticia', 'atleta', 'escalao', 'evento', 'historia', 'treinador', 'video'];

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  function renderResults(query, results) {
    var container = document.getElementById('searchResults');
    var hint      = document.getElementById('searchHint');
    if (!container) return;

    if (!query.trim()) {
      container.innerHTML = '';
      if (hint) hint.style.display = '';
      return;
    }

    if (hint) hint.style.display = 'none';

    if (!results.length) {
      container.innerHTML =
        '<p class="search-empty">Nenhum resultado para "<strong>' +
        escHtml(query) + '</strong>". Tente outros termos.</p>';
      return;
    }

    var words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);

    // Group by type
    var groups = {};
    results.forEach(function (item) {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    });

    var html = '<p class="search-count">' + results.length +
      ' resultado' + (results.length !== 1 ? 's' : '') +
      ' para "<strong>' + escHtml(query) + '</strong>"</p>';

    TYPE_ORDER.forEach(function (type) {
      if (!groups[type] || !groups[type].length) return;
      var meta  = TYPE_META[type] || { icon: '', label: type };
      var items = groups[type];
      var cards = items.map(function (item) {
        return (
          '<a href="' + escHtml(item.url) + '" class="search-result">' +
            '<div class="search-result__type">' + meta.icon + ' ' + meta.label + '</div>' +
            '<div class="search-result__title">' + highlight(escHtml(item.title), words) + '</div>' +
            (item.subtitle
              ? '<div class="search-result__sub">' + highlight(escHtml(item.subtitle), words) + '</div>'
              : '') +
          '</a>'
        );
      }).join('');

      html +=
        '<div class="search-group">' +
          '<h2 class="search-group__title">' +
            meta.icon + ' ' + meta.label +
            ' <span class="search-group__count">(' + items.length + ')</span>' +
          '</h2>' +
          '<div class="search-group__items">' + cards + '</div>' +
        '</div>';
    });

    container.innerHTML = html;
  }

  function escHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------

  var _index = null;
  var _debounceTimer = null;

  function getIndex() {
    if (!_index) _index = buildIndex();
    return _index;
  }

  function runSearch(query) {
    var results = search(query, getIndex());
    renderResults(query, results);
  }

  function init() {
    var input     = document.getElementById('searchInput');
    var clearBtn  = document.getElementById('searchClear');
    if (!input) return;

    // Pre-fill from ?q= URL param
    var params = new URLSearchParams(window.location.search);
    var qParam = params.get('q') || '';
    if (qParam) {
      input.value = qParam;
      if (clearBtn) clearBtn.style.display = '';
      runSearch(qParam);
    }

    input.addEventListener('input', function () {
      var val = input.value;
      if (clearBtn) clearBtn.style.display = val ? '' : 'none';

      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(function () {
        // Update URL
        var url = new URL(window.location.href);
        if (val.trim()) {
          url.searchParams.set('q', val);
        } else {
          url.searchParams.delete('q');
        }
        history.replaceState(null, '', url.toString());
        runSearch(val);
      }, 200);
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        input.value = '';
        clearBtn.style.display = 'none';
        var url = new URL(window.location.href);
        url.searchParams.delete('q');
        history.replaceState(null, '', url.toString());
        runSearch('');
        input.focus();
      });
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        input.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        var url = new URL(window.location.href);
        url.searchParams.delete('q');
        history.replaceState(null, '', url.toString());
        runSearch('');
      }
    });
  }

  // Run after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
