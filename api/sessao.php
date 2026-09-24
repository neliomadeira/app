<?php
// =====================================================
// SESSÃO E PERMISSÕES — Juventude Sport Campinense
// =====================================================
// Guarda os utilizadores num ficheiro em data/, protegido pelo .htaccess
// dessa pasta e pela regra que bloqueia .json na raiz. Não precisa de
// MySQL: o painel passa a ter autenticação a sério sem obrigar a
// configurar base de dados.
//
// As palavras-passe são guardadas com password_hash (bcrypt, custo 12).
// Nunca é possível lê-las de volta — só verificar.
// =====================================================

require_once __DIR__ . '/config.php';

define('JSC_UTILIZADORES', __DIR__ . '/../data/utilizadores.json');

// ---- Perfis e permissões ------------------------------------------
// Princípio de menor privilégio: cada perfil recebe só o que precisa.
// A verificação acontece aqui, no servidor, a cada pedido. O painel
// também esconde o que não é permitido, mas isso é conforto — quem
// contornar a interface esbarra à mesma nestas funções.
//
// As capacidades correspondem às áreas que o Publicar pode alterar, mais
// as operações que têm endpoint próprio.

// Capacidade -> que chaves do conteúdo publicado ela autoriza a mudar.
function jsc_areas() {
    return [
        'noticias'      => ['noticias'],
        'galeria'       => ['galeria'],
        'videos'        => ['videos'],
        'patrocinadores'=> ['patrocinadores'],
        'homepage'      => ['siteBanner', 'sitePopup', 'siteAviso'],
        'institucional' => ['historia', 'palmares', 'siteLegal', 'dadosClube'],
        'redes'         => ['fbPosts'],
        'atletas'       => ['atletas'],
        'treinadores'   => ['treinadores'],
        'equipas'       => ['escaloes', 'seniores', 'senioresInfo'],
        'jogos'         => ['jogos', 'classData', 'classConfig'],
        'agenda'        => ['agenda'],
        'modalidades'   => ['modalidades', 'modPosts'],
        'configuracoes' => ['siteConfig', 'siteCores', 'emailConfig', 'logos', 'siteManutencao'],
    ];
}

// Capacidades sem área publicável: têm endpoint próprio.
//   inscricoes   — ler e gerir inscrições e mensagens (dados pessoais)
//   utilizadores — criar, listar e apagar contas do painel
//   importar     — usar o proxy para importar plantéis e calendários
//   matchday     — operar o jogo ao vivo
//   seguranca    — mexer na segurança de contas de Super Admin

function jsc_perfis() {
    $conteudo = ['noticias', 'galeria', 'videos', 'patrocinadores', 'homepage', 'institucional', 'redes'];
    $desporto = ['atletas', 'treinadores', 'equipas', 'jogos', 'agenda', 'importar'];

    return [
        'super-admin' => [
            'nome'       => 'Super Admin',
            'permissoes' => array_merge($conteudo, $desporto,
                            ['modalidades', 'configuracoes', 'inscricoes', 'utilizadores', 'matchday', 'seguranca']),
            'modalidade' => null,
        ],
        'administrador' => [
            'nome'       => 'Administrador',
            'permissoes' => array_merge($conteudo, $desporto,
                            ['modalidades', 'configuracoes', 'inscricoes', 'matchday']),
            // Sem 'utilizadores' nem 'seguranca': não mexe em contas nem na
            // segurança do Super Admin.
            'modalidade' => null,
        ],
        'comunicacao' => [
            'nome'       => 'Comunicação',
            'permissoes' => $conteudo,
            // Sem inscrições: são dados pessoais de menores.
            'modalidade' => null,
        ],
        'futebol' => [
            'nome'       => 'Futebol',
            'permissoes' => $desporto,
            'modalidade' => 'futebol',
        ],
        'futsal' => [
            'nome'       => 'Futsal',
            'permissoes' => $desporto,
            'modalidade' => 'futsal',
        ],
        'matchday' => [
            'nome'       => 'Matchday',
            'permissoes' => ['matchday'],
            'modalidade' => null,
        ],
    ];
}

function jsc_perfil_do_utilizador() {
    $u = jsc_utilizador();
    if (!$u) return null;
    $perfis = jsc_perfis();
    return isset($perfis[$u['perfil']]) ? $perfis[$u['perfil']] : null;
}

// Que áreas do conteúdo publicado este perfil pode alterar.
function jsc_areas_permitidas() {
    $p = jsc_perfil_do_utilizador();
    if (!$p) return [];
    $areas = jsc_areas();
    $chaves = [];
    foreach ($p['permissoes'] as $cap) {
        if (isset($areas[$cap])) $chaves = array_merge($chaves, $areas[$cap]);
    }
    return array_values(array_unique($chaves));
}

// ---- Arranque da sessão --------------------------------------------
function jsc_sessao_iniciar() {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $seguro = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
           || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $seguro,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_name('JSCSESSAO');
    session_start();
}

// ---- Ficheiro de utilizadores --------------------------------------
function jsc_ler_utilizadores() {
    if (!is_file(JSC_UTILIZADORES)) return null;
    $raw = file_get_contents(JSC_UTILIZADORES);
    $d = json_decode($raw, true);
    return is_array($d) ? $d : null;
}

function jsc_gravar_utilizadores($dados) {
    $dir = dirname(JSC_UTILIZADORES);
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $tmp = JSC_UTILIZADORES . '.tmp';
    $ok = file_put_contents($tmp, json_encode($dados, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    if ($ok === false) return false;
    @chmod($tmp, 0600);
    return rename($tmp, JSC_UTILIZADORES);
}

function jsc_primeiro_arranque() {
    $d = jsc_ler_utilizadores();
    return !$d || empty($d['utilizadores']);
}

// ---- Utilizador da sessão ------------------------------------------
function jsc_utilizador() {
    jsc_sessao_iniciar();
    if (empty($_SESSION['jsc_user'])) return null;
    $d = jsc_ler_utilizadores();
    if (!$d) return null;
    foreach ($d['utilizadores'] as $u) {
        if ($u['utilizador'] === $_SESSION['jsc_user']) {
            unset($u['hash']);
            return $u;
        }
    }
    return null;
}

function jsc_tem_sessao() {
    return jsc_utilizador() !== null;
}

// Verifica uma capacidade. Não há atalho: cada perfil tem a sua lista.
function jsc_pode($permissao) {
    $p = jsc_perfil_do_utilizador();
    if (!$p) return false;
    return in_array($permissao, $p['permissoes'], true);
}

// Interrompe o pedido se não houver sessão com a permissão pedida.
function jsc_exigir($permissao) {
    if (jsc_pode($permissao)) return;
    http_response_code(jsc_tem_sessao() ? 403 : 401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => jsc_tem_sessao() ? 'sem permissao' : 'sem sessao']);
    exit;
}

// ---- Proteção contra pedidos vindos de outro site -------------------
// O painel envia sempre este cabeçalho. Um formulário noutro site não o
// consegue enviar sem passar por uma verificação prévia do browser.
function jsc_exigir_pedido_do_painel() {
    if (isset($_SERVER['HTTP_X_JSC_PAINEL'])) return;
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'pedido invalido']);
    exit;
}

// ---- Bloqueio após tentativas falhadas ------------------------------
function jsc_bloqueio_ler() {
    $f = __DIR__ . '/../data/tentativas.json';
    if (!is_file($f)) return [];
    $d = json_decode(file_get_contents($f), true);
    return is_array($d) ? $d : [];
}

function jsc_bloqueio_gravar($d) {
    $f = __DIR__ . '/../data/tentativas.json';
    $dir = dirname($f);
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    file_put_contents($f, json_encode($d));
    @chmod($f, 0600);
}

function jsc_bloqueado($utilizador) {
    $d = jsc_bloqueio_ler();
    $k = strtolower($utilizador);
    if (empty($d[$k])) return 0;
    $ate = isset($d[$k]['ate']) ? (int)$d[$k]['ate'] : 0;
    return $ate > time() ? $ate - time() : 0;
}

function jsc_registar_falha($utilizador) {
    $d = jsc_bloqueio_ler();
    $k = strtolower($utilizador);
    $n = isset($d[$k]['n']) ? (int)$d[$k]['n'] + 1 : 1;
    // 5 tentativas livres; a partir daí espera que duplica, até 15 minutos.
    $espera = $n > 5 ? min(900, pow(2, $n - 5) * 5) : 0;
    $d[$k] = ['n' => $n, 'ate' => time() + $espera];
    jsc_bloqueio_gravar($d);
    return $espera;
}

function jsc_limpar_falhas($utilizador) {
    $d = jsc_bloqueio_ler();
    unset($d[strtolower($utilizador)]);
    jsc_bloqueio_gravar($d);
}
