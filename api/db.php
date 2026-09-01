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
        // Autenticação do painel (ver api/schema.sql)
        $pdo->exec("CREATE TABLE IF NOT EXISTS jsc_utilizadores (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            utilizador VARCHAR(50) NOT NULL UNIQUE,
            email VARCHAR(190) NOT NULL,
            palavra_passe VARCHAR(255) NOT NULL,
            papel VARCHAR(20) NOT NULL DEFAULT 'admin',
            ativo TINYINT(1) NOT NULL DEFAULT 1,
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ultimo_acesso DATETIME NULL,
            INDEX idx_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $pdo->exec("CREATE TABLE IF NOT EXISTS jsc_tentativas (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            utilizador VARCHAR(50) NOT NULL,
            ip VARCHAR(45) NOT NULL,
            quando DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_utilizador (utilizador, quando),
            INDEX idx_ip (ip, quando)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $pdo->exec("CREATE TABLE IF NOT EXISTS jsc_patrocinadores (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            nome VARCHAR(150) NOT NULL,
            sector VARCHAR(100) NULL,
            tier VARCHAR(20) NOT NULL DEFAULT 'Bronze',
            website VARCHAR(500) NULL,
            logo VARCHAR(500) NULL,
            ordem INT NOT NULL DEFAULT 0,
            ativo TINYINT(1) NOT NULL DEFAULT 1,
            desde VARCHAR(10) NULL,
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_visivel (ativo, tier, ordem)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $pdo->exec("CREATE TABLE IF NOT EXISTS jsc_noticias (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            titulo VARCHAR(255) NOT NULL,
            categoria VARCHAR(50) NOT NULL DEFAULT 'Clube',
            data DATE NOT NULL,
            resumo LONGTEXT NULL,
            imagem VARCHAR(500) NULL,
            imagem_pos VARCHAR(20) NOT NULL DEFAULT 'top',
            imagem_size VARCHAR(20) NOT NULL DEFAULT 'cover',
            focal_pos VARCHAR(20) NOT NULL DEFAULT 'center',
            publicada TINYINT(1) NOT NULL DEFAULT 0,
            agendada_para DATETIME NULL,
            destaque TINYINT(1) NOT NULL DEFAULT 0,
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_visivel (publicada, data),
            INDEX idx_categoria (categoria),
            INDEX idx_destaque (destaque)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $pdo->exec("CREATE TABLE IF NOT EXISTS jsc_recuperacao (
            token_hash CHAR(64) NOT NULL PRIMARY KEY,
            utilizador_id INT UNSIGNED NOT NULL,
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expira_em DATETIME NOT NULL,
            usado TINYINT(1) NOT NULL DEFAULT 0,
            INDEX idx_utilizador (utilizador_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    } catch (Exception $e) {
        $pdo = null;
    }
    return $pdo;
}

function jsc_tabela($tipo) {
    return $tipo === 'inscricao' ? 'jsc_inscricoes' : 'jsc_mensagens';
}
