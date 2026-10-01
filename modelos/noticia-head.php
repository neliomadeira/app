<?php
// =====================================================
// MODELO — <head> DA NOTÍCIA INDIVIDUAL (E2)
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:noticia-head:inicio -->  e  <!-- JSC:noticia-head:fim -->
// da noticias.html: título, descrição, Open Graph, Twitter, canonical e os
// dados estruturados do artigo.
//
// Este bloco NÃO é gerado pelo api/gerar.php. Não é um bloco do E1: as marcas
// existem no ficheiro, mas o que está entre elas no ficheiro publicado é o
// <head> da lista de notícias, escrito à mão, e é esse que o visitante recebe
// quando pede o noticias.html sem id. É o api/noticia.php que o substitui, ao
// pedido, quando o endereço traz um id.
//
// Por isso este modelo escreve o <head> COMPLETO da notícia: não acrescenta ao
// que lá está, substitui-o. Uma propriedade sem valor não é escrita — uma
// notícia sem imagem fica sem og:image, porque uma partilha que mostra o
// logótipo do clube em vez da imagem do artigo mostra outra coisa.
//
// Recebe:
//   $seo       o que a jsc_noticia_seo() (ou a jsc_noticia_seo_ausente())
//              decidiu: url, titulo, descricao, imagem, sitio, schema
//   $noindex   true no estado "não encontrada"
// =====================================================

if (!defined('JSC_E2')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}

$seo     = (isset($seo) && is_array($seo)) ? $seo : [];
$noindex = !empty($noindex);

$valor = function ($chave) use ($seo) {
    return (isset($seo[$chave]) && is_string($seo[$chave])) ? $seo[$chave] : '';
};
$url       = $valor('url');
$titulo    = $valor('titulo');
$descricao = $valor('descricao');
$imagem    = $valor('imagem');
$sitio     = $valor('sitio');
$schema    = (isset($seo['schema']) && is_array($seo['schema'])) ? $seo['schema'] : null;

// Os mesmos sinalizadores do modelos/rodape-base.php: o json_encode() escapa
// <, > e & , e é isso que impede que um valor do painel feche o <script>.
$opcoes = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT;
?>
  <title><?= jsc_esc($titulo) ?></title>
<?php if ($descricao !== ''): ?>
  <meta name="description" content="<?= jsc_esc($descricao) ?>" />
<?php endif; ?>
<?php if ($noindex): ?>
  <meta name="robots" content="noindex, follow" />
<?php endif; ?>
<?php if (!$noindex): /* No estado "não encontrada" não há Open Graph nem
       Twitter: não é conteúdo para indexar nem para partilhar, e um og:title a
       dizer "não encontrada" só serve para ser partilhado por engano. */ ?>
  <meta property="og:type" content="article" />
<?php if ($sitio !== ''): ?>
  <meta property="og:site_name" content="<?= jsc_esc($sitio) ?>" />
<?php endif; ?>
  <meta property="og:locale" content="pt_PT" />
<?php if ($url !== ''): ?>
  <meta property="og:url" content="<?= jsc_esc_url($url) ?>" />
<?php endif; ?>
  <meta property="og:title" content="<?= jsc_esc($titulo) ?>" />
<?php if ($descricao !== ''): ?>
  <meta property="og:description" content="<?= jsc_esc($descricao) ?>" />
<?php endif; ?>
<?php if ($imagem !== ''): ?>
  <meta property="og:image" content="<?= jsc_esc_url($imagem) ?>" />
<?php endif; ?>
  <meta name="twitter:card" content="<?= $imagem !== '' ? 'summary_large_image' : 'summary' ?>" />
  <meta name="twitter:title" content="<?= jsc_esc($titulo) ?>" />
<?php if ($descricao !== ''): ?>
  <meta name="twitter:description" content="<?= jsc_esc($descricao) ?>" />
<?php endif; ?>
<?php if ($imagem !== ''): ?>
  <meta name="twitter:image" content="<?= jsc_esc_url($imagem) ?>" />
<?php endif; ?>
<?php if ($url !== ''): ?>
  <link rel="canonical" href="<?= jsc_esc_url($url) ?>" />
<?php endif; ?>
<?php endif; /* !$noindex */ ?>
<?php if ($schema !== null): ?>
  <script type="application/ld+json" id="articleJsonLd"><?= json_encode($schema, $opcoes) ?></script>
<?php endif; ?>
