<?php
// =====================================================
// TRANSPORTE HTTP DE LEITURA — Juventude Sport Campinense
// =====================================================
// O "como se busca" de um endereço, e a validação pura de endereços. As
// DECISÕES de segurança continuam no api/proxy.php: sessão, capacidade
// importar, lista de domínios, verificação de endereço público e o ciclo de
// redirecionamentos.
//
// Está à parte por duas razões. A primeira é separar transporte de política. A
// segunda é poder ser medido: a allowlist do endpoint só aceita domínios reais,
// por isso o caminho da busca — cURL, a alternativa por stream, os
// redirecionamentos, o tecto de bytes — não é exercitável através dele contra
// um servidor de teste. Aqui é.
//
// jsc_buscar() faz UM pedido e NÃO segue redirecionamentos: devolve o código e
// o Location, e é o ciclo do api/proxy.php que valida cada salto antes de o
// pedir. É essa validação, salto a salto, que impede um domínio permitido de
// levar à rede interna do alojamento.
// =====================================================

const JSC_BUSCAR_MAX_BYTES = 3145728;   // 3 MB
const JSC_BUSCAR_CONEXAO_S = 8;         // tempo para ligar
const JSC_BUSCAR_TOTAL_S   = 15;        // tempo total do pedido
const JSC_BUSCAR_AGENTE    = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                           . 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function jsc_buscar_cabecalhos() {
    return [
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language: pt-PT,pt;q=0.9,en;q=0.8',
    ];
}

function jsc_tem_curl() {
    return function_exists('curl_init') && function_exists('curl_setopt');
}

// ---------------------------------------------------------------------
// Validação de endereços — lógica pura, sem rede
// ---------------------------------------------------------------------
// O endereço é de um dos domínios permitidos, em http ou https? Um subdomínio
// de um domínio permitido conta (é assim que o www.zerozero.pt entra sem estar
// na lista); um domínio que apenas TERMINE no mesmo texto não conta.
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

// ---------------------------------------------------------------------
// Um pedido, sem seguir redirecionamentos
// ---------------------------------------------------------------------
// Devolve  ['erro' => texto]  ou
//          ['codigo' => int, 'destino' => ?string, 'corpo' => string,
//           'truncado' => bool, 'via' => 'curl'|'stream']
function jsc_buscar($url) {
    return jsc_tem_curl() ? jsc_buscar_curl($url) : jsc_buscar_stream($url);
}

function jsc_buscar_curl($url) {
    $ch = curl_init();
    if ($ch === false) return ['erro' => 'Nao foi possivel iniciar o cURL'];

    $destino  = null;
    $corpo    = '';
    $truncado = false;

    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_HTTPGET        => true,
        // Os redirecionamentos NÃO são seguidos aqui: quem os segue é o ciclo
        // do api/proxy.php, que valida o destino de cada salto antes de o pedir.
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => JSC_BUSCAR_CONEXAO_S,
        CURLOPT_TIMEOUT        => JSC_BUSCAR_TOTAL_S,
        CURLOPT_USERAGENT      => JSC_BUSCAR_AGENTE,
        CURLOPT_HTTPHEADER     => jsc_buscar_cabecalhos(),
        // Como um browser: aceita comprimido e o cURL descomprime. O tecto de
        // bytes conta o que fica em memória, que é o que interessa.
        CURLOPT_ENCODING       => '',
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HEADER         => false,
        // Nenhum cookie nosso sai para um site de terceiros.
        CURLOPT_COOKIEFILE     => '',
        CURLOPT_HEADERFUNCTION => function ($ch, $linha) use (&$destino) {
            if (stripos($linha, 'Location:') === 0) $destino = trim(substr($linha, 9));
            return strlen($linha);
        },
        CURLOPT_WRITEFUNCTION  => function ($ch, $pedaco) use (&$corpo, &$truncado) {
            $falta = JSC_BUSCAR_MAX_BYTES - strlen($corpo);
            if ($falta <= 0) { $truncado = true; return 0; }
            if (strlen($pedaco) > $falta) {
                $corpo .= substr($pedaco, 0, $falta);
                $truncado = true;
                return 0;   // aborta a transferência: não se descarrega o resto
            }
            $corpo .= $pedaco;
            return strlen($pedaco);
        },
    ]);
    // Só HTTP e HTTPS. Com o FOLLOWLOCATION desligado isto é uma segunda linha
    // de defesa, e o nome da constante mudou entre versões do cURL.
    if (defined('CURLOPT_PROTOCOLS_STR')) {
        curl_setopt($ch, CURLOPT_PROTOCOLS_STR, 'http,https');
    } elseif (defined('CURLOPT_PROTOCOLS') && defined('CURLPROTO_HTTP') && defined('CURLPROTO_HTTPS')) {
        curl_setopt($ch, CURLOPT_PROTOCOLS, CURLPROTO_HTTP | CURLPROTO_HTTPS);
    }

    $ok   = curl_exec($ch);
    $erro = curl_errno($ch);
    $codigo = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $msg  = curl_error($ch);
    curl_close($ch);

    // O corte no tecto de bytes aborta a transferência e o cURL chama-lhe erro
    // de escrita. Com corpo e código na mão, é uma resposta truncada, não uma
    // falha.
    $cortado = ($erro === CURLE_WRITE_ERROR && $truncado);
    if ($ok === false && !$cortado) {
        return ['erro' => 'Nao foi possivel obter o endereco (cURL: '
                        . ($msg !== '' ? $msg : 'erro ' . $erro) . ')'];
    }
    if ($codigo === 0) return ['erro' => 'O site de origem nao respondeu'];

    return ['codigo' => $codigo, 'destino' => $destino, 'corpo' => $corpo,
            'truncado' => $truncado, 'via' => 'curl'];
}

function jsc_buscar_stream($url) {
    if (!ini_get('allow_url_fopen')) {
        return ['erro' => 'Nao foi possivel obter o endereco: este alojamento nao tem a '
                        . 'extensao cURL e tem o allow_url_fopen desligado. Active uma das '
                        . 'duas no cPanel, ou use a colagem manual.'];
    }
    $contexto = stream_context_create([
        'http' => [
            'method'          => 'GET',
            'user_agent'      => JSC_BUSCAR_AGENTE,
            'timeout'         => JSC_BUSCAR_TOTAL_S,
            'follow_location' => 0,
            'ignore_errors'   => true,
            'header'          => implode("\r\n", jsc_buscar_cabecalhos()) . "\r\n",
        ],
        'ssl' => [
            'verify_peer'      => true,
            'verify_peer_name' => true,
        ],
    ]);

    $fh = @fopen($url, 'rb', false, $contexto);
    if ($fh === false) {
        $e = error_get_last();
        return ['erro' => 'Nao foi possivel obter o endereco'
                        . (!empty($e['message']) ? ' (' . $e['message'] . ')' : '')];
    }

    $meta    = stream_get_meta_data($fh);
    $codigo  = 0;
    $destino = null;
    foreach ((isset($meta['wrapper_data']) ? $meta['wrapper_data'] : []) as $linha) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#i', $linha, $m)) { $codigo = (int)$m[1]; $destino = null; }
        elseif (stripos($linha, 'Location:') === 0)           { $destino = trim(substr($linha, 9)); }
    }
    $corpo = (string)stream_get_contents($fh, JSC_BUSCAR_MAX_BYTES);
    fclose($fh);

    if ($codigo === 0) return ['erro' => 'O site de origem nao respondeu'];
    return ['codigo' => $codigo, 'destino' => $destino, 'corpo' => $corpo,
            'truncado' => strlen($corpo) >= JSC_BUSCAR_MAX_BYTES, 'via' => 'stream'];
}
