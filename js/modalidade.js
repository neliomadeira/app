(function () {
  // Havia aqui um segundo ouvinte do hamburger, igual ao do js/nav.js, que
  // esta página também carrega. Os dois alternavam as mesmas classes no mesmo
  // clique: o menu abria e fechava no mesmo instante, e nunca chegava a
  // aparecer. O aria-expanded que o nav.js escreve ficava também
  // dessincronizado do estado visível. Ficou só o do js/nav.js.

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  function ptDate(str) {
    if (!str) return '';
    const d = new Date(str + 'T00:00:00');
    return `${d.getDate()} de ${MESES[d.getMonth()]}, ${d.getFullYear()}`;
  }

  // Havia aqui um DEFAULT_MODALIDADES com três modalidades e as respectivas
  // descrições, usado quando o db_modalidades não existisse. Saiu: sem dados
  // publicados, a página diz que a modalidade não existe, em vez de mostrar
  // uma que talvez já não exista. As modalidades continuam nos dados
  // persistentes do painel — o que saiu foi a cópia no código.

  let posts = []; // partilhado com openPost

  function render() {
    // ---- Carregar modalidade ----
    const params = new URLSearchParams(window.location.search);
    const modId  = parseInt(params.get('id'));
    var rawMod   = localStorage.getItem('db_modalidades');
    var lista    = [];
    try { lista = rawMod ? JSON.parse(rawMod) : []; } catch (e) { lista = []; }
    // Uma modalidade desativada no painel deixa de estar publicada também por
    // endereço directo: antes saía da página inicial e continuava aqui,
    // completa, para quem tivesse a ligação.
    //
    // E sem nome é tratada como inexistente, pela mesma razão: a grelha
    // descarta-a, e por endereço directo abria com um título vazio.
    const m = lista.find(x => x && x.id == modId
      && jscModalidadeAtiva(x.ativo)
      && String(x.nome || '').trim() !== '');

    if (!m) {
      document.getElementById('modNome').textContent = 'Modalidade não encontrada';
      document.getElementById('modDesc').textContent = 'A modalidade solicitada não existe ou foi removida.';
      document.getElementById('modInfoSection').style.display  = 'none';
      document.getElementById('modPostsSection').style.display = 'none';
      return;
    }

    document.getElementById('modInfoSection').style.display  = '';
    document.getElementById('modPostsSection').style.display = '';

    document.title = m.nome + ' — Juventude Sport Campinense';
    document.getElementById('modIcone').textContent = m.icone || '🏅';
    document.getElementById('modNome').textContent  = m.nome;
    document.getElementById('modDesc').textContent  = m.descricao || '';

    // Hero background
    // jscUrlCss() e não o endereço cru: isto vai dentro de um url('...') de
    // CSS, e um apóstrofo no endereço fechava a função — o resto do valor
    // passava a ser CSS. Aqui usa-se a versão sem escape de HTML, porque o
    // valor é atribuído a style.backgroundImage e não passa por um parser de
    // HTML: escapá-lo transformaria um & legítimo da query em &amp;.
    const endereco = jscUrlCss(m.imagem);
    if (endereco) {
      const hero = document.getElementById('modHero');
      hero.style.backgroundImage    = `linear-gradient(rgba(0,27,77,0.72),rgba(0,27,77,0.72)),url('${endereco}')`;
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
          <div><strong>${jscEsc(i.label)}</strong><br><span>${jscEsc(i.val)}</span></div>
        </div>`
      ).join('');
    } else {
      document.getElementById('modInfoSection').style.display = 'none';
    }

    // ---- Posts ----
    const allPosts = JSON.parse(localStorage.getItem('db_mod_posts') || '[]');
    posts = allPosts
      .filter(p => p.modalidadeId == modId && p.publicada)
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    const grid = document.getElementById('modPostsGrid');

    if (!posts.length) {
      grid.innerHTML = `<p style="color:#888;text-align:center;grid-column:1/-1;padding:40px 0">
        Sem publicações de momento. Fique atento às novidades!
      </p>`;
    } else {
      grid.innerHTML = posts.map((p, i) => `
        <div class="mod-post-card" role="button" tabindex="0" data-tecla onclick="openPost(${p.id})">
          <div class="mod-post-card__img-wrap mod-post-card__img--${jscEsc((i % 3) + 1)}">
            ${p.imagem ? `<img src="${jscEscUrl(p.imagem)}" class="mod-post-card__img-el"
              style="object-fit:${jscEsc(p.imagemSize === 'contain' ? 'contain' : 'cover')};object-position:${jscEsc(p.imagemPos || 'center')}"
              alt="${jscEsc(p.titulo)}" loading="lazy" onerror="this.style.display='none'">` : ''}
          </div>
          <div class="mod-post-card__body">
            <div class="mod-post-card__date">${jscEsc(ptDate(p.data))}</div>
            <h3 class="mod-post-card__title">${jscEsc(p.titulo)}</h3>
            ${p.texto ? `<p class="mod-post-card__excerpt">${jscEsc(p.texto)}</p>` : ''}
            <span class="mod-post-card__link">Ler mais &rarr;</span>
          </div>
        </div>`).join('');
    }
  }

  render();
  // Re-renderizar quando os dados do servidor chegam (sync.js)
  document.addEventListener('jsc:synced', render);

  // ---- Overlay para ver post completo ----
  window.openPost = function (id) {
    const p = posts.find(x => x.id === id);
    if (!p) return;

    // Quem abriu isto volta a ter o foco quando isto fechar.
    const veioDe = document.activeElement;

    const ov = document.createElement('div');
    ov.id = 'postOverlay';
    ov.className = 'post-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', p.titulo || 'Publicação');
    ov.innerHTML = `
      <div class="post-overlay__panel">
        <div class="post-overlay__header">
          <span class="post-overlay__date">${jscEsc(ptDate(p.data))}</span>
          <button class="post-overlay__close" aria-label="Fechar" onclick="document.getElementById('postOverlay').remove()">&#10005;</button>
        </div>
        ${p.imagem ? `<img src="${jscEscUrl(p.imagem)}" class="post-overlay__img" alt="${jscEsc(p.titulo)}" onerror="this.style.display='none'">` : ''}
        <h2 class="post-overlay__title">${jscEsc(p.titulo)}</h2>
        <div class="post-overlay__body">${jscEsc(p.texto || '')}</div>
      </div>`;
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });

    // Escape fecha, como em qualquer caixa destas. Sem isto, quem usa
    // teclado abria a publicação e não tinha como sair.
    const porTecla = (e) => {
      if (e.key !== 'Escape') return;
      ov.remove();
    };
    document.addEventListener('keydown', porTecla);
    // Quando a caixa sai da página, desliga-se a tecla e devolve-se o foco.
    new MutationObserver((_, obs) => {
      if (document.getElementById('postOverlay')) return;
      document.removeEventListener('keydown', porTecla);
      obs.disconnect();
      if (veioDe && veioDe.focus) veioDe.focus();
    }).observe(document.body, { childList: true });

    document.body.appendChild(ov);
    ov.querySelector('.post-overlay__close').focus();
  };
})();
