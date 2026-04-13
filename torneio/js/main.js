// Torneio App – Main JS (navigation & scroll)
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('nav');
  hamburger?.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    nav.classList.toggle('open');
  });
  nav?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger?.classList.remove('open');
      nav?.classList.remove('open');
    });
  });
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    header?.classList.toggle('header--scrolled', window.scrollY > 60);
  }, { passive: true });
  document.head.insertAdjacentHTML('beforeend', '<style>.header--scrolled{background:rgba(0,10,30,0.99)!important}</style>');
});
