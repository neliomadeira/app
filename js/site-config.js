// =============================================
// SITE CONFIG — aplica configurações do admin
// =============================================
(function () {
  // ---- MODO MANUTENÇÃO ----
  const path = window.location.pathname;
  const isAdmin = path.includes('/admin');
  const isManu  = path.includes('manutencao');
  if (!isAdmin && !isManu) {
    const manu = JSON.parse(localStorage.getItem('site_manutencao') || '{}');
    if (manu.ativo) {
      window.location.replace('manutencao.html');
      return;
    }
  }

  // ---- TEMA / CORES PERSONALIZADAS (templates do admin) ----
  (function () {
    try {
      const cores = JSON.parse(localStorage.getItem('site_cores') || '{}');
      if (!cores.azul && !cores.amarelo) return;
      const hex = (h) => {
        h = (h || '').replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const n = parseInt(h, 16);
        return h.length === 6 && !isNaN(n) ? [n >> 16 & 255, n >> 8 & 255, n & 255] : null;
      };
      const mix = (rgb, alvo, p) => rgb.map((c, i) => Math.round(c + (alvo[i] - c) * p));
      const css = (rgb) => '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
      const root = document.documentElement.style;
      const azul = hex(cores.azul);
      if (azul) {
        root.setProperty('--blue',      css(azul));
        root.setProperty('--blue-dark', css(mix(azul, [0, 0, 0], 0.25)));
        root.setProperty('--blue-bg',   css(mix(azul, [0, 0, 0], 0.45)));
        root.setProperty('--blue-mid',  css(mix(azul, [255, 255, 255], 0.18)));
      }
      const amarelo = hex(cores.amarelo);
      if (amarelo) {
        root.setProperty('--yellow',       css(amarelo));
        root.setProperty('--yellow-dark',  css(mix(amarelo, [0, 0, 0], 0.12)));
        root.setProperty('--yellow-light', css(mix(amarelo, [255, 255, 255], 0.2)));
      }
    } catch (e) {}
  })();

  function set(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== '') el.textContent = val;
  }
  // Os dois textos que entram como HTML — o título do herói e a morada —
  // precisam do <br> e do <span>, e por isso não podem ir por textContent. O
  // filtro a sério está no servidor (jsc_sanitizar_inline, em api/save.php),
  // antes de gravar; o jscHtmlSeguro() é a segunda linha, para o caso de o
  // valor chegar ao browser por outro caminho que não a publicação.
  function setHtml(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== '') el.innerHTML = jscHtmlSeguro(val);
  }
  // Um endereço do painel nunca vai directo para um href: um "javascript:..."
  // corria ao primeiro clique. O jscHrefSeguro() devolve '' aos esquemas que não
  // são http, https, mailto, tel ou relativos.
  function setHref(id, val) {
    const el = document.getElementById(id);
    const seguro = jscHrefSeguro(val);
    if (el && seguro) el.href = seguro;
  }
  function setAttr(id, attr, val) {
    const el = document.getElementById(id);
    if (el && val) el.setAttribute(attr, val);
  }

  // Club identity — independente de site_config, corre sempre
  const clube = JSON.parse(localStorage.getItem('dados_clube') || '{}');
  if (clube.logo && clube.logo.length > 10) {
    document.querySelectorAll('.logo__img').forEach(function(el) {
      el.onerror = function() { this.src = 'images/logo.svg'; this.onerror = null; };
      el.src = clube.logo;
    });
    const emblem = document.querySelector('.about__emblem-large');
    if (emblem) {
      emblem.onerror = function() { this.src = 'images/logo.svg'; this.onerror = null; };
      emblem.src = clube.logo;
    }
  }
  if (clube.navNome) document.querySelectorAll('.logo__name').forEach(el => { el.textContent = clube.navNome; });
  if (clube.navSub)  document.querySelectorAll('.logo__sub').forEach(el => { el.textContent = clube.navSub; });

  const cfg = JSON.parse(localStorage.getItem('site_config') || '{}');
  if (!Object.keys(cfg).length) return;

  // Hero
  set('heroTag',  cfg.heroTag);
  setHtml('heroTitle', cfg.heroTitle);
  set('heroDesc', cfg.heroDesc);

  // Hero background image (ignorado se slideshow ativo — main.js trata disso)
  if (cfg.heroImagem && !cfg.heroSlideshow) {
    const hero = document.querySelector('.hero');
    if (hero) {
      // Três valores do painel entravam crus numa declaração de CSS:
      //   heroOverlay  dentro de rgba() — com "0.5),rgb(0,0,255" acrescentava
      //                paradas de cor ao gradiente. Injecção medida.
      //   heroImagem   dentro de url('...') — um apóstrofo num nome de ficheiro
      //                legítimo invalidava a declaração inteira e o herói
      //                perdia a imagem. Medido.
      //   heroImgPos   em backgroundPosition — um valor inválido resolvia
      //                silenciosamente para 0% 0% em vez de center.
      // O jscEscUrlCss()/jscUrlCss() é o mesmo que os Blocos 5, 6 e 7 já usam
      // em todas as outras imagens de CSS do site.
      const opacity = jscOpacidade(cfg.heroOverlay, '0.7');
      const pos     = jscPosicaoFundo(cfg.heroImgPos, 'center');
      const imagem  = jscUrlCss(cfg.heroImagem);
      if (!imagem) return;   // endereço recusado: fica o gradiente do CSS
      hero.style.backgroundImage    = `linear-gradient(rgba(0,27,77,${opacity}),rgba(0,27,77,${opacity})),url('${imagem}')`;
      hero.style.backgroundSize     = 'cover';
      hero.style.backgroundPosition = pos;
      hero.style.backgroundRepeat   = 'no-repeat';
    }
  }

  // Stats
  //
  // Uma estatística sem número não é desenhada. Duas das quatro — "300+
  // Atletas" e "80+ Títulos" — deixaram de ter valor, porque os números não têm
  // fonte confirmada e o clube decidiu não os publicar. O lugar continua a
  // existir e continua administrável: basta guardar um valor no painel para
  // aparecer. O que não acontece é um cartão vazio ficar na barra.
  //
  // A regra é a mesma para as quatro, num sítio só: se não houver número, o
  // cartão fica escondido, e se houver, aparece. Sem JavaScript vale o que o
  // HTML traz — e os dois que não têm valor já vêm com hidden.
  function estatistica(n) {
    var cartao = document.getElementById('stat' + n);
    var num = cfg['stat' + n + 'Num'];
    set('stat' + n + 'Num',   num);
    set('stat' + n + 'Label', cfg['stat' + n + 'Label']);
    if (!cartao) return;
    var texto = (document.getElementById('stat' + n + 'Num') || {}).textContent || '';
    if (texto.trim() === '') cartao.setAttribute('hidden', '');
    else cartao.removeAttribute('hidden');
  }
  estatistica(1); estatistica(2); estatistica(3); estatistica(4);

  // Sobre
  set('aboutText1', cfg.aboutText1);
  set('aboutText2', cfg.aboutText2);
  set('aboutEst',   cfg.aboutEst);
  set('aboutMotto', cfg.aboutMotto);
  set('aboutVal1Title', cfg.aboutVal1Title);
  set('aboutVal1Desc',  cfg.aboutVal1Desc);
  set('aboutVal2Title', cfg.aboutVal2Title);
  set('aboutVal2Desc',  cfg.aboutVal2Desc);
  set('aboutVal3Title', cfg.aboutVal3Title);
  set('aboutVal3Desc',  cfg.aboutVal3Desc);

  // Contacto
  setHtml('contactAddress', cfg.contactAddress);
  set('contactPhone',   cfg.contactPhone);
  set('contactEmail',   cfg.contactEmail);
  set('contactHours',   cfg.contactHours);

  // Redes sociais — abre em nova tab, popula contact section + footer
  // Sem endereço válido o botão NÃO aparece. Antes ficava com href="#" — eram
  // 54 ligações mortas em 16 páginas, porque não há endereços por omissão. E o
  // endereço passa pela política de esquemas: um "javascript:..." guardado no
  // painel ficava no href de seis botões por página.
  function setSocial(id, url) {
    const el = document.getElementById(id);
    if (!el) return;
    const seguro = jscHrefSeguro(url);
    if (!seguro) { el.setAttribute('hidden', ''); return; }
    el.href = seguro;
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
    el.removeAttribute('hidden');
  }
  const waUrl = cfg.socialWhatsappUrl ? 'https://wa.me/' + cfg.socialWhatsappUrl.replace(/\D/g,'') : null;
  setSocial('socialInstagram',       cfg.socialInstagramUrl);
  setSocial('socialFacebook',        cfg.socialFacebookUrl);
  setSocial('socialWhatsapp',        waUrl);
  setSocial('footerSocialInstagram', cfg.socialInstagramUrl);
  setSocial('footerSocialFacebook',  cfg.socialFacebookUrl);
  setSocial('footerSocialWhatsapp',  waUrl);
  // Botão "Ver página no Facebook" na secção de feed
  if (cfg.socialFacebookUrl) {
    setSocial('fbSectionLink', cfg.socialFacebookUrl);
  }

  // Footer
  set('footerEmail', cfg.footerEmail);

  // Contactos em todo o site.
  //
  // Antes isto só chegava a elementos com id, e o rodapé está copiado em 17
  // páginas: mudar o telefone no painel actualizava 2 dos 19 sítios onde ele
  // aparece, e o email 17 de 23. O que sobrava ficava com o valor antigo,
  // sem nada a indicar porquê.
  function aplicar(seletor, valor, prefixoHref) {
    if (!valor) return;
    document.querySelectorAll(seletor).forEach(function (el) {
      el.textContent = valor;
      if (prefixoHref && el.tagName === 'A') el.href = prefixoHref + valor.replace(/\s+/g, '');
    });
  }
  aplicar('.js-email',    cfg.contactEmail);
  aplicar('.js-telefone', cfg.contactPhone);
  // A morada leva um <br> entre a rua e o código postal — é assim que o valor
  // por omissão do painel está escrito, e é assim que a página de contacto o
  // mostra. Aqui usava-se textContent, e o rodapé de 17 páginas mostrava a
  // etiqueta "<br />" como texto visível. Medido.
  if (cfg.contactAddress) {
    const morada = jscHtmlSeguro(cfg.contactAddress);
    document.querySelectorAll('.js-morada').forEach(function (el) { el.innerHTML = morada; });
  }

  // Os mailto:/tel: em texto corrido — a página de privacidade tem três —
  // precisam do href actualizado, não só do texto.
  if (cfg.contactEmail) {
    document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
      if (/@/.test(a.textContent)) a.textContent = cfg.contactEmail;
      a.href = 'mailto:' + cfg.contactEmail;
    });
  }
  if (cfg.contactPhone) {
    document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
      if (/\d/.test(a.textContent)) a.textContent = cfg.contactPhone;
      a.href = 'tel:' + cfg.contactPhone.replace(/\s+/g, '');
    });
  }
  if (cfg.footerTagline) {
    document.querySelectorAll('.footer__tagline').forEach(el => { el.textContent = cfg.footerTagline; });
  }

  // Hero buttons
  if (cfg.heroBtn1Text) {
    const bt1 = document.getElementById('heroBt1');
    if (bt1) bt1.textContent = cfg.heroBtn1Text;
  }
  // Pelo setHref(), que aplica a política de esquemas. Estava aqui uma
  // atribuição directa, e um "javascript:..." guardado no painel corria ao
  // primeiro clique no botão do herói.
  setHref('heroBt1', cfg.heroBtn1Url);
  if (cfg.heroBtn2Text) {
    const bt2 = document.getElementById('heroBt2');
    if (bt2) bt2.textContent = cfg.heroBtn2Text;
  }
  setHref('heroBt2', cfg.heroBtn2Url);

  // SEO — SÓ da página inicial.
  //
  // Isto aplicava-se às 16 páginas que carregam este ficheiro. Preencher os dois
  // campos do painel punha o mesmo <title> e a mesma descrição na História, nas
  // Notícias, no Contacto e na Formação — 16 títulos distintos colapsados num
  // só, que é o pior caso possível de conteúdo duplicado. Medido.
  //
  // O reconhecimento é por uma marca explícita no <body> da página inicial, e
  // não por um id que lá esteja por acaso: se amanhã a secção "Sobre"
  // desaparecer, o título da página inicial continua a ser administrável.
  const daInicial = document.body.getAttribute('data-pagina') === 'inicial';
  if (daInicial) {
    if (cfg.seoTitle) document.title = cfg.seoTitle;
    if (cfg.seoDesc) {
      let meta = document.getElementById('metaDesc');
      if (!meta) meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', cfg.seoDesc);
    }
  }


  // ---- ANNOUNCEMENT BANNER ----
  (function () {
    const banner = JSON.parse(localStorage.getItem('site_banner') || '{}');
    if (!banner.ativo || !banner.texto) return;
    const sessKey = 'banner_dismissed_' + (banner.texto || '').slice(0, 20);
    if (sessionStorage.getItem(sessKey)) return;
    const tipo = banner.tipo || 'info';
    const el = document.createElement('div');
    el.className = `site-banner site-banner--${tipo}`;
    el.setAttribute('role', 'alert');
    el.innerHTML = `<p class="site-banner__text">${jscEsc(banner.texto)}${
      banner.link && banner.linkTexto
        ? ` <a class="site-banner__link" href="${jscEscUrl(banner.link)}">${jscEsc(banner.linkTexto)}</a>`
        : ''
    }</p><button class="site-banner__close" aria-label="Fechar" onclick="
      this.closest('.site-banner').classList.remove('site-banner--visible');
      document.body.classList.remove('has-banner');
      sessionStorage.setItem('${sessKey}', '1');
    ">&times;</button>`;
    document.body.insertAdjacentElement('afterbegin', el);
    document.body.classList.add('has-banner');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('site-banner--visible')));
  })();

  // Map — update iframe from stored coordinates or geocode address on the fly
  function applyMapCoords(lat, lon) {
    const d   = 0.015;
    const src = `https://www.openstreetmap.org/export/embed.html?bbox=${(lon-d).toFixed(4)}%2C${(lat-d).toFixed(4)}%2C${(lon+d).toFixed(4)}%2C${(lat+d).toFixed(4)}&layer=mapnik&marker=${lat}%2C${lon}`;
    setAttr('contactMapIframe', 'src', src);
    const link = document.getElementById('contactMapLink');
    if (link) link.href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
  }

  if (cfg.contactLat && cfg.contactLon) {
    const lat = parseFloat(cfg.contactLat);
    const lon = parseFloat(cfg.contactLon);
    if (!isNaN(lat) && !isNaN(lon)) applyMapCoords(lat, lon);
  } else if (cfg.contactAddress && document.getElementById('contactMapIframe')) {
    // No stored coordinates — geocode address from the browser
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cfg.contactAddress)}&format=json&limit=1&countrycodes=pt`,
      { headers: { 'Accept': 'application/json' } })
      .then(r => r.json())
      .then(data => {
        if (data && data.length) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          applyMapCoords(lat, lon);
          // Cache coordinates so next load is instant
          try {
            const stored = JSON.parse(localStorage.getItem('site_config') || '{}');
            stored.contactLat = lat.toFixed(6);
            stored.contactLon = lon.toFixed(6);
            localStorage.setItem('site_config', JSON.stringify(stored));
          } catch(_) {}
        }
      })
      .catch(() => {});
  }

  // Staff cards: renderizados por main.js (com suporte a fotos) — ver "Treinadores públicos"
})();
