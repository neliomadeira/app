<?php
// =====================================================
// NOTÍCIA INDIVIDUAL — resposta ao pedido (E2)
// =====================================================
// Responde ao noticias.html?id=N. O endereço público NÃO muda: o Apache faz
// uma reescrita interna deste endereço para aqui (ver .htaccess), sem
// redirecionamento, e o visitante continua a ver noticias.html?id=N na barra.
//
// É o primeiro ficheiro do projeto que produz HTML ao pedido — o E2. O que já
// existia (E1) continua como estava: o api/gerar.php escreve o conteúdo dentro
// das páginas uma vez, na publicação, e este ficheiro não o altera nem depende
// dele. O que faz é pegar na noticias.html JÁ GERADA e trocar três regiões:
//
//   JSC:noticia-head      o <head> da notícia (título, OG, canonical, JSON-LD)
//   JSC:noticias-pagina   a lista, que na vista de artigo fica escondida
//   JSC:noticia-artigo    o artigo
//
// Regras que mandam aqui:
//
//   • SÓ LÊ. Não grava, não apaga, não toca em sessões nem em permissões. Um
//     pedido GET público nunca provoca escrita — e por isso este ficheiro nem
//     requer o api/sessao.php nem o api/geracao.php;
//
//   • o endereço canónico monta-se da JSC_SITE_URL mais o id validado, NUNCA
//     do REQUEST_URI. Depois da reescrita o REQUEST_URI diz
//     /api/noticia.php?id=N, e publicar isso como canonical mandaria os
//     motores de busca para o endereço interno. Foi medido no alojamento;
//
//   • uma notícia não publicada, ou agendada para o futuro, não existe aqui:
//     o filtro é o mesmo da lista pública (jsc_noticias_pagina). A página
//     pública nunca lê conteúdo administrativo não publicado;
//
//   • o ?preview=1 não passa por aqui. O .htaccess exclui-o, e a
//     pré-visualização continua a ser o que era: o rascunho que o painel
//     guardou no sessionStorage do próprio browser, visível só nele;
//
//   • se qualquer coisa falhar — o ficheiro não se lê, uma marca não está onde
//     devia, um modelo não escreve nada — serve-se a noticias.html tal como
//     está, que é exactamente o que o visitante receberia sem o E2. Uma avaria
//     aqui não pode deixar a página de notícias em branco.
// =====================================================

define('JSC_E2', 1);

require_once __DIR__ . '/conteudo.php';
require_once __DIR__ . '/sanitizar.php';

define('JSC_E2_PAGINA', __DIR__ . '/../noticias.html');
define('JSC_E2_MODELOS', __DIR__ . '/../modelos/');

// ---------------------------------------------------------------------
// Troca o miolo de uma região, pelas marcas. Mesmas exigências do E1: cada
// marca exactamente uma vez, e na ordem certa. Devolve null se não puder.
//
// A indentação da linha da marca de fim é reposta no fim do miolo, como no
// jsc_regioes()/jsc_gerar_bloco() do api/geracao.php: sem isso a marca de
// fecho mudava de coluna.
// ---------------------------------------------------------------------
function jsc_e2_trocar($html, $nome, $miolo) {
    $ini = '<!-- JSC:' . $nome . ':inicio -->';
    $fim = '<!-- JSC:' . $nome . ':fim -->';
    if (substr_count($html, $ini) !== 1 || substr_count($html, $fim) !== 1) return null;
    $abre  = strpos($html, $ini) + strlen($ini);
    $fecha = strpos($html, $fim);
    if ($fecha < $abre) return null;

    $nl      = strrpos(substr($html, 0, $fecha), "\n");
    $comeco  = ($nl === false) ? 0 : $nl + 1;
    $prefixo = substr($html, $comeco, $fecha - $comeco);
    $indent  = preg_match('/^[ \t]*$/', $prefixo) ? $prefixo : '';

    return substr($html, 0, $abre) . "\n" . rtrim($miolo, "\n") . "\n" . $indent
         . substr($html, $fecha);
}

// ---------------------------------------------------------------------
// Corre um modelo e devolve o que ele escreveu, ou null.
//
// As variáveis locais daqui levam prefixo de propósito. O extract() corre com
// EXTR_SKIP, e uma variável desta função com o nome de uma variável do modelo
// faria o modelo receber silenciosamente o valor desta função — foi assim que
// o rodapé gerado chegou a dizer "© 2026 rodape-base@index.html". Com o
// prefixo jscE2 nenhuma colisão é possível, e um teste verifica-o.
// ---------------------------------------------------------------------
function jsc_e2_bloco($jscE2Modelo, array $jscE2Vars) {
    $jscE2Caminho = JSC_E2_MODELOS . $jscE2Modelo;
    if (!is_file($jscE2Caminho)) return null;

    ob_start();
    try {
        extract($jscE2Vars, EXTR_SKIP);
        include $jscE2Caminho;
    } catch (Throwable $jscE2Excecao) {
        ob_end_clean();
        return null;
    }
    $jscE2Saida = ob_get_clean();
    if ($jscE2Saida === false || trim($jscE2Saida) === '') return null;

    // Um aviso do PHP impresso pelo modelo iria direto para a página.
    foreach (['Fatal error', 'Parse error', 'Warning:', 'Notice:', 'Deprecated:'] as $jscE2Marca) {
        if (strpos($jscE2Saida, $jscE2Marca) !== false) return null;
    }
    return $jscE2Saida;
}

// ---------------------------------------------------------------------
// Resposta
// ---------------------------------------------------------------------
header('Content-Type: text/html; charset=UTF-8');

// A reescrita do Apache olha para o endereço, não para o método. Um POST ao
// noticias.html?id=1 chegaria aqui — e aqui não há nada para escrever.
$metodo = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
if ($metodo !== 'GET' && $metodo !== 'HEAD') {
    http_response_code(405);
    header('Allow: GET, HEAD');
    echo "<!DOCTYPE html>\n<html lang=\"pt-PT\"><head><meta charset=\"UTF-8\">"
       . "<title>Método não permitido</title></head><body><h1>Método não permitido</h1>"
       . "<p><a href=\"noticias.html\">Ver todas as notícias</a></p></body></html>\n";
    exit;
}

$jscE2Html = is_file(JSC_E2_PAGINA) ? (string)@file_get_contents(JSC_E2_PAGINA) : '';
if ($jscE2Html === '') {
    // Sem a página não há nada a servir, e não se inventa uma.
    http_response_code(500);
    echo "<!DOCTYPE html>\n<html lang=\"pt-PT\"><head><meta charset=\"UTF-8\">"
       . "<meta name=\"robots\" content=\"noindex, follow\">"
       . "<title>Erro</title></head><body><h1>Página indisponível</h1>"
       . "<p><a href=\"/\">Voltar ao início</a></p></body></html>\n";
    exit;
}

// Serve a página tal como está no disco — o que o visitante receberia sem o
// E2 — e sai. É o caminho de qualquer avaria.
function jsc_e2_servir_pagina() {
    global $jscE2Html;
    echo $jscE2Html;
    exit;
}

$conteudo = jsc_conteudo_do_ficheiro();

// Sem lista de notícias NÃO se decide nada: serve-se a página como está.
//
// A diferença é entre "a lista existe e esta notícia não está lá" — que é um
// 404 — e "não há lista para consultar", que é o que acontece quando o
// data/db.json ainda não foi enviado para o alojamento. Nesse caso responder 404
// a todos os endereços de notícia transformava uma instalação incompleta num
// site com centenas de erros indexáveis. Uma lista que existe e está vazia é
// outra coisa: aí a resposta certa é 404, e é o que acontece.
if (!isset($conteudo['noticias']) || !is_array($conteudo['noticias'])) {
    jsc_e2_servir_pagina();
}

// ?id[]=1 chega como array; ?id=1&id=abc chega como 'abc' (o PHP guarda o
// último). Em qualquer dos casos o jsc_noticia_id_valido() recusa, e a
// resposta é a mesma de um id que não existe: 404.
$id = isset($_GET['id']) ? $_GET['id'] : '';
if (!is_string($id)) $id = '';

$noticia = jsc_noticia_por_id($conteudo, $id);
$gerado  = jsc_publicado_em($conteudo);

if ($noticia === null) {
    $codigo = 404;
    $seo    = jsc_noticia_seo_ausente($conteudo);
    $artigo = jsc_e2_bloco('noticia-artigo.php', ['noticia' => null]);
} else {
    $codigo = 200;

    // O corpo passa pelo MESMO filtro que o api/save.php aplica ao gravar.
    // Ao gravar é onde o filtro conta; aqui é a segunda linha: as notícias
    // guardadas antes de o filtro existir nunca foram filtradas, e este
    // ficheiro escreve-as no HTML do servidor. Para tudo o que foi gravado
    // depois do filtro isto não muda nada — é a mesma função.
    $noticia['corpo'] = jsc_sanitizar_noticia($noticia['corpo']);

    $seo    = jsc_noticia_seo($conteudo, $noticia);
    $artigo = jsc_e2_bloco('noticia-artigo.php', [
        'noticia'      => $noticia,
        'corpo'        => $noticia['corpo'],
        'relacionadas' => jsc_noticia_relacionadas($conteudo, $noticia),
        // O mesmo sítio de onde sai o canonical. Dois sítios diferentes para o
        // endereço da própria página é como eles divergem.
        'base'         => JSC_SITE_URL,
        'gerado'       => $gerado,
    ]);
}

$cabeca = jsc_e2_bloco('noticia-head.php', ['seo' => $seo, 'noindex' => $codigo !== 200]);
$lista  = jsc_e2_bloco('noticia-lista-oculta.php', []);

if ($artigo === null || $cabeca === null || $lista === null) jsc_e2_servir_pagina();

$saida = $jscE2Html;
foreach (['noticia-head' => $cabeca, 'noticias-pagina' => $lista, 'noticia-artigo' => $artigo] as $nome => $miolo) {
    $novo = jsc_e2_trocar($saida, $nome, $miolo);
    if ($novo === null) jsc_e2_servir_pagina();
    $saida = $novo;
}

http_response_code($codigo);
if ($codigo !== 200) header('X-Robots-Tag: noindex, follow');
echo $saida;
