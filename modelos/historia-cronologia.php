<?php
// =====================================================
// MODELO — CRONOLOGIA DA HISTÓRIA DO CLUBE
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:historia:inicio -->  e  <!-- JSC:historia:fim -->
// da historia.html: a linha do tempo, ou o estado vazio.
//
// Estava aqui um <p>A carregar...</p> que nunca carregava: sem JavaScript, os
// 22 marcos da história do clube — de 1947 a 2026 — ficavam invisíveis, atrás
// de uma promessa permanente. Saiu.
//
// A ordem é por ano CRESCENTE: a cronologia lê-se do início para o presente.
// O desempate entre marcos do mesmo ano é o índice de entrada, calculado no
// jsc_ordenar_por_ano() para dar o mesmo resultado em PHP 7.4, em PHP 8.3 e
// no JavaScript.
//
// A imagem é decorativa: o título aparece a seguir, no <h3>, e um alt igual
// fazia o leitor de ecrã ler a mesma frase duas vezes.
//
// Recebe:
//   $marcos  lista já filtrada e ordenada (jsc_historia)
//   $gerado  data/hora da publicação que gerou este bloco
// =====================================================

if (!defined('JSC_GERACAO')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}

if (!isset($marcos) || !is_array($marcos)) $marcos = [];
$gerado = isset($gerado) ? (string)$gerado : '';
?>
      <div class="timeline" id="historiaTimeline" data-gerado="<?= jsc_esc($gerado) ?>" data-itens="<?= count($marcos) ?>">
<?php if (!$marcos): ?>
        <!-- Sem marcos publicáveis não se inventa história: nem um marco de
             exemplo, nem um esqueleto, nem "a carregar". -->
        <p class="historia-empty">Sem marcos históricos registados.</p>
<?php else: ?>
<?php   foreach ($marcos as $i => $m): ?>
<?php     $lado = $i % 2 === 0 ? 'left' : 'right';
          $classe = 'timeline-item timeline-item--' . $lado
                  . ($m['destaque'] ? ' timeline-item--destaque' : ''); ?>
        <div class="<?= $classe ?>">
<?php     if ($m['ano'] !== ''): ?>
          <div class="timeline-year-wrap">
            <span class="timeline-year"><?= jsc_esc($m['ano']) ?></span>
          </div>
<?php     endif; ?>
          <div class="timeline-dot"></div>
          <div class="timeline-card-wrap">
            <div class="timeline-card">
<?php       if ($m['ano'] !== ''): ?>
              <span class="timeline-card__year-mobile"><?= jsc_esc($m['ano']) ?></span>
<?php       endif; ?>
<?php       if ($m['imagem'] !== ''): ?>
              <img src="<?= jsc_esc_url($m['imagem']) ?>" alt="" aria-hidden="true" class="timeline-card__img" loading="lazy" />
<?php       endif; ?>
              <h3 class="timeline-card__title"><?= jsc_esc($m['titulo']) ?></h3>
<?php       if ($m['descricao'] !== ''): ?>
              <p class="timeline-card__desc"><?= jsc_esc($m['descricao']) ?></p>
<?php       endif; ?>
            </div>
          </div>
        </div>
<?php   endforeach; ?>
<?php endif; ?>
      </div>
