<?php
// =====================================================
// MODELO — MODALIDADES DA PÁGINA INICIAL
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:modalidades:inicio -->  e  <!-- JSC:modalidades:fim -->
// do index.html: um cartão por modalidade ativa, pela ordem do painel.
//
// Estavam aqui três cartões escritos à mão — Kickboxing, Judo e Futsal, com
// as descrições —, iguais aos dados de arranque do painel. Ficavam na página
// sempre que a base estivesse vazia, e podiam já não corresponder ao que o
// painel tinha. Saíram; as modalidades continuam nos dados persistentes.
//
// Campo vazio não produz elemento. Se treinos, local e responsável estiverem
// todos vazios, não há a caixa de informação: ela desenha um traço e 14px de
// espaço mesmo quando não tem nada dentro.
//
// A imagem é fundo CSS, e não <img>: é uma textura atrás do ícone e de um
// gradiente opaco, não um logótipo. Quem identifica o cartão é o <h3>. Por
// isso o ícone leva aria-hidden: é decoração, e sem ele um leitor de ecrã
// anuncia o emoji antes do nome.
//
// Recebe:
//   $modalidades  lista já filtrada e normalizada (jsc_modalidades)
//   $gerado       data/hora da publicação que gerou este bloco
// =====================================================

if (!defined('JSC_GERACAO')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}

if (!isset($modalidades) || !is_array($modalidades)) $modalidades = [];
$gerado = isset($gerado) ? (string)$gerado : '';
?>
      <div class="modalities__grid" id="modalidadesGrid" data-gerado="<?= jsc_esc($gerado) ?>" data-itens="<?= count($modalidades) ?>">
<?php if (!$modalidades): ?>
        <p class="jsc-vazio">Modalidades a atualizar.</p>
<?php else: foreach ($modalidades as $m): ?>
        <div class="modality-card">
          <div class="modality-card__icon-wrap"<?= $m['imagem'] !== '' ? ' style="background-image:url(\'' . jsc_esc_url_css($m['imagem']) . '\');background-size:cover;background-position:' . jsc_esc($m['imagemPos']) . '"' : '' ?>>
            <span class="modality-card__icon" aria-hidden="true"><?= jsc_esc($m['icone']) ?></span>
          </div>
          <div class="modality-card__body">
            <h3 class="modality-card__name"><?= jsc_esc($m['nome']) ?></h3>
<?php   if ($m['descricao'] !== ''): ?>
            <p class="modality-card__desc"><?= jsc_esc($m['descricao']) ?></p>
<?php   endif; ?>
<?php   if ($m['itens']): ?>
            <div class="modality-card__info">
<?php     foreach ($m['itens'] as $i): ?>
              <span class="modality-card__info-item"><?= $i['icone'] ?> <?= jsc_esc($i['valor']) ?></span>
<?php     endforeach; ?>
            </div>
<?php   endif; ?>
            <a href="<?= jsc_esc($m['url']) ?>" class="modality-card__link">Ver mais &rarr;</a>
          </div>
        </div>
<?php endforeach; endif; ?>
      </div>
