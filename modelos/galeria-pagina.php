<?php
// =====================================================
// MODELO — PÁGINA COMPLETA DA GALERIA
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:galeria-pagina:inicio -->  e  :fim
// da galeria.html: a barra de filtros, a grelha completa e o estado vazio.
//
// A grelha vinha com seis esqueletos de carregamento. Sem JavaScript ficavam
// lá para sempre: um estado de carregamento permanente, que diz "está a
// carregar" e nunca carrega. Saíram.
//
// A grelha é gerada completa. Os filtros são botões a sério, mas só funcionam
// com JavaScript — sem ele saem da página, porque a lista já está toda visível.
//
// Cada fotografia é um <div> com a imagem em fundo, como já era. A lightbox
// continua a ser melhoria progressiva: sem JavaScript vê-se a grelha e as
// legendas, com JavaScript abre-se a fotografia em grande.
//
// Recebe:
//   $fotos   lista já filtrada e normalizada (jsc_galeria)
//   $gerado  data/hora da publicação que gerou este bloco
// =====================================================

if (!defined('JSC_GERACAO')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}

if (!isset($fotos) || !is_array($fotos)) $fotos = [];
$gerado = isset($gerado) ? (string)$gerado : '';
$categorias = jsc_media_categorias($fotos);
?>
      <!-- Category filter pills -->
<?php if (count($categorias) > 1): ?>
      <div class="galeria-filter-bar jsc-so-com-js" id="galeriaFilters">
        <button class="news-filter-btn news-filter-btn--active" data-cat="Todos" type="button">Todos</button>
<?php   foreach ($categorias as $c): ?>
        <button class="news-filter-btn" data-cat="<?= jsc_esc($c) ?>" type="button"><?= jsc_esc($c) ?></button>
<?php   endforeach; ?>
      </div>
<?php else: ?>
      <div class="galeria-filter-bar jsc-so-com-js" id="galeriaFilters"></div>
<?php endif; ?>

      <!-- Photo grid -->
      <div class="galeria-grid" id="galeriaGrid" data-gerado="<?= jsc_esc($gerado) ?>" data-itens="<?= count($fotos) ?>">
<?php foreach ($fotos as $i => $f): ?>
        <div class="galeria-item" data-idx="<?= $i ?>" data-cat="<?= jsc_esc($f['categoria']) ?>" tabindex="0" role="button"
             aria-label="Ver foto: <?= jsc_esc($f['titulo']) ?>">
<?php   if ($f['url'] !== ''): ?>
          <div class="galeria-item__bg" style="background-image:url('<?= jsc_esc_url_css($f['url']) ?>');background-size:<?= jsc_esc($f['imgSize']) ?>;background-position:<?= jsc_esc($f['imgPos']) ?>"></div>
<?php   else: ?>
          <div class="galeria-item__bg galeria-placeholder galeria-placeholder--<?= jsc_esc($f['slug']) ?>">
            <span class="galeria-placeholder__icon" aria-hidden="true"><?= $f['icone'] ?></span>
            <span class="galeria-placeholder__title"><?= jsc_esc($f['titulo']) ?></span>
          </div>
<?php   endif; ?>
          <div class="galeria-item__overlay" aria-hidden="true">
            <p class="galeria-item__overlay-title"><?= jsc_esc($f['titulo']) ?></p>
<?php   if ($f['descricao'] !== ''): ?>
            <p class="galeria-item__overlay-desc"><?= jsc_esc($f['descricao']) ?></p>
<?php   endif; ?>
          </div>
        </div>
<?php endforeach; ?>
      </div>

      <!-- Empty state -->
      <div class="galeria-empty" id="galeriaEmpty"<?= $fotos ? ' hidden' : '' ?>>
        <span class="galeria-empty__icon" aria-hidden="true">&#128247;</span>
        <p class="galeria-empty__msg">Ainda não há fotos na galeria.</p>
      </div>
