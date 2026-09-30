<?php
// =====================================================
// MODELO — LINHA DE BAIXO DO RODAPÉ E DADOS ESTRUTURADOS
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:rodape-base:inicio -->  e  <!-- JSC:rodape-base:fim -->
// do .footer__bottom: a linha de direitos reservados e o JSON-LD.
//
// Duas coisas juntas, e de propósito:
//
//   O ano e o nome do clube estavam escritos à mão em 17 páginas — 16 diziam
//   2026 e a atleta.html dizia 2024, e ninguém actualizava nenhuma. O ano passa
//   a ser o da publicação e o nome vem do dados_clube.nome, que era editável no
//   painel e não chegava a sítio nenhum.
//
//   Os dados estruturados existiam só com JavaScript, e 14 das suas 15
//   propriedades estavam escritas à mão no js/seo.js. Passam a ser escritos aqui,
//   derivados das mesmas fontes únicas. Um <script type="application/ld+json">
//   é conteúdo de fluxo e vale em qualquer parte do documento; fica nesta região
//   porque é a que existe em todas as páginas e porque os dados são os mesmos —
//   pôr um <head> gerado por página exigiria saída parametrizada, que é E2.
//
// Nome vazio não inventa nome: a frase fica sem ele, e o JSON-LD sai sem a
// propriedade. Nenhuma propriedade vazia é escrita.
//
// Recebe:
//   $clubeNome  nome oficial do clube, ou ''
//               (o nome da variável NÃO pode ser o óbvio: o motor tem uma
//                variável com esse nome no âmbito do include — é o nome do
//                bloco — e o extract() corre com EXTR_SKIP, logo o modelo
//                recebia o nome do bloco em vez do nome do clube. Aconteceu.)
//   $ano        ano da publicação (quatro dígitos)
//   $schemas    lista de objectos já prontos (jsc_dados_estruturados)
//   $gerado     data/hora da publicação que gerou este bloco
// =====================================================

if (!defined('JSC_GERACAO')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}

$clubeNome = isset($clubeNome) ? (string)$clubeNome : '';
$ano     = isset($ano) ? (string)$ano : '';
$gerado  = isset($gerado) ? (string)$gerado : '';
$schemas = (isset($schemas) && is_array($schemas)) ? $schemas : [];

// O JSON_UNESCAPED_SLASHES deixa os endereços legíveis; o UNESCAPED_UNICODE
// mantém os acentos. O json_encode() escapa <, > e & com HEX_TAG/HEX_AMP, e é
// isso que impede que um valor do painel feche o <script>.
$opcoes = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT;
?>
      <p data-gerado="<?= jsc_esc($gerado) ?>">&copy; <?= jsc_esc($ano) ?><?= $clubeNome !== '' ? ' ' . jsc_esc($clubeNome) : '' ?>. Todos os direitos reservados. &nbsp;|&nbsp; <a href="privacidade.html" style="color:rgba(255,255,255,0.5);text-decoration:none;">Privacidade &amp; Termos</a></p>
<?php foreach ($schemas as $s): ?>
      <script type="application/ld+json" data-jsc-schema="1"><?= json_encode($s, $opcoes) ?></script>
<?php endforeach; ?>
