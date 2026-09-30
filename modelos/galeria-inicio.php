<?php
// =====================================================
// MODELO — GALERIA DA PÁGINA INICIAL
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:galeria:inicio -->  e  <!-- JSC:galeria:fim -->
// do index.html: a secção inteira, cabeçalho incluído.
//
// A região abrange a secção toda de propósito: sem fotografias publicáveis, a
// secção desaparece por completo — título, subtítulo, filtros, grelha e botão.
// Uma secção "Galeria" com uma caixa a dizer "a atualizar" é pior do que não
// ter secção.
//
// Estavam aqui cinco fotografias escritas à mão, com legendas inventadas, uma
// delas a afirmar um título distrital que o clube pode não ter conquistado.
// Apareciam sempre que a base estivesse vazia — que é o estado actual. Saíram.
//
// Recebe:
//   $fotos   lista já filtrada e normalizada (jsc_galeria), completa
//   $previa  quantas mostrar antes do botão "Ver mais"
//   $gerado  data/hora da publicação que gerou este bloco
// =====================================================

if (!defined('JSC_GERACAO')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}

if (!isset($fotos) || !is_array($fotos)) $fotos = [];
$previa = isset($previa) ? (int)$previa : 6;
$gerado = isset($gerado) ? (string)$gerado : '';
$mostradas = array_slice($fotos, 0, $previa);
$categorias = jsc_media_categorias($fotos);
?>
<?php if (!$fotos): ?>
  <!-- Sem fotografias publicáveis não há secção de galeria: nem título, nem
       subtítulo, nem grelha, nem botão. Uma secção "Galeria" com uma caixa a
       dizer "a atualizar" é pior do que não ter secção. Este comentário é o
       que o bloco escreve — o motor recusa um bloco vazio, e um comentário não
       produz elemento nenhum na página. -->
<?php else: ?>
  <section class="section section--gray" id="galeria">
    <div class="container">
      <div class="section__header">
        <span class="section__tag">Momentos</span>
        <h2 class="section__title">Galeria</h2>
      </div>
      <p class="section__subtitle">Imagens dos treinos, jogos e momentos especiais da Juventude Sport Campinense.</p>
<?php   if (count($categorias) > 1): ?>
      <!-- Os filtros só funcionam com JavaScript. Sem ele saem da página, em
           vez de ficarem lá a não fazer nada: a grelha já está completa. -->
      <div class="gallery__filters jsc-so-com-js" id="galleryFilters">
        <button class="gallery__filter-btn active" data-cat="">Todas</button>
<?php     foreach ($categorias as $c): ?>
        <button class="gallery__filter-btn" data-cat="<?= jsc_esc($c) ?>"><?= jsc_esc($c) ?></button>
<?php     endforeach; ?>
      </div>
<?php   endif; ?>
      <div class="gallery__grid" id="galleryGrid" data-gerado="<?= jsc_esc($gerado) ?>" data-itens="<?= count($fotos) ?>">
<?php   foreach ($mostradas as $i => $f): ?>
<?php     $classe = 'gallery__item--img';
          if ($i === 0) $classe .= ' gallery__item--tall';
          if ($i === count($mostradas) - 1 && count($mostradas) >= 4) $classe .= ' gallery__item--wide'; ?>
        <div class="<?= $classe ?>" data-idx="<?= $i ?>"<?= $f['url'] !== '' ? ' style="background-image:url(\'' . jsc_esc_url_css($f['url']) . '\');background-size:' . jsc_esc($f['imgSize']) . ';background-position:' . jsc_esc($f['imgPos']) . '"' : '' ?>
             tabindex="0" role="button" aria-label="Abrir foto: <?= jsc_esc($f['titulo']) ?>">
<?php       if ($f['url'] === ''): ?>
          <span class="gallery__icon" aria-hidden="true"><?= $f['icone'] ?></span>
<?php       endif; ?>
          <span class="gallery__caption"><?= jsc_esc($f['titulo']) ?></span>
        </div>
<?php   endforeach; ?>
      </div>
<?php   if (count($fotos) > $previa): ?>
      <!-- Só com JavaScript: sem ele a galeria completa está a uma ligação de
           distância, e um botão que não faz nada não ajuda ninguém. -->
      <div class="gallery__more jsc-so-com-js" id="galleryMore">
        <button class="btn btn--outline" id="galleryMoreBtn">Ver mais fotos (<?= count($fotos) - count($mostradas) ?> restantes)</button>
      </div>
      <p class="gallery__todas"><a href="galeria.html">Ver a galeria completa &rarr;</a></p>
<?php   endif; ?>
    </div>
  </section>
<?php endif; ?>
