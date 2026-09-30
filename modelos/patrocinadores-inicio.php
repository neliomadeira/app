<?php
// =====================================================
// MODELO — PATROCINADORES DA PÁGINA INICIAL
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:patrocinadores:inicio -->  e  <!-- JSC:patrocinadores:fim -->
// do index.html: uma zona única, com todos os patrocinadores ativos.
//
// Estavam aqui doze cartões escritos à mão, com nomes de empresas que não
// existem, divididos por três níveis de patrocínio. Apareciam sempre que a
// base estivesse vazia ou que um nível ficasse sem ninguém. Saíram.
//
// Nenhuma diferenciação visual entre patrocinadores: uma classe só.
//
// Sem website não se escreve <a>: um <a> sem href não recebe foco nem é
// anunciado como ligação, e era exactamente o que a página fazia antes.
//
// O logótipo é <img> com alt, e não uma imagem de fundo CSS: um fundo não tem
// texto alternativo, e o cartão ficava sem nome acessível nenhum.
//
// Recebe:
//   $patrocinadores  lista já filtrada e normalizada (jsc_patrocinadores)
//   $gerado          data/hora da publicação que gerou este bloco
// =====================================================

if (!defined('JSC_GERACAO')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}

if (!isset($patrocinadores) || !is_array($patrocinadores)) $patrocinadores = [];
$gerado = isset($gerado) ? (string)$gerado : '';
?>
      <div class="sponsors-row" id="sponsorsGrid" data-gerado="<?= jsc_esc($gerado) ?>" data-itens="<?= count($patrocinadores) ?>">
<?php if (!$patrocinadores): ?>
        <p class="jsc-vazio">Patrocinadores a atualizar.</p>
<?php else: foreach ($patrocinadores as $p): $et = $p['url'] !== '' ? 'a' : 'div'; ?>
        <<?= $et ?> class="sponsor-card"<?= $p['url'] !== '' ? ' href="' . jsc_esc($p['url']) . '" target="_blank" rel="noopener noreferrer"' : '' ?>>
<?php   if ($p['logo'] !== ''): ?>
          <img src="<?= jsc_esc_url($p['logo']) ?>" alt="<?= jsc_esc($p['nome']) ?>" class="sponsor-card__img" loading="lazy" />
          <span class="sponsor-card__title"><?= jsc_esc($p['nome']) ?></span>
<?php   else: ?>
          <div class="sponsor-card__logo"><?= jsc_esc($p['nome']) ?></div>
<?php   endif; ?>
<?php   if ($p['sector'] !== ''): ?>
          <span class="sponsor-card__name"><?= jsc_esc($p['sector']) ?></span>
<?php   endif; ?>
        </<?= $et ?>>
<?php endforeach; endif; ?>
      </div>
