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

-- =====================================================
-- AUTENTICAÇÃO DO PAINEL
-- =====================================================
-- Estas tabelas são criadas automaticamente por api/db.php na primeira
-- ligação, tal como as de cima. Ficam aqui para referência e para quem
-- preferir criá-las à mão no phpMyAdmin.

CREATE TABLE IF NOT EXISTS jsc_utilizadores (
  id             INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY,
  utilizador     VARCHAR(50)     NOT NULL UNIQUE,
  email          VARCHAR(190)    NOT NULL,
  palavra_passe  VARCHAR(255)    NOT NULL,   -- password_hash(), nunca a password
  papel          VARCHAR(20)     NOT NULL DEFAULT 'admin',
  ativo          TINYINT(1)      NOT NULL DEFAULT 1,
  criado_em      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acesso  DATETIME        NULL,
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tentativas falhadas, para bloqueio por utilizador e por IP.
-- No servidor, ao contrário do bloqueio antigo que vivia no localStorage
-- e desaparecia apagando uma chave.
CREATE TABLE IF NOT EXISTS jsc_tentativas (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  utilizador  VARCHAR(50)     NOT NULL,
  ip          VARCHAR(45)     NOT NULL,
  quando      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_utilizador (utilizador, quando),
  INDEX idx_ip (ip, quando)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pedidos de recuperação. Guarda-se o hash do token, não o token: quem
-- ler a base de dados não consegue usar um pedido pendente.
CREATE TABLE IF NOT EXISTS jsc_recuperacao (
  token_hash     CHAR(64)        NOT NULL PRIMARY KEY,
  utilizador_id  INT UNSIGNED    NOT NULL,
  criado_em      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em      DATETIME        NOT NULL,
  usado          TINYINT(1)      NOT NULL DEFAULT 0,
  INDEX idx_utilizador (utilizador_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- NOTÍCIAS
-- =====================================================
CREATE TABLE IF NOT EXISTS jsc_noticias (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  titulo         VARCHAR(255)    NOT NULL,
  categoria      VARCHAR(50)     NOT NULL DEFAULT 'Clube',
  data           DATE            NOT NULL,
  resumo         LONGTEXT        NULL,          -- corpo em HTML
  imagem         VARCHAR(500)    NULL,          -- caminho em /uploads/ ou URL
  imagem_pos     VARCHAR(20)     NOT NULL DEFAULT 'top',
  imagem_size    VARCHAR(20)     NOT NULL DEFAULT 'cover',
  focal_pos      VARCHAR(20)     NOT NULL DEFAULT 'center',
  publicada      TINYINT(1)      NOT NULL DEFAULT 0,
  agendada_para  DATETIME        NULL,          -- publica-se sozinha nesta hora
  destaque       TINYINT(1)      NOT NULL DEFAULT 0,
  criado_em      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_visivel (publicada, data),
  INDEX idx_categoria (categoria),
  INDEX idx_destaque (destaque)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
