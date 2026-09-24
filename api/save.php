<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/sessao.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo '{"error":"method not allowed"}';
    exit;
}

// Publicar exige sessão no servidor. O token continua a ser aceite para
// quem ainda não criou contas no painel; quando existirem, pode ser
// retirado de api/config.local.php.
$token = isset($_SERVER['HTTP_X_JSC_TOKEN']) ? $_SERVER['HTTP_X_JSC_TOKEN'] : '';
$comToken  = $token && hash_equals(JSC_TOKEN, $token) && JSC_TOKEN !== '';
$comSessao = jsc_pode('tudo');
if (!$comSessao && !$comToken) {
    http_response_code(jsc_tem_sessao() ? 403 : 401);
    echo json_encode(['error' => jsc_tem_sessao() ? 'sem permissao' : 'sem sessao nem token']);
    exit;
}

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
