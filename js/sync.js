// sync.js — sincroniza dados do servidor com o localStorage
(function () {
  if (sessionStorage.getItem('jsc_sync_done')) return;

  fetch('/api/load.php', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || typeof data !== 'object' || !Object.keys(data).length) return;
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
      sessionStorage.setItem('jsc_sync_done', '1');
      document.dispatchEvent(new CustomEvent('jsc:synced'));

      // Conteúdo novo chegou depois de a página já ter renderizado com dados
      // antigos — recarregar uma vez para o visitante ver a versão atual.
      // jsc_sync_done (acima) garante que o reload não repete o fetch.
      if (changed && !sessionStorage.getItem('jsc_sync_reloaded')) {
        sessionStorage.setItem('jsc_sync_reloaded', '1');
        location.reload();
      }
    })
    .catch(function () {});
})();
