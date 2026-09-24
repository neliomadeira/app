<?php
// =====================================================
// PROXY DE LEITURA — Juventude Sport Campinense
// =====================================================
// Vai buscar uma página a um dos sites de dados de futebol e devolve-a,
// para o painel poder importar plantéis e calendários sem esbarrar nas
// restrições de origem do browser.
//
// A lista de domínios permitidos é verificada em TODOS os saltos, não só
// no endereço inicial. Antes, o contexto seguia até cinco redirecionamentos
// sem validar o destino: um domínio permitido que redirecionasse para
// http://127.0.0.1/ ou para a rede interna do alojamento era seguido, e o
// conteúdo devolvido a quem pedisse. O endereço é público e não pede token.
// =====================================================

require_once __DIR__ . '/api/sessao.php';

// Só o painel usa isto, e chama-o da mesma origem. Sem esta verificação
// qualquer pessoa na internet podia usar o servidor do clube para ir
// buscar páginas a outros sites em nome dele.
if (!jsc_pode('importar')) {
    http_response_code(jsc_tem_sessao() ? 403 : 401);
    header('Content-Type: text/plain; charset=utf-8');
    echo jsc_tem_sessao() ? 'O seu perfil nao pode importar dados' : 'Precisa de sessao no painel';
    exit;
}

$DOMINIOS = ['zerozero.pt', 'fpf.pt', 'ligaportugal.pt', 'afalgarve.pt'];
const JSC_MAX_SALTOS = 5;
const JSC_MAX_BYTES  = 3145728;   // 3 MB

function jsc_erro($codigo, $msg) {
    http_response_code($codigo);
    header('Content-Type: text/plain; charset=utf-8');
    echo $msg;
    exit;
}

// O endereço é de um dos domínios permitidos, em https ou http?
function jsc_dominio_permitido($url, $dominios) {
    if (!filter_var($url, FILTER_VALIDATE_URL)) return false;
    $partes = parse_url($url);
    if (!$partes || empty($partes['host'])) return false;
    $esquema = isset($partes['scheme']) ? strtolower($partes['scheme']) : '';
    if ($esquema !== 'http' && $esquema !== 'https') return false;
    // Uma porta fora das habituais costuma ser tentativa de alcançar outro serviço.
    if (isset($partes['port']) && !in_array((int)$partes['port'], [80, 443], true)) return false;
    if (isset($partes['user']) || isset($partes['pass'])) return false;

    $host = strtolower($partes['host']);
    foreach ($dominios as $d) {
        if ($host === $d || substr($host, -strlen('.' . $d)) === '.' . $d) return true;
    }
    return false;
}

// O nome resolve para um endereço público? Um domínio permitido cujo DNS
// aponte para a rede interna não pode ser usado para lá chegar.
function jsc_endereco_publico($host) {
    $ips = [];
    foreach (@dns_get_record($host, DNS_A) ?: [] as $r) if (!empty($r['ip']))   $ips[] = $r['ip'];
    foreach (@dns_get_record($host, DNS_AAAA) ?: [] as $r) if (!empty($r['ipv6'])) $ips[] = $r['ipv6'];
    if (!$ips) {
        $ip = gethostbyname($host);
        if ($ip && $ip !== $host) $ips[] = $ip;
    }
    if (!$ips) return false;
    foreach ($ips as $ip) {
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return false;
        }
    }
    return true;
}

$url = isset($_GET['url']) ? trim($_GET['url']) : '';
if ($url === '') jsc_erro(400, 'Falta o parametro url');
if (!jsc_dominio_permitido($url, $DOMINIOS)) jsc_erro(403, 'Dominio nao permitido');

$contexto = stream_context_create([
    'http' => [
        'method'          => 'GET',
        'user_agent'      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'timeout'         => 15,
        // Os redirecionamentos são seguidos aqui, um a um, para o destino
        // de cada salto poder ser validado antes de ser pedido.
        'follow_location' => 0,
        'ignore_errors'   => true,
        'header'          => "Accept: text/html,application/xhtml+xml\r\nAccept-Language: pt-PT,pt;q=0.9\r\n",
    ],
    'ssl' => [
        'verify_peer'      => true,
        'verify_peer_name' => true,
    ],
]);

$atual = $url;
$corpo = false;

for ($salto = 0; $salto <= JSC_MAX_SALTOS; $salto++) {
    $host = parse_url($atual, PHP_URL_HOST);
    if (!jsc_endereco_publico($host)) jsc_erro(403, 'Destino nao permitido');

    $fh = @fopen($atual, 'rb', false, $contexto);
    if ($fh === false) jsc_erro(502, 'Nao foi possivel obter o endereco');

    $meta   = stream_get_meta_data($fh);
    $codigo = 0;
    $destino = null;
    foreach ($meta['wrapper_data'] as $linha) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#i', $linha, $m)) { $codigo = (int)$m[1]; $destino = null; }
        elseif (stripos($linha, 'Location:') === 0)           { $destino = trim(substr($linha, 9)); }
    }

    if ($codigo >= 300 && $codigo < 400 && $destino !== null) {
        fclose($fh);
        // Um Location relativo resolve-se contra o endereço atual.
        if (!preg_match('#^https?://#i', $destino)) {
            $p = parse_url($atual);
            $base = $p['scheme'] . '://' . $p['host'];
            $destino = $destino[0] === '/' ? $base . $destino : $base . '/' . ltrim($destino, '/');
        }
        if (!jsc_dominio_permitido($destino, $DOMINIOS)) jsc_erro(403, 'Redirecionamento para fora dos dominios permitidos');
        $atual = $destino;
        continue;
    }

    if ($codigo >= 400) { fclose($fh); jsc_erro(502, 'O site de origem respondeu ' . $codigo); }

    $corpo = stream_get_contents($fh, JSC_MAX_BYTES);
    fclose($fh);
    break;
}

if ($corpo === false) jsc_erro(502, 'Demasiados redirecionamentos');

header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
// O painel chama isto da mesma origem: não é preciso abrir CORS a ninguém.
echo $corpo;
