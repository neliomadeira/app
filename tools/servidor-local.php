<?php
// =====================================================
// SERVIDOR DE DESENVOLVIMENTO — encaminhador
// =====================================================
// O servidor embutido do PHP não lê o .htaccess. Sem isto, em
// desenvolvimento ficavam acessíveis coisas que em produção o Apache
// bloqueia — o data/db.json, o data/utilizadores.json, os .sql — e o
// ambiente local deixava de valer como ensaio do real.
//
// Aqui repetem-se apenas as regras que negam acesso. O resto — cabeçalhos,
// compressão, redirecionamentos, https — é do Apache e fica para produção.
//
// Não é usado pelo site publicado: só pelo iniciar.bat / iniciar.sh.
// =====================================================

$raiz = realpath(__DIR__ . '/..');
$uri  = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri  = rawurldecode($uri);

function jsc_negar($porque) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8">'
       . '<title>403</title><body style="font-family:system-ui;padding:40px">'
       . '<h1>403 — sem acesso</h1><p>' . htmlspecialchars($porque, ENT_QUOTES, 'UTF-8') . '</p>'
       . '<p style="color:#666">Em produção esta resposta vem do .htaccess.</p>';
    exit;
}

// ---- Nunca sair da pasta do projeto --------------------------------
$alvo = realpath($raiz . $uri);
if ($alvo !== false && strpos($alvo, $raiz) !== 0) {
    jsc_negar('Pedido fora da pasta do projeto.');
}

// ---- Extensões bloqueadas pelo .htaccess ---------------------------
// <FilesMatch "\.(env|json|log|sql|bak|sh)$"> Require all denied
// com a exceção do manifest.json, que o service worker precisa de ler.
$ficheiro = basename($uri);
if ($ficheiro !== 'manifest.json'
    && preg_match('/\.(env|json|log|sql|bak|sh|bat)$/i', $ficheiro)) {
    jsc_negar('Ficheiros ' . pathinfo($ficheiro, PATHINFO_EXTENSION) . ' não são servidos.');
}

// ---- Options -Indexes ----------------------------------------------
// Uma pasta sem index não mostra a lista do que lá está dentro.
if ($alvo !== false && is_dir($alvo)) {
    $temIndice = false;
    foreach (['index.html', 'index.php', 'index.htm'] as $i) {
        if (is_file($alvo . DIRECTORY_SEPARATOR . $i)) { $temIndice = true; break; }
    }
    if (!$temIndice) jsc_negar('Listagem de pastas desligada.');
}

// O resto segue o caminho normal: o servidor embutido serve o ficheiro e
// executa o PHP.
return false;
