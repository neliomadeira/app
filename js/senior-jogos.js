// =============================================
// SENIOR-JOGOS.JS — jogos, resultados e classificação da equipa principal
// =============================================
// Fonte única: o que o painel de administração grava na Equipa Sénior.
//   db_jogos            → os jogos com escalao === 'Seniores'
//   fpf_class_Seniores  → a classificação introduzida ou colada no painel
//   db_seniores_info    → o nome da competição e a temporada, para o cabeçalho
//   db_logos            → o mapa nome-da-equipa → logótipo
//
// Não há dados escritos à mão neste ficheiro, nem fallback com jogos ou
// classificações de exemplo: sem dados no painel, a página diz que não há.
// Um resultado que não aconteceu não se publica — o mesmo princípio que
// levou os dados inventados a sair do js/resultados.js.
//
// É independente do js/resultados.js de propósito: aquele ficheiro serve a
// página da Formação, com separadores por escalão, e tem funções que
// dependem de elementos que só existem lá (o renderClass() escreve em
// #resCompeticao sem guarda). Carregá-lo aqui era arriscar a Formação. Os
// helpers que fazem falta estão repetidos em baixo, pequenos e fechados
// neste âmbito, e as classes do CSS são as mesmas — css/resultados.css e as
// regras de tema escuro do css/styles.css — para a apresentação ser a mesma.
(function () {
  'use strict';

  var ESCALAO = 'Seniores';
  var CHAVE_CLASS = 'fpf_class_' + ESCALAO;

  var MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

  // ---- Leitura do armazém -------------------------------------------
  // Nunca escreve. Qualquer chave em falta, com JSON inválido ou com um tipo
  // inesperado dá o valor por omissão, e a página desenha o estado vazio em
  // vez de morrer a meio.
  function lerJSON(chave, omissao) {
    try {
      var cru = localStorage.getItem(chave);
      if (!cru) return omissao;
      var v = JSON.parse(cru);
      return (v === null || v === undefined) ? omissao : v;
    } catch (e) { return omissao; }
  }

  // ---- Data ---------------------------------------------------------
  // Lê-se o AAAA-MM-DD do texto em vez de new Date(str): o construtor trata
  // uma data sem hora como UTC, e num fuso a leste de Greenwich getDate()
  // pode devolver o dia anterior. O painel grava sempre AAAA-MM-DD.
  function fmtData(str) {
    var m = String(str || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    var mes = parseInt(m[2], 10);
    if (mes < 1 || mes > 12) return null;
    return { dia: m[3], mes: MESES[mes - 1], ano: m[1] };
  }

  // ---- Nomes de equipas ---------------------------------------------
  // As mesmas defesas do js/resultados.js, e pela mesma razão: os jogos dos
  // seniores podem ter entrado pela colagem, e o que vem do AF Algarve e do
  // ZeroZero traz a marca de lado "(C)"/"(F)" ao lado do nome e linhas que
  // não são equipas nenhumas, como o "h2h" da ligação frente-a-frente.
  var MARCA_LADO = /\(\s*[CF]\s*\)/ig;
  var NAO_E_EQUIPA = /^(h2h|vs|realizado|agendado|adiado|adi|anulado|anu|cancelado|can|int|interrompido|encerrado|advers[áa]rio por identificar)$/i;

  function semMarca(nome) {
    return String(nome == null ? '' : nome).replace(MARCA_LADO, '').replace(/\s{2,}/g, ' ').trim();
  }
  function marcaDe(nome) {
    var m = String(nome == null ? '' : nome).match(/\(\s*([CF])\s*\)/i);
    return m ? m[1].toUpperCase() : '';
  }
  function isSC(nome) {
    return /sport campinense|js campinense|campinense/i.test(nome || '');
  }

  // Um registo só se desenha se tiver duas equipas a sério. Em dúvida não se
  // mostra: um jogo a menos é melhor do que um jogo com "h2h" no lugar de um
  // clube.
  function jogoRenderavel(j) {
    if (!j) return false;
    var casa = semMarca(j.casa), fora = semMarca(j.fora);
    var casaOk = casa.length >= 3 || (!casa && marcaDe(j.casa));
    var foraOk = fora.length >= 3 || (!fora && marcaDe(j.fora));
    if (!casaOk || !foraOk) return false;
    if (NAO_E_EQUIPA.test(casa) || NAO_E_EQUIPA.test(fora)) return false;
    if (casa && fora && casa.toLowerCase() === fora.toLowerCase()) return false;
    return true;
  }

  // ---- Logótipos ----------------------------------------------------
  // "Quando disponíveis": o logótipo guardado no próprio jogo, senão o do
  // mapa db_logos pelo nome da equipa, senão nada — e sem nada o nome fica
  // sozinho, que é o que se vê hoje na Formação. O escudo do clube vem do
  // que o painel configurar em dados_clube.logo, com o ficheiro local como
  // recurso final, igual ao js/site-config.js.
  function logoDoClube() {
    var clube = lerJSON('dados_clube', {});
    if (clube && typeof clube.logo === 'string' && clube.logo.length > 10) return clube.logo;
    return 'images/logo.svg';
  }

  function logoEquipa(url, nome) {
    var resolvido = url;
    if (!resolvido) {
      var mapa = lerJSON('db_logos', {});
      if (mapa && typeof mapa === 'object') {
        resolvido = mapa[String(nome || '').toLowerCase()] || '';
      }
    }
    if (!resolvido && isSC(nome)) resolvido = logoDoClube();
    return resolvido
      ? '<img src="' + jscEscUrl(resolvido) + '" alt="" class="jogo-team-logo" loading="lazy"'
        + ' onerror="this.style.display=\'none\'">'
      : '';
  }

  // ---- Um jogo ------------------------------------------------------
  // As duas equipas, sempre as duas e nesta ordem — casa, depois fora —, cada
  // uma com o seu logótipo quando existe. A página da Formação mostra só o
  // adversário; aqui mostram-se as duas, que é o que a Equipa Principal pede.
  function equipasHtml(j) {
    var casa = semMarca(j.casa), fora = semMarca(j.fora);
    return ''
      + '<div class="jogo-equipas">'
      +   '<span class="jogo-equipa' + (isSC(casa) ? ' jogo-equipa--sc' : '') + '">'
      +     logoEquipa(j.logoCasa, casa) + jscEsc(casa)
      +   '</span>'
      +   '<div class="jogo-equipa-row">'
      +     '<span class="vs">vs</span>'
      +     '<span class="jogo-equipa' + (isSC(fora) ? ' jogo-equipa--sc' : '') + '">'
      +       logoEquipa(j.logoFora, fora) + jscEsc(fora)
      +     '</span>'
      +   '</div>'
      + '</div>';
  }

  // A jornada é opcional desde o painel: um jogo sem ela não tem a
  // propriedade, e aqui não produz texto nenhum — nunca "Jornada undefined"
  // nem "Jornada 0".
  function jornadaTexto(j) {
    var n = Number(j.jornada);
    return (j.jornada != null && isFinite(n) && n > 0) ? ('Jornada ' + n) : '';
  }

  // O local só conta se for um local: menos de três caracteres não é um
  // recinto, uma sigla de maiúsculas é um código, e o nome de uma das
  // equipas do jogo é o nome repetido — as três condições do
  // jogoLocalHtml() do js/resultados.js, pelas mesmas razões.
  function localTexto(j) {
    var local = String(j.local || '').trim();
    if (local.length <= 2 || /^[A-Z]{2,4}$/.test(local)) return '';
    var igual = function (outro) {
      return String(outro || '').trim().toLowerCase() === local.toLowerCase();
    };
    if (igual(j.casa) || igual(j.fora)) return '';
    return local;
  }

  function metaHtml(partes) {
    var texto = partes.filter(function (p) { return p; }).join(' · ');
    return texto ? '<div class="jogo-meta">' + jscEsc(texto) + '</div>' : '';
  }

  function dataHtml(j) {
    var d = fmtData(j.data);
    if (!d) return '<div class="jogo-data"></div>';
    return ''
      + '<div class="jogo-data">'
      +   '<div class="jogo-data__day">' + jscEsc(d.dia) + '</div>'
      +   '<div class="jogo-data__mes">' + jscEsc(d.mes) + '</div>'
      + '</div>';
  }

  // Vitória, empate ou derrota — do ponto de vista do Campinense, e só
  // quando o Campinense está no jogo. Num jogo entre terceiros mostra-se o
  // resultado sem etiqueta.
  function resultadoSC(j) {
    var scCasa = isSC(j.casa), scFora = isSC(j.fora);
    if (!scCasa && !scFora) return null;
    var gSC = Number(scCasa ? j.gcasa : j.gfora);
    var gAdv = Number(scCasa ? j.gfora : j.gcasa);
    if (!isFinite(gSC) || !isFinite(gAdv)) return null;
    if (gSC > gAdv) return 'v';
    if (gSC === gAdv) return 'e';
    return 'd';
  }

  // ---- Os jogos dos seniores ----------------------------------------
  function getJogos() {
    var todos = lerJSON('db_jogos', []);
    if (!Array.isArray(todos)) return [];
    return todos.filter(function (j) {
      return j && j.escalao === ESCALAO && jogoRenderavel(j);
    });
  }

  var porData = function (a, b) {
    return String(a.data || '').localeCompare(String(b.data || ''))
        || String(a.hora || '').localeCompare(String(b.hora || ''));
  };

  // ---- Próximos jogos -----------------------------------------------
  function renderProximos(jogos) {
    var alvo = document.getElementById('seniorProximos');
    if (!alvo) return;

    // estado !== 'Realizado', e não estado === 'Agendado': é o mesmo critério
    // do painel (renderJogosSenior), e assim um jogo com um estado que o
    // painel venha a ter nunca desaparece da página sem se dar por isso.
    var prox = jogos.filter(function (j) { return j.estado !== 'Realizado'; }).sort(porData);
    if (!prox.length) return;   // fica a mensagem que já está no HTML

    alvo.innerHTML = prox.map(function (j) {
      var hora = String(j.hora || '').trim();
      return ''
        + '<div class="jogo-item">'
        +   dataHtml(j)
        +   '<div class="jogo-divider"></div>'
        +   '<div class="jogo-info">'
        +     equipasHtml(j)
        +     metaHtml([jornadaTexto(j), localTexto(j)])
        +   '</div>'
        +   '<div class="jogo-agendado">'
        +     (hora ? '<div class="jogo-hora">' + jscEsc(hora) + '</div>' : '')
        +     '<div class="jogo-badge-prox">Agendado</div>'
        +   '</div>'
        + '</div>';
    }).join('');
  }

  // ---- Resultados ---------------------------------------------------
  function renderResultados(jogos) {
    var alvo = document.getElementById('seniorResultados');
    if (!alvo) return;

    var feitos = jogos.filter(function (j) { return j.estado === 'Realizado'; })
                      .sort(function (a, b) { return porData(b, a); });
    if (!feitos.length) return;   // fica a mensagem que já está no HTML

    alvo.innerHTML = feitos.map(function (j) {
      var res = resultadoSC(j);
      var rotulo = res === 'v' ? 'Vitória' : res === 'e' ? 'Empate' : 'Derrota';
      var gc = Number(j.gcasa), gf = Number(j.gfora);
      var placar = (isFinite(gc) && isFinite(gf)) ? (gc + '–' + gf) : '';
      return ''
        + '<div class="jogo-item">'
        +   dataHtml(j)
        +   '<div class="jogo-divider"></div>'
        +   '<div class="jogo-info">'
        +     equipasHtml(j)
        +     metaHtml([jornadaTexto(j)])
        +   '</div>'
        +   '<div class="jogo-resultado">'
        +     (placar ? '<div class="resultado-placar">' + jscEsc(placar) + '</div>' : '')
        +     (res ? '<div class="resultado-badge resultado-badge--' + jscEsc(res) + '">'
                     + jscEsc(rotulo) + '</div>' : '')
        +   '</div>'
        + '</div>';
    }).join('');
  }

  // ---- Classificação ------------------------------------------------
  // Os pontos são os mesmos que o painel mostra e que o js/resultados.js
  // calcula: V×3 + E, e o arrastado da 1.ª fase quando existe. O valor
  // gravado só ganha se for maior do que a conta, porque nesse caso já
  // inclui a 1.ª fase.
  function pontosDe(t) {
    var base = (Number(t.v) || 0) * 3 + (Number(t.e) || 0);
    return (t.pts != null && Number(t.pts) > base)
      ? Number(t.pts)
      : base + (Number(t.pts1fase) || 0);
  }

  function abrevDe(t) {
    var a = String(t.abrev || '').trim();
    if (a) return a;
    return String(t.equipa || '').trim().slice(0, 3).toUpperCase();
  }

  function renderClass() {
    var corpo = document.getElementById('seniorClassTabela');
    var wrap = document.getElementById('seniorClassWrap');
    var vazio = document.getElementById('seniorClassVazio');
    if (!corpo || !wrap || !vazio) return;

    var linhas = lerJSON(CHAVE_CLASS, []);
    if (!Array.isArray(linhas)) linhas = [];
    linhas = linhas.filter(function (t) { return t && String(t.equipa || '').trim(); });
    if (!linhas.length) return;   // fica a mensagem que já está no HTML

    var mapaLogos = lerJSON('db_logos', {});
    if (!mapaLogos || typeof mapaLogos !== 'object') mapaLogos = {};

    var ordenadas = linhas.map(function (t) {
      var sc = (t.sc === true) || isSC(t.equipa);
      var logo = t.logo || mapaLogos[String(t.equipa || '').toLowerCase()] || '';
      // A linha do clube não tem por onde resolver o logótipo quando o nome
      // foi mudado no painel: o db_logos guarda a grafia da colagem, e
      // "J.S. Campinense" não bate com a chave "js campinense".
      if (!logo && sc) logo = logoDoClube();
      return {
        equipa: String(t.equipa).trim(),
        abrev: abrevDe(t),
        j: Number(t.j) || 0, v: Number(t.v) || 0, e: Number(t.e) || 0, d: Number(t.d) || 0,
        gm: Number(t.gm) || 0, gs: Number(t.gs) || 0,
        dg: (Number(t.gm) || 0) - (Number(t.gs) || 0),
        pts: pontosDe(t), sc: sc, logo: logo,
      };
    }).sort(function (a, b) {
      return b.pts - a.pts || b.dg - a.dg || b.gm - a.gm;
    });

    corpo.innerHTML = ordenadas.map(function (t, i) {
      var pos = i + 1;
      var crachaPos = pos <= 3
        ? '<span class="pos-badge pos-badge--' + jscEsc(pos) + '">' + jscEsc(pos) + '</span>'
        : '<span>' + jscEsc(pos) + '</span>';
      var classeCracha = t.sc ? 'team-badge--sc' : 'team-badge--other';
      var emblema = t.logo
        ? '<img src="' + jscEscUrl(t.logo) + '" alt="" class="team-logo" loading="lazy"'
          + ' onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'inline-flex\'">'
          + '<span class="team-badge ' + classeCracha + '" style="display:none">' + jscEsc(t.abrev) + '</span>'
        : '<span class="team-badge ' + classeCracha + '">' + jscEsc(t.abrev) + '</span>';
      return ''
        + '<tr' + (t.sc ? ' class="sc-row"' : '') + '>'
        +   '<td class="pos-cell">' + crachaPos + '</td>'
        +   '<td><div class="team-cell">' + emblema + '<span>' + jscEsc(t.equipa) + '</span></div></td>'
        +   '<td>' + jscEsc(t.j) + '</td>'
        +   '<td>' + jscEsc(t.v) + '</td>'
        +   '<td>' + jscEsc(t.e) + '</td>'
        +   '<td>' + jscEsc(t.d) + '</td>'
        +   '<td>' + jscEsc(t.gm) + '</td>'
        +   '<td>' + jscEsc(t.gs) + '</td>'
        +   '<td>' + jscEsc(t.dg > 0 ? '+' : '') + jscEsc(t.dg) + '</td>'
        +   '<td class="pts-cell">' + jscEsc(t.pts) + '</td>'
        + '</tr>';
    }).join('');

    wrap.hidden = false;
    vazio.hidden = true;
  }

  // ---- Competição e temporada ---------------------------------------
  // O mesmo db_seniores_info que enche a barra da equipa. Campo vazio no
  // painel não produz texto: nada escrito à mão aqui.
  function renderCompeticao() {
    var alvo = document.getElementById('seniorCompeticao');
    if (!alvo) return;
    var info = lerJSON('db_seniores_info', {});
    if (!info || typeof info !== 'object') info = {};
    var partes = [info.liga, info.temporada].map(function (v) {
      return String(v == null ? '' : v).trim();
    }).filter(function (v) { return v; });
    alvo.textContent = partes.join(' · ');
  }

  function desenhar() {
    var jogos = getJogos();
    renderProximos(jogos);
    renderResultados(jogos);
    renderClass();
    renderCompeticao();
  }

  // ---- Arranque -----------------------------------------------------
  // A secção vem do HTML com as mensagens de "ainda não há" já escritas, e
  // é isso que o visitante sem JavaScript lê. Havendo dados, trocam-se.
  //
  // O jsc:synced é o evento do js/sync.js: os dados do servidor chegam
  // depois desta primeira passagem, e sem o ouvir a página ficava a mostrar
  // o que o visitante tinha de antes — ou o estado vazio, na primeira visita.
  function iniciar() {
    if (!document.getElementById('seniorCompeticoes')) return;   // outra página
    desenhar();
    document.addEventListener('jsc:synced', desenhar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
