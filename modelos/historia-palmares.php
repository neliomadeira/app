<?php
// =====================================================
// MODELO — PALMARÉS DO CLUBE
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:palmares:inicio -->  e  <!-- JSC:palmares:fim -->
// da historia.html: a grelha de títulos, ou o estado vazio.
//
// Estava aqui um <p>A carregar...</p> permanente, como na cronologia.
//
// A ordem é por ano DECRESCENTE: o palmarés lê-se do mais recente para trás.
// Era essa a intenção do código antigo, mas só se aplicava quando havia dados
// publicados — sem eles saía a ordem do array, que começava em 1984. A ordem
// passa a ser a mesma com e sem dados publicados.
//
// O escalão é texto livre: guarda hoje grupos etários, designações como
// 'Traquinas A' ou 'Sen. Femininos', e nomes de atletas. Escreve-se o que lá
// estiver, sem o interpretar.
//
// Recebe:
//   $titulos  lista já filtrada e ordenada (jsc_palmares)
//   $gerado   data/hora da publicação que gerou este bloco
// =====================================================

if (!defined('JSC_GERACAO')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}

if (!isset($titulos) || !is_array($titulos)) $titulos = [];
$gerado = isset($gerado) ? (string)$gerado : '';
?>
      <div class="palmares__grid" id="historiaPalmares" data-gerado="<?= jsc_esc($gerado) ?>" data-itens="<?= count($titulos) ?>">
<?php if (!$titulos): ?>
        <!-- Sem títulos publicáveis não se inventa nenhum, e não se afirma um
             número a partir do que aqui estiver. -->
        <p class="historia-empty" style="grid-column:1/-1">Sem títulos registados.</p>
<?php else: ?>
<?php   foreach ($titulos as $t): ?>
        <div class="palmares-card">
          <div class="palmares-card__icon" aria-hidden="true">&#127942;</div>
          <div class="palmares-card__body">
            <div class="palmares-card__title"><?= jsc_esc($t['competicao']) ?></div>
<?php     $meta = $t['ano'];
          if ($t['observacao'] !== '') {
              $meta = $meta === '' ? jsc_esc($t['observacao'])
                                   : jsc_esc($meta) . ' &middot; ' . jsc_esc($t['observacao']);
          } else {
              $meta = jsc_esc($meta);
          } ?>
<?php     if ($meta !== ''): ?>
            <div class="palmares-card__meta"><?= $meta ?></div>
<?php     endif; ?>
<?php     if ($t['escalao'] !== ''): ?>
            <span class="palmares-card__badge"><?= jsc_esc($t['escalao']) ?></span>
<?php     endif; ?>
          </div>
        </div>
<?php   endforeach; ?>
<?php endif; ?>
      </div>
