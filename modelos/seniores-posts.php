<?php
// =====================================================
// MODELO — PUBLICAÇÕES DA EQUIPA PRINCIPAL
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:seniores-posts:inicio -->  e  <!-- JSC:seniores-posts:fim -->
// da equipa-principal.html: as quatro publicações mais recentes.
//
// Uma publicação da equipa principal é uma notícia do painel com a categoria
// "Seniores" e publicada. Não há chave nem tabela à parte.
//
// Duas diferenças face ao que o JavaScript escrevia:
//
//   • o "Ler mais" é uma ligação a sério para noticias.html?id=N. Antes era
//     um <span aria-hidden="true">, e o cartão inteiro era um
//     <div role="button" onclick>: sem JavaScript não havia nada para
//     clicar, e o destino não existia. Com JavaScript, um ouvinte no
//     contentor intercepta o clique e abre o modal como antes;
//   • o botão "Ver todas" leva a classe jsc-so-com-js, porque abre um modal
//     que só existe com JavaScript.
//
// Recebe:
//   $posts   as publicações já preparadas (jsc_seniores_posts)
//   $total   quantas existem no total, para o botão "Ver todas"
//   $previa  quantas cabem na grelha
//   $gerado  data/hora da publicação que gerou este bloco
// =====================================================

if (!defined('JSC_GERACAO')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}

if (!isset($posts) || !is_array($posts)) $posts = [];
$total  = isset($total)  ? (int)$total  : count($posts);
$previa = isset($previa) ? (int)$previa : count($posts);
$gerado = isset($gerado) ? (string)$gerado : '';
?>
      <div class="senior-posts__grid" id="seniorPostsGrid" data-gerado="<?= jsc_esc($gerado) ?>" data-itens="<?= $total ?>">
<?php foreach ($posts as $p):
        $id = jsc_esc(urlencode($p['id']));
        $classe = 'senior-post-card' . ($p['grande'] ? ' senior-post-card--featured' : '');
        $imgCl  = 'senior-post-card__img' . ($p['imagem'] !== '' ? '' : ' news-card__img--' . $p['variante']);
        $estilo = $p['imagem'] === '' ? '' : ' style="background-image:url(\''
                . jsc_esc_url_css($p['imagem']) . '\');background-size:'
                . jsc_esc($p['imagemSize']) . ';background-position:' . jsc_esc($p['imagemPos']) . '"';
?>
        <article class="<?= $classe ?>" data-id="<?= $id ?>" style="cursor:pointer">
          <div class="<?= $imgCl ?>"<?= $estilo ?>>
            <span class="senior-post-card__tag">Seniores</span>
          </div>
          <div class="senior-post-card__body">
<?php   if ($p['dataPt'] !== ''): ?>
            <time class="senior-post-card__date"><?= jsc_esc($p['dataPt']) ?></time>
<?php   endif; ?>
            <h3 class="senior-post-card__title"><?= jsc_esc($p['titulo']) ?></h3>
<?php   if ($p['resumo'] !== ''): ?>
            <p class="senior-post-card__excerpt"><?= jsc_esc($p['resumo']) ?></p>
<?php   endif; ?>
            <a class="senior-post-card__more" href="noticias.html?id=<?= $id ?>">Ler mais &rarr;</a>
          </div>
        </article>
<?php endforeach; ?>
        <div class="senior-posts__empty" id="seniorPostsEmpty"<?= $posts ? ' hidden' : '' ?>>
          <p>Sem publicações de momento. As novidades da equipa principal aparecem aqui.</p>
        </div>
      </div>
      <div style="text-align:center;margin-top:36px">
        <button class="btn-outline jsc-so-com-js" id="btnVerTodosPosts"<?= $total > $previa ? '' : ' hidden' ?>
                onclick="openNewsArchive('Seniores')">
          Ver todas as publicações &darr;
        </button>
      </div>
