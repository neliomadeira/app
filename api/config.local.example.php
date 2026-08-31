<?php
// =====================================================
// MODELO — copie para api/config.local.php e preencha.
// =====================================================
//     cp api/config.local.example.php api/config.local.php
//
// O ficheiro config.local.php NÃO é versionado: os valores
// abaixo nunca chegam ao git nem ao repositório público.
// Preencha-o apenas no servidor.
// =====================================================

// ---- Token de publicação ----
// Protege api/save.php (publicar o site) e api/registos.php
// (listar inscrições e mensagens). Tem de ser exatamente igual
// ao valor gravado no painel admin, em Configurações > Segurança
// > "Token de publicação no servidor".
//
// Para gerar um token novo:
//     php -r 'echo bin2hex(random_bytes(24)), "\n";'
define('JSC_TOKEN', 'PREENCHER-COM-O-SEU-TOKEN');

// ---- Base de dados MySQL (opcional) ----
// Recebe as inscrições e mensagens submetidas pelos visitantes.
// Deixe DB_NAME vazio para funcionar sem base de dados.
// Atenção: no cPanel os nomes levam o prefixo da conta,
// por exemplo 'campin_jsc_site' e 'campin_jsc_user'.
define('DB_HOST', 'localhost');
define('DB_NAME', '');
define('DB_USER', '');
define('DB_PASS', '');
