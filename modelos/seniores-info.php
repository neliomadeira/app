<?php
// =====================================================
// MODELO — BARRA DE INFORMAÇÃO DA EQUIPA PRINCIPAL
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:seniores-info:inicio -->  e  <!-- JSC:seniores-info:fim -->
// da equipa-principal.html.
//
// Um item por campo preenchido, pela ordem fixa da página: Competição,
// Temporada, Treinos, Local. Campo vazio não produz item — antes produzia um
// item escondido. Com os quatro vazios não há barra nenhuma, em vez de ficar
// uma caixa vazia.
//
// Os ids (seniorLiga, seniorTemporada, seniorTreinos, seniorEstadio)
// mantêm-se: o js/main.js procura-os quando tem de voltar a desenhar.
//
// Recebe:
//   $itens   os campos preenchidos (jsc_seniores_info)
//   $gerado  data/hora da publicação que gerou este bloco
// =====================================================

if (!defined('JSC_GERACAO')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}

if (!isset($itens) || !is_array($itens)) $itens = [];
$gerado = isset($gerado) ? (string)$gerado : '';
?>
      <div class="senior-info" id="seniorInfoBar" data-gerado="<?= jsc_esc($gerado) ?>" data-itens="<?= count($itens) ?>"<?= $itens ? '' : ' hidden' ?>>
<?php foreach ($itens as $i): ?>
        <div class="senior-info__item">
          <span class="senior-info__icon"><?= $i['icone'] ?></span>
          <div>
            <span class="senior-info__label"><?= jsc_esc($i['rotulo']) ?></span>
            <span class="senior-info__val" id="<?= jsc_esc($i['id']) ?>"><?= jsc_esc($i['valor']) ?></span>
          </div>
        </div>
<?php endforeach; ?>
      </div>
