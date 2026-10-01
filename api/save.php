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

// ---- Corpo vazio por engano, ou corpo recusado pelo servidor? -------
// As imagens do painel não são enviadas como ficheiros: ficam dentro deste
// JSON, como data: URI. Quando o conteúdo passa o post_max_size, o PHP
// descarta o corpo inteiro e o que chega aqui é uma string vazia — enquanto o
// CONTENT_LENGTH continua a anunciar o tamanho que o browser enviou.
//
// Antes, as duas situações davam a mesma resposta: "corpo vazio". Quem
// publicasse uma notícia com imagens via isso e não tinha como saber que o
// problema era o limite do servidor.
$anunciado = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
$recebido  = $raw === false ? 0 : strlen($raw);
if ($anunciado > 0 && $recebido < $anunciado) {
    $mb = function ($n) { return number_format($n / 1048576, 2, ',', ' ') . ' MB'; };
    jsc_saida([
        'ok'    => false,
        'error' => 'O conteudo enviado (' . $mb($anunciado) . ') foi recusado pelo servidor antes de '
                 . 'chegar aqui: excede o post_max_size, que neste alojamento esta em '
                 . (string)ini_get('post_max_size') . '. Remova ou substitua as imagens mais pesadas, '
                 . 'ou peca ao alojamento para aumentar o limite.',
        'limite' => (string)ini_get('post_max_size'),
        'enviado' => $anunciado,
        'recebido' => $recebido,
    ], 413);
}
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
    // Uma chave que NÃO vem no pedido significa "inalterada", não "alterada".
    // O array_merge mais abaixo já preserva o que lá está — a intenção está
    // escrita no comentário dele —, mas esta contagem tratava a ausência como
    // uma alteração e recusava com 403 um pedido parcial que não mudava nada.
    // Nada se perde em permissões: o que não vem no pedido não é escrito.
    if (!array_key_exists($k, $novos)) continue;
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

// O título do herói e a morada são os outros dois textos do painel que chegam
// às páginas como HTML — o primeiro precisa do <span> que o CSS pinta, a
// segunda do <br> que separa a rua do código postal. Sem filtro, quem entre no
// painel punha <img onerror> no título da página inicial, e corria no browser
// de todos os visitantes: foi medido a correr antes desta linha existir.
//
// Filtro estreito, não o dos textos legais: aqui não fazem sentido ligações,
// listas nem títulos.
if (isset($novos['siteConfig']) && is_array($novos['siteConfig'])) {
    foreach (['heroTitle', 'contactAddress'] as $campo) {
        if (isset($novos['siteConfig'][$campo]) && is_string($novos['siteConfig'][$campo])) {
            $novos['siteConfig'][$campo] = jsc_sanitizar_inline($novos['siteConfig'][$campo]);
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

// ---- Gravar e gerar ------------------------------------------------
// As áreas que não venham no pedido ficam como estavam. O painel envia
// sempre tudo, mas assim um pedido parcial nunca apaga o que não menciona.
$gravar = array_merge($antigos, $novos);

$dir = dirname(DATA_FILE);
if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
    jsc_saida(['ok' => false, 'error' => 'nao foi possivel criar a pasta data/'], 500);
}

$bytes = json_encode($gravar, JSON_UNESCAPED_UNICODE);
if ($bytes === false) {
    jsc_saida(['ok' => false, 'error' => 'nao foi possivel converter o conteudo para JSON'], 500);
}

// O data/db.json e as páginas geradas movem-se juntos, numa só transação.
// Se a geração falhar, nada avança: o conteúdo antigo fica onde estava e o
// painel fica a saber. Assim nunca há dados novos com HTML antigo, nem
// metade do site publicado. Ver api/geracao.php.
require_once __DIR__ . '/geracao.php';
$pub = jsc_publicar($gravar, $bytes, $perfil['nome']);

if (!$pub['ok']) {
    jsc_saida([
        'ok'        => false,
        'error'     => 'publicacao abortada: ' . implode('; ', $pub['erros']),
        'revertido' => $pub['revertido'],
        'avisos'    => $pub['avisos'],
    ], 500);
}

jsc_saida([
    'ok'        => true,
    'savedAt'   => date('c'),
    'alteradas' => $alteradas,
    'porQuem'   => $perfil['nome'],
    'gerados'   => $pub['ficheiros'],
    'avisos'    => $pub['avisos'],
]);
