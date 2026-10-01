<?php
// =====================================================
// MODELO — ARTIGO DA NOTÍCIA INDIVIDUAL (E2)
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:noticia-artigo:inicio -->  e  <!-- JSC:noticia-artigo:fim -->
// da noticias.html: o contentor #notArticle, com o artigo inteiro lá dentro.
//
// Como o modelos/noticia-head.php, não é um bloco do E1: o api/gerar.php não o
// conhece, e o que está entre as marcas no ficheiro publicado é o contentor
// vazio e escondido de sempre. É o api/noticia.php que o substitui, ao pedido.
//
// A estrutura é a que o showArticle() do js/noticias.js produz, para que o
// artigo seja o mesmo com e sem JavaScript. Duas diferenças de propósito:
//
//   • o "Voltar às notícias" é uma ligação a sério, não um <button>. Sem
//     JavaScript um botão não faz nada, e é o único caminho de volta que a
//     página oferece. Com JavaScript o clique é interceptado e a navegação
//     continua a ser feita pelo history, como antes;
//   • o contentor leva data-id e data-gerado. É por eles que o js/noticias.js
//     sabe que o artigo que está na página é este e está actual, e não o
//     volta a desenhar.
//
// Recebe:
//   $noticia      a notícia (jsc_noticia_por_id), ou null para "não encontrada"
//   $corpo        o corpo da notícia JÁ FILTRADO pelo api/noticia.php
//   $relacionadas até três notícias da mesma categoria
//   $base         endereço público do site, para as ligações de partilha
//   $gerado       data/hora da publicação de que saiu este conteúdo
// =====================================================

if (!defined('JSC_E2')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}

$noticia      = (isset($noticia) && is_array($noticia)) ? $noticia : null;
$corpo        = isset($corpo) ? (string)$corpo : '';
$relacionadas = (isset($relacionadas) && is_array($relacionadas)) ? $relacionadas : [];
$base         = isset($base) ? (string)$base : '';
$gerado       = isset($gerado) ? (string)$gerado : '';

// O mesmo estilo de imagem de fundo do modelos/noticia-pagina.php: cada pedaço
// escapado à parte, com o jsc_esc_url_css() a percent-encodar o que fecharia o
// url(...).
$estiloImagem = function (array $n, $tamanhoFixo = null) {
    $url = jsc_esc_url_css($n['imagem']);
    if ($url === '') return '';
    return ' style="background-image:url(\'' . $url . '\');background-size:'
         . jsc_esc($tamanhoFixo !== null ? $tamanhoFixo : $n['imagemSize'])
         . ';background-position:' . jsc_esc($n['focalPos'])
         . ';background-repeat:no-repeat"';
};

// Fila de partilha. Gémea da do modelos/noticias-pagina.php — mesma marcação,
// para que o cartão e o artigo partilhem o mesmo endereço e o mesmo aspeto.
$estiloBotao = 'font-size:0.75rem;padding:5px 10px;border-radius:20px;background:#f0f4ff;color:#003B8E;border:none;cursor:pointer;text-decoration:none;font-weight:600;display:inline-flex;align-items:center;gap:4px';
$partilha = function (array $n) use ($base, $estiloBotao) {
    if ($base === '') return '';   // sem endereço público não se inventa nenhum
    $pagina = jsc_enc_uri($base . '/noticias.html?id=' . $n['id']);
    $titulo = jsc_enc_uri($n['titulo']);
    $wa = 'https://wa.me/?text=' . $titulo . '%20' . $pagina;
    $fb = 'https://www.facebook.com/sharer/sharer.php?u=' . $pagina;
    $copiar = "(function(b){var u=window.location.origin+'/noticias.html?id=" . jsc_esc(urlencode($n['id']))
            . "';navigator.clipboard.writeText(u).then(function(){var t=b.textContent;b.textContent='\u{2713} Copiado!';"
            . "setTimeout(function(){b.textContent=t},2000)}).catch(function(){var t=b.textContent;"
            . "b.textContent='\u{2713} Copiado!';setTimeout(function(){b.textContent=t},2000)})})(this)";
    return '<div class="news-share" style="display:flex;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid #eee;flex-wrap:wrap">'
         . '<a href="' . jsc_esc_url($wa) . '" target="_blank" rel="noopener" class="news-share-btn" style="' . jsc_esc($estiloBotao) . '">&#128241; WhatsApp</a>'
         . '<a href="' . jsc_esc_url($fb) . '" target="_blank" rel="noopener" class="news-share-btn" style="' . jsc_esc($estiloBotao) . '">&#128216; Facebook</a>'
         . '<button onclick="' . jsc_esc($copiar) . '" class="news-share-btn jsc-so-com-js" style="' . jsc_esc($estiloBotao) . '">&#128279; Copiar link</button>'
         . '</div>';
};

if ($noticia !== null) {
    $pos     = $noticia['imagemPos'];
    $imagem  = $noticia['imagem'] !== '' ? $estiloImagem($noticia) : '';
    $imgHtml = $imagem === '' ? ''
             : '<div class="news-article__img news-article__img--' . jsc_esc($pos) . '"' . $imagem . '></div>';
}
?>
<?php if ($noticia === null): ?>
      <div id="notArticle" data-estado="ausente">
        <div class="news-page__empty">
          <h1 class="news-article__title" style="font-size:1.6rem">Notícia não encontrada</h1>
          <p>Esta notícia não existe, ainda não foi publicada ou já não está disponível.</p>
          <a href="noticias.html" class="btn" style="margin-top:20px;background:var(--blue);color:#fff">Ver todas as notícias</a>
        </div>
      </div>
<?php else: ?>
      <div id="notArticle" data-id="<?= jsc_esc($noticia['id']) ?>" data-gerado="<?= jsc_esc($gerado) ?>">
        <div class="not-article-wrap">
          <div style="padding-top:20px">
            <a class="news-archive__back" id="notBack" href="noticias.html">&#8592; Voltar às notícias</a>
          </div>
          <div class="news-article" style="padding:0 0 32px">
<?php   if ($pos === 'top' && $imgHtml !== ''): ?>
            <?= $imgHtml ?>

<?php   endif; ?>
            <h1 class="news-article__title"><?= jsc_esc($noticia['titulo']) ?></h1>
            <div class="news-article__meta">
<?php   if ($noticia['categoria'] !== ''): ?>
              <span class="news-article__cat-badge"><?= jsc_esc($noticia['categoria']) ?></span>
<?php   endif; ?>
<?php   if ($noticia['dataPt'] !== ''): ?>
              <time datetime="<?= jsc_esc($noticia['data']) ?>"><?= jsc_esc($noticia['dataPt']) ?></time>
<?php   endif; ?>
              <span style="color:#999;font-size:0.82rem">&#128336; <?= jsc_esc($noticia['leitura']) ?> de leitura</span>
            </div>
<?php   if ($pos === 'center' && $imgHtml !== ''): ?>
            <?= $imgHtml ?>

<?php   endif; ?>
            <div class="news-article__body">
<?php   if (($pos === 'left' || $pos === 'right') && $imgHtml !== ''): ?>
              <?= $imgHtml ?>

<?php   endif; ?>
<?php   if (trim($corpo) !== ''): ?>
              <?= $corpo ?>

<?php   else: ?>
              <em style="color:#aaa">Sem texto disponível.</em>
<?php   endif; ?>
            </div>
            <div style="clear:both"></div>
            <?= $partilha($noticia) ?>

          </div>
<?php   if ($relacionadas): ?>
          <div class="not-related">
            <h2 class="not-related__title">Mais em <?= jsc_esc($noticia['categoria']) ?></h2>
            <div class="not-related__grid">
<?php     foreach ($relacionadas as $i => $r): $idR = jsc_esc(urlencode($r['id'])); ?>
              <article class="not-related__card" data-rel-id="<?= $idR ?>" style="cursor:pointer">
                <div class="not-related__img not-related__img--<?= ($i % 3) + 1 ?>"<?= $r['imagem'] !== '' ? $estiloImagem($r, 'cover') : '' ?>></div>
                <div class="not-related__body">
<?php       if ($r['dataPt'] !== ''): ?>
                  <time class="news-card__date" datetime="<?= jsc_esc($r['data']) ?>"><?= jsc_esc($r['dataPt']) ?></time>
<?php       endif; ?>
                  <p class="not-related__heading"><a class="not-related__link" href="noticias.html?id=<?= $idR ?>"><?= jsc_esc($r['titulo']) ?></a></p>
                </div>
              </article>
<?php     endforeach; ?>
            </div>
          </div>
<?php   endif; ?>
        </div>
      </div>
<?php endif; ?>
