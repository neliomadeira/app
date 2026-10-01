<?php
// =====================================================
// MODELO — ENTRADAS DO SITEMAP
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:sitemap:inicio -->  e  <!-- JSC:sitemap:fim -->
// do sitemap.xml: apenas os elementos <url>.
//
// As marcas ficam DENTRO do <urlset>, e não em volta do ficheiro: a declaração
// XML tem de ser a primeiríssima coisa do documento, e um comentário antes dela
// torna o XML inválido.
//
// (E a declaração não se escreve aqui nem num comentário: a sequência que a
// fecha fecha também o bloco PHP, e o resto do comentário sairia como texto no
// sitemap. Aconteceu.)
//
// O que mudou em relação ao ficheiro escrito à mão:
//   — o lastmod era 2026-07-01 nas 14 entradas, igual e desactualizado. Passa a
//     ser o dia da publicação que gerou o ficheiro;
//   — a pesquisa.html saiu. São resultados de pesquisa interna, combinações do
//     que já está indexado noutras páginas, e a página passou a ter noindex;
//   — os endereços absolutos saem da JSC_SITE_URL, um sítio só.
//
// O que NÃO entra está decidido em jsc_sitemap_paginas(), com a razão de cada
// ausência escrita ao lado.
//
// Desde o Bloco 10 entram também as notícias publicadas, uma por artigo
// (noticias.html?id=N). Passaram a ser endereços a sério: o api/noticia.php
// responde-lhes com o artigo, o título e a descrição dessa notícia. Antes eram
// a mesma página para os motores de busca, e por isso não se listavam.
//
// Cada entrada traz o seu lastmod: as páginas levam a data da publicação, as
// notícias levam a data da notícia.
//
// Recebe:
//   $entradas  lista de ['loc' => caminho, 'freq' => …, 'pri' => …,
//                        'lastmod' => AAAA-MM-DD]
// =====================================================

if (!defined('JSC_GERACAO')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}

$entradas = (isset($entradas) && is_array($entradas)) ? $entradas : [];
?>
<?php foreach ($entradas as $p): ?>
  <url>
    <loc><?= jsc_esc(JSC_SITE_URL . $p['loc']) ?></loc>
    <lastmod><?= jsc_esc(isset($p['lastmod']) ? $p['lastmod'] : '') ?></lastmod>
    <changefreq><?= jsc_esc($p['freq']) ?></changefreq>
    <priority><?= jsc_esc($p['pri']) ?></priority>
  </url>
<?php endforeach; ?>
