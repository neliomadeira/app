<?php
// Gestão dos administradores do painel.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/sessao.php';

const JSC_MIN_PASSWORD_U = 10;

function resposta($dados, $code = 200) {
    http_response_code($code);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = jsc_db();
if (!$pdo) resposta(['ok' => false, 'error' => 'bd nao configurada'], 503);

$eu = jsc_exigir_admin();

// Só o dono mexe nas contas dos outros. Cada um muda a sua própria
// palavra-passe, e para isso basta estar autenticado.
function exigir_dono($eu) {
    if (($eu['papel'] ?? '') !== 'dono' && $eu['id'] !== 0) {
        resposta(['ok' => false, 'error' => 'apenas o administrador principal pode gerir contas'], 403);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = $pdo->query(
        'SELECT id, utilizador, email, papel, ativo, criado_em, ultimo_acesso
           FROM jsc_utilizadores ORDER BY id'
    )->fetchAll();
    resposta(['ok' => true, 'utilizadores' => $rows, 'eu' => $eu]);
}

$corpo = json_decode(file_get_contents('php://input'), true);
if (!is_array($corpo)) resposta(['ok' => false, 'error' => 'json invalido'], 400);
$acao = $corpo['acao'] ?? '';

// ---- Criar um administrador ----
if ($acao === 'criar') {
    exigir_dono($eu);
    $nome  = trim($corpo['utilizador'] ?? '');
    $email = trim($corpo['email'] ?? '');
    $pw    = $corpo['palavra_passe'] ?? '';

    if (!preg_match('/^[A-Za-z0-9._-]{3,50}$/', $nome)) resposta(['ok' => false, 'error' => 'utilizador inválido (3-50 caracteres: letras, números, . _ -)'], 400);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL))     resposta(['ok' => false, 'error' => 'email inválido'], 400);
    if (strlen($pw) < JSC_MIN_PASSWORD_U)               resposta(['ok' => false, 'error' => 'a palavra-passe precisa de pelo menos ' . JSC_MIN_PASSWORD_U . ' caracteres'], 400);

    $ja = $pdo->prepare('SELECT id FROM jsc_utilizadores WHERE utilizador = ?');
    $ja->execute([$nome]);
    if ($ja->fetch()) resposta(['ok' => false, 'error' => 'já existe um utilizador com esse nome'], 409);

    $stmt = $pdo->prepare('INSERT INTO jsc_utilizadores (utilizador, email, palavra_passe, papel) VALUES (?, ?, ?, ?)');
    $stmt->execute([$nome, $email, password_hash($pw, PASSWORD_DEFAULT), 'admin']);
    resposta(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);
}

// ---- Mudar a minha palavra-passe ----
if ($acao === 'alterar-password') {
    $atual = $corpo['atual'] ?? '';
    $nova  = $corpo['nova'] ?? '';
    if (strlen($nova) < JSC_MIN_PASSWORD_U) resposta(['ok' => false, 'error' => 'a nova palavra-passe precisa de pelo menos ' . JSC_MIN_PASSWORD_U . ' caracteres'], 400);
    if ($eu['id'] === 0) resposta(['ok' => false, 'error' => 'inicie sessão para mudar a palavra-passe'], 403);

    $stmt = $pdo->prepare('SELECT palavra_passe FROM jsc_utilizadores WHERE id = ?');
    $stmt->execute([$eu['id']]);
    $hash = $stmt->fetchColumn();
    if (!$hash || !password_verify($atual, $hash)) resposta(['ok' => false, 'error' => 'a palavra-passe atual não está correta'], 403);

    $pdo->prepare('UPDATE jsc_utilizadores SET palavra_passe = ? WHERE id = ?')
        ->execute([password_hash($nova, PASSWORD_DEFAULT), $eu['id']]);
    resposta(['ok' => true]);
}

// ---- Redefinir a palavra-passe de outro (recuperação sem email) ----
if ($acao === 'redefinir') {
    exigir_dono($eu);
    $id   = (int)($corpo['id'] ?? 0);
    $nova = $corpo['nova'] ?? '';
    if (!$id) resposta(['ok' => false, 'error' => 'id invalido'], 400);
    if (strlen($nova) < JSC_MIN_PASSWORD_U) resposta(['ok' => false, 'error' => 'a palavra-passe precisa de pelo menos ' . JSC_MIN_PASSWORD_U . ' caracteres'], 400);

    $stmt = $pdo->prepare('UPDATE jsc_utilizadores SET palavra_passe = ? WHERE id = ?');
    $stmt->execute([password_hash($nova, PASSWORD_DEFAULT), $id]);
    resposta(['ok' => true]);
}

// ---- Remover ----
if ($acao === 'remover') {
    exigir_dono($eu);
    $id = (int)($corpo['id'] ?? 0);
    if (!$id) resposta(['ok' => false, 'error' => 'id invalido'], 400);
    if ($id === $eu['id']) resposta(['ok' => false, 'error' => 'não pode remover a sua própria conta'], 400);

    $ativos = (int)$pdo->query('SELECT COUNT(*) FROM jsc_utilizadores WHERE ativo = 1')->fetchColumn();
    if ($ativos <= 1) resposta(['ok' => false, 'error' => 'não pode remover o único administrador'], 400);

    $pdo->prepare('DELETE FROM jsc_utilizadores WHERE id = ?')->execute([$id]);
    resposta(['ok' => true]);
}

resposta(['ok' => false, 'error' => 'acao invalida'], 400);
