<?php
// =====================================================
// PUBLICAR — Juventude Sport Campinense
// =====================================================
// Recebe o conteúdo do painel e grava-o em data/db.json, que é o que as
// páginas públicas leem.
//
// O painel envia sempre tudo, mesmo o que não mexeu. Por isso a
// verificação não é "pode publicar?" mas "pode alterar cada uma das áreas
// que de facto mudaram?". Assim um perfil de Comunicação publica notícias
// sem poder tocar nos atletas, mesmo enviando o conteúdo inteiro.
// =====================================================

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/sessao.php';
require_once __DIR__ . '/sanitizar.php';

function jsc_saida($dados, $codigo = 200) {
    http_response_code($codigo);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsc_saida(['ok' => false, 'error' => 'method not allowed'], 405);
}

$perfil = jsc_perfil_do_utilizador();
if (!$perfil) {
    jsc_saida(['ok' => false, 'error' => 'sem sessao'], 401);
}

$raw = file_get_contents('php://input');
if (!$raw) jsc_saida(['ok' => false, 'error' => 'corpo vazio'], 400);
$novos = json_decode($raw, true);
if (!is_array($novos)) jsc_saida(['ok' => false, 'error' => 'json invalido'], 400);

$antigos = [];
if (is_file(DATA_FILE)) {
    $d = json_decode(file_get_contents(DATA_FILE), true);
    if (is_array($d)) $antigos = $d;
}

// ---- Que áreas mudaram de facto? -----------------------------------
$chaves = array_unique(array_merge(array_keys($novos), array_keys($antigos)));
$alteradas = [];
foreach ($chaves as $k) {
    if ($k === 'publicadoEm') continue;   // muda sempre, não é conteúdo
    $a = isset($antigos[$k]) ? json_encode($antigos[$k]) : null;
    $b = isset($novos[$k])   ? json_encode($novos[$k])   : null;
    if ($a !== $b) $alteradas[] = $k;
}

$permitidas = jsc_areas_permitidas();
$negadas = array_values(array_diff($alteradas, $permitidas));
if ($negadas) {
    jsc_saida([
        'ok'      => false,
        'error'   => 'sem permissao para alterar: ' . implode(', ', $negadas),
        'areas'   => $negadas,
        'perfil'  => $perfil['nome'],
    ], 403);
}

// ---- Âmbito por modalidade -----------------------------------------
// Os perfis de Futebol e Futsal só podem mexer nos registos da sua
// modalidade. Os registos que ainda não têm o campo 'modalidade' ficam
// acessíveis a ambos: essa separação só existe depois de o campo entrar
// no modelo de dados, e recusar por omissão deixaria estes perfis sem
// nada que pudessem fazer.
if (!empty($perfil['modalidade'])) {
    $mod = $perfil['modalidade'];
    $fora = [];
    foreach (['atletas', 'treinadores', 'jogos', 'escaloes'] as $seccao) {
        if (!in_array($seccao, $alteradas, true)) continue;
        foreach ([$antigos[$seccao] ?? [], $novos[$seccao] ?? []] as $lista) {
            if (!is_array($lista)) continue;
            foreach ($lista as $item) {
                if (!is_array($item) || !isset($item['modalidade'])) continue;
                if (strcasecmp((string)$item['modalidade'], $mod) !== 0) {
                    $fora[$seccao] = true;
                }
            }
        }
    }
    if ($fora) {
        jsc_saida([
            'ok'    => false,
            'error' => 'a alteração inclui registos de outra modalidade: ' . implode(', ', array_keys($fora)),
        ], 403);
    }
}

// ---- Textos formatados: filtrar antes de gravar ---------------------
// Privacidade e Termos são inseridos nas páginas como HTML. Sem isto,
// quem entre no painel pode pôr script no site público.
if (isset($novos['siteLegal']) && is_array($novos['siteLegal'])) {
    foreach (['privacidade', 'termos'] as $campo) {
        if (isset($novos['siteLegal'][$campo]) && is_string($novos['siteLegal'][$campo])) {
            $novos['siteLegal'][$campo] = jsc_sanitizar_html($novos['siteLegal'][$campo]);
        }
    }
}

// ---- Corpo das notícias: filtrar só o que mudou ---------------------
// As notícias também vão para a página como HTML, pelo mesmo caminho.
// Mas o painel envia sempre todas, e filtrar todas reescreveria em
// silêncio o que já está escrito. Por isso só passam pelo filtro as
// notícias novas e aquelas cujo texto foi alterado.
//
// As que ficaram por tocar mantêm-se exatamente como estavam. Para as
// tratar é preciso uma migração à parte, com o impacto à vista primeiro:
// ver tools/impacto-noticias.js.
if (isset($novos['noticias']) && is_array($novos['noticias'])) {
    $antesPorId = [];
    if (isset($antigos['noticias']) && is_array($antigos['noticias'])) {
        foreach ($antigos['noticias'] as $n) {
            if (is_array($n) && isset($n['id'])) $antesPorId[(string)$n['id']] = $n;
        }
    }
    foreach ($novos['noticias'] as $i => $n) {
        if (!is_array($n) || !isset($n['resumo']) || !is_string($n['resumo'])) continue;
        $id = isset($n['id']) ? (string)$n['id'] : null;
        $antiga = ($id !== null && isset($antesPorId[$id])) ? $antesPorId[$id] : null;
        $inalterada = $antiga !== null
            && isset($antiga['resumo']) && is_string($antiga['resumo'])
            && $antiga['resumo'] === $n['resumo'];
        if ($inalterada) continue;
        $novos['noticias'][$i]['resumo'] = jsc_sanitizar_noticia($n['resumo']);
    }
}

// ---- Gravar --------------------------------------------------------
// As áreas que não venham no pedido ficam como estavam. O painel envia
// sempre tudo, mas assim um pedido parcial nunca apaga o que não menciona.
$gravar = array_merge($antigos, $novos);

$dir = dirname(DATA_FILE);
if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
    jsc_saida(['ok' => false, 'error' => 'nao foi possivel criar a pasta data/'], 500);
}

$tmp = DATA_FILE . '.tmp';
if (file_put_contents($tmp, json_encode($gravar, JSON_UNESCAPED_UNICODE)) === false || !rename($tmp, DATA_FILE)) {
    @unlink($tmp);
    jsc_saida(['ok' => false, 'error' => 'erro ao guardar'], 500);
}

jsc_saida([
    'ok'        => true,
    'savedAt'   => date('c'),
    'alteradas' => $alteradas,
    'porQuem'   => $perfil['nome'],
]);
