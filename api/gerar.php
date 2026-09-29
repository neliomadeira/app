<?php
// =====================================================
// REGENERAR AS PÁGINAS — Juventude Sport Campinense
// =====================================================
// Volta a escrever o conteúdo publicado dentro das páginas, a partir do que
// já está em data/db.json. Serve para duas coisas:
//
//   • depois de enviar ficheiros novos para o alojamento, o index.html volta
//     ao estado do repositório (bloco vazio). Uma regeneração põe lá as
//     notícias outra vez, sem ser preciso republicar do painel;
//   • voltar atrás, com --reverter, para a última publicação válida.
//
// Pela web exige sessão do painel e a mesma permissão que publicar notícias
// exige. Não introduz forma nenhuma de entrar: usa a autenticação que já
// existe, tal como está.
//
// Na linha de comandos (terminal do alojamento, ou desenvolvimento):
//     php api/gerar.php
//     php api/gerar.php --reverter
// =====================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/geracao.php';

$ehCli = (php_sapi_name() === 'cli');

// ---- Linha de comandos ---------------------------------------------
if ($ehCli) {
    $reverter = in_array('--reverter', $argv, true);
    $r = $reverter ? jsc_reverter() : jsc_publicar(jsc_conteudo_do_ficheiro(), null, 'cli');

    foreach ($r['avisos'] as $a) fwrite(STDERR, "aviso: $a\n");
    if ($r['ok']) {
        echo ($reverter ? "Revertido: " : "Gerado: ") . implode(', ', $r['ficheiros']) . "\n";
        exit(0);
    }
    foreach ($r['erros'] as $e) fwrite(STDERR, "erro: $e\n");
    fwrite(STDERR, $r['revertido']
        ? "A versão anterior foi restaurada.\n"
        : "A versão pública não foi alterada.\n");
    exit(1);
}

// ---- Web ------------------------------------------------------------
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache');
require_once __DIR__ . '/sessao.php';

function jsc_gerar_saida($dados, $codigo = 200) {
    http_response_code($codigo);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsc_gerar_saida(['ok' => false, 'error' => 'method not allowed'], 405);
}

$perfil = jsc_perfil_do_utilizador();
if (!$perfil) {
    jsc_gerar_saida(['ok' => false, 'error' => 'sem sessao'], 401);
}

// Regenerar escreve o mesmo bloco que publicar notícias escreve: pede-se a
// mesma permissão. Quem não pode alterar notícias também não regenera.
if (!in_array('noticias', jsc_areas_permitidas(), true)) {
    jsc_gerar_saida(['ok' => false, 'error' => 'sem permissao para gerar as noticias'], 403);
}

$corpo = json_decode((string)file_get_contents('php://input'), true);
$acao  = (is_array($corpo) && isset($corpo['acao'])) ? (string)$corpo['acao'] : 'gerar';

if ($acao === 'reverter') {
    $r = jsc_reverter();
} else {
    $r = jsc_publicar(jsc_conteudo_do_ficheiro(), null, $perfil['nome']);
}

if ($r['ok']) {
    jsc_gerar_saida([
        'ok'        => true,
        'acao'      => $acao,
        'ficheiros' => $r['ficheiros'],
        'avisos'    => $r['avisos'],
    ]);
}

jsc_gerar_saida([
    'ok'         => false,
    'error'      => implode('; ', $r['erros']),
    'avisos'     => $r['avisos'],
    'revertido'  => $r['revertido'],
], 500);
