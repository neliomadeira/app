// sync.js — sincroniza dados do servidor com o localStorage
(function () {
  // ---- Validade de uma sincronização --------------------------------
  // Aqui havia uma marca de "feito" no sessionStorage, e era definitiva:
  //
  //     if (sessionStorage.getItem('jsc_sync_done')) return;
  //
  // O sessionStorage sobrevive a recarregamentos e a navegações durante toda a
  // vida do separador, e no iOS sobrevive também ao restauro de separadores.
  // Um telemóvel com o separador aberto há dias nunca voltava a pedir o
  // /api/load.php: ficava a desenhar o localStorage antigo para sempre. Depois
  // de Publicar no painel, o computador — separador novo — mostrava a versão
  // nova, e o telemóvel continuava a mostrar a velha. Acrescentar ?v=… ao
  // endereço parecia resolver, mas o que resolvia era abrir um separador novo,
  // com sessionStorage vazio.
  //
  // Passa a ser uma validade com prazo: ao fim de um minuto, a próxima
  // oportunidade volta a perguntar ao servidor.
  var VALIDADE_MS = 60000;

  // Depois de uma falha não se espera o minuto inteiro: tenta-se outra vez à
  // próxima oportunidade a partir de dez segundos. Sem isto, um servidor que
  // falhe uma vez ficava um minuto inteiro sem nova tentativa; com retentativa
  // imediata, um servidor em baixo levava um pedido por cada troca de
  // separador.
  var ESPERA_APOS_FALHA_MS = 10000;

  // sessionStorage e não localStorage: cada separador trata do seu, como
  // antes. Dois separadores sincronizam uma vez por minuto cada, o que é
  // barato — a projeção pública é pequena e vem com no-store.
  var MARCA_SYNC    = 'jsc_sync_em';          // instante do último sync concluído
  var MARCA_RECARGA = 'jsc_sync_recarregado'; // qual a publicação que já recarregou

  // Um pedido de cada vez. O sync é chamado no arranque, quando o separador
  // fica visível e no pageshow: sem esta guarda, três gatilhos quase
  // simultâneos davam três pedidos e três rondas de escrita.
  var aCorrer = false;

  // Publicação que merece recarregamento mas chegou com o separador escondido.
  // Recarregar um separador em segundo plano é trabalho perdido e, quando o
  // visitante volta a ele, apanha-o a meio. Fica à espera de ficar visível.
  var recargaPendente = null;

  function sStorage(fn, omissao) {
    try { return fn(); } catch (_) { return omissao; }
  }

  // ---- Não tocar no armazém do painel -------------------------------
  // O painel guarda o que está a ser escrito SÓ aqui, no localStorage deste
  // browser, e partilha a mesma origem — e portanto o mesmo localStorage — com
  // o site público. Enquanto o /api/load.php devolvia o ficheiro inteiro isso
  // era inofensivo: o que este ficheiro escrevia era igual ao que o painel
  // tinha. Deixou de ser, agora que o endpoint devolve só a projeção pública:
  //
  //   1. escrevem-se 3 notícias no painel, ainda sem publicar  → 24 no armazém
  //   2. na mesma aba, abre-se o noticias.html para ver como ficou
  //   3. isto corria, pedia a projeção pública                 → 21
  //   4. e sobrepunha o armazém                    → OS 3 RASCUNHOS PERDIDOS
  //   5. Publicar  →  apagava-os também do servidor
  //
  // Daí esta guarda. Num browser usado como painel, o localStorage é a cópia
  // de trabalho de quem escreve, e não se mexe nela.
  //
  // O visitante desse browser não perde nada: as páginas públicas são servidas
  // já escritas pelo servidor (E1 e E2), e o jsc_publicado_em fica como está,
  // logo os blocos gerados contam como atuais e é o HTML do servidor que se vê.
  //
  // Para voltar a sincronizar num browser que já foi painel:
  //     localStorage.removeItem('jsc_painel_local')
  function ehPainel() {
    try {
      return localStorage.getItem('jsc_painel_local') === '1';
    } catch (_) {
      // sem localStorage não há nada a proteger nem a escrever: segue, como
      // sempre seguiu. O ls() falha em silêncio e o jsc:synced ainda sai.
      return false;
    }
  }

  function atual() {
    var t = Number(sStorage(function () { return sessionStorage.getItem(MARCA_SYNC); }, 0)) || 0;
    return t > 0 && (Date.now() - t) < VALIDADE_MS;
  }

  function marcar(instante) {
    sStorage(function () { return sessionStorage.setItem(MARCA_SYNC, String(instante)); });
  }

  function visivel() {
    return typeof document.visibilityState !== 'string' || document.visibilityState === 'visible';
  }

  // Recarrega uma vez por publicação, nunca duas. A guarda é a própria marca
  // da publicação, e não um "já recarreguei nesta sessão": assim uma segunda
  // publicação no mesmo separador também chega ao visitante, e a mesma
  // publicação nunca provoca um segundo recarregamento — que era o caminho
  // para um ciclo infinito.
  function recarregar(publicadoEm) {
    // Conteúdo sem marca de publicação — um db.json que nunca passou pela
    // transação — recarrega uma vez por separador, como antes.
    var chave = publicadoEm || 'sem-marca';
    if (!visivel()) { recargaPendente = chave; return; }
    var feito = sStorage(function () { return sessionStorage.getItem(MARCA_RECARGA); }, null);
    if (feito === chave) return;
    sStorage(function () { return sessionStorage.setItem(MARCA_RECARGA, chave); });
    recargaPendente = null;
    location.reload();
  }

  function sincronizar() {
    if (aCorrer || ehPainel() || atual()) return;
    aCorrer = true;

    fetch('/api/load.php', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || typeof data !== 'object' || !Object.keys(data).length) {
          marcar(Date.now() - VALIDADE_MS + ESPERA_APOS_FALHA_MS);
          return;
        }
        var changed = false;
        function ls(key, val) {
          if (val !== null && val !== undefined) {
            try {
              var json = JSON.stringify(val);
              if (localStorage.getItem(key) !== json) {
                localStorage.setItem(key, json);
                changed = true;
              }
            } catch (_) {}
          }
        }
        // Quando foi publicado este conteúdo. Fica guardado à parte e de
        // propósito fora do ls(): muda a cada publicação, e contá-lo como
        // alteração forçaria um recarregamento por sessão sem haver nada de
        // novo para mostrar. É por esta marca que o js/main.js sabe se o
        // bloco que o servidor já escreveu no HTML está atual.
        var publicadoEm = typeof data.publicadoEm === 'string' ? data.publicadoEm : '';
        if (publicadoEm) {
          try { localStorage.setItem('jsc_publicado_em', publicadoEm); } catch (_) {}
        }
        if (data.noticias)       ls('jsc_noticias',       data.noticias);
        if (data.agenda)         ls('db_agenda',           data.agenda);
        if (data.galeria)        ls('db_galeria',          data.galeria);
        if (data.videos)         ls('db_videos',           data.videos);
        if (data.atletas)        ls('db_atletas',          data.atletas);
        if (data.escaloes)       ls('db_escaloes',         data.escaloes);
        if (data.treinadores)    ls('db_treinadores',      data.treinadores);
        if (data.patrocinadores) ls('db_patrocinadores',   data.patrocinadores);
        if (data.modalidades)    ls('db_modalidades',      data.modalidades);
        if (data.modPosts)       ls('db_mod_posts',        data.modPosts);
        if (data.jogos)          ls('db_jogos',            data.jogos);
        if (data.historia)       ls('db_historia',         data.historia);
        if (data.palmares)       ls('db_palmares',         data.palmares);
        if (data.seniores)       ls('db_seniores',         data.seniores);
        if (data.senioresInfo)   ls('db_seniores_info',    data.senioresInfo);
        if (data.siteConfig)     ls('site_config',         data.siteConfig);
        if (data.dadosClube)     ls('dados_clube',         data.dadosClube);
        if (data.sitePopup)      ls('site_popup',          data.sitePopup);
        if (data.siteBanner)     ls('site_banner',         data.siteBanner);
        if (data.siteAviso)      ls('site_aviso',          data.siteAviso);
        if (data.siteCores)      ls('site_cores',          data.siteCores);
        if (data.siteLegal)      ls('site_legal',          data.siteLegal);
        if (data.emailConfig)    ls('email_config',        data.emailConfig);
        if (data.fbPosts)        ls('fb_posts',            data.fbPosts);
        if (data.logos)          ls('db_logos',            data.logos);
        if (data.classConfig)    ls('fpf_sync_config',     data.classConfig);
        if (data.classData && typeof data.classData === 'object') {
          Object.keys(data.classData).forEach(function (k) {
            if (k.indexOf('fpf_class_') === 0 || k.indexOf('fpf_jogos_') === 0) {
              ls(k, data.classData[k]);
            }
          });
        }
        marcar(Date.now());
        // As páginas que se desenham em JavaScript ouvem isto e redesenham-se
        // sem recarregar: modalidade.js, galeria.js, historia.js,
        // patrocinadores.js, videos.js, senior-posts.js, seo.js e main.js.
        document.dispatchEvent(new CustomEvent('jsc:synced'));

        // Conteúdo novo chegou depois de a página já ter renderizado com dados
        // antigos — recarregar uma vez para o visitante ver a versão atual.
        // Serve as regiões que o servidor escreveu no HTML, que não têm como
        // ouvir o evento.
        if (changed) recarregar(publicadoEm);
      })
      .catch(function () {
        marcar(Date.now() - VALIDADE_MS + ESPERA_APOS_FALHA_MS);
      })
      .then(function () { aCorrer = false; });
  }

  // ---- Gatilhos ------------------------------------------------------
  // No arranque, como sempre.
  sincronizar();

  // Quando o separador volta a ficar à frente. É este o gatilho que trata do
  // telemóvel: o separador fica semanas aberto, e ao ser trazido de volta
  // pergunta ao servidor em vez de confiar no que tem.
  document.addEventListener('visibilitychange', function () {
    if (!visivel()) return;
    if (recargaPendente) { recarregar(recargaPendente); return; }
    sincronizar();
  });

  // Inclui o restauro pela bfcache, onde não há arranque nenhum: o Safari
  // devolve a página exactamente como estava, scripts já corridos, e sem isto
  // nada voltaria a perguntar ao servidor.
  window.addEventListener('pageshow', function () { sincronizar(); });
})();
