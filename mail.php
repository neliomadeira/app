<?php
/**
 * =====================================================
 * JUVENTUDE SPORT CAMPINENSE — Mail Handler
 * =====================================================
 * Dois modos de envio:
 *   1. SMTP (recomendado) — requer PHPMailer
 *      Instalar: composer require phpmailer/phpmailer
 *   2. PHP mail() nativo — sem dependências
 *
 * CONFIGURAÇÃO: edite a secção CONFIG abaixo
 * ou defina variáveis de ambiente no servidor.
 * =====================================================
 */

// ---- CORS -----------------------------------------------
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Secret-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204); exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']); exit;
}

// =====================================================
// CONFIG — edite aqui OU use variáveis de ambiente
// =====================================================
$config = [
    'secret_token'  => getenv('MAIL_TOKEN')      ?: 'ALTERE_ESTE_TOKEN',
    'to_email'      => getenv('MAIL_TO')          ?: 'clube@jscampinense.pt',
    'to_name'       => getenv('MAIL_TO_NAME')     ?: 'JS Campinense',
    'from_email'    => getenv('MAIL_FROM')        ?: 'noreply@jscampinense.pt',
    'from_name'     => getenv('MAIL_FROM_NAME')   ?: 'Site JS Campinense',
    // SMTP — deixe smtp_host vazio para usar PHP mail() nativo
    'smtp_host'     => getenv('SMTP_HOST')        ?: '',
    'smtp_port'     => (int)(getenv('SMTP_PORT')  ?: 587),
    'smtp_secure'   => getenv('SMTP_SECURE')      ?: 'tls', // tls | ssl | ''
    'smtp_user'     => getenv('SMTP_USER')        ?: '',
    'smtp_pass'     => getenv('SMTP_PASS')        ?: '',
];
// =====================================================

// ---- Ler JSON recebido ---------------------------------
$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'JSON inválido']); exit;
}

// ---- Validar token secreto -----------------------------
$token = $_SERVER['HTTP_X_SECRET_TOKEN'] ?? $data['_token'] ?? '';
if ($config['secret_token'] !== 'ALTERE_ESTE_TOKEN'
    && !hash_equals($config['secret_token'], (string)$token)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Token inválido']); exit;
}

// ---- Extrair e limpar campos ---------------------------
$tipo       = s($data['_tipo']       ?? 'contacto');
$nome       = s($data['nome']        ?? '');
$email      = s($data['email']       ?? $data['email_resp'] ?? '');
$telefone   = s($data['telefone']    ?? '');
$assunto    = s($data['assunto']     ?? '');
$mensagem   = s($data['mensagem']    ?? '');
$modalidade = s($data['modalidade']  ?? '');
$escalao    = s($data['escalao']     ?? '—');
$nivel      = s($data['nivel']       ?? '—');
$posicao    = s($data['posicao']     ?? '—');
$email_resp = s($data['email_resp']  ?? $email);
$hoje       = date('d/m/Y H:i');

if (!$nome) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Nome obrigatório']); exit;
}

// ---- Montar email --------------------------------------
if ($tipo === 'inscricao') {
    $subject = "[JSC] Nova Inscrição — {$nome} ({$modalidade})";
    $body    = templateInscricao($nome, $modalidade, $escalao, $nivel, $posicao, $telefone, $email_resp, $hoje);
    $replyEmail = $email_resp;
} else {
    $subject = "[JSC] Contacto — " . ($assunto ?: 'Mensagem do site') . " (de {$nome})";
    $body    = templateContacto($nome, $email, $telefone, $assunto, $mensagem, $hoje);
    $replyEmail = $email;
}

// ---- Enviar --------------------------------------------
try {
    if ($config['smtp_host']) {
        smtpSend($config, $subject, $body, $nome, $replyEmail);
    } else {
        nativeSend($config, $subject, $body, $nome, $replyEmail);
    }
    echo json_encode(['ok' => true]);
} catch (Exception $e) {
    error_log('[JSC Mail] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

// =====================================================
// ENVIO
// =====================================================

function nativeSend(array $cfg, string $subject, string $body, string $rName, string $rEmail): void
{
    $h  = "MIME-Version: 1.0\r\n";
    $h .= "Content-Type: text/html; charset=UTF-8\r\n";
    $h .= "From: {$cfg['from_name']} <{$cfg['from_email']}>\r\n";
    if ($rEmail) $h .= "Reply-To: {$rName} <{$rEmail}>\r\n";
    if (!mail($cfg['to_email'], $subject, $body, $h)) {
        throw new Exception('PHP mail() falhou. Verifique o sendmail do servidor.');
    }
}

function smtpSend(array $cfg, string $subject, string $body, string $rName, string $rEmail): void
{
    // Tenta PHPMailer se instalado via Composer
    if (file_exists(__DIR__ . '/vendor/autoload.php')) {
        require_once __DIR__ . '/vendor/autoload.php';
        phpmailerSend($cfg, $subject, $body, $rName, $rEmail);
        return;
    }
    // Fallback: SMTP manual via sockets (sem dependências)
    smtpSocketSend($cfg, $subject, $body, $rName, $rEmail);
}

function phpmailerSend(array $cfg, string $subject, string $body, string $rName, string $rEmail): void
{
    $m = new PHPMailer\PHPMailer\PHPMailer(true);
    $m->isSMTP();
    $m->Host       = $cfg['smtp_host'];
    $m->SMTPAuth   = true;
    $m->Username   = $cfg['smtp_user'];
    $m->Password   = $cfg['smtp_pass'];
    $m->SMTPSecure = $cfg['smtp_secure'] === 'ssl'
        ? PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS
        : PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
    $m->Port       = $cfg['smtp_port'];
    $m->CharSet    = 'UTF-8';
    $m->setFrom($cfg['smtp_user'], $cfg['from_name']);
    $m->addAddress($cfg['to_email'], $cfg['to_name']);
    if ($rEmail) $m->addReplyTo($rEmail, $rName);
    $m->isHTML(true);
    $m->Subject = $subject;
    $m->Body    = $body;
    $m->AltBody = strip_tags($body);
    $m->send();
}

function smtpSocketSend(array $cfg, string $subject, string $body, string $rName, string $rEmail): void
{
    $host   = $cfg['smtp_host'];
    $port   = $cfg['smtp_port'];
    $secure = $cfg['smtp_secure'];
    $user   = $cfg['smtp_user'];
    $pass   = $cfg['smtp_pass'];
    $from   = $cfg['from_email'];
    $to     = $cfg['to_email'];

    $prefix = ($secure === 'ssl') ? 'ssl://' : '';
    $sock   = @fsockopen($prefix . $host, $port, $errno, $errstr, 15);
    if (!$sock) throw new Exception("SMTP: não foi possível ligar a {$host}:{$port} — {$errstr}");

    $rd = function() use ($sock) { return fgets($sock, 512); };
    $wr = function(string $c) use ($sock) { fwrite($sock, $c . "\r\n"); };

    $rd();
    $wr("EHLO " . (gethostname() ?: 'localhost'));
    while ($l = $rd()) { if (strlen($l) > 3 && $l[3] === ' ') break; }

    if ($secure === 'tls') {
        $wr("STARTTLS"); $rd();
        stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        $wr("EHLO " . (gethostname() ?: 'localhost'));
        while ($l = $rd()) { if (strlen($l) > 3 && $l[3] === ' ') break; }
    }

    $wr("AUTH LOGIN"); $rd();
    $wr(base64_encode($user)); $rd();
    $wr(base64_encode($pass));
    $resp = $rd();
    if (!str_starts_with($resp, '235')) {
        fclose($sock);
        throw new Exception("SMTP: autenticação falhou — verifique utilizador/password");
    }

    $wr("MAIL FROM:<{$from}>"); $rd();
    $wr("RCPT TO:<{$to}>");
    $r = $rd();
    if (!str_starts_with($r, '250')) {
        fclose($sock); throw new Exception("SMTP: destinatário rejeitado — " . trim($r));
    }
    $wr("DATA"); $rd();

    $mid = md5(uniqid()) . '@jscampinense.pt';
    $hdr = "From: {$cfg['from_name']} <{$from}>\r\n"
         . "To: {$cfg['to_name']} <{$to}>\r\n"
         . ($rEmail ? "Reply-To: {$rName} <{$rEmail}>\r\n" : '')
         . "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n"
         . "Message-ID: <{$mid}>\r\n"
         . "Date: " . date('r') . "\r\n"
         . "MIME-Version: 1.0\r\n"
         . "Content-Type: text/html; charset=UTF-8\r\n"
         . "Content-Transfer-Encoding: base64\r\n";

    $wr($hdr . "\r\n" . chunk_split(base64_encode($body)));
    $wr("."); $rd();
    $wr("QUIT");
    fclose($sock);
}

// =====================================================
// TEMPLATES HTML
// =====================================================

function templateContacto(string $nome, string $email, string $tel, string $assunto, string $msg, string $data): string
{
    $msgHtml = nl2br(htmlspecialchars($msg, ENT_QUOTES, 'UTF-8'));
    return <<<HTML
<!DOCTYPE html><html lang="pt-PT"><head><meta charset="UTF-8">
<style>
body{font-family:Arial,sans-serif;background:#f5f7fa;margin:0;padding:20px}
.w{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}
.h{background:#003B8E;padding:28px 32px;text-align:center}
.h h1{color:#FFD100;font-size:20px;margin:0;letter-spacing:1px}
.h p{color:rgba(255,255,255,.7);font-size:12px;margin:6px 0 0}
.b{padding:28px 32px}
.lbl{font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.val{font-size:14px;color:#111;padding:10px 14px;background:#f5f7fa;border-radius:6px;border-left:3px solid #003B8E;margin-bottom:14px}
.msg{background:#f5f7fa;border-radius:8px;padding:16px;font-size:13px;line-height:1.7;color:#333;border-left:3px solid #FFD100}
.ft{background:#f5f7fa;padding:14px 32px;text-align:center;font-size:10px;color:#999}
</style></head><body>
<div class="w">
  <div class="h"><h1>Nova Mensagem de Contacto</h1><p>Juventude Sport Campinense · Loulé</p></div>
  <div class="b">
    <div class="lbl">Nome</div><div class="val">{$nome}</div>
    <div class="lbl">Email</div><div class="val">{$email}</div>
    <div class="lbl">Telefone</div><div class="val">{$tel}</div>
    <div class="lbl">Assunto</div><div class="val">{$assunto}</div>
    <div class="lbl">Mensagem</div><div class="msg">{$msgHtml}</div>
  </div>
  <div class="ft">Enviado pelo site jscampinense.pt em {$data}</div>
</div>
</body></html>
HTML;
}

function templateInscricao(string $nome, string $mod, string $esc, string $niv, string $pos, string $tel, string $email, string $data): string
{
    return <<<HTML
<!DOCTYPE html><html lang="pt-PT"><head><meta charset="UTF-8">
<style>
body{font-family:Arial,sans-serif;background:#f5f7fa;margin:0;padding:20px}
.w{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}
.h{background:#003B8E;padding:28px 32px;text-align:center}
.h h1{color:#FFD100;font-size:20px;margin:0;letter-spacing:1px}
.h p{color:rgba(255,255,255,.7);font-size:12px;margin:6px 0 0}
.badge{display:inline-block;background:#FFD100;color:#003B8E;font-weight:700;font-size:13px;padding:5px 18px;border-radius:20px;margin-top:10px}
.b{padding:28px 32px}
.g{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lbl{font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.val{font-size:14px;color:#111;padding:10px 14px;background:#f5f7fa;border-radius:6px;border-left:3px solid #003B8E;margin-bottom:14px}
.ft{background:#f5f7fa;padding:14px 32px;text-align:center;font-size:10px;color:#999}
</style></head><body>
<div class="w">
  <div class="h">
    <h1>Nova Inscrição de Atleta</h1>
    <p>Juventude Sport Campinense · Loulé</p>
    <div class="badge">{$mod}</div>
  </div>
  <div class="b">
    <div class="lbl">Nome do Atleta</div><div class="val">{$nome}</div>
    <div class="g">
      <div><div class="lbl">Escalão</div><div class="val">{$esc}</div></div>
      <div><div class="lbl">Nível</div><div class="val">{$niv}</div></div>
      <div><div class="lbl">Posição</div><div class="val">{$pos}</div></div>
      <div><div class="lbl">Telefone</div><div class="val">{$tel}</div></div>
    </div>
    <div class="lbl">Email Encarregado</div><div class="val">{$email}</div>
  </div>
  <div class="ft">Enviado pelo site jscampinense.pt em {$data}</div>
</div>
</body></html>
HTML;
}

// Sanitizar entrada
function s(string $str): string {
    return htmlspecialchars(strip_tags(trim($str)), ENT_QUOTES, 'UTF-8');
}
