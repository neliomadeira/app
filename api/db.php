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
        // O MOTIVO NÃO SE PERDE. Este catch era mudo, e foi por isso que o
        // "bd nao configurada" do painel não dizia nada: credenciais erradas,
        // host errado, extensão em falta e base inexistente acabavam todos
        // aqui, indistinguíveis de fora. Custou duas semanas e um ficheiro de
        // diagnóstico temporário a descobrir que era um byte a mais no
        // config.local.php. Com esta linha, bastava ler o log de erros.
        //
        // CREDENCIAIS FORA. O MySQL põe o utilizador, o host e o nome da base
        // entre apóstrofos — "Access denied for user 'x'@'y'" — e um log pode
        // ser copiado para fora do servidor, anexado a um pedido de ajuda ou
        // lido por quem tenha acesso ao cPanel e não às senhas. Fica o código
        // de erro, que é o que diagnostica, e o texto com o que está entre
        // apóstrofos apagado.
        //
        // O caso de DB_NAME vazia, acima, não passa por aqui e não se
        // registra: um site sem base de dados configurada funciona à mesma, de
        // propósito, e não tem de encher o log a cada visita.
        $msg = preg_replace("/'[^']*'/", "'…'", $e->getMessage());
        $msg = preg_replace('/\s+/', ' ', (string)$msg);
        error_log('[JSC] ligacao MySQL falhou: ' . substr($msg, 0, 200));
    }
    return $pdo;
}

function jsc_tabela($tipo) {
    return $tipo === 'inscricao' ? 'jsc_inscricoes' : 'jsc_mensagens';
}
