<?php
// Endpoint do admin: listar e gerir inscrições/mensagens guardadas na
// base de dados. Protegido pelo mesmo token de publicação (JSC_TOKEN).
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/db.php';

$token = isset($_SERVER['HTTP_X_JSC_TOKEN']) ? $_SERVER['HTTP_X_JSC_TOKEN'] : '';
if (!$token || $token !== JSC_TOKEN) {
    http_response_code(401);
    echo '{"ok":false,"error":"token invalido"}';
    exit;
}

$pdo = jsc_db();
if (!$pdo) {
    echo '{"ok":false,"error":"bd nao configurada"}';
    exit;
}

$tipo = isset($_GET['tipo']) ? $_GET['tipo'] : '';
if (!in_array($tipo, ['inscricao', 'contacto'], true)) {
    http_response_code(400);
    echo '{"ok":false,"error":"tipo invalido"}';
    exit;
}
$tabela = jsc_tabela($tipo);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = $pdo->query("SELECT id, dados, estado, criado_em FROM $tabela ORDER BY id DESC LIMIT 500")->fetchAll();
    $out = [];
    foreach ($rows as $r) {
        $d = json_decode($r['dados'], true) ?: [];
        $d['id']     = (int)$r['id'];
        $d['estado'] = $r['estado'];
        $out[] = $d;
    }
    echo json_encode(['ok' => true, 'registos' => $out], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $acao = isset($body['acao']) ? $body['acao'] : '';
    $id   = isset($body['id']) && is_numeric($body['id']) ? (int)$body['id'] : 0;
    if (!$id) { http_response_code(400); echo '{"ok":false,"error":"id invalido"}'; exit; }

    try {
        if ($acao === 'estado' && isset($body['estado'])) {
            $stmt = $pdo->prepare("UPDATE $tabela SET estado = ? WHERE id = ?");
            $stmt->execute([substr($body['estado'], 0, 20), $id]);
            echo '{"ok":true}';
        } elseif ($acao === 'apagar') {
            $stmt = $pdo->prepare("DELETE FROM $tabela WHERE id = ?");
            $stmt->execute([$id]);
            echo '{"ok":true}';
        } else {
            http_response_code(400);
            echo '{"ok":false,"error":"acao invalida"}';
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo '{"ok":false,"error":"erro na operacao"}';
    }
    exit;
}

http_response_code(405);
echo '{"ok":false,"error":"method not allowed"}';
