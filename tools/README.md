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

## Diagnóstico

`JSC_DEBUG=1` mantém a configuração gerada do Apache e o respetivo
`erro.log` na pasta temporária, em vez de os apagar.
