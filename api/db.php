<?php
// Ligação PDO à base de dados MySQL (opcional).
// Se DB_NAME estiver vazio em config.php, o site funciona sem base de
// dados: os formulários continuam a guardar localmente + email.
require_once __DIR__ . '/config.php';

function jsc_db() {
    static $pdo = null;
    static $tried = false;
    if ($tried) return $pdo;
    $tried = true;
    if (!defined('DB_NAME') || DB_NAME === '') return null;
    try {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]
        );
        // Criar tabelas se ainda não existirem (idempotente)
        $pdo->exec("CREATE TABLE IF NOT EXISTS jsc_inscricoes (
            id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
            dados LONGTEXT NOT NULL,
            estado VARCHAR(20) NOT NULL DEFAULT 'Pendente',
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $pdo->exec("CREATE TABLE IF NOT EXISTS jsc_mensagens (
            id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
            dados LONGTEXT NOT NULL,
            estado VARCHAR(20) NOT NULL DEFAULT 'Não lida',
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    } catch (Exception $e) {
        $pdo = null;
    }
    return $pdo;
}

function jsc_tabela($tipo) {
    return $tipo === 'inscricao' ? 'jsc_inscricoes' : 'jsc_mensagens';
}
