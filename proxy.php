<?php
// Server-side proxy — fetches a remote URL and returns its content.
// Used by the admin panel to bypass browser CORS restrictions when importing
// data from ZeroZero or similar sites.

$url = isset($_GET['url']) ? trim($_GET['url']) : '';

if (!$url) {
    http_response_code(400);
    echo 'Missing url parameter';
    exit;
}

if (!filter_var($url, FILTER_VALIDATE_URL) || !preg_match('#^https?://#i', $url)) {
    http_response_code(400);
    echo 'Invalid URL';
    exit;
}

// Only allow fetching from known football data sites
$allowed = ['zerozero.pt', 'fpf.pt', 'ligaportugal.pt', 'www.zerozero.pt'];
$host = parse_url($url, PHP_URL_HOST);
if (!in_array($host, $allowed, true)) {
    http_response_code(403);
    echo 'Domain not allowed';
    exit;
}

header('Access-Control-Allow-Origin: *');
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$ctx = stream_context_create([
    'http' => [
        'method'          => 'GET',
        'user_agent'      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'timeout'         => 15,
        'follow_location' => 1,
        'max_redirects'   => 5,
        'header'          => "Accept: text/html,application/xhtml+xml\r\nAccept-Language: pt-PT,pt;q=0.9\r\n",
    ],
    'ssl' => [
        'verify_peer'      => true,
        'verify_peer_name' => true,
    ],
]);

$body = @file_get_contents($url, false, $ctx);

if ($body === false) {
    http_response_code(502);
    echo 'Failed to fetch remote URL';
    exit;
}

echo $body;
