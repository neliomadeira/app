// sync.js — sincroniza dados do servidor com o localStorage
(function () {
  if (sessionStorage.getItem('jsc_sync_done')) return;

  fetch('/api/load.php', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || typeof data !== 'object' || !Object.keys(data).length) return;
      function ls(key, val) {
        if (val !== null && val !== undefined) {
          try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
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
      if (data.seniores)       ls('db_seniores',         data.seniores);
      if (data.senioresInfo)   ls('db_seniores_info',    data.senioresInfo);
      if (data.siteConfig)     ls('site_config',         data.siteConfig);
      if (data.dadosClube)     ls('dados_clube',         data.dadosClube);
      if (data.siteAviso)      ls('site_aviso',          data.siteAviso);
      if (data.siteCores)      ls('site_cores',          data.siteCores);
      sessionStorage.setItem('jsc_sync_done', '1');
      document.dispatchEvent(new CustomEvent('jsc:synced'));
    })
    .catch(function () {});
})();
