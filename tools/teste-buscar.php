<?php
// =====================================================
// FERRAMENTA DE TESTE — exercita o api/buscar.php
// =====================================================
// Só linha de comandos, e é o tools/testar-sem-js.js que a corre. Existe
// porque o caminho da busca não é exercitável através do api/proxy.php: a
// allowlist desse endpoint só aceita domínios reais, e um teste precisa de um
// servidor local. Aqui mede-se o transporte directamente, com e sem cURL.
//
//   php tools/teste-buscar.php <url>
//   php tools/teste-buscar.php --dominio <url> <dominio,dominio>
//
// Para medir a alternativa sem cURL:
//   php -d disable_functions=curl_init tools/teste-buscar.php <url>
// =====================================================

if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require_once __DIR__ . '/../api/buscar.php';

$args = array_slice($argv, 1);

if (($args[0] ?? '') === '--dominio') {
    $url = $args[1] ?? '';
    $dominios = array_filter(explode(',', $args[2] ?? ''));
    echo json_encode(['permitido' => jsc_dominio_permitido($url, $dominios)]), "\n";
    exit(0);
}

$url = $args[0] ?? '';
if ($url === '') { fwrite(STDERR, "uso: php tools/teste-buscar.php <url>\n"); exit(2); }

$r = jsc_buscar($url);
$fora = ['temCurl' => jsc_tem_curl(), 'allowUrlFopen' => (bool)ini_get('allow_url_fopen')];
if (isset($r['erro'])) {
    echo json_encode($fora + ['erro' => $r['erro']]), "\n";
    exit(0);
}
echo json_encode($fora + [
    'via'      => $r['via'],
    'codigo'   => $r['codigo'],
    'destino'  => $r['destino'],
    'bytes'    => strlen($r['corpo']),
    'truncado' => $r['truncado'],
    'inicio'   => substr($r['corpo'], 0, 12),
]), "\n";
