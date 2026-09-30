<?php
// =====================================================
// MODELO — PÁGINA COMPLETA DE PATROCINADORES
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:patrocinadores-pagina:inicio -->  e  :fim
// da patrocinadores.html: uma grelha única com todos os patrocinadores
// ativos, e o bloco final de convite.
//
// Esta página era inteiramente construída por um <script> inline: sem
// JavaScript não havia nada — nem cartões, nem estado vazio, nem o convite.
// Passa a existir tudo sem JavaScript.
//
// Havia três grelhas, uma por nível, e um patrocinador ativo com um nível
// fora dos três conhecidos desaparecia enquanto a página anunciava que não
// havia patrocinadores. Agora há uma grelha, e nenhum patrocinador ativo pode
// ser excluído por causa do nível.
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
      <div id="sponsorsContent" data-gerado="<?= jsc_esc($gerado) ?>" data-itens="<?= count($patrocinadores) ?>">
<?php if (!$patrocinadores): ?>
        <div class="sp-empty">
          <div class="sp-empty__icon">&#129309;</div>
          <p class="sp-empty__title">Seja o primeiro patrocinador</p>
          <p class="sp-empty__text">Ainda não temos patrocinadores registados. Se a sua empresa quer apoiar o desenvolvimento do futebol jovem em Loulé, entre em contacto connosco.</p>
          <a href="contacto.html" class="btn btn--primary">Torne-se patrocinador &rarr;</a>
        </div>
<?php else: ?>
        <div class="sp-grid">
<?php   foreach ($patrocinadores as $p): ?>
          <div class="sp-card">
            <div class="sp-card__logo-wrap">
<?php     if ($p['logo'] !== ''): ?>
              <img src="<?= jsc_esc_url($p['logo']) ?>" alt="<?= jsc_esc($p['nome']) ?>" class="sp-card__logo-img" loading="lazy" />
<?php     else: ?>
              <div class="sp-card__initials"><?= jsc_esc($p['iniciais']) ?></div>
<?php     endif; ?>
            </div>
            <div class="sp-card__body">
              <h3 class="sp-card__name"><?= jsc_esc($p['nome']) ?></h3>
<?php     if ($p['sector'] !== ''): ?>
              <span class="sp-card__sector"><?= jsc_esc($p['sector']) ?></span>
<?php     endif; ?>
<?php     if ($p['desde'] !== ''): ?>
              <span class="sp-card__since">Parceiro desde <?= jsc_esc($p['desde']) ?></span>
<?php     endif; ?>
<?php     if ($p['url'] !== ''): ?>
              <a href="<?= jsc_esc($p['url']) ?>" target="_blank" rel="noopener noreferrer" class="sp-card__website">Visitar site &#8599;</a>
<?php     endif; ?>
            </div>
          </div>
<?php   endforeach; ?>
        </div>
<?php endif; ?>
        <div class="sp-cta">
          <span class="sp-cta__tag">Junte-se a nós</span>
          <h2 class="sp-cta__title">Quer ser patrocinador?</h2>
          <p class="sp-cta__desc">Associe a sua marca a um clube com mais de 100 anos de história e faça parte do futuro do desporto jovem algarvio.</p>
          <a href="contacto.html" class="btn btn--primary">Contacte-nos</a>
        </div>
      </div>
