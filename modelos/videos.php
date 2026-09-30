<?php
// =====================================================
// MODELO — PÁGINA DE VÍDEOS
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:videos:inicio -->  e  <!-- JSC:videos:fim -->
// da videos.html: a barra de filtros, a grelha e o estado vazio.
//
// A grelha vinha vazia no HTML e o estado vazio escondido: sem JavaScript a
// página ficava em branco debaixo de um herói que promete golos, melhores
// momentos e entrevistas.
//
// Cada cartão é agora uma ligação a sério para o YouTube. Sem JavaScript o
// vídeo abre lá; com JavaScript o clique é interceptado e abre-se o modal, como
// no "Ler mais" das publicações da equipa principal.
//
// Os três endereços — miniatura, ligação e embed — são construídos a partir do
// id validado de onze caracteres, nunca do endereço escrito no painel. Um
// vídeo sem id válido não chega aqui: não há cartão sem miniatura nem iframe
// vazio.
//
// Recebe:
//   $videos  lista já filtrada e normalizada (jsc_videos)
//   $gerado  data/hora da publicação que gerou este bloco
// =====================================================

if (!defined('JSC_GERACAO')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}

if (!isset($videos) || !is_array($videos)) $videos = [];
$gerado = isset($gerado) ? (string)$gerado : '';
$categorias = jsc_media_categorias($videos);
?>
      <!-- Filters -->
<?php if (count($categorias) > 1): ?>
      <div id="videosFilters" class="jsc-so-com-js" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:32px">
        <button class="news-filter-btn news-filter-btn--active" data-cat="Todos" type="button">Todos</button>
<?php   foreach ($categorias as $c): ?>
        <button class="news-filter-btn" data-cat="<?= jsc_esc($c) ?>" type="button"><?= jsc_esc($c) ?></button>
<?php   endforeach; ?>
      </div>
<?php else: ?>
      <div id="videosFilters" class="jsc-so-com-js" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:32px"></div>
<?php endif; ?>

      <!-- Grid -->
      <div class="videos-grid" id="videosGrid" data-gerado="<?= jsc_esc($gerado) ?>" data-itens="<?= count($videos) ?>">
<?php foreach ($videos as $i => $v): ?>
        <a class="video-card" href="<?= jsc_esc($v['ligacao']) ?>" target="_blank" rel="noopener noreferrer"
           data-idx="<?= $i ?>" data-cat="<?= jsc_esc($v['categoria']) ?>">
          <div class="video-card__thumb">
            <img src="<?= jsc_esc_url($v['miniatura']) ?>" alt="<?= jsc_esc($v['titulo']) ?>" class="video-card__img" loading="lazy" />
            <div class="video-card__play" aria-hidden="true">&#9654;</div>
<?php   if ($v['categoria'] !== ''): ?>
            <span class="video-card__cat"><?= jsc_esc($v['categoria']) ?></span>
<?php   endif; ?>
          </div>
          <div class="video-card__body">
            <p class="video-card__title"><?= jsc_esc($v['titulo']) ?></p>
<?php   if ($v['dataPt'] !== ''): ?>
            <p class="video-card__date"><?= jsc_esc($v['dataPt']) ?></p>
<?php   endif; ?>
          </div>
        </a>
<?php endforeach; ?>
      </div>

      <!-- Empty -->
      <div class="videos-empty" id="videosEmpty"<?= $videos ? ' hidden' : '' ?>>
        <div class="videos-empty__icon" aria-hidden="true">&#127909;</div>
        <p>Ainda não há vídeos publicados.<br>Volte em breve!</p>
      </div>
