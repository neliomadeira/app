<?php
// Endpoint público: recebe inscrições e mensagens de contacto do site
// e guarda-as na base de dados (se configurada em config.php).
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo '{"ok":false,"error":"method not allowed"}';
    exit;
}

$raw = file_get_contents('php://input');
if (strlen($raw) > 65536) {
    http_response_code(413);
    echo '{"ok":false,"error":"payload demasiado grande"}';
    exit;
}

$body = json_decode($raw, true);
if (!is_array($body)) {
    http_response_code(400);
    echo '{"ok":false,"error":"json invalido"}';
    exit;
}

$tipo  = isset($body['tipo']) ? $body['tipo'] : '';
$dados = isset($body['dados']) && is_array($body['dados']) ? $body['dados'] : null;

if (!in_array($tipo, ['inscricao', 'contacto'], true) || !$dados) {
    http_response_code(400);
    echo '{"ok":false,"error":"pedido invalido"}';
    exit;
}

// Honeypot: bots preenchem o campo escondido — fingir sucesso sem guardar
if (!empty($dados['hp_website'])) {
    echo '{"ok":true}';
    exit;
}
unset($dados['hp_website']);

$pdo = jsc_db();
if (!$pdo) {
    // Base de dados não configurada — o site continua a funcionar
    // (localStorage + email); informar o cliente sem erro.
    echo '{"ok":false,"error":"bd nao configurada"}';
    exit;
}

$id     = isset($dados['id']) && is_numeric($dados['id']) ? (int)$dados['id'] : (int)(microtime(true) * 1000);
$estado = $tipo === 'inscricao' ? 'Pendente' : 'Não lida';

try {
    $stmt = $pdo->prepare(
        'INSERT INTO ' . jsc_tabela($tipo) . ' (id, dados, estado) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE dados = VALUES(dados)'
    );
    $stmt->execute([$id, json_encode($dados, JSON_UNESCAPED_UNICODE), $estado]);
    echo json_encode(['ok' => true, 'id' => $id]);
} catch (Exception $e) {
    http_response_code(500);
    echo '{"ok":false,"error":"erro ao guardar"}';
}
