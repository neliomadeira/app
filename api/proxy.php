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
//
// PORQUE VIVE EM api/. Estava na raiz do site, e era o único dos catorze
// endpoints autenticados fora desta pasta. No alojamento real isso bastou para
// o deixar sem sessão: o painel entrava, o /api/auth.php?acao=estado devolvia
// a sessão do Admin, e o /proxy.php na raiz respondia "Precisa de sessao no
// painel" com o mesmo cookie. Nunca foi o código — reproduzido no Apache do
// projeto, o proxy via a sessão criada pelo api/auth.php e passava a
// verificação. É a raiz que difere do /api/ no servidor: ou o cookie não lhe
// chega, ou a sessão é lida de outro armazenamento, por o PHP dessa pasta ser
// outro. Aqui dentro corre sob o mesmo handler e lê as mesmas sessões que o
// resto das APIs, e o site deixa de ter PHP na raiz.
//
// A lógica de segurança é a mesma, linha por linha: sessão obrigatória,
// capacidade importar, allowlist verificada em cada salto, destino tem de ser
// um endereço público e tecto de bytes na resposta.
// =====================================================

require_once __DIR__ . '/sessao.php';
require_once __DIR__ . '/buscar.php';

// Só o painel usa isto, e chama-o da mesma origem. Sem esta verificação
// qualquer pessoa na internet podia usar o servidor do clube para ir
// buscar páginas a outros sites em nome dele.
if (!jsc_pode('importar')) {
    http_response_code(jsc_tem_sessao() ? 403 : 401);
    header('Content-Type: text/plain; charset=utf-8');
    echo jsc_tem_sessao() ? 'O seu perfil nao pode importar dados' : 'Precisa de sessao no painel';
    exit;
}

// Só os dois sites de onde o painel importa de facto. O fpf.pt e o
// ligaportugal.pt estavam aqui e nada que passe por este endpoint os usa: as
// duas referências a www.fpf.pt no painel são apenas a base para resolver
// caminhos de imagens dentro de um documento já colado, e o scraper da FPF é
// uma ferramenta de linha de comandos que busca por si. Menos domínios, menos
// superfície. O www.zerozero.pt entra pela regra de subdomínio.
$DOMINIOS = ['zerozero.pt', 'afalgarve.pt'];
const JSC_MAX_SALTOS = 5;

function jsc_erro($codigo, $msg) {
    http_response_code($codigo);
    header('Content-Type: text/plain; charset=utf-8');
    echo $msg;
    exit;
}

// A jsc_dominio_permitido() e o transporte vivem no api/buscar.php. As
// decisões ficam aqui: é este ficheiro que diz QUAIS os domínios, que exige a
// sessão e a capacidade, que verifica o endereço público e que valida cada
// salto antes de o pedir.

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

$atual = $url;
$corpo = false;

for ($salto = 0; $salto <= JSC_MAX_SALTOS; $salto++) {
    $host = parse_url($atual, PHP_URL_HOST);
    if (!jsc_endereco_publico($host)) jsc_erro(403, 'Destino nao permitido');

    // Um pedido, sem seguir redirecionamentos — ver api/buscar.php.
    $r = jsc_buscar($atual);
    if (isset($r['erro'])) jsc_erro(502, $r['erro']);

    $codigo  = $r['codigo'];
    $destino = $r['destino'];

    if ($codigo >= 300 && $codigo < 400 && $destino !== null && $destino !== '') {
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

    if ($codigo >= 400) jsc_erro(502, 'O site de origem respondeu ' . $codigo);

    $corpo = $r['corpo'];
    break;
}

if ($corpo === false) jsc_erro(502, 'Demasiados redirecionamentos');

header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
// O painel chama isto da mesma origem: não é preciso abrir CORS a ninguém.
echo $corpo;
