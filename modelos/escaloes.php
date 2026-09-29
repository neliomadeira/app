<?php
// =====================================================
// MODELO — CARTÕES DOS ESCALÕES DE FORMAÇÃO
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:escaloes:inicio -->  e  <!-- JSC:escaloes:fim -->
// da formacao.html.
//
// Um cartão por escalão do painel, na ordem do array. Campo vazio não produz
// elemento, e sem nenhum item não há <ul> — em vez de uma lista vazia.
//
// A estrutura é a mesma que o js/main.js produz, para o cartão gerado aqui e
// o cartão desenhado lá serem o mesmo cartão. O id categoriesGrid mantém-se:
// é por ele que o JavaScript encontra a grelha quando tem de redesenhar.
//
// Recebe:
//   $escaloes  lista já normalizada (jsc_escaloes)
//   $gerado    data/hora da publicação que gerou este bloco
// =====================================================

if (!defined('JSC_GERACAO')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}

if (!isset($escaloes) || !is_array($escaloes)) $escaloes = [];
$gerado = isset($gerado) ? (string)$gerado : '';
?>
      <div class="categories__grid" id="categoriesGrid" data-gerado="<?= jsc_esc($gerado) ?>" data-itens="<?= count($escaloes) ?>">
<?php if (!$escaloes): ?>
        <p class="jsc-vazio">Escalões a atualizar.</p>
<?php else: foreach ($escaloes as $e): ?>
        <div class="category-card<?= $e['destaque'] ? ' category-card--featured' : '' ?>">
<?php   if ($e['destaque']): ?>
          <div class="category-card__badge">Destaque</div>
<?php   endif; ?>
          <div class="category-card__age"><?= jsc_esc($e['nome']) ?></div>
<?php   if ($e['designacao'] !== ''): ?>
          <h3 class="category-card__name"><?= jsc_esc($e['designacao']) ?></h3>
<?php   endif; ?>
<?php   if ($e['faixa'] !== ''): ?>
          <p class="category-card__age-range"><?= jsc_esc($e['faixa']) ?></p>
<?php   endif; ?>
<?php   if ($e['descricao'] !== ''): ?>
          <p class="category-card__desc"><?= jsc_esc($e['descricao']) ?></p>
<?php   endif; ?>
<?php   if ($e['itens']): ?>
          <ul class="category-card__list">
<?php     foreach ($e['itens'] as $item): ?>
            <li><?= jsc_esc($item) ?></li>
<?php     endforeach; ?>
          </ul>
<?php   endif; ?>
          <a href="<?= jsc_esc($e['url']) ?>" class="esc-link">Ver plantel &rarr;</a>
        </div>
<?php endforeach; endif; ?>
      </div>
