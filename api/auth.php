<?php
// Login, logout e estado da sessão do painel.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/sessao.php';

const JSC_MIN_PASSWORD = 10;

function resposta($dados, $code = 200) {
    http_response_code($code);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = jsc_db();
if (!$pdo) {
    resposta(['ok' => false, 'error' => 'bd nao configurada',
              'detalhe' => 'O login exige base de dados. Preencha DB_NAME em api/config.local.php.'], 503);
}

$corpo = json_decode(file_get_contents('php://input'), true);
if (!is_array($corpo)) $corpo = [];
$acao = $corpo['acao'] ?? ($_GET['acao'] ?? '');

// Quantos administradores existem — usado para saber se falta a instalação
$total = (int)$pdo->query('SELECT COUNT(*) FROM jsc_utilizadores WHERE ativo = 1')->fetchColumn();

// ---- Estado da sessão ----
if ($acao === 'sessao') {
    $u = jsc_utilizador_atual();
    resposta(['ok' => true, 'autenticado' => (bool)$u, 'utilizador' => $u, 'instalado' => $total > 0]);
}

// ---- Primeira instalação: criar o primeiro administrador ----
// Só funciona enquanto não existir nenhum. A partir daí fecha-se sozinha,
// portanto não é preciso lembrar-se de a desactivar.
if ($acao === 'setup') {
    if ($total > 0) resposta(['ok' => false, 'error' => 'ja existe administrador'], 409);

    $nome  = trim($corpo['utilizador'] ?? '');
    $email = trim($corpo['email'] ?? '');
    $pw    = $corpo['palavra_passe'] ?? '';

    if (!preg_match('/^[A-Za-z0-9._-]{3,50}$/', $nome)) resposta(['ok' => false, 'error' => 'utilizador inválido (3-50 caracteres: letras, números, . _ -)'], 400);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL))     resposta(['ok' => false, 'error' => 'email inválido'], 400);
    if (strlen($pw) < JSC_MIN_PASSWORD)                 resposta(['ok' => false, 'error' => 'a palavra-passe precisa de pelo menos ' . JSC_MIN_PASSWORD . ' caracteres'], 400);

    $stmt = $pdo->prepare('INSERT INTO jsc_utilizadores (utilizador, email, palavra_passe, papel) VALUES (?, ?, ?, ?)');
    $stmt->execute([$nome, $email, password_hash($pw, PASSWORD_DEFAULT), 'dono']);
    $id = (int)$pdo->lastInsertId();

    jsc_criar_sessao(['id' => $id, 'utilizador' => $nome, 'papel' => 'dono', 'email' => $email]);
    resposta(['ok' => true, 'utilizador' => ['id' => $id, 'utilizador' => $nome, 'papel' => 'dono', 'email' => $email]]);
}

// ---- Login ----
if ($acao === 'login') {
    $nome = trim($corpo['utilizador'] ?? '');
    $pw   = $corpo['palavra_passe'] ?? '';
    if ($nome === '' || $pw === '') resposta(['ok' => false, 'error' => 'indique utilizador e palavra-passe'], 400);

    $falhas = jsc_tentativas_recentes($pdo, $nome);
    if ($falhas >= JSC_MAX_TENTATIVAS) {
        resposta(['ok' => false, 'error' => 'demasiadas tentativas falhadas. Tente novamente dentro de ' . (JSC_BLOQUEIO_SEGUNDOS / 60) . ' minutos.'], 429);
    }

    $stmt = $pdo->prepare('SELECT * FROM jsc_utilizadores WHERE utilizador = ? AND ativo = 1');
    $stmt->execute([$nome]);
    $u = $stmt->fetch();

    // Verificar sempre um hash, mesmo sem utilizador, para que o tempo de
    // resposta não revele quais os nomes que existem.
    $hash = $u ? $u['palavra_passe'] : '$2y$12$invalidoinvalidoinvalidoinvalidoinvalidoinvalidoinvalidoinva';
    $valida = password_verify($pw, $hash);

    if (!$u || !$valida) {
        jsc_registar_tentativa($pdo, $nome);
        $restantes = max(0, JSC_MAX_TENTATIVAS - ($falhas + 1));
        resposta(['ok' => false, 'error' => 'credenciais inválidas', 'restantes' => $restantes], 401);
    }

    // Actualizar o hash se o custo ou o algoritmo por omissão mudarem
    if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
        $up = $pdo->prepare('UPDATE jsc_utilizadores SET palavra_passe = ? WHERE id = ?');
        $up->execute([password_hash($pw, PASSWORD_DEFAULT), $u['id']]);
    }

    jsc_limpar_tentativas($pdo, $nome);
    $pdo->prepare('UPDATE jsc_utilizadores SET ultimo_acesso = NOW() WHERE id = ?')->execute([$u['id']]);
    jsc_criar_sessao($u);

    resposta(['ok' => true, 'utilizador' => [
        'id' => (int)$u['id'], 'utilizador' => $u['utilizador'],
        'papel' => $u['papel'], 'email' => $u['email'],
    ]]);
}

// ---- Logout ----
if ($acao === 'logout') {
    jsc_terminar_sessao();
    resposta(['ok' => true]);
}

resposta(['ok' => false, 'error' => 'acao invalida'], 400);
