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

// ---- Base de dados MySQL (opcional) ----
// Recebe as inscrições e mensagens submetidas pelos visitantes.
// Deixe DB_NAME vazio para funcionar sem base de dados.
// Atenção: no cPanel os nomes levam o prefixo da conta,
// por exemplo 'campin_jsc_site' e 'campin_jsc_user'.
define('DB_HOST', 'localhost');
define('DB_NAME', '');
define('DB_USER', '');
define('DB_PASS', '');
