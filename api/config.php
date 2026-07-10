<?php
// Token de autenticação para publicar dados no servidor.
// Deve corresponder ao token configurado no painel admin (Configurações > Segurança).
// IMPORTANTE: altere este valor antes de colocar o site online!
define('JSC_TOKEN', 'campinense2025');
define('DATA_FILE', __DIR__ . '/../data/db.json');

// ---- Base de dados MySQL (opcional) ----
// Permite que as inscrições e mensagens de contacto dos visitantes
// cheguem ao servidor (e ao admin em qualquer dispositivo).
// 1. Cria a base de dados e o utilizador no cPanel (MySQL Databases)
// 2. Executa api/schema.sql no phpMyAdmin (ou deixa as tabelas serem
//    criadas automaticamente no primeiro registo)
// 3. Preenche os 4 valores abaixo
// Se DB_NAME ficar vazio, o site funciona sem base de dados.
define('DB_HOST', 'localhost');
define('DB_NAME', '');
define('DB_USER', '');
define('DB_PASS', '');
