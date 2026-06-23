// galeria.js — Photo gallery for JS Campinense
// Data source: localStorage key `db_galeria`
// Photo object: { id, titulo, categoria, data, url, descricao }

'use strict';

let _allPhotos = [];
let _filtered  = [];
let _lightboxIdx = 0;

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORIAS = ['Todos', 'Jogo', 'Treino', 'Conquista', 'Evento'];

const CATEGORIA_ICONS = {
  Jogo:      '⚽',
  Treino:    '🏃',
  Conquista: '🏆',
  Evento:    '🎉',
  Outro:     '📷',
};

const CATEGORIA_SLUG = {
  Jogo:      'jogo',
  Treino:    'treino',
  Conquista: 'conquista',
  Evento:    'evento',
  Outro:     'outro',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function _escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch (_) {
    return dateStr;
  }
}

// ── Load & bootstrap ──────────────────────────────────────────────────────────
function loadGaleria() {
  try {
    const raw = localStorage.getItem('db_galeria');
    _allPhotos = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(_allPhotos)) _allPhotos = [];
  } catch (_) {
    _allPhotos = [];
  }

  _filtered = _allPhotos.slice();

  renderFilters(_allPhotos);
  renderGrid(_filtered);
}

// ── Filter bar ────────────────────────────────────────────────────────────────
function renderFilters(photos) {
  const bar = document.getElementById('galeriaFilters');
  if (!bar) return;

  // Determine which categories actually have photos
  const usedCats = new Set(photos.map(p => p.categoria));

  // Always show "Todos"; only show category buttons if that category has items
  const buttons = CATEGORIAS.filter(c => c === 'Todos' || usedCats.has(c));

  bar.innerHTML = buttons.map(cat => {
    const isActive = cat === 'Todos';
    return `<button
      class="news-filter-btn${isActive ? ' news-filter-btn--active' : ''}"
      data-cat="${_escHtml(cat)}"
      type="button"
    >${_escHtml(cat)}</button>`;
  }).join('');

  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('.news-filter-btn');
    if (!btn) return;

    bar.querySelectorAll('.news-filter-btn').forEach(b => b.classList.remove('news-filter-btn--active'));
    btn.classList.add('news-filter-btn--active');

    const cat = btn.dataset.cat;
    _filtered = cat === 'Todos' ? _allPhotos.slice() : _allPhotos.filter(p => p.categoria === cat);
    renderGrid(_filtered);
  });
}

// ── Photo grid ────────────────────────────────────────────────────────────────
function renderGrid(photos) {
  const grid  = document.getElementById('galeriaGrid');
  const empty = document.getElementById('galeriaEmpty');
  if (!grid || !empty) return;

  if (!photos || photos.length === 0) {
    grid.innerHTML  = '';
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';

  grid.innerHTML = photos.map((photo, idx) => {
    const hasImg = photo.url && photo.url.trim() !== '';
    const slug   = CATEGORIA_SLUG[photo.categoria] || 'outro';
    const icon   = CATEGORIA_ICONS[photo.categoria] || '📷';
    const title  = _escHtml(photo.titulo || 'Sem título');
    const desc   = _escHtml(photo.descricao || '');

    let bgContent;
    if (hasImg) {
      bgContent = `<div class="galeria-item__bg" style="background-image:url('${_escHtml(photo.url)}')"></div>`;
    } else {
      bgContent = `
        <div class="galeria-item__bg galeria-placeholder galeria-placeholder--${slug}">
          <span class="galeria-placeholder__icon" aria-hidden="true">${icon}</span>
          <span class="galeria-placeholder__title">${title}</span>
        </div>`;
    }

    return `
      <div class="galeria-item" data-idx="${idx}" tabindex="0" role="button"
           aria-label="Ver foto: ${title}">
        ${bgContent}
        <div class="galeria-item__overlay" aria-hidden="true">
          <p class="galeria-item__overlay-title">${title}</p>
          ${desc ? `<p class="galeria-item__overlay-desc">${desc}</p>` : ''}
        </div>
      </div>`;
  }).join('');

  // Click & keyboard handlers
  grid.querySelectorAll('.galeria-item').forEach(el => {
    el.addEventListener('click', () => openLightbox(Number(el.dataset.idx)));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(Number(el.dataset.idx));
      }
    });
  });
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function _renderLightboxContent(photo) {
  const media  = document.getElementById('lbMedia');
  const badge  = document.getElementById('lbBadge');
  const title  = document.getElementById('lbTitle');
  const date   = document.getElementById('lbDate');
  const desc   = document.getElementById('lbDesc');
  const counter = document.getElementById('lbCounter');
  const prev   = document.getElementById('lbPrev');
  const next   = document.getElementById('lbNext');

  if (!media) return;

  // Media area
  if (photo.url && photo.url.trim() !== '') {
    media.innerHTML = `<img class="lightbox__img" src="${_escHtml(photo.url)}" alt="${_escHtml(photo.titulo || '')}" />`;
  } else {
    const slug = CATEGORIA_SLUG[photo.categoria] || 'outro';
    const icon = CATEGORIA_ICONS[photo.categoria] || '📷';
    media.innerHTML = `
      <div class="lightbox__placeholder galeria-placeholder galeria-placeholder--${slug}">
        <span class="lightbox__placeholder-icon" aria-hidden="true">${icon}</span>
        <span class="lightbox__placeholder-label">${_escHtml(photo.titulo || 'Sem título')}</span>
      </div>`;
  }

  // Info
  if (badge)   badge.textContent   = photo.categoria || 'Outro';
  if (title)   title.textContent   = photo.titulo    || 'Sem título';
  if (date)    date.textContent    = _formatDate(photo.data);
  if (desc)    desc.textContent    = photo.descricao || '';

  // Counter
  if (counter) counter.textContent = `${_lightboxIdx + 1} / ${_filtered.length}`;

  // Nav buttons
  if (prev) prev.disabled = _lightboxIdx === 0;
  if (next) next.disabled = _lightboxIdx === _filtered.length - 1;
}

function openLightbox(idx) {
  _lightboxIdx = idx;
  const lb = document.getElementById('lightbox');
  if (!lb) return;

  lb.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';

  _renderLightboxContent(_filtered[_lightboxIdx]);

  // Focus close button for accessibility
  const closeBtn = document.getElementById('lbClose');
  if (closeBtn) closeBtn.focus();
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (!lb) return;

  lb.setAttribute('hidden', '');
  document.body.style.overflow = '';
}

function navigateLightbox(dir) {
  const newIdx = _lightboxIdx + dir;
  if (newIdx < 0 || newIdx >= _filtered.length) return;
  _lightboxIdx = newIdx;
  _renderLightboxContent(_filtered[_lightboxIdx]);
}

// ── Event wiring ──────────────────────────────────────────────────────────────
function _wireEvents() {
  // Close button
  const closeBtn = document.getElementById('lbClose');
  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);

  // Prev / Next
  const prevBtn = document.getElementById('lbPrev');
  const nextBtn = document.getElementById('lbNext');
  if (prevBtn) prevBtn.addEventListener('click', () => navigateLightbox(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => navigateLightbox(+1));

  // Click outside (on the backdrop) to close
  const lb = document.getElementById('lightbox');
  if (lb) {
    lb.addEventListener('click', (e) => {
      // Close only when clicking directly on the backdrop, not inner content
      if (e.target === lb) closeLightbox();
    });
  }

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    const lb = document.getElementById('lightbox');
    if (!lb || lb.hasAttribute('hidden')) return;

    switch (e.key) {
      case 'Escape':
        closeLightbox();
        break;
      case 'ArrowLeft':
        navigateLightbox(-1);
        break;
      case 'ArrowRight':
        navigateLightbox(+1);
        break;
    }
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadGaleria();
  _wireEvents();
});
