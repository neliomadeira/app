(function () {
  // Hamburger menu
  const hamburger = document.getElementById('hamburger');
  const nav       = document.getElementById('nav');
  hamburger?.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    nav.classList.toggle('open');
  });

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  function ptDate(str) {
    if (!str) return '';
    const d = new Date(str + 'T00:00:00');
    return `${d.getDate()} de ${MESES[d.getMonth()]}, ${d.getFullYear()}`;
  }

  // ---- Carregar modalidade ----
  const params  = new URLSearchParams(window.location.search);
  const modId   = parseInt(params.get('id'));
  const lista   = JSON.parse(localStorage.getItem('db_modalidades') || '[]');
  const m       = lista.find(x => x.id == modId);

  if (!m) {
    document.getElementById('modNome').textContent = 'Modalidade não encontrada';
    document.getElementById('modDesc').textContent = 'A modalidade solicitada não existe ou foi removida.';
    document.getElementById('modInfoSection').style.display  = 'none';
    document.getElementById('modPostsSection').style.display = 'none';
    return;
  }

  document.title = m.nome + ' — Juventude Sport Campinense';
  document.getElementById('modIcone').textContent = m.icone || '🏅';
  document.getElementById('modNome').textContent  = m.nome;
  document.getElementById('modDesc').textContent  = m.descricao || '';

  // Hero background
  if (m.imagem) {
    const hero = document.getElementById('modHero');
    hero.style.backgroundImage    = `linear-gradient(rgba(0,27,77,0.72),rgba(0,27,77,0.72)),url('${m.imagem}')`;
    hero.style.backgroundSize     = 'cover';
    hero.style.backgroundPosition = m.imagemPos || 'center';
  }

  // Info bar
  const infos = [
    m.treinos     && { icon: '⏰', label: 'Treinos',      val: m.treinos },
    m.local       && { icon: '📍', label: 'Local',        val: m.local },
    m.responsavel && { icon: '👤', label: 'Responsável',  val: m.responsavel },
  ].filter(Boolean);

  const infoBar = document.getElementById('modInfoBar');
  if (infos.length) {
    infoBar.innerHTML = infos.map(i =>
      `<div class="mod-info-item">
        <span class="mod-info-item__icon">${i.icon}</span>
        <div><strong>${i.label}</strong><br><span>${i.val}</span></div>
      </div>`
    ).join('');
  } else {
    document.getElementById('modInfoSection').style.display = 'none';
  }

  // ---- Posts ----
  const allPosts = JSON.parse(localStorage.getItem('db_mod_posts') || '[]');
  const posts    = allPosts
    .filter(p => p.modalidadeId == modId && p.publicada)
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  const grid = document.getElementById('modPostsGrid');

  if (!posts.length) {
    grid.innerHTML = `<p style="color:#888;text-align:center;grid-column:1/-1;padding:40px 0">
      Sem publicações de momento. Fique atento às novidades!
    </p>`;
  } else {
    grid.innerHTML = posts.map((p, i) => `
      <div class="mod-post-card" onclick="openPost(${p.id})">
        <div class="mod-post-card__img mod-post-card__img--${(i % 3) + 1}"
             ${p.imagem ? `style="background-image:url('${p.imagem}');background-size:${p.imagemSize||'cover'};background-position:center;background-repeat:no-repeat"` : ''}>
        </div>
        <div class="mod-post-card__body">
          <div class="mod-post-card__date">${ptDate(p.data)}</div>
          <h3 class="mod-post-card__title">${p.titulo}</h3>
          ${p.texto ? `<p class="mod-post-card__excerpt">${p.texto}</p>` : ''}
          <span class="mod-post-card__link">Ler mais &rarr;</span>
        </div>
      </div>`).join('');
  }

  // ---- Overlay para ver post completo ----
  window.openPost = function (id) {
    const p = posts.find(x => x.id === id);
    if (!p) return;

    const ov = document.createElement('div');
    ov.id = 'postOverlay';
    ov.className = 'post-overlay';
    ov.innerHTML = `
      <div class="post-overlay__panel">
        <div class="post-overlay__header">
          <span class="post-overlay__date">${ptDate(p.data)}</span>
          <button class="post-overlay__close" onclick="document.getElementById('postOverlay').remove()">&#10005;</button>
        </div>
        ${p.imagem ? `<img src="${p.imagem}" class="post-overlay__img" onerror="this.style.display='none'">` : ''}
        <h2 class="post-overlay__title">${p.titulo}</h2>
        <div class="post-overlay__body">${p.texto || ''}</div>
      </div>`;
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  };
})();
