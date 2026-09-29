<?php
// =====================================================
// MODELO — PLANTEL DA EQUIPA PRINCIPAL
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:seniores-plantel:inicio -->  e  <!-- JSC:seniores-plantel:fim -->
// da equipa-principal.html.
//
// Só os grupos de posição que têm jogadores são escritos: antes existiam
// sempre os quatro no HTML, escondidos. Sem plantel, fica só a mensagem.
//
// O cartão publica os mesmos quatro campos que já publicava — nome, número,
// posição e fotografia — e nem um mais. Não há aqui data de nascimento,
// idade nem contactos, e o modelo de dados também não os tem.
//
// Os ids das grelhas (sgGR, sgDEF, sgMEI, sgAVA) mantêm-se: o js/main.js
// procura-os quando tem de voltar a desenhar.
//
// Recebe:
//   $grupos  posições com jogadores (jsc_seniores_plantel)
//   $gerado  data/hora da publicação que gerou este bloco
// =====================================================

if (!defined('JSC_GERACAO')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}

if (!isset($grupos) || !is_array($grupos)) $grupos = [];
$gerado = isset($gerado) ? (string)$gerado : '';

$total = 0;
foreach ($grupos as $g) $total += count($g['jogadores']);
?>
      <div id="seniorPlantel" data-gerado="<?= jsc_esc($gerado) ?>" data-itens="<?= $total ?>">
<?php if (!$grupos): ?>
        <p class="jsc-vazio" id="plantelVazio">Plantel a atualizar.</p>
<?php else: foreach ($grupos as $g): ?>
        <div class="squad-group">
          <h2 class="squad-group__title"><span class="squad-pos-badge squad-pos-badge--<?= jsc_esc(strtolower($g['pos'])) ?>"><?= jsc_esc($g['pos']) ?></span> <?= jsc_esc($g['label']) ?></h2>
          <div class="<?= jsc_esc($g['grelha']) ?>" id="sg<?= jsc_esc($g['pos']) ?>">
<?php   foreach ($g['jogadores'] as $j):
          $estilo = $j['foto'] === '' ? '' : ' style="background-image:url(\''
                  . jsc_esc_url_css($j['foto']) . '\');background-size:cover;background-position:center;font-size:0"';
?>
            <div class="player-card">
              <span class="player-card__num"><?= jsc_esc($j['numero']) ?></span>
              <div class="player-card__avatar"<?= $estilo ?>><?= jsc_esc($j['iniciais']) ?></div>
              <span class="player-card__name"><?= jsc_esc($j['nome']) ?></span>
              <span class="player-card__pos player-card__pos--<?= jsc_esc($j['posicao']) ?>"><?= jsc_esc($j['posicaoFull']) ?></span>
            </div>
<?php   endforeach; ?>
          </div>
        </div>
<?php endforeach; endif; ?>
      </div>
