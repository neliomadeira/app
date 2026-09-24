<?php
// =====================================================
// AUTENTICAÇÃO DO PAINEL — Juventude Sport Campinense
// =====================================================
// Substitui o login que era feito só em JavaScript, onde as credenciais
// ficavam no localStorage e a comparação corria no browser do visitante.
//
// Ações (?acao=...):
//   estado            GET   diz se há sessão e se é o primeiro arranque
//   criar-primeiro    POST  cria o Super Admin, só enquanto não houver nenhum
//   entrar            POST  inicia sessão
//   sair              POST  termina sessão
//   mudar-password    POST  muda a palavra-passe do próprio
//   utilizadores      GET   lista (só quem gere utilizadores)
//   criar-utilizador  POST  cria (só quem gere utilizadores)
//   apagar-utilizador POST  apaga (só quem gere utilizadores)
// =====================================================

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/sessao.php';

function jsc_responder($dados, $codigo = 200) {
    http_response_code($codigo);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

function jsc_corpo() {
    $raw = file_get_contents('php://input');
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}

function jsc_validar_password($p) {
    if (strlen($p) < 10) return 'A palavra-passe tem de ter pelo menos 10 caracteres.';
    if (!preg_match('/[A-Za-zÀ-ÿ]/', $p)) return 'A palavra-passe tem de ter pelo menos uma letra.';
    if (!preg_match('/[0-9]/', $p))       return 'A palavra-passe tem de ter pelo menos um algarismo.';
    $comuns = ['1234567890', 'password123', 'campinense', 'administrador'];
    foreach ($comuns as $c) if (stripos($p, $c) !== false) return 'Escolha uma palavra-passe menos previsível.';
    return null;
}

function jsc_normalizar_utilizador($u) {
    $u = trim((string)$u);
    return preg_match('/^[A-Za-z0-9._-]{3,32}$/', $u) ? $u : null;
}

$acao   = isset($_GET['acao']) ? $_GET['acao'] : '';
$metodo = $_SERVER['REQUEST_METHOD'];

// ---------------------------------------------------------------
// estado — o painel chama isto ao abrir
// ---------------------------------------------------------------
if ($acao === 'estado' && $metodo === 'GET') {
    $u = jsc_utilizador();
    $perfis = [];
    foreach (jsc_perfis() as $k => $p) {
        $perfis[$k] = ['nome' => $p['nome'], 'definido' => !empty($p['permissoes'])];
    }
    jsc_responder([
        'ok'              => true,
        'primeiroArranque'=> jsc_primeiro_arranque(),
        'sessao'          => $u ? [
            'utilizador' => $u['utilizador'],
            'nome'       => $u['nome'],
            'perfil'     => $u['perfil'],
            'perfilNome' => jsc_perfis()[$u['perfil']]['nome'] ?? $u['perfil'],
            'permissoes' => jsc_perfil_do_utilizador()['permissoes'],
            'modalidade' => jsc_perfil_do_utilizador()['modalidade'],
        ] : null,
        'perfis'          => $perfis,
    ]);
}

if ($metodo !== 'POST' && $acao !== 'utilizadores') {
    jsc_responder(['ok' => false, 'error' => 'acao invalida'], 400);
}

if ($metodo === 'POST') jsc_exigir_pedido_do_painel();

// ---------------------------------------------------------------
// criar-primeiro — só funciona enquanto não existir nenhum utilizador
// ---------------------------------------------------------------
if ($acao === 'criar-primeiro') {
    if (!jsc_primeiro_arranque()) {
        jsc_responder(['ok' => false, 'error' => 'ja existe um administrador'], 409);
    }
    $b = jsc_corpo();
    $user = jsc_normalizar_utilizador(isset($b['utilizador']) ? $b['utilizador'] : '');
    $pass = isset($b['password']) ? (string)$b['password'] : '';
    $nome = trim(isset($b['nome']) ? (string)$b['nome'] : '');
    if (!$user) jsc_responder(['ok' => false, 'error' => 'Nome de utilizador inválido (3 a 32 letras, algarismos, ponto, hífen ou underscore).'], 400);
    $erro = jsc_validar_password($pass);
    if ($erro) jsc_responder(['ok' => false, 'error' => $erro], 400);

    $dados = ['versao' => 1, 'utilizadores' => [[
        'utilizador' => $user,
        'nome'       => $nome !== '' ? $nome : $user,
        'perfil'     => 'super-admin',
        'hash'       => password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12]),
        'criadoEm'   => date('c'),
    ]]];
    if (!jsc_gravar_utilizadores($dados)) {
        jsc_responder(['ok' => false, 'error' => 'Não foi possível gravar. Confirme que a pasta data/ tem permissão de escrita.'], 500);
    }
    jsc_sessao_iniciar();
    session_regenerate_id(true);
    $_SESSION['jsc_user'] = $user;
    $p = jsc_perfis()['super-admin'];
    jsc_responder(['ok' => true, 'sessao' => [
        'utilizador' => $user, 'nome' => $dados['utilizadores'][0]['nome'], 'perfil' => 'super-admin',
        'perfilNome' => $p['nome'], 'permissoes' => $p['permissoes'], 'modalidade' => $p['modalidade'],
    ]]);
}

// ---------------------------------------------------------------
// entrar
// ---------------------------------------------------------------
if ($acao === 'entrar') {
    $b = jsc_corpo();
    $user = trim(isset($b['utilizador']) ? (string)$b['utilizador'] : '');
    $pass = isset($b['password']) ? (string)$b['password'] : '';
    if ($user === '' || $pass === '') jsc_responder(['ok' => false, 'error' => 'Indique utilizador e palavra-passe.'], 400);

    $espera = jsc_bloqueado($user);
    if ($espera > 0) {
        jsc_responder(['ok' => false, 'error' => 'Demasiadas tentativas. Tente daqui a ' . ceil($espera / 60) . ' minuto(s).'], 429);
    }

    $d = jsc_ler_utilizadores();
    $encontrado = null;
    if ($d) foreach ($d['utilizadores'] as $u) {
        if (strcasecmp($u['utilizador'], $user) === 0) { $encontrado = $u; break; }
    }

    // Verificar sempre um hash, exista ou não o utilizador, para o tempo de
    // resposta não revelar quais os nomes que existem.
    $hash = $encontrado ? $encontrado['hash'] : '$2y$12$' . str_repeat('.', 53);
    $valido = password_verify($pass, $hash) && $encontrado;

    if (!$valido) {
        $esperaNova = jsc_registar_falha($user);
        jsc_responder(['ok' => false, 'error' => 'Utilizador ou palavra-passe incorretos.'
            . ($esperaNova ? ' Aguarde ' . ceil($esperaNova / 60) . ' minuto(s).' : '')], 401);
    }

    if (password_needs_rehash($encontrado['hash'], PASSWORD_BCRYPT, ['cost' => 12])) {
        foreach ($d['utilizadores'] as &$u) {
            if ($u['utilizador'] === $encontrado['utilizador']) $u['hash'] = password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12]);
        }
        unset($u);
        jsc_gravar_utilizadores($d);
    }

    jsc_limpar_falhas($user);
    jsc_sessao_iniciar();
    session_regenerate_id(true);
    $_SESSION['jsc_user'] = $encontrado['utilizador'];
    $p = jsc_perfis()[$encontrado['perfil']] ?? ['nome' => $encontrado['perfil'], 'permissoes' => [], 'modalidade' => null];
    jsc_responder(['ok' => true, 'sessao' => [
        'utilizador' => $encontrado['utilizador'], 'nome' => $encontrado['nome'], 'perfil' => $encontrado['perfil'],
        'perfilNome' => $p['nome'], 'permissoes' => $p['permissoes'], 'modalidade' => $p['modalidade'],
    ]]);
}

// ---------------------------------------------------------------
// sair
// ---------------------------------------------------------------
if ($acao === 'sair') {
    jsc_sessao_iniciar();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    jsc_responder(['ok' => true]);
}

// ---------------------------------------------------------------
// mudar-password (do próprio)
// ---------------------------------------------------------------
if ($acao === 'mudar-password') {
    $eu = jsc_utilizador();
    if (!$eu) jsc_responder(['ok' => false, 'error' => 'sem sessao'], 401);
    $b = jsc_corpo();
    $atual = isset($b['atual']) ? (string)$b['atual'] : '';
    $nova  = isset($b['nova'])  ? (string)$b['nova']  : '';
    $erro = jsc_validar_password($nova);
    if ($erro) jsc_responder(['ok' => false, 'error' => $erro], 400);

    $d = jsc_ler_utilizadores();
    $ok = false;
    foreach ($d['utilizadores'] as &$u) {
        if ($u['utilizador'] === $eu['utilizador']) {
            if (!password_verify($atual, $u['hash'])) {
                jsc_responder(['ok' => false, 'error' => 'A palavra-passe atual está errada.'], 401);
            }
            $u['hash'] = password_hash($nova, PASSWORD_BCRYPT, ['cost' => 12]);
            $ok = true;
        }
    }
    unset($u);
    if (!$ok || !jsc_gravar_utilizadores($d)) jsc_responder(['ok' => false, 'error' => 'Não foi possível gravar.'], 500);
    jsc_responder(['ok' => true]);
}

// ---------------------------------------------------------------
// utilizadores — listar, criar, apagar
// ---------------------------------------------------------------
function jsc_exigir_gestor() {
    $eu = jsc_utilizador();
    if (!$eu) jsc_responder(['ok' => false, 'error' => 'sem sessao'], 401);
    if (!jsc_pode('utilizadores')) {
        jsc_responder(['ok' => false, 'error' => 'sem permissao para gerir utilizadores'], 403);
    }
    return $eu;
}

if ($acao === 'utilizadores' && $metodo === 'GET') {
    jsc_exigir_gestor();
    $d = jsc_ler_utilizadores();
    $lista = [];
    foreach ($d['utilizadores'] as $u) {
        $lista[] = ['utilizador' => $u['utilizador'], 'nome' => $u['nome'], 'perfil' => $u['perfil'], 'criadoEm' => isset($u['criadoEm']) ? $u['criadoEm'] : null];
    }
    jsc_responder(['ok' => true, 'utilizadores' => $lista]);
}

if ($acao === 'criar-utilizador') {
    jsc_exigir_gestor();
    $b = jsc_corpo();
    $user   = jsc_normalizar_utilizador(isset($b['utilizador']) ? $b['utilizador'] : '');
    $pass   = isset($b['password']) ? (string)$b['password'] : '';
    $nome   = trim(isset($b['nome']) ? (string)$b['nome'] : '');
    $perfil = isset($b['perfil']) ? (string)$b['perfil'] : '';
    if (!$user) jsc_responder(['ok' => false, 'error' => 'Nome de utilizador inválido.'], 400);
    if (!isset(jsc_perfis()[$perfil])) jsc_responder(['ok' => false, 'error' => 'Perfil desconhecido.'], 400);
    $erro = jsc_validar_password($pass);
    if ($erro) jsc_responder(['ok' => false, 'error' => $erro], 400);

    $d = jsc_ler_utilizadores();
    foreach ($d['utilizadores'] as $u) {
        if (strcasecmp($u['utilizador'], $user) === 0) jsc_responder(['ok' => false, 'error' => 'Já existe um utilizador com esse nome.'], 409);
    }
    $d['utilizadores'][] = [
        'utilizador' => $user,
        'nome'       => $nome !== '' ? $nome : $user,
        'perfil'     => $perfil,
        'hash'       => password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12]),
        'criadoEm'   => date('c'),
    ];
    if (!jsc_gravar_utilizadores($d)) jsc_responder(['ok' => false, 'error' => 'Não foi possível gravar.'], 500);
    jsc_responder(['ok' => true]);
}

if ($acao === 'apagar-utilizador') {
    $eu = jsc_exigir_gestor();
    $b = jsc_corpo();
    $alvo = isset($b['utilizador']) ? (string)$b['utilizador'] : '';
    if (strcasecmp($alvo, $eu['utilizador']) === 0) {
        jsc_responder(['ok' => false, 'error' => 'Não pode apagar a sua própria conta.'], 400);
    }
    $d = jsc_ler_utilizadores();
    $antes = count($d['utilizadores']);
    $d['utilizadores'] = array_values(array_filter($d['utilizadores'], function ($u) use ($alvo) {
        return strcasecmp($u['utilizador'], $alvo) !== 0;
    }));
    if (count($d['utilizadores']) === $antes) jsc_responder(['ok' => false, 'error' => 'Utilizador não encontrado.'], 404);
    // Nunca deixar o painel sem quem possa gerir utilizadores.
    $gestores = 0;
    foreach ($d['utilizadores'] as $u) {
        $perfil = jsc_perfis()[$u['perfil']] ?? null;
        if ($perfil && in_array('utilizadores', $perfil['permissoes'], true)) $gestores++;
    }
    if ($gestores === 0) jsc_responder(['ok' => false, 'error' => 'Tem de ficar pelo menos um Super Admin.'], 400);
    if (!jsc_gravar_utilizadores($d)) jsc_responder(['ok' => false, 'error' => 'Não foi possível gravar.'], 500);
    jsc_responder(['ok' => true]);
}

jsc_responder(['ok' => false, 'error' => 'acao invalida'], 400);
