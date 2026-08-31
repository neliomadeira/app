<?php
// =====================================================
// Configuração pública — NÃO coloque segredos aqui.
// Este ficheiro é versionado no git.
// =====================================================
// Os valores reais (token e credenciais MySQL) vivem em
// api/config.local.php, que está fora do controlo de versões.
// Para criar esse ficheiro no servidor, copie o modelo:
//
//     cp api/config.local.example.php api/config.local.php
//
// e preencha-o. Sem esse ficheiro o site continua a funcionar:
// as páginas públicas leem os dados normalmente, apenas a
// publicação a partir do admin e a base de dados ficam inativas.
// =====================================================

if (is_file(__DIR__ . '/config.local.php')) {
    require_once __DIR__ . '/config.local.php';
}

// Valores por omissão — aplicados apenas ao que config.local.php
// não tenha já definido. Um token vazio faz save.php e registos.php
// recusarem todos os pedidos, que é o comportamento seguro quando
// o servidor ainda não foi configurado.
if (!defined('JSC_TOKEN')) define('JSC_TOKEN', '');
if (!defined('DB_HOST'))   define('DB_HOST', 'localhost');
if (!defined('DB_NAME'))   define('DB_NAME', '');
if (!defined('DB_USER'))   define('DB_USER', '');
if (!defined('DB_PASS'))   define('DB_PASS', '');

define('DATA_FILE', __DIR__ . '/../data/db.json');
