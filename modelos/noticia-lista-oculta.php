<?php
// =====================================================
// MODELO — LISTA ESCONDIDA NA VISTA DE ARTIGO (E2)
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:noticias-pagina:inicio -->  e  <!-- JSC:noticias-pagina:fim -->
// quando o api/noticia.php responde a um endereço com id.
//
// Porque é que o E2 escreve nesta região, que é do E1:
//
//   A vista de artigo mostra o artigo, não a lista. O showArticle() do
//   js/noticias.js esconde os cinco contentores da lista antes de escrever o
//   artigo; sem JavaScript ninguém os esconde, e o visitante receberia o artigo
//   com a lista inteira por baixo — e um canonical, um og:title e um <h1> de
//   artigo numa página que mostra uma lista.
//
//   Não é uma alteração ao E1: o api/gerar.php continua a ser o único a
//   escrever esta região NO FICHEIRO, e o que o api/gerar.php lá põe é a lista
//   completa, que é o que o visitante recebe quando pede o noticias.html sem
//   id. O E2 troca-a apenas na resposta a um endereço com id, e não toca no
//   ficheiro.
//
// Os cinco contentores ficam, vazios e escondidos: o js/noticias.js procura-os
// pelo id, e sem eles o botão "Voltar às notícias" não tinha onde desenhar a
// lista. Sem data-gerado no #notGrid — a lista NÃO vem servida, e é o
// jscBlocoAtual() que lê essa ausência.
// =====================================================

if (!defined('JSC_E2')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}
?>
      <div id="notFeatured" hidden></div>
      <div class="news-filter-bar" id="notFilters" hidden></div>
      <div class="news-page__grid" id="notGrid" hidden></div>
      <div class="news-page__empty" id="notEmpty" hidden>
        <p>Ainda não existem notícias publicadas.</p>
        <a href="index.html" class="btn" style="margin-top:20px;background:var(--blue);color:#fff">Voltar ao início</a>
      </div>
      <div class="gallery__more jsc-so-com-js" id="notMoreWrap" hidden>
        <button class="btn" id="notMoreBtn" style="background:var(--blue);color:#fff">Ver mais notícias</button>
      </div>
