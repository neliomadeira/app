<?php
// Recebe uma imagem do painel admin, grava-a em /uploads/ e devolve o
// caminho. Substitui o base64 que era guardado dentro do conteúdo e
// enchia o localStorage.
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/sessao.php';

function fail($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('method not allowed', 405);

// Só o admin carrega imagens: sessão do painel ou token.
jsc_exigir_admin();

// $_FILES vem vazio quando o corpo excede post_max_size, e nesse caso o
// PHP não assinala erro nenhum — daí a verificação explícita.
if (empty($_FILES['ficheiro'])) {
    $limite = ini_get('post_max_size');
    fail('ficheiro em falta ou acima do limite do servidor (post_max_size = ' . $limite . ')', 413);
}

$f = $_FILES['ficheiro'];
if ($f['error'] !== UPLOAD_ERR_OK) {
    $erros = [
        UPLOAD_ERR_INI_SIZE   => 'excede upload_max_filesize',
        UPLOAD_ERR_FORM_SIZE  => 'excede MAX_FILE_SIZE',
        UPLOAD_ERR_PARTIAL    => 'envio incompleto',
        UPLOAD_ERR_NO_FILE    => 'nenhum ficheiro enviado',
        UPLOAD_ERR_NO_TMP_DIR => 'servidor sem pasta temporária',
        UPLOAD_ERR_CANT_WRITE => 'servidor não conseguiu escrever',
    ];
    fail(isset($erros[$f['error']]) ? $erros[$f['error']] : 'erro no envio', 400);
}

$MAX = 5 * 1024 * 1024;
if ($f['size'] > $MAX) fail('imagem acima de 5MB', 413);

// is_uploaded_file garante que o caminho veio mesmo de um upload HTTP e
// não é um caminho local forjado.
if (!is_uploaded_file($f['tmp_name'])) fail('upload invalido', 400);

// O tipo é decidido pelo conteúdo do ficheiro, nunca pelo nome nem pelo
// Content-Type do cliente — ambos são controlados por quem envia.
$info = @getimagesize($f['tmp_name']);
if ($info === false) fail('o ficheiro não é uma imagem', 415);

$extensoes = [
    IMAGETYPE_JPEG => 'jpg',
    IMAGETYPE_PNG  => 'png',
    IMAGETYPE_GIF  => 'gif',
    IMAGETYPE_WEBP => 'webp',
];
if (!isset($extensoes[$info[2]])) fail('formato não suportado (use JPG, PNG, GIF ou WEBP)', 415);
$ext = $extensoes[$info[2]];

$dir = __DIR__ . '/../uploads';
if (!is_dir($dir) && !@mkdir($dir, 0755, true)) fail('não foi possível criar a pasta uploads', 500);
if (!is_writable($dir)) fail('a pasta uploads não tem permissões de escrita', 500);

// Nome gerado pelo servidor: o nome original nunca é usado, o que evita
// travessia de caminhos e extensões duplas do tipo foto.php.jpg.
try {
    $nome = date('Ymd') . '-' . bin2hex(random_bytes(8)) . '.' . $ext;
} catch (Exception $e) {
    fail('não foi possível gerar o nome do ficheiro', 500);
}

if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $nome)) fail('não foi possível guardar a imagem', 500);
@chmod($dir . '/' . $nome, 0644);

echo json_encode([
    'ok'      => true,
    'url'     => '/uploads/' . $nome,
    'bytes'   => $f['size'],
    'largura' => $info[0],
    'altura'  => $info[1],
], JSON_UNESCAPED_UNICODE);
