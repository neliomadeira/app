<?php
// Recuperação de palavra-passe por email.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/sessao.php';

const JSC_VALIDADE_MIN   = 60;  // o link expira ao fim de 1 hora
const JSC_MIN_PASSWORD_R = 10;

function resposta($dados, $code = 200) {
    http_response_code($code);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = jsc_db();
if (!$pdo) resposta(['ok' => false, 'error' => 'bd nao configurada'], 503);

$corpo = json_decode(file_get_contents('php://input'), true);
if (!is_array($corpo)) resposta(['ok' => false, 'error' => 'json invalido'], 400);
$acao = $corpo['acao'] ?? '';

// ---- Pedir o link ----
if ($acao === 'pedir') {
    $email = trim($corpo['email'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) resposta(['ok' => false, 'error' => 'email inválido'], 400);

    // Limita pedidos pelo IP, para o formulário não servir para enviar
    // mensagens em massa a partir do servidor do clube.
    $recentes = jsc_tentativas_recentes($pdo, '@recuperacao');
    if ($recentes >= JSC_MAX_TENTATIVAS) {
        resposta(['ok' => false, 'error' => 'demasiados pedidos. Tente daqui a alguns minutos.'], 429);
    }
    jsc_registar_tentativa($pdo, '@recuperacao');

    $stmt = $pdo->prepare('SELECT id, utilizador, email FROM jsc_utilizadores WHERE email = ? AND ativo = 1 LIMIT 1');
    $stmt->execute([$email]);
    $u = $stmt->fetch();

    // A resposta é sempre a mesma, exista ou não a conta: caso contrário
    // este formulário dizia a estranhos quais os emails registados.
    $generica = ['ok' => true, 'mensagem' => 'Se existir uma conta com esse email, foi enviada uma mensagem com as instruções.'];
    if (!$u) resposta($generica);

    $token = bin2hex(random_bytes(32));
    $pdo->prepare(
        'INSERT INTO jsc_recuperacao (token_hash, utilizador_id, expira_em)
         VALUES (?, ?, (NOW() + INTERVAL ? MINUTE))'
    )->execute([hash('sha256', $token), $u['id'], JSC_VALIDADE_MIN]);

    // Invalidar pedidos anteriores da mesma conta
    $pdo->prepare('UPDATE jsc_recuperacao SET usado = 1 WHERE utilizador_id = ? AND token_hash <> ?')
        ->execute([$u['id'], hash('sha256', $token)]);

    $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $base   = (jsc_https() ? 'https://' : 'http://') . $host;
    $link   = $base . '/admin/recuperar.html?token=' . $token;
    $assunto = 'Recuperacao de palavra-passe - Painel JS Campinense';
    $texto  = "Ola " . $u['utilizador'] . ",\n\n"
            . "Foi pedida a reposicao da palavra-passe do painel administrativo.\n\n"
            . "Abra este link para definir uma nova (valido durante " . JSC_VALIDADE_MIN . " minutos):\n"
            . $link . "\n\n"
            . "Se nao foi voce a pedir, ignore esta mensagem: a palavra-passe atual continua valida.\n";
    $de = 'no-reply@' . preg_replace('/^www\./', '', $host);
    $cabecalhos = "From: JS Campinense <$de>\r\n"
                . "Content-Type: text/plain; charset=UTF-8\r\n";

    $enviado = @mail($u['email'], $assunto, $texto, $cabecalhos);
    if (!$enviado) {
        // Não revelamos o motivo ao visitante, mas deixamos rasto para quem
        // administra o servidor: mail() falha muitas vezes por configuração.
        error_log('jsc: mail() falhou ao enviar recuperacao para ' . $u['email']);
    }
    resposta($generica);
}

// ---- Validar o token (usado ao abrir a página) ----
if ($acao === 'validar') {
    $token = $corpo['token'] ?? '';
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) resposta(['ok' => false, 'error' => 'link inválido'], 400);
    $stmt = $pdo->prepare(
        'SELECT r.utilizador_id, u.utilizador FROM jsc_recuperacao r
           JOIN jsc_utilizadores u ON u.id = r.utilizador_id
          WHERE r.token_hash = ? AND r.usado = 0 AND r.expira_em > NOW()'
    );
    $stmt->execute([hash('sha256', $token)]);
    $r = $stmt->fetch();
    if (!$r) resposta(['ok' => false, 'error' => 'este link expirou ou já foi usado'], 400);
    resposta(['ok' => true, 'utilizador' => $r['utilizador']]);
}

// ---- Definir a nova palavra-passe ----
if ($acao === 'redefinir') {
    $token = $corpo['token'] ?? '';
    $nova  = $corpo['nova'] ?? '';
    if (!preg_match('/^[a-f0-9]{64}$/', $token))  resposta(['ok' => false, 'error' => 'link inválido'], 400);
    if (strlen($nova) < JSC_MIN_PASSWORD_R)       resposta(['ok' => false, 'error' => 'a palavra-passe precisa de pelo menos ' . JSC_MIN_PASSWORD_R . ' caracteres'], 400);

    $stmt = $pdo->prepare('SELECT utilizador_id FROM jsc_recuperacao WHERE token_hash = ? AND usado = 0 AND expira_em > NOW()');
    $stmt->execute([hash('sha256', $token)]);
    $id = $stmt->fetchColumn();
    if (!$id) resposta(['ok' => false, 'error' => 'este link expirou ou já foi usado'], 400);

    $pdo->prepare('UPDATE jsc_utilizadores SET palavra_passe = ? WHERE id = ?')
        ->execute([password_hash($nova, PASSWORD_DEFAULT), $id]);
    $pdo->prepare('UPDATE jsc_recuperacao SET usado = 1 WHERE token_hash = ?')
        ->execute([hash('sha256', $token)]);
    // Tentativas falhadas deixam de fazer sentido depois de repor
    $pdo->prepare('DELETE FROM jsc_tentativas WHERE ip = ?')->execute([jsc_ip()]);

    resposta(['ok' => true]);
}

resposta(['ok' => false, 'error' => 'acao invalida'], 400);
