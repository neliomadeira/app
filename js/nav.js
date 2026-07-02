// =============================================
// NAV — hamburger + dropdowns + scroll (all pages)
// =============================================
(function () {
  'use strict';

  function initNav() {
    // ---- ACTIVE PAGE INDICATOR ----
    var page = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav__sublink').forEach(function (link) {
      var href = link.getAttribute('href') || '';
      var linkPage = href.split('/').pop().split('#')[0];
      var isMatch = (linkPage && linkPage === page) ||
                    ((page === '' || page === 'index.html') && href.startsWith('#'));
      if (isMatch) {
        link.classList.add('nav__sublink--active');
        var toggle = link.closest('.nav__dropdown') &&
                     link.closest('.nav__dropdown').querySelector('.nav__dropdown-toggle');
        if (toggle) toggle.classList.add('nav__link--active');
      }
    });
    document.querySelectorAll('a.nav__link').forEach(function (link) {
      var href = link.getAttribute('href') || '';
      var linkPage = href.split('/').pop().split('#')[0];
      if (linkPage && linkPage === page) link.classList.add('nav__link--active');
    });

    // ---- SCROLL-AWARE NAV (hero pages only) ----
    var header = document.getElementById('header');
    if (header && document.querySelector('.hero')) {
      var THRESHOLD = 80;
      function updateNav() {
        if (window.scrollY > THRESHOLD) {
          header.classList.remove('header--transparent');
          header.classList.add('header--scrolled');
        } else {
          header.classList.remove('header--scrolled');
          header.classList.add('header--transparent');
        }
      }
      updateNav();
      window.addEventListener('scroll', updateNav, { passive: true });
    }

    // ---- HAMBURGER MENU ----
    var hamburger = document.getElementById('hamburger');
    var nav       = document.getElementById('nav');

    if (hamburger) {
      hamburger.addEventListener('click', function () {
        hamburger.classList.toggle('open');
        if (nav) nav.classList.toggle('open');
      });
    }

    // ---- DROPDOWN TOGGLES ----
    document.querySelectorAll('.nav__dropdown').forEach(function (dropdown) {
      var toggle = dropdown.querySelector('.nav__dropdown-toggle');
      if (!toggle) return;
      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = dropdown.classList.contains('open');
        document.querySelectorAll('.nav__dropdown.open').forEach(function (d) {
          d.classList.remove('open');
          var t = d.querySelector('.nav__dropdown-toggle');
          if (t) t.setAttribute('aria-expanded', 'false');
        });
        if (!isOpen) {
          dropdown.classList.add('open');
          toggle.setAttribute('aria-expanded', 'true');
        }
      });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function () {
      document.querySelectorAll('.nav__dropdown.open').forEach(function (d) {
        d.classList.remove('open');
        var t = d.querySelector('.nav__dropdown-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    });

    // ---- KEYBOARD NAVIGATION ----
    // Escape: close open dropdown
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.nav__dropdown.open').forEach(function (d) {
          d.classList.remove('open');
          var t = d.querySelector('.nav__dropdown-toggle');
          if (t) { t.setAttribute('aria-expanded', 'false'); t.focus(); }
        });
      }
    });

    // Arrow keys inside open dropdowns
    document.querySelectorAll('.nav__dropdown').forEach(function (dropdown) {
      dropdown.addEventListener('keydown', function (e) {
        if (!dropdown.classList.contains('open')) return;
        var links = Array.from(dropdown.querySelectorAll('.nav__sublink'));
        if (!links.length) return;
        var idx = links.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          links[idx + 1 < links.length ? idx + 1 : 0].focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          links[idx - 1 >= 0 ? idx - 1 : links.length - 1].focus();
        }
      });
    });

    // Close dropdown + mobile nav when a submenu link is clicked
    document.querySelectorAll('.nav__sublink').forEach(function (link) {
      link.addEventListener('click', function () {
        document.querySelectorAll('.nav__dropdown.open').forEach(function (d) {
          d.classList.remove('open');
        });
        if (hamburger) hamburger.classList.remove('open');
        if (nav) nav.classList.remove('open');
      });
    });

    // Close mobile nav on any nav link click
    if (nav) {
      nav.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          if (hamburger) hamburger.classList.remove('open');
          nav.classList.remove('open');
        });
      });
    }

    // ---- ACTIVE SECTION HIGHLIGHT (homepage only) ----
    var sections = document.querySelectorAll('section[id]');
    var navLinks = document.querySelectorAll('.nav__link');
    if (sections.length && navLinks.length && window.IntersectionObserver) {
      var sectionObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            navLinks.forEach(function (link) {
              link.classList.remove('active');
              if (link.getAttribute('href') === '#' + entry.target.id) {
                link.classList.add('active');
              }
            });
          }
        });
      }, { threshold: 0.35 });
      sections.forEach(function (s) { sectionObserver.observe(s); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNav);
  } else {
    initNav();
  }
})();
