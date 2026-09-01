<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/sessao.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo '{"error":"method not allowed"}';
    exit;
}

// Sessão do painel, ou o token para automatismos. Termina o pedido com
// 401 se nenhum dos dois for válido.
jsc_exigir_admin();

$raw = file_get_contents('php://input');
if (!$raw || json_decode($raw) === null) {
    http_response_code(400);
    echo '{"error":"json invalido"}';
    exit;
}

$dir = dirname(DATA_FILE);
if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

if (file_put_contents(DATA_FILE, $raw) === false) {
    http_response_code(500);
    echo '{"error":"erro ao guardar"}';
    exit;
}

echo '{"ok":true,"savedAt":"' . date('c') . '"}';
