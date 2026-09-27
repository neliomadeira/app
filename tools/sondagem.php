<?php
// =====================================================
// SONDAGEM AO ALOJAMENTO — só leitura
// =====================================================
// Responde às perguntas de que a decisão de arquitetura precisa, sem
// alterar coisa nenhuma: não escreve ficheiros, não cria tabelas, não
// muda configuração, não instala nada. Todas as verificações de escrita
// são perguntas — `is_writable()` — e não escritas.
//
// COMO USAR
//   1. abra este ficheiro e escreva uma senha na linha JSC_SONDA_SENHA;
//   2. envie-o para a raiz do site;
//   3. abra https://campinense.pt/tools/sondagem.php?senha=A_SUA_SENHA
//   4. guarde a página (Ctrl+S) ou copie o texto;
//   5. APAGUE O FICHEIRO DO SERVIDOR.
//
// Sem senha certa não mostra nada: esta informação não deve ficar à vista
// de quem passe pelo endereço.
// =====================================================

const JSC_SONDA_SENHA = '';   // <<< escreva aqui uma senha antes de enviar

header('Content-Type: text/plain; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');

if (JSC_SONDA_SENHA === '') {
    http_response_code(403);
    exit("Abra o ficheiro e escreva uma senha na linha JSC_SONDA_SENHA antes de o usar.\n");
}
if (!isset($_GET['senha']) || !hash_equals(JSC_SONDA_SENHA, (string)$_GET['senha'])) {
    http_response_code(403);
    exit("Senha errada.\n");
}

function linha($rotulo, $valor) { printf("%-34s %s\n", $rotulo, $valor); }
function titulo($t) { echo "\n", $t, "\n", str_repeat('-', 62), "\n"; }
function simNao($v) { return $v ? 'sim' : 'NÃO'; }

echo "SONDAGEM AO ALOJAMENTO — Juventude Sport Campinense\n";
echo date('c'), "\n";

titulo('PHP');
linha('versão', PHP_VERSION);
linha('como corre (SAPI)', PHP_SAPI);
linha('sistema', PHP_OS_FAMILY);
linha('64 bits', simNao(PHP_INT_SIZE === 8));

titulo('Extensões de que o projeto precisa');
$precisa = [
    'json'      => 'ler e gravar o conteúdo publicado',
    'mbstring'  => 'texto em português nas ferramentas',
    'dom'       => 'filtro de HTML das notícias e textos legais',
    'libxml'    => 'idem',
    'session'   => 'autenticação do painel',
    'openssl'   => 'https e hashes',
    'fileinfo'  => 'validar imagens enviadas',
    'curl'      => 'importações (opcional, há alternativa)',
    'pdo_mysql' => 'base de dados (opcional hoje)',
    'mysqli'    => 'base de dados (alternativa)',
    'zip'       => 'cópias de segurança (opcional)',
    'gd'        => 'redimensionar imagens (opcional)',
    'intl'      => 'datas e ordenação (opcional)',
];
foreach ($precisa as $ext => $porque) {
    linha($ext, (extension_loaded($ext) ? 'sim' : 'NÃO') . '   — ' . $porque);
}

titulo('Limites');
foreach (['memory_limit','max_execution_time','post_max_size','upload_max_filesize',
          'max_input_vars','default_socket_timeout'] as $k) {
    linha($k, ini_get($k));
}
linha('allow_url_fopen', simNao(ini_get('allow_url_fopen')));
linha('open_basedir', ini_get('open_basedir') ?: '(sem restrição)');
$desativadas = trim((string)ini_get('disable_functions'));
linha('funções desativadas', $desativadas === '' ? '(nenhuma)' : $desativadas);

titulo('Sessões');
linha('handler', ini_get('session.save_handler'));
$sp = ini_get('session.save_path') ?: sys_get_temp_dir();
linha('pasta das sessões', $sp);
linha('pasta escrita pelo PHP', simNao(is_writable(explode(';', $sp)[count(explode(';', $sp)) - 1])));
linha('cookie só por https', simNao(ini_get('session.cookie_secure')));
linha('cookie fora do JavaScript', simNao(ini_get('session.cookie_httponly')));
linha('gc_maxlifetime', ini_get('session.gc_maxlifetime'));

titulo('Servidor web');
linha('software', $_SERVER['SERVER_SOFTWARE'] ?? '(não diz)');
linha('protocolo', $_SERVER['SERVER_PROTOCOL'] ?? '?');
linha('https neste pedido', simNao(!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'));
linha('X-Forwarded-Proto', $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '(nenhum)');
linha('raiz do site', $_SERVER['DOCUMENT_ROOT'] ?? '?');
if (function_exists('apache_get_modules')) {
    $mods = apache_get_modules();
    foreach (['mod_rewrite','mod_headers','mod_deflate','mod_expires','mod_setenvif',
              'mod_include','mod_authz_core','mod_php','mod_mime'] as $m) {
        linha('  ' . $m, simNao(in_array($m, $mods, true)));
    }
} else {
    linha('lista de módulos', '(não acessível a partir do PHP — normal em FPM/CGI)');
}

titulo('O .htaccess está a ser lido?');
// Se estas regras estivessem a ser ignoradas, o pedido a este ficheiro
// teria chegado na mesma; o que se pode confirmar daqui é que existe.
$raiz = rtrim($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__), '/');
foreach (['/.htaccess', '/data/.htaccess', '/api/config.php', '/data/db.json'] as $f) {
    linha($f, is_file($raiz . $f) ? 'existe' : 'não existe');
}
echo "\nPara confirmar as regras a sério, abra estes endereços no browser\n";
echo "e anote o código de resposta (espera-se 403, 403, 200, 404):\n";
echo "  /data/db.json      → deve dar 403\n";
echo "  /api/schema.sql    → deve dar 403\n";
echo "  /manifest.json     → deve dar 200\n";
echo "  /nao-existe-xyz    → deve dar 404\n";

titulo('O PHP pode gerar HTML e gravá-lo?');
// Só perguntas. Nada é escrito.
$alvos = [
    'raiz do site'      => $raiz,
    'pasta data/'       => $raiz . '/data',
    'pasta do projeto'  => dirname(__DIR__),
];
foreach ($alvos as $rotulo => $caminho) {
    if (!is_dir($caminho)) { linha($rotulo, '(não existe: ' . $caminho . ')'); continue; }
    linha($rotulo, 'escrita pelo PHP: ' . simNao(is_writable($caminho)) . '   ' . $caminho);
}
linha('index.html na raiz', is_file($raiz . '/index.html')
    ? ('escrita pelo PHP: ' . simNao(is_writable($raiz . '/index.html')))
    : '(não existe — o site ainda não está aqui)');
linha('utilizador do PHP', function_exists('posix_getpwuid') && function_exists('posix_geteuid')
    ? (posix_getpwuid(posix_geteuid())['name'] ?? '?') : get_current_user());

titulo('Base de dados');
if (is_file(__DIR__ . '/../api/config.local.php')) {
    // Lê a versão e mais nada. Não cria, não altera, não apaga.
    $antes = get_defined_vars();
    require __DIR__ . '/../api/config.local.php';
    $temConst = defined('DB_HOST') && defined('DB_NAME') && defined('DB_USER');
    if ($temConst && extension_loaded('pdo_mysql')) {
        try {
            $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
                DB_USER, defined('DB_PASS') ? DB_PASS : '',
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 5]);
            linha('ligação', 'ok');
            linha('versão', $pdo->query('SELECT VERSION()')->fetchColumn());
            linha('codificação', $pdo->query("SELECT @@character_set_database")->fetchColumn());
            $n = $pdo->query('SHOW TABLES')->rowCount();
            linha('tabelas existentes', $n);
        } catch (Throwable $e) {
            linha('ligação', 'falhou — ' . $e->getMessage());
        }
    } else {
        linha('credenciais', $temConst ? 'existem, mas falta pdo_mysql' : 'não definidas em config.local.php');
    }
} else {
    linha('api/config.local.php', 'não existe — sem credenciais para testar');
}

titulo('Fim');
echo "Esta página não alterou nada no servidor.\n";
echo "APAGUE ESTE FICHEIRO DO SERVIDOR depois de copiar o resultado.\n";
