<?php
// =====================================================
// Configuração pública — NÃO coloque segredos aqui.
// Este ficheiro é versionado no git.
// =====================================================
// As credenciais da base de dados vivem em api/config.local.php,
// que está fora do controlo de versões.
// Para criar esse ficheiro no servidor, copie o modelo:
//
//     cp api/config.local.example.php api/config.local.php
//
// e preencha-o. Sem esse ficheiro o site continua a funcionar:
// as páginas públicas leem os dados normalmente e o painel também,
// apenas as inscrições deixam de ser guardadas na base de dados.
//
// A autenticação do painel não depende daqui: as contas ficam em
// data/utilizadores.json e são criadas no primeiro arranque.
// =====================================================

if (is_file(__DIR__ . '/config.local.php')) {
    require_once __DIR__ . '/config.local.php';
}

// Valores por omissão — aplicados apenas ao que config.local.php
// não tenha já definido. Sem base de dados o site funciona à mesma:
// só as inscrições e mensagens deixam de ser guardadas no servidor.
if (!defined('DB_HOST'))   define('DB_HOST', 'localhost');
if (!defined('DB_NAME'))   define('DB_NAME', '');
if (!defined('DB_USER'))   define('DB_USER', '');
if (!defined('DB_PASS'))   define('DB_PASS', '');

define('DATA_FILE', __DIR__ . '/../data/db.json');
