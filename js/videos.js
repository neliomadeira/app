// videos.js — YouTube video gallery for JS Campinense
// Data source: localStorage key `db_videos`
// Video object: { id, titulo, categoria, data, url, descricao }

'use strict';

let _allVideos  = [];
let _filtered   = [];
let _modalIdx   = 0;

const VID_CATS = ['Todos', 'Golos', 'Melhores Momentos', 'Entrevistas', 'Treino', 'Jogo'];

function _escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _ytId(url) {
  if (!url) return '';
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : '';
}

function _ytThumb(id) {
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
}

function _ytEmbed(id) {
  return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
}

function _formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return isNaN(d) ? dateStr : d.toLocaleDateString('pt-PT', { day:'2-digit', month:'long', year:'numeric' });
  } catch(_) { return dateStr; }
}

// ── Load ──────────────────────────────────────────────────────────────────────
function loadVideos() {
  try {
    const raw = localStorage.getItem('db_videos');
    _allVideos = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(_allVideos)) _allVideos = [];
  } catch(_) { _allVideos = []; }

  _filtered = _allVideos.slice();
  renderFilters(_allVideos);
  renderGrid(_filtered);
}

// ── Filters ───────────────────────────────────────────────────────────────────
function renderFilters(videos) {
  const bar = document.getElementById('videosFilters');
  if (!bar) return;

  const usedCats = new Set(videos.map(v => v.categoria));
  const visible  = VID_CATS.filter(c => c === 'Todos' || usedCats.has(c));

  bar.innerHTML = visible.map(cat =>
    `<button class="news-filter-btn${cat === 'Todos' ? ' news-filter-btn--active' : ''}"
      data-cat="${_escHtml(cat)}" type="button">${_escHtml(cat)}</button>`
  ).join('');

  bar.addEventListener('click', e => {
    const btn = e.target.closest('.news-filter-btn');
    if (!btn) return;
    bar.querySelectorAll('.news-filter-btn').forEach(b => b.classList.remove('news-filter-btn--active'));
    btn.classList.add('news-filter-btn--active');
    const cat = btn.dataset.cat;
    _filtered = cat === 'Todos' ? _allVideos.slice() : _allVideos.filter(v => v.categoria === cat);
    renderGrid(_filtered);
  });
}

// ── Grid ──────────────────────────────────────────────────────────────────────
function renderGrid(videos) {
  const grid  = document.getElementById('videosGrid');
  const empty = document.getElementById('videosEmpty');
  if (!grid || !empty) return;

  if (!videos || videos.length === 0) {
    grid.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = videos.map((v, idx) => {
    const id    = _ytId(v.url);
    const thumb = _ytThumb(id);
    const title = _escHtml(v.titulo || 'Sem título');
    const cat   = _escHtml(v.categoria || '');

    return `
      <div class="video-card" data-idx="${idx}" tabindex="0" role="button" aria-label="Ver vídeo: ${title}">
        <div class="video-card__thumb">
          ${thumb
            ? `<img src="${thumb}" alt="${title}" class="video-card__img" loading="lazy" />`
            : `<div class="video-card__no-thumb">&#127909;</div>`
          }
          <div class="video-card__play" aria-hidden="true">&#9654;</div>
          ${cat ? `<span class="video-card__cat">${cat}</span>` : ''}
        </div>
        <div class="video-card__body">
          <p class="video-card__title">${title}</p>
          <p class="video-card__date">${_formatDate(v.data)}</p>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.video-card').forEach(el => {
    el.addEventListener('click', () => openModal(Number(el.dataset.idx)));
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(Number(el.dataset.idx)); }
    });
  });
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(idx) {
  _modalIdx = idx;
  const v   = _filtered[idx];
  const id  = _ytId(v?.url);
  const modal = document.getElementById('videoModal');
  if (!modal) return;

  const frame = document.getElementById('videoFrame');
  if (frame) frame.src = id ? _ytEmbed(id) : '';

  const titleEl = document.getElementById('vmTitle');
  const dateEl  = document.getElementById('vmDate');
  const descEl  = document.getElementById('vmDesc');
  const catEl   = document.getElementById('vmCat');
  if (titleEl) titleEl.textContent = v?.titulo || '';
  if (dateEl)  dateEl.textContent  = _formatDate(v?.data);
  if (descEl)  descEl.textContent  = v?.descricao || '';
  if (catEl)   catEl.textContent   = v?.categoria || '';

  modal.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
  document.getElementById('vmClose')?.focus();
}

function closeModal() {
  const modal = document.getElementById('videoModal');
  if (!modal) return;
  const frame = document.getElementById('videoFrame');
  if (frame) frame.src = '';          // stop playback
  modal.setAttribute('hidden', '');
  document.body.style.overflow = '';
}

// ── Events ────────────────────────────────────────────────────────────────────
function _wireEvents() {
  document.getElementById('vmClose')?.addEventListener('click', closeModal);
  const modal = document.getElementById('videoModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => {
    const m = document.getElementById('videoModal');
    if (!m || m.hasAttribute('hidden')) return;
    if (e.key === 'Escape') closeModal();
  });
}

document.addEventListener('DOMContentLoaded', () => { loadVideos(); _wireEvents(); });
