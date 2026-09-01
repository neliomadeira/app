<?php
// Sessão do painel — autenticação verdadeira, do lado do servidor.
//
// O login antigo vivia inteiramente no browser: as credenciais estavam no
// localStorage e "entrar" apenas mostrava uma div, com o painel já todo
// carregado. Quem abrisse as ferramentas de programação entrava sem
// palavra-passe. Aqui a decisão passa a ser do servidor, e é ele que
// guarda o estado.
require_once __DIR__ . '/db.php';

const JSC_SESSAO_INATIVIDADE = 1800;   // 30 min sem actividade
const JSC_SESSAO_MAXIMA      = 43200;  // 12 h no total, mesmo activo
const JSC_MAX_TENTATIVAS     = 5;
const JSC_BLOQUEIO_SEGUNDOS  = 900;    // 15 min

function jsc_https() {
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') return true;
    if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') return true;
    return false;
}

function jsc_sessao_iniciar() {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_set_cookie_params([
        'lifetime' => 0,          // termina ao fechar o browser
        'path'     => '/',
        'httponly' => true,       // fora do alcance de JavaScript
        'secure'   => jsc_https(),
        'samesite' => 'Strict',   // o cookie não viaja a partir de outros sites
    ]);
    session_name('JSCSESSAO');
    session_start();
}

function jsc_ip() {
    return isset($_SERVER['REMOTE_ADDR']) ? substr($_SERVER['REMOTE_ADDR'], 0, 45) : '0.0.0.0';
}

// Impressão digital fraca do cliente. Não impede um ataque decidido, mas
// invalida um cookie copiado para outro browser.
function jsc_impressao() {
    return hash('sha256', ($_SERVER['HTTP_USER_AGENT'] ?? '') . '|' . JSC_TOKEN);
}

// Devolve o utilizador da sessão, ou null. Aplica os dois tempos limite.
function jsc_utilizador_atual() {
    jsc_sessao_iniciar();
    if (empty($_SESSION['uid'])) return null;
    $agora = time();
    if ($agora - ($_SESSION['visto_em'] ?? 0) > JSC_SESSAO_INATIVIDADE) { jsc_terminar_sessao(); return null; }
    if ($agora - ($_SESSION['iniciada_em'] ?? 0) > JSC_SESSAO_MAXIMA)   { jsc_terminar_sessao(); return null; }
    if (($_SESSION['impressao'] ?? '') !== jsc_impressao())             { jsc_terminar_sessao(); return null; }
    $_SESSION['visto_em'] = $agora;
    return [
        'id'         => (int)$_SESSION['uid'],
        'utilizador' => $_SESSION['utilizador'] ?? '',
        'papel'      => $_SESSION['papel'] ?? 'admin',
        'email'      => $_SESSION['email'] ?? '',
    ];
}

function jsc_criar_sessao(array $u) {
    jsc_sessao_iniciar();
    session_regenerate_id(true);   // evita fixação de sessão
    $_SESSION['uid']         = (int)$u['id'];
    $_SESSION['utilizador']  = $u['utilizador'];
    $_SESSION['papel']       = $u['papel'];
    $_SESSION['email']       = $u['email'];
    $_SESSION['impressao']   = jsc_impressao();
    $_SESSION['iniciada_em'] = time();
    $_SESSION['visto_em']    = time();
}

function jsc_terminar_sessao() {
    jsc_sessao_iniciar();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

// Guarda para os endpoints do painel. Aceita uma sessão válida ou, em
// alternativa, o JSC_TOKEN — que continua a servir automatismos e
// scripts, sem browser nem cookies.
function jsc_exigir_admin() {
    $u = jsc_utilizador_atual();
    if ($u) return $u;
    $token = $_SERVER['HTTP_X_JSC_TOKEN'] ?? '';
    if ($token && JSC_TOKEN !== '' && hash_equals(JSC_TOKEN, $token)) {
        return ['id' => 0, 'utilizador' => '(token)', 'papel' => 'admin', 'email' => ''];
    }
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo '{"ok":false,"error":"nao autenticado"}';
    exit;
}

// ---- Bloqueio por tentativas falhadas ----

function jsc_tentativas_recentes(PDO $pdo, $utilizador) {
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM jsc_tentativas
          WHERE (utilizador = ? OR ip = ?) AND quando > (NOW() - INTERVAL ? SECOND)'
    );
    $stmt->execute([$utilizador, jsc_ip(), JSC_BLOQUEIO_SEGUNDOS]);
    return (int)$stmt->fetchColumn();
}

function jsc_registar_tentativa(PDO $pdo, $utilizador) {
    $stmt = $pdo->prepare('INSERT INTO jsc_tentativas (utilizador, ip) VALUES (?, ?)');
    $stmt->execute([substr($utilizador, 0, 50), jsc_ip()]);
    // Limpeza oportunista, para a tabela não crescer sem fim
    $pdo->exec('DELETE FROM jsc_tentativas WHERE quando < (NOW() - INTERVAL 1 DAY)');
}

function jsc_limpar_tentativas(PDO $pdo, $utilizador) {
    $stmt = $pdo->prepare('DELETE FROM jsc_tentativas WHERE utilizador = ? OR ip = ?');
    $stmt->execute([$utilizador, jsc_ip()]);
}
