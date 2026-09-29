<?php
// =====================================================
// MODELO — AGENDA DA PÁGINA INICIAL
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:agenda:inicio -->  e  <!-- JSC:agenda:fim -->
// do index.html: os próximos seis eventos.
//
// A estrutura é a mesma que o js/main.js produz. Duas diferenças, ambas por
// causa do princípio de que campo vazio não produz elemento: sem hora não há
// o ícone da hora, sem local não há o do local, e sem nenhum dos dois não há
// a linha. O js/main.js foi corrigido para dar o mesmo resultado.
//
// O calendário mensal e o .ics não existem nesta página.
//
// Recebe:
//   $eventos  lista já filtrada, ordenada e cortada (jsc_agenda_proximos)
//   $gerado   data/hora da publicação que gerou este bloco
//   $desde    o dia que serviu de "hoje" na geração
// =====================================================

if (!defined('JSC_GERACAO')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}

if (!isset($eventos) || !is_array($eventos)) $eventos = [];
$gerado = isset($gerado) ? (string)$gerado : '';
$desde  = isset($desde)  ? (string)$desde  : '';
?>
      <div class="agenda__grid" id="agendaPublicGrid" data-gerado="<?= jsc_esc($gerado) ?>" data-itens="<?= count($eventos) ?>" data-desde="<?= jsc_esc($desde) ?>">
<?php if (!$eventos): ?>
        <p class="jsc-vazio">Ainda não existem eventos agendados.</p>
<?php else: foreach ($eventos as $e): ?>
        <div class="agenda-card">
          <div class="agenda-card__date-box">
            <span class="agenda-card__day"><?= jsc_esc($e['dia']) ?></span>
            <span class="agenda-card__month"><?= jsc_esc($e['mesCurto']) ?></span>
          </div>
          <div class="agenda-card__body">
<?php   if ($e['tipo'] !== ''): ?>
            <span class="agenda-card__tipo agenda-card__tipo--<?= jsc_esc($e['classe']) ?>"><?= jsc_esc($e['tipo']) ?></span>
<?php   endif; ?>
            <h3 class="agenda-card__title"><?= jsc_esc($e['titulo']) ?></h3>
<?php   if ($e['hora'] !== '' || $e['local'] !== ''): ?>
            <p class="agenda-card__meta"><?= $e['hora'] !== '' ? '&#128337; ' . jsc_esc($e['hora']) : '' ?><?= ($e['hora'] !== '' && $e['local'] !== '') ? ' &nbsp;·&nbsp; ' : '' ?><?= $e['local'] !== '' ? '&#128205; ' . jsc_esc($e['local']) : '' ?></p>
<?php   endif; ?>
<?php   if ($e['escalao'] !== ''): ?>
            <p class="agenda-card__meta">&#127942; <?= jsc_esc($e['escalao']) ?></p>
<?php   endif; ?>
          </div>
        </div>
<?php endforeach; endif; ?>
      </div>
