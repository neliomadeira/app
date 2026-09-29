<?php
// =====================================================
// MODELO — LISTA DA AGENDA (agenda.html)
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:agenda-pagina:inicio -->  e  <!-- JSC:agenda-pagina:fim -->
// da agenda.html: todos os eventos de hoje em diante.
//
// A estrutura é a mesma que o js/agenda.js produz na vista "Próximos
// Eventos". O que muda:
//
//   • campo vazio não produz elemento — sem hora não há o ícone da hora,
//     sem local não há o do local, e sem nenhum dos dois não há a linha;
//   • o botão "Adicionar ao calendário" leva a classe jsc-so-com-js, porque
//     precisa do JavaScript para produzir o ficheiro. Sem JavaScript sai da
//     página pelo <noscript>, em vez de ficar lá a não fazer nada.
//
// O calendário mensal (#agendaCal) e a barra de filtros (#agendaFilters)
// continuam a ser construídos pelo JavaScript: são controlos, não conteúdo,
// e ficam fora das marcas.
//
// Recebe:
//   $eventos  lista já filtrada e ordenada (jsc_agenda_proximos)
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
      <div id="agendaList" class="agenda-pub-list" data-gerado="<?= jsc_esc($gerado) ?>" data-itens="<?= count($eventos) ?>" data-desde="<?= jsc_esc($desde) ?>">
<?php if (!$eventos): ?>
        <p class="agenda-pub-empty">Sem eventos agendados.</p>
<?php else: foreach ($eventos as $e): ?>
        <div class="agenda-pub-item" style="border-left-color:<?= jsc_esc($e['cor']) ?>">
          <div class="agenda-pub-date">
            <span class="agenda-pub-date__day"><?= jsc_esc($e['dia']) ?></span>
            <span class="agenda-pub-date__month"><?= jsc_esc($e['mesCurto']) ?></span>
          </div>
          <div class="agenda-pub-body">
<?php   if ($e['tipo'] !== ''): ?>
            <span class="agenda-tipo-badge" style="background:<?= jsc_esc($e['cor']) ?>"><?= jsc_esc($e['tipo']) ?></span>
<?php   endif; ?>
            <p class="agenda-pub-title"><?= jsc_esc($e['titulo']) ?></p>
<?php   if ($e['hora'] !== '' || $e['local'] !== '' || $e['escalao'] !== ''): ?>
            <p class="agenda-pub-meta">
<?php     if ($e['hora'] !== ''): ?>
              <span>&#128337; <?= jsc_esc($e['hora']) ?></span>
<?php     endif; ?>
<?php     if ($e['local'] !== ''): ?>
              <span>&#128205; <?= jsc_esc($e['local']) ?></span>
<?php     endif; ?>
<?php     if ($e['escalao'] !== ''): ?>
              <span>&#127942; <?= jsc_esc($e['escalao']) ?></span>
<?php     endif; ?>
            </p>
<?php   endif; ?>
            <button class="agenda-ics-btn jsc-so-com-js" data-ics="<?= jsc_esc($e['ics']) ?>" title="Adicionar ao calendário">&#128197; Adicionar ao calendário</button>
          </div>
        </div>
<?php endforeach; endif; ?>
      </div>
