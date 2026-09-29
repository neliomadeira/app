<?php
// =====================================================
// MODELO — NOTÍCIAS DA PÁGINA INICIAL
// =====================================================
// Escreve o bloco que fica entre as marcas
//   <!-- JSC:noticias:inicio -->  e  <!-- JSC:noticias:fim -->
// do index.html. Só apresentação: quem escolhe e prepara os dados é o
// api/conteudo.php, quem grava com segurança é o api/geracao.php.
//
// As classes e a estrutura são as mesmas que o js/main.js produz, para que
// o aspeto não mude conforme o visitante tenha ou não JavaScript.
//
// Recebe:
//   $noticias  lista já filtrada, ordenada e cortada (jsc_noticias)
//   $total     quantas notícias publicadas existem no total
//   $limite    quantas cabem na página inicial
//   $gerado    data/hora da publicação que gerou este bloco
// =====================================================

// Este ficheiro é incluído pelo api/geracao.php, que define esta constante.
// Pedido diretamente pelo browser não tem contexto nenhum: responde 403 e
// sai. A pasta já está bloqueada no .htaccess — isto é a segunda camada,
// para o caso de o servidor não ler o .htaccess ou de os .php seguirem
// outro caminho.
if (!defined('JSC_GERACAO')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}

if (!isset($noticias) || !is_array($noticias)) $noticias = [];
$total  = isset($total)  ? (int)$total  : count($noticias);
$limite = isset($limite) ? (int)$limite : count($noticias);
$gerado = isset($gerado) ? (string)$gerado : '';
?>
      <div class="news__grid" id="newsGrid" data-gerado="<?= jsc_esc($gerado) ?>">
<?php if (!$noticias): ?>
        <p class="jsc-vazio">Ainda não existem notícias publicadas.</p>
<?php else: foreach ($noticias as $n):
        $id    = jsc_esc(urlencode($n['id']));
        $classe = 'news-card' . ($n['destaque'] ? ' news-card--featured' : '');
        $imgCl  = 'news-card__img' . ($n['imagem'] !== '' ? '' : ' news-card__img--' . $n['variante']);
        $estilo = $n['imagem'] === '' ? '' : ' style="background-image:url(\''
                . jsc_esc_url_css($n['imagem']) . '\');background-size:'
                . jsc_esc($n['imagemSize']) . ';background-position:center;background-repeat:no-repeat"';
?>
        <article class="<?= $classe ?>" style="cursor:pointer" onclick="window.location='noticias.html?id=<?= $id ?>'">
          <div class="<?= $imgCl ?>"<?= $estilo ?>>
            <span class="news-card__cat"><?= jsc_esc($n['categoria']) ?></span>
          </div>
          <div class="news-card__body">
            <time class="news-card__date"><?= jsc_esc($n['dataPt']) ?></time>
            <h3 class="news-card__title"><?= jsc_esc($n['titulo']) ?></h3>
<?php   if ($n['resumo'] !== ''): ?>
            <p class="news-card__excerpt"><?= jsc_esc($n['resumo']) ?></p>
<?php   endif; ?>
            <a class="news-card__link" href="noticias.html?id=<?= $id ?>">Ler mais &rarr;</a>
          </div>
        </article>
<?php endforeach; endif; ?>
      </div>
      <div style="text-align:center;margin-top:36px">
        <a href="noticias.html" class="btn btn--outline" id="btnVerTodasNoticias"<?= $total > $limite ? '' : ' style="display:none"' ?>>
          Ver todas as notícias &rarr;
        </a>
      </div>
