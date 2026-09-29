<?php
// =====================================================
// MODELO — PÁGINA DE NOTÍCIAS (noticias.html)
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:noticias-pagina:inicio -->  e  <!-- JSC:noticias-pagina:fim -->
// da noticias.html: cartão de destaque, barra de filtros, grelha completa,
// estado vazio e botão "Ver mais".
//
// A estrutura é a mesma que o js/noticias.js produz, para que o aspeto não
// mude conforme o visitante tenha ou não JavaScript. Duas diferenças de
// propósito:
//
//   • a grelha traz a lista COMPLETA. Os cartões a partir do décimo levam a
//     classe news-page__card--extra, que o CSS esconde. Com JavaScript é o
//     botão "Ver mais" que os mostra; sem JavaScript não há botão, e o
//     <noscript> da página mostra-os todos — ver css/styles.css;
//   • os controlos que não funcionam sem JavaScript (filtrar, copiar
//     ligação, "Ver mais") levam a classe jsc-so-com-js, que o mesmo
//     <noscript> retira. Um botão que não faz nada é pior do que botão
//     nenhum.
//
// A vista de artigo (#notArticle) fica fora das marcas: é do Bloco 11.
//
// Recebe:
//   $noticias  lista completa já preparada (jsc_noticias_pagina)
//   $destaque  a notícia marcada como destaque, ou null
//   $categorias  categorias existentes, pela ordem de aparição
//   $previa    quantos cartões se mostram antes do "Ver mais"
//   $base      endereço público do site, para as ligações de partilha
//   $gerado    data/hora da publicação que gerou este bloco
// =====================================================

if (!defined('JSC_GERACAO')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}

if (!isset($noticias) || !is_array($noticias)) $noticias = [];
$destaque   = isset($destaque) && is_array($destaque) ? $destaque : null;
$categorias = isset($categorias) && is_array($categorias) ? $categorias : [];
$previa     = isset($previa) ? (int)$previa : 9;
$base       = isset($base) ? (string)$base : '';
$gerado     = isset($gerado) ? (string)$gerado : '';

$total  = count($noticias);
$extras = max(0, $total - $previa);

// O estilo da imagem de fundo, com cada pedaço escapado à parte. O
// jsc_esc_url_css() percent-encoda os caracteres que fechariam o url(...).
$estiloImagem = function (array $n, $tamanhoFixo = null) {
    if ($n['imagem'] === '') return '';
    $url = jsc_esc_url_css($n['imagem']);
    if ($url === '') return '';
    return ' style="background-image:url(\'' . $url . '\');background-size:'
         . jsc_esc($tamanhoFixo !== null ? $tamanhoFixo : $n['imagemSize'])
         . ';background-position:' . jsc_esc($n['focalPos'])
         . ';background-repeat:no-repeat"';
};

// Fila de partilha. As duas ligações funcionam sem JavaScript; o "Copiar
// link" precisa do navigator.clipboard, por isso leva a jsc-so-com-js.
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
?>
      <div id="notFeatured"<?= $destaque ? '' : ' hidden' ?>>
<?php if ($destaque): $idD = jsc_esc(urlencode($destaque['id'])); ?>
        <article class="news-hero-card" data-id="<?= $idD ?>" style="cursor:pointer">
          <div class="news-hero-card__img"<?= $estiloImagem($destaque, 'cover') ?>>
            <span class="news-hero-card__tag">&#11088; Destaque</span>
          </div>
          <div class="news-hero-card__body">
<?php   if ($destaque['categoria'] !== ''): ?>
            <span class="news-card__cat"><?= jsc_esc($destaque['categoria']) ?></span>
<?php   endif; ?>
<?php   if ($destaque['dataPt'] !== ''): ?>
            <time class="news-card__date"><?= jsc_esc($destaque['dataPt']) ?></time>
<?php   endif; ?>
            <h2 class="news-hero-card__title"><?= jsc_esc($destaque['titulo']) ?></h2>
<?php   if ($destaque['resumo200'] !== ''): ?>
            <p class="news-hero-card__excerpt"><?= jsc_esc($destaque['resumo200']) ?></p>
<?php   endif; ?>
            <a class="news-card__link" href="noticias.html?id=<?= $idD ?>">Ler mais &rarr;</a>
          </div>
        </article>
<?php endif; ?>
      </div>
      <div class="news-filter-bar" id="notFilters"<?= $categorias ? '' : ' hidden' ?>>
<?php if ($categorias): ?>
        <button class="news-filter-btn active" data-cat="">Todas</button>
<?php   foreach ($categorias as $c): ?>
        <button class="news-filter-btn" data-cat="<?= jsc_esc($c) ?>"><?= jsc_esc($c) ?></button>
<?php   endforeach; ?>
<?php endif; ?>
      </div>
      <div class="news-page__grid" id="notGrid" data-gerado="<?= jsc_esc($gerado) ?>" data-itens="<?= $total ?>">
<?php foreach ($noticias as $i => $n):
        $id = jsc_esc(urlencode($n['id']));
        $classes = 'news-card news-page__card' . ($i >= $previa ? ' news-page__card--extra' : '');
        $imgCl = 'news-card__img' . ($n['imagem'] !== '' ? '' : ' news-card__img--' . $n['variante']);
?>
        <article class="<?= $classes ?>" style="cursor:pointer" data-id="<?= $id ?>">
          <div class="<?= $imgCl ?>"<?= $estiloImagem($n) ?>>
<?php   if ($n['categoria'] !== ''): ?>
            <span class="news-card__cat"><?= jsc_esc($n['categoria']) ?></span>
<?php   endif; ?>
          </div>
          <div class="news-card__body">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
<?php   if ($n['dataPt'] !== ''): ?>
              <time class="news-card__date"><?= jsc_esc($n['dataPt']) ?></time>
<?php   endif; ?>
              <span class="news-card__date" style="opacity:0.6">&#128336; <?= jsc_esc($n['leitura']) ?> de leitura</span>
            </div>
            <h2 class="news-card__title" style="font-size:1.05rem"><?= jsc_esc($n['titulo']) ?></h2>
<?php   if ($n['resumo130'] !== ''): ?>
            <p class="news-card__excerpt"><?= jsc_esc($n['resumo130']) ?></p>
<?php   endif; ?>
            <a class="news-card__link" href="noticias.html?id=<?= $id ?>">Ler mais &rarr;</a>
            <?= $partilha($n) ?>
          </div>
        </article>
<?php endforeach; ?>
      </div>
      <div class="news-page__empty" id="notEmpty"<?= $total ? ' hidden' : '' ?>>
        <p>Ainda não existem notícias publicadas.</p>
        <a href="index.html" class="btn" style="margin-top:20px;background:var(--blue);color:#fff">Voltar ao início</a>
      </div>
      <div class="gallery__more jsc-so-com-js" id="notMoreWrap"<?= $extras ? '' : ' hidden' ?>>
        <button class="btn" id="notMoreBtn" style="background:var(--blue);color:#fff">Ver mais notícias<?= $extras ? ' (' . $extras . ' restantes)' : '' ?></button>
      </div>
