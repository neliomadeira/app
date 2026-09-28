<?php
// =====================================================
// SONDAGEM AO ALOJAMENTO — só leitura, e um teste de escrita
// controlado, dentro da própria pasta
// =====================================================
// Serve para saber o que o alojamento permite, ANTES de lá pôr o site
// novo. Não precisa do site instalado: é um ficheiro solto, que corre
// sozinho e não carrega nada do projeto.
//
// O QUE FAZ
//   - lê a configuração do PHP: versão, extensões, limites, sessões;
//   - lê o que o servidor web diz de si;
//   - cria um ficheiro temporário DENTRO DA PRÓPRIA PASTA, lê-o e
//     apaga-o a seguir. É a única escrita, e serve para responder à
//     única pergunta que não se responde de outra maneira: o processo
//     PHP consegue escrever ficheiros?
//   - diz com que utilizador o PHP corre, e de quem são as pastas. É
//     isso que distingue "a minha conta escreve" de "o PHP escreve".
//
// O QUE NÃO FAZ
//   - não toca no site publicado, seja ele qual for;
//   - não abre ligação a nenhuma base de dados;
//   - não lê ficheiros do site, nem de configuração, nem de WordPress;
//   - não escreve fora da pasta onde está;
//   - não envia nada para lado nenhum.
//
// COMO USAR
//   1. escreva uma senha na linha JSC_SONDA_SENHA, aqui em baixo;
//   2. crie uma pasta nova no alojamento, por exemplo /sonda-jsc/;
//   3. ponha lá este ficheiro, e só este;
//   4. abra https://o-seu-dominio/sonda-jsc/sondagem.php?senha=A_SUA_SENHA
//   5. copie o resultado;
//   6. apague a pasta.
// =====================================================

const JSC_SONDA_SENHA = '';   // <<< escreva aqui uma senha antes de enviar

header('Content-Type: text/plain; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

if (JSC_SONDA_SENHA === '') {
    http_response_code(403);
    exit("Abra este ficheiro num editor e escreva uma senha na linha JSC_SONDA_SENHA.\n");
}
if (!isset($_GET['senha']) || !hash_equals(JSC_SONDA_SENHA, (string)$_GET['senha'])) {
    http_response_code(403);
    exit("Senha errada.\n");
}

function linha($rotulo, $valor) { printf("%-34s %s\n", $rotulo, $valor); }
function titulo($t) { echo "\n", $t, "\n", str_repeat('-', 64), "\n"; }
function simNao($v) { return $v ? 'sim' : 'NAO'; }

$aqui = __DIR__;

echo "SONDAGEM AO ALOJAMENTO — J.S. Campinense\n";
echo date('c'), "\n";
echo "Esta pagina nao altera o site nem a base de dados.\n";

// =====================================================
titulo('1. O PHP CONSEGUE ESCREVER FICHEIROS?');
// =====================================================
// A pergunta que decide a arquitetura. Responde-se escrevendo mesmo, e
// nao a perguntar ao sistema: is_writable() engana-se com ACLs, com
// open_basedir e com sistemas de ficheiros so de leitura.
//
// A escrita e feita aqui, nesta pasta, que e uma pasta criada da mesma
// maneira que a futura pasta do site tera de ser. E apagada a seguir.
$nome = $aqui . DIRECTORY_SEPARATOR . 'sonda-escrita-' . bin2hex(random_bytes(6)) . '.txt';
$conteudo = 'teste de escrita ' . date('c');

$escreveu = @file_put_contents($nome, $conteudo);
if ($escreveu === false) {
    linha('escrever um ficheiro', 'NAO — ' . (error_get_last()['message'] ?? 'sem detalhe'));
    linha('  conclusao', 'o PHP NAO escreve nesta pasta');
} else {
    linha('escrever um ficheiro', 'sim (' . $escreveu . ' bytes)');
    $lido = @file_get_contents($nome);
    linha('voltar a ler o que escreveu', $lido === $conteudo ? 'sim' : 'NAO');
    $dono = function_exists('posix_getpwuid') && function_exists('fileowner')
        ? (posix_getpwuid(fileowner($nome))['name'] ?? '?') : '?';
    linha('dono do ficheiro criado', $dono);
    linha('permissoes do ficheiro criado', substr(sprintf('%o', fileperms($nome)), -4));
    $apagou = @unlink($nome);
    linha('apagar o ficheiro', $apagou ? 'sim — nao ficou nada' : 'NAO — APAGUE-O A MAO');
    linha('  conclusao', 'o PHP escreve e apaga ficheiros nesta pasta');
}

// =====================================================
titulo('2. COM QUE UTILIZADOR CORRE O PHP');
// =====================================================
// E aqui que se ve se "a minha conta escreve" e o mesmo que "o PHP
// escreve". Se o PHP correr com o utilizador da conta (suPHP, FPM, CGI),
// e o mesmo. Se correr com um utilizador do servidor (mod_php: www-data,
// nobody, apache), nao e.
$utilizador = function_exists('posix_getpwuid') && function_exists('posix_geteuid')
    ? (posix_getpwuid(posix_geteuid())['name'] ?? '?')
    : (get_current_user() ?: '?');
linha('utilizador do PHP', $utilizador);
linha('como o PHP corre (SAPI)', PHP_SAPI);
$pistas = [
    'fpm-fcgi' => 'FPM — corre com o utilizador da conta',
    'cgi-fcgi' => 'CGI/suPHP — corre com o utilizador da conta',
    'litespeed'=> 'LiteSpeed — normalmente com o utilizador da conta',
    'apache2handler' => 'mod_php — corre com o utilizador do servidor, NAO com o da conta',
];
linha('  o que isso quer dizer', $pistas[PHP_SAPI] ?? '(sem regra conhecida para este modo)');

$donoPasta = function_exists('posix_getpwuid') ? (posix_getpwuid(fileowner($aqui))['name'] ?? '?') : '?';
linha('dono desta pasta', $donoPasta);
linha('permissoes desta pasta', substr(sprintf('%o', fileperms($aqui)), -4));
linha('o PHP e o dono desta pasta?', simNao($utilizador === $donoPasta && $utilizador !== '?'));

// =====================================================
titulo('3. PHP');
// =====================================================
linha('versao', PHP_VERSION);
linha('sistema', PHP_OS_FAMILY);
linha('64 bits', simNao(PHP_INT_SIZE === 8));

titulo('4. EXTENSOES DE QUE O PROJETO PRECISA');
$precisa = [
    'json'      => 'gravar e ler o conteudo publicado',
    'mbstring'  => 'texto em portugues nas ferramentas',
    'dom'       => 'filtro de HTML das noticias e textos legais',
    'libxml'    => 'idem',
    'session'   => 'autenticacao do painel',
    'openssl'   => 'https e hashes',
    'fileinfo'  => 'validar imagens enviadas',
    'curl'      => 'importacoes (opcional)',
    'pdo_mysql' => 'base de dados (so a partir da Fase D)',
    'mysqli'    => 'base de dados (alternativa)',
    'zip'       => 'copias de seguranca (opcional)',
    'gd'        => 'redimensionar imagens (opcional)',
];
foreach ($precisa as $ext => $porque) {
    linha($ext, (extension_loaded($ext) ? 'sim' : 'NAO') . '   — ' . $porque);
}

titulo('5. LIMITES');
foreach (['memory_limit', 'max_execution_time', 'post_max_size',
          'upload_max_filesize', 'max_input_vars'] as $k) {
    linha($k, ini_get($k));
}
linha('allow_url_fopen', simNao(ini_get('allow_url_fopen')));
linha('open_basedir', ini_get('open_basedir') ?: '(sem restricao)');
$desativadas = trim((string)ini_get('disable_functions'));
linha('funcoes desativadas', $desativadas === '' ? '(nenhuma)' : $desativadas);

titulo('6. SESSOES (a autenticacao do painel depende disto)');
linha('handler', ini_get('session.save_handler'));
$sp = ini_get('session.save_path') ?: sys_get_temp_dir();
$partes = explode(';', $sp);
$ultimo = trim((string)end($partes));
linha('pasta das sessoes', $sp);
linha('o PHP escreve nessa pasta', simNao(@is_writable($ultimo)));
linha('cookie so por https', simNao(ini_get('session.cookie_secure')));
linha('cookie fora do JavaScript', simNao(ini_get('session.cookie_httponly')));

titulo('7. SERVIDOR WEB');
linha('software', $_SERVER['SERVER_SOFTWARE'] ?? '(nao diz)');
linha('protocolo', $_SERVER['SERVER_PROTOCOL'] ?? '?');
linha('https neste pedido', simNao(!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'));
linha('X-Forwarded-Proto', $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '(nenhum)');
if (function_exists('apache_get_modules')) {
    foreach (['mod_rewrite', 'mod_headers', 'mod_deflate', 'mod_expires',
              'mod_setenvif', 'mod_include', 'mod_authz_core'] as $m) {
        linha('  ' . $m, simNao(in_array($m, apache_get_modules(), true)));
    }
} else {
    linha('lista de modulos', '(o PHP nao a ve neste modo — normal em FPM/CGI)');
}
linha('o .htaccess desta pasta e lido', file_exists($aqui . '/.htaccess')
    ? 'ha um .htaccess aqui' : '(nao pus nenhum .htaccess para testar)');

titulo('8. BASE DE DADOS');
linha('ligacao', 'NAO tentada — esta sondagem nao toca na base de dados');
linha('  onde ver a versao', 'painel do alojamento > MySQL / phpMyAdmin');

titulo('FIM');
echo "Nada foi alterado: o unico ficheiro criado foi o do teste, e foi apagado.\n";
echo "APAGUE AGORA a pasta onde pos este ficheiro.\n";
