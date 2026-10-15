# uploads/logos/

Escudos das equipas, carregados pelo painel em
**Configurações → Logótipos**. O `db_logos` aponta para cá:

    { "ferreiras": "uploads/logos/ferreiras.png" }

## Isto não é uma pasta do repositório

É **conteúdo persistente do servidor**:

- não depende do GitHub;
- **não é apagada nem substituída nos deploys** — ao enviar ficheiros
  para o alojamento, esta pasta fica de fora;
- **entra nos backups** do alojamento, como a `data/`.

Só o `.htaccess` e este ficheiro são versionados. As imagens não.

## Quem escreve aqui

Só o `api/logo.php`, com sessão e a capacidade `configuracoes`. O nome do
ficheiro é sempre gerado no servidor a partir do nome da equipa; nunca
vem do cliente. Formatos aceites: PNG, JPEG e WebP — o SVG fica de fora
de propósito, porque um SVG servido da nossa origem pode executar script.

## A garantia está no nome, não no `.htaccess`

O `.htaccess` desta pasta desliga a execução e limita o que é servido, mas
**só funciona em alojamentos onde o PHP venha por módulo ou handler**. Com
PHP-FPM por proxy — `ProxyPassMatch` ou `SetHandler proxy:` — um pedido a um
`.php` não chega a ser um pedido de ficheiro nesta pasta e o `.htaccess` nem
é lido. Está medido na bateria: o comportamento é igual com e sem ele.

A garantia que vale em qualquer alojamento é outra: o `api/logo.php` **gera**
o nome, sempre `<slug>.<png|jpg|webp>` com o slug em `[a-z0-9-]`, e portanto
nunca cria aqui um ficheiro com nome executável. O `.htaccess` é defesa em
profundidade onde funcionar.
