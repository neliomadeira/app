# Validação

Este projeto não tem build, lint, testes nem TypeScript. As verificações
habituais não se aplicam, e declarar uma fase concluída sem verificar nada
seria pior do que não ter regra nenhuma.

O `validar.js` faz o equivalente: levanta o site num Apache local **com o
`.htaccess` real do projeto**, abre todas as páginas num browser a sério,
nas sete larguras que o site tem de suportar, e falha se encontrar
problemas.

## Instalar

```
cd tools
npm install
```

Instala o Playwright e descarrega o Chromium. É a única dependência, e
fica em `tools/node_modules/`, fora do site.

## Usar

```
node tools/validar.js                     # tudo: 24 páginas × 7 larguras
node tools/validar.js --pagina index.html # uma página
node tools/validar.js --largura 320       # uma largura
node tools/validar.js --json              # saída em JSON
```

Código de saída `0` sem problemas, `1` com problemas.

## Comparar com o estado gravado

`tools/estado-inicial.json` guarda o resultado de uma execução. Serve para
provar que uma alteração não partiu nada:

```
node tools/validar.js --comparar
```

Mostra o que ficou resolvido e o que apareceu de novo. Se aparecer algo
novo, sai com erro — é uma regressão.

Para gravar um novo estado de referência, depois de confirmar que o
resultado é o esperado:

```
node tools/validar.js --gravar-base
```

## O que é verificado

Em cada página e em cada largura:

- **erros de JavaScript** na consola e exceções não apanhadas;
- **overflow horizontal**, com o elemento responsável identificado;
- **recursos em falta** — qualquer pedido que devolva 400 ou mais;
- **páginas que não carregam** ou ficam sem conteúdo visível;
- **resposta HTTP** diferente de 200.

Uma vez por execução, as regras do `.htaccess` que protegem o site:

| Endereço | Esperado | Porquê |
|---|---|---|
| `/data/db.json` | 403 | o conteúdo publicado não pode ser lido diretamente |
| `/api/schema.sql` | 403 | ficheiros `.sql` estão bloqueados |
| `/manifest.json` | 200 | se for bloqueado, o service worker não instala |
| `/api/load.php` | 200 | é daqui que as páginas leem o conteúdo publicado |
| `/images/` | 403 ou 404 | a listagem de diretórios não pode ser exposta |
| `/nao-existe-xyz` | 404 | um endereço inexistente não pode devolver 200 |

## Como o servidor é montado

O Apache é arrancado com uma configuração própria numa pasta temporária.
Não toca em `/etc` nem na instalação do sistema, e é parado no fim.

Duas particularidades, que existem por razões concretas:

- **O Apache aqui não traz módulo de PHP.** Os pedidos a `.php` são
  encaminhados para um `php -S` que corre ao lado, para os *endpoints*
  funcionarem a sério em vez de serem servidos como texto.
- **`RequestHeader set X-Forwarded-Proto "https" early`.** O `.htaccess`
  força https, e em teste local isso quebrava tudo. O cabeçalho tem de ser
  posto pelo servidor e com `early`: posto pelo browser não chega aos
  pedidos do service worker, e sem `early` chega depois de o `mod_rewrite`
  já ter decidido redirecionar.

Recursos externos — tipos de letra, mapas, vídeos — são cortados durante o
teste. Não são do site, e sem eles o resultado é igual com e sem ligação à
internet.

Se o Apache não estiver disponível, o guião usa `php -S` e avisa que as
regras do `.htaccess` não estão a ser aplicadas.

## O `.htaccess` da raiz não entra nos deploys de rotina

É o único ficheiro do projeto com duas donas. As regras de segurança e de
reescrita são nossas; os dois blocos do fim — `BEGIN cPanel-generated php
ini directives` e `php -- BEGIN cPanel-generated handler` — são escritos
pelo cPanel, e reescritos por ele sempre que se muda a versão de PHP ou os
limites no MultiPHP Manager / MultiPHP INI Editor.

Por isso, **ao enviar ficheiros para o alojamento este fica de fora**, como
a `data/` e a `uploads/logos/`. O que está versionado é a cópia de
referência, para que um envio por engano seja inofensivo — não é a fonte da
verdade do que está no ar.

Medido uma vez à mão, antes de o commit `7271c97` existir: o ficheiro do
servidor tinha 112 directivas efectivas e o do repositório 81. As 31 em
falta eram exactamente os dois blocos do cPanel. Enviar o do repositório
por cima teria apagado o handler do PHP 8.3 e derrubado todo o PHP do site.

Quando for mesmo preciso enviá-lo — por exemplo depois de acrescentar uma
regra de segurança — a ordem é:

1. descarregar o `.htaccess` da raiz pelo gestor de ficheiros do cPanel;
2. `node tools/comparar-htaccess.js <ficheiro-descarregado>`;
3. enviar só se sair `0`.

E ao contrário: depois de mexer na versão de PHP ou nos limites pelo
cPanel, a cópia daqui fica desactualizada. O passo 2 diz isso, e a correção
é copiar os blocos do ficheiro do servidor para cá — nunca editá-los à mão.

## Comparar o `.htaccess` do servidor com o do repositório

```
node tools/comparar-htaccess.js /caminho/do/.htaccess-descarregado
```

Só lê: não altera nenhum dos dois ficheiros, não toca no servidor e não faz
deploy. Código de saída `0` sem divergências, `1` com divergências, `2` se
não conseguir ler um dos ficheiros.

Compara quatro coisas:

| Verificação | Falha quando |
|---|---|
| **blocos do cPanel** | falta um dos dois de um dos lados, ou existem nos dois com conteúdo diferente — comparação byte a byte, incluindo as aspas curvas do comentário do handler, que é por elas que o cPanel reconhece o bloco como seu |
| **versão de PHP** | o `AddHandler application/x-httpd-ea-phpNN` difere entre os dois, ou falta num deles |
| **regras de segurança** | qualquer uma das 12 regras nomeadas falta de um dos lados — executáveis bloqueados em `uploads/`, só imagens em `uploads/logos/`, `<FilesMatch>` dos ficheiros sensíveis, excepção do `manifest.json`, `scraper/` negada, CSP, `nosniff`, `X-Frame-Options`, `X-Robots-Tag`, `Options -Indexes`, `www` → domínio único, http → https |
| **directivas efectivas** | alguma linha que não seja comentário nem linha em branco existe num ficheiro e não no outro. A contagem respeita repetições: as doze `php_value` aparecem duas vezes cada, uma por `IfModule`, e perder uma delas aparece aqui |

Comentários e indentação são ignorados de propósito: é o que o Apache lê
que interessa, e a indentação das regras dos uploads difere entre os dois
ficheiros sem que isso mude nada. É também por isso que o cabeçalho de
aviso no topo do `.htaccess` do repositório não conta como divergência.

Uma divergência em **regras de segurança** que diga `FALTA NO SERVIDOR` é
diferente de todas as outras: significa que o site está sem essa protecção
neste momento, e o que falta é actualizar o servidor, não o repositório.

A ferramenta tem testes próprios na bateria (`tools/testar-sem-js.js`):
corre o comando a sério contra pares de ficheiros sintéticos e verifica
cada código de saída e que nenhum ficheiro é modificado pela execução.

## Cópias de segurança do conteúdo

```
php api/backup.php --onde
php api/backup.php --conteudo --iniciar     na primeira vez
php api/backup.php --conteudo               nas seguintes
php api/backup.php --relatorio
php api/backup.php --verificar --profundo
php api/backup.php --limpar                 mostra o que a retenção faria
php api/backup.php --ensaio-recuperacao --serie --para <pasta> --limpar-depois
```

As cópias vivem **fora da raiz web**, em `/home/<utilizador>/jsc-backups/`, com
as pastas a `0700` e os ficheiros a `0600`. Medido no alojamento a 17/10/2026:
PHP 8.3.35 em CGI/FastCGI, `open_basedir` vazio, a pasta escrita, lida, fechada
a `0600` e limpa pelo PHP do site. Nada disto vai para o Git.

Cada cópia é um ficheiro datado em UTC com uma entrada no `manifesto.json`:
as duas impressões digitais (conteúdo e ficheiro), os dois tamanhos, a
compressão, a origem, quem pediu, as contagens por área e a **etiqueta**.

### Duas origens

O `--conteudo` olha para dois ficheiros:

| Origem | Etiqueta | O que é |
|---|---|---|
| `data/db.json` | `cron` ou a que se pedir | o estado publicado agora |
| `data/publicacao/anterior/data__db.json` | `anterior` | o estado que a última publicação substituiu |

A segunda é **apenas lida**. Essa pasta é a área de uma transação da geração e
o `jsc_reparar_transacao()` depende dela: escrever, renomear ou apagar ali
partiria o rollback de uma publicação interrompida.

Com as duas, cada estado publicado fica guardado mesmo que duas publicações
aconteçam entre duas execuções. Três publicações entre duas execuções perdem o
estado do meio — a garantia exacta de uma cópia **antes** de cada publicação
precisa de uma chamada dentro da publicação, que não existe ainda.

### A política de retenção de dados pessoais

O `data/db.json` não é o conteúdo público: leva a data de nascimento, o nome do
encarregado e o telefone de cada atleta, e a projeção pública só deixa passar
sete campos. **Uma cópia do `db.json` é uma cópia de dados pessoais de
menores**, e é isso que a retenção existe para limitar — não o disco, que a
2,9 MB por cópia e 188 GB livres não é restrição nenhuma.

| Escalão | Guarda |
|---|---|
| recentes | todas as cópias das últimas **48 horas**, e no mínimo as **10** mais recentes |
| diária | a mais antiga de cada um dos últimos **14 dias** |
| semanal | a mais antiga de cada uma das últimas **8 semanas** ISO |
| mensal | a mais antiga de cada um dos últimos **12 meses** |
| protegidas | as etiquetas `manual` e `pre-publicacao`, **12 meses** |

A mais **antiga** de cada período, não a mais recente: numa recuperação
procura-se o estado antes de algo ter corrido mal, e a primeira cópia do dia é
a que está mais longe do erro.

Os valores estão em `jsc_bk_politica()`, no topo do `api/backup.php`, e podem
ser mudados na linha de comandos para se ver o efeito antes de se mexer no
código: `--recentes-horas`, `--recentes-minimo`, `--dias`, `--semanas`,
`--meses`, `--protegidas-meses`, `--maximo`.

### Nenhuma eliminação, até a política ser aprovada

```php
define('JSC_BK_POLITICA_APROVADA', false);
```

Enquanto esta linha for `false`, o `--limpar` mostra o que faria e o `--aplicar`
recusa-se: **nenhuma execução apaga uma cópia**. É uma constante e não uma
opção da linha de comandos de propósito — um engano num cron não pode ligar as
eliminações.

Quando for ligada, estas regras aplicam-se pela ordem:

1. verificação profunda de tudo;
2. sem nenhuma cópia válida, **apaga zero** e sai com erro;
3. se a cópia **mais recente** falhar a verificação, **apaga zero** — pode
   estar a acontecer algo agora, e não é hora de limpar o histórico;
4. a cópia válida mais recente é acrescentada à força ao conjunto a guardar;
5. uma cópia que não se consegue verificar **nunca** é candidata: é prova, e
   apaga-se à mão depois de se olhar para ela;
6. no máximo **5 remoções por execução**;
7. a entrada sai do manifesto e o ficheiro sai do disco dentro da mesma tranca.

### O cron, no cPanel

```
7 * * * *  /opt/cpanel/ea-php83/root/usr/bin/php /home/campinense/novo.campinense.pt/api/backup.php --conteudo >/dev/null
17 4 * * 1 /opt/cpanel/ea-php83/root/usr/bin/php /home/campinense/novo.campinense.pt/api/backup.php --verificar --profundo >/dev/null
23 5 1 * * /opt/cpanel/ea-php83/root/usr/bin/php /home/campinense/novo.campinense.pt/api/backup.php --limpar >/dev/null
```

O `>/dev/null` manda o sucesso para o lixo e deixa o **stderr** ir para o email
da conta: só se recebe mensagem quando algo corre mal. Nenhuma destas linhas
apaga nada.

## Auditar as notícias já escritas, a partir do browser

As notícias vivem no `localStorage` do browser onde o painel é usado. Para as
verificar sem linha de comandos e sem exportar dados pessoais, abra

```
tools/auditar-noticias.html
```

**no mesmo endereço onde abre o painel** — se o painel está em
`http://127.0.0.1:5500/admin/`, a página é
`http://127.0.0.1:5500/tools/auditar-noticias.html`. O browser guarda os dados
de cada endereço em separado; aberta como ficheiro solto (`file://`) a página
não encontra nada.

A página só lê. Mostra quantas notícias existem, quantas passam pela allowlist
sem alteração, que etiquetas, atributos e propriedades CSS seriam removidos, e
se há atributos de evento ou protocolos perigosos. Permite descarregar um
ficheiro **só com as notícias** — título, categoria, data e texto — sem
inscrições, mensagens nem contactos, para a análise exata pelo comando abaixo.

## Impacto do filtro nas notícias já escritas

O corpo das notícias passa por um filtro de HTML antes de ser gravado, mas
só quando a notícia é criada ou editada. As que já estavam guardadas não
são tocadas.

Para ver o que mudaria nelas, sem alterar nada:

```
php tools/impacto-noticias.php data/db.json
php tools/impacto-noticias.php backup-campinense-AAAA-MM-DD.json --detalhe
```

Diz quantas notícias seriam afetadas, que elementos e atributos seriam
removidos, e quais delas perderiam texto visível. Sai com `1` se houver
alterações a fazer e `0` se não houver. Não escreve nada.

## Diagnóstico

`JSC_DEBUG=1` mantém a configuração gerada do Apache e o respetivo
`erro.log` na pasta temporária, em vez de os apagar.
