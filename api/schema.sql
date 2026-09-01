-- =====================================================
-- JUVENTUDE SPORT CAMPINENSE — Esquema da base de dados
-- =====================================================
-- Como usar (cPanel):
--   1. MySQL Databases → criar base de dados (ex: jsc_site)
--   2. Criar utilizador MySQL e associá-lo à base (ALL PRIVILEGES)
--   3. phpMyAdmin → selecionar a base → separador SQL → colar este
--      ficheiro → Executar
--   4. Preencher DB_HOST / DB_NAME / DB_USER / DB_PASS em
--      api/config.local.php (copiado de api/config.local.example.php)
-- =====================================================

CREATE TABLE IF NOT EXISTS jsc_inscricoes (
  id         BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  dados      LONGTEXT        NOT NULL,
  estado     VARCHAR(20)     NOT NULL DEFAULT 'Pendente',
  criado_em  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS jsc_mensagens (
  id         BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  dados      LONGTEXT        NOT NULL,
  estado     VARCHAR(20)     NOT NULL DEFAULT 'Não lida',
  criado_em  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
