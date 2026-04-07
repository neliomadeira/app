// =============================================
// FACEBOOK FEED — Juventude Sport Campinense
// Suporta dois modos:
//   1. Posts guardados manualmente no admin (sem API key)
//   2. Graph API automático (requer Page Access Token)
// =============================================

const FB_CONFIG = {
  // URL da página de Facebook do clube
  pageUrl: 'https://www.facebook.com/juventudeSportCampinense',

  // Número de posts a mostrar no site
  maxPosts: 6,

  // --- MODO AUTOMÁTICO (opcional) ---
  // Preencha com o seu Page Access Token (obtido em developers.facebook.com)
  // Se vazio, usa os posts guardados manualmente no admin
  accessToken: '',
  pageId: '',
};

// ─── ARMAZENAMENTO LOCAL DOS POSTS ──────────────────────────────────────────
// Quando não há API token, os posts são geridos manualmente no Admin → Facebook
function getPostsGuardados() {
  try {
    return JSON.parse(localStorage.getItem('fb_posts') || '[]');
  } catch { return []; }
}

// ─── RENDERIZAÇÃO ────────────────────────────────────────────────────────────
function renderFbFeed(posts) {
  const feed = document.getElementById('fbFeed');
  const loading = document.getElementById('fbLoading');
  if (loading) loading.style.display = 'none';

  if (!posts || !posts.length) {
    feed.innerHTML = `
      <div class="fb-empty">
        <p>Ainda sem publicações. Configure a ligação ao Facebook no painel admin.</p>
        <a href="${FB_CONFIG.pageUrl}" target="_blank" rel="noopener" class="btn btn--fb" style="display:inline-flex;gap:8px;margin-top:16px">
          Visitar página
        </a>
      </div>`;
    return;
  }

  feed.innerHTML = `<div class="fb-grid">${posts.slice(0, FB_CONFIG.maxPosts).map(renderPost).join('')}</div>`;
}

function renderPost(post) {
  const data = post.data ? formatData(post.data) : '';
  const tipo = post.tipo || 'texto';
  const tipoIcon = { foto: '📷', video: '▶️', link: '🔗', texto: '📝' }[tipo] || '📝';
  const tipoLabel = { foto: 'Foto', video: 'Vídeo', link: 'Partilha', texto: 'Publicação' }[tipo] || 'Publicação';
  const imgHtml = post.imagem
    ? `<div class="fb-card__img" style="background-image:url('${post.imagem}')"></div>`
    : `<div class="fb-card__img fb-card__img--placeholder"><span>${tipoIcon}</span></div>`;

  return `
    <a class="fb-card" href="${post.url || FB_CONFIG.pageUrl}" target="_blank" rel="noopener">
      ${imgHtml}
      <div class="fb-card__body">
        <div class="fb-card__meta">
          <span class="fb-card__tipo">${tipoLabel}</span>
          ${data ? `<time class="fb-card__data">${data}</time>` : ''}
        </div>
        <p class="fb-card__texto">${truncar(post.texto || '', 160)}</p>
        <span class="fb-card__link">Ver publicação →</span>
      </div>
      ${post.likes ? `<div class="fb-card__reactions">❤️ ${post.likes}</div>` : ''}
    </a>`;
}

// ─── GRAPH API (automático) ───────────────────────────────────────────────────
async function carregarViaAPI() {
  if (!FB_CONFIG.accessToken || !FB_CONFIG.pageId) return null;
  try {
    const fields = 'message,story,full_picture,permalink_url,created_time,attachments,reactions.summary(true)';
    const url = `https://graph.facebook.com/v19.0/${FB_CONFIG.pageId}/posts?fields=${fields}&limit=10&access_token=${FB_CONFIG.accessToken}`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);

    return (json.data || []).map(p => {
      const att  = p.attachments?.data?.[0];
      const tipo = att?.type?.includes('video') ? 'video'
                 : att?.type?.includes('photo') || p.full_picture ? 'foto'
                 : att?.type?.includes('share') ? 'link'
                 : 'texto';
      return {
        id:     p.id,
        texto:  p.message || p.story || '',
        imagem: p.full_picture || att?.media?.image?.src || '',
        url:    p.permalink_url,
        data:   p.created_time,
        tipo,
        likes:  p.reactions?.summary?.total_count || 0,
      };
    });
  } catch (e) {
    console.warn('[Facebook]', e.message);
    return null;
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function formatData(str) {
  try {
    return new Date(str).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return str; }
}

function truncar(str, n) {
  if (!str) return '';
  str = str.replace(/\n+/g, ' ');
  return str.length > n ? str.slice(0, n) + '…' : str;
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
(async function init() {
  // Tenta Graph API primeiro
  let posts = await carregarViaAPI();

  // Fallback: posts guardados manualmente
  if (!posts) posts = getPostsGuardados();

  renderFbFeed(posts);
})();
