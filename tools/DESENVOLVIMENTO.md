# Trabalhar no projeto no computador

O painel precisa de PHP. O Live Server do VS Code serve ficheiros mas não
executa PHP, e por isso com ele o painel abre em **modo local**: escreve-se
e organiza-se conteúdo, mas não há conta, não há sessão e não se publica.

Para ter o painel completo, use o servidor de desenvolvimento.

## Iniciar

Na pasta do projeto, no terminal do VS Code:

```
.\iniciar.bat        (Windows)
./iniciar.sh         (macOS e Linux)
```

Ou, sem os guiões:

```
php -S localhost:8000 -t . tools/servidor-local.php
```

## Endereços

| | |
|---|---|
| Site | http://localhost:8000/ |
| Painel | http://localhost:8000/admin/ |

## Primeiro acesso

Na primeira vez não há contas nenhumas. O painel pede que crie a sua: é a
conta **Super Admin**. Escolha o nome de utilizador e uma palavra-passe com
pelo menos 10 caracteres, com letras e algarismos, que não seja previsível.

A palavra-passe fica guardada em `data/utilizadores.json`, como *hash*
bcrypt — não é possível lê-la de volta, só verificá-la. Esse ficheiro não
vai para o Git e não é servido pela web.

Se precisar de recomeçar do zero, apague `data/utilizadores.json` e volte a
abrir o painel: pede outra vez a criação da primeira conta.

## Depois de enviar ficheiros para o alojamento

As notícias da página inicial são escritas dentro do `index.html` quando se
publica (ver `api/geracao.php`). O `index.html` que vem do repositório traz
esse bloco vazio, de propósito: não tem conteúdo do clube lá dentro.

Por isso, depois de enviar ficheiros para o alojamento:

1. abra o painel → **Dados & Backup** → **Regenerar páginas**;
2. ou, no terminal do alojamento: `php api/gerar.php`.

Sem isto, a página inicial fica sem notícias até à publicação seguinte.

Para voltar à publicação anterior: `php api/gerar.php --reverter`.

## Testes

```
node tools/validar.js --comparar    todas as páginas, em 7 larguras
node tools/testar-sem-js.js         o conteúdo gerado, com o JavaScript desligado
```

O segundo trabalha sempre sobre uma cópia temporária do site, com dados de
teste próprios (`tools/teste/`). Não toca no projeto nem no conteúdo real.
`JSC_DEBUG=1` mantém a cópia, para diagnóstico.

## Parar

`Ctrl+C` na janela onde o servidor está a correr.

## Porquê um encaminhador

O servidor embutido do PHP não lê o `.htaccess`. Sem
`tools/servidor-local.php`, ficariam acessíveis em desenvolvimento coisas
que em produção o Apache bloqueia — `data/db.json`,
`data/utilizadores.json`, os `.sql` — e o ambiente local deixaria de valer
como ensaio do real.

O encaminhador repete só as regras que negam acesso. Cabeçalhos,
compressão, redirecionamentos e https continuam a ser do Apache, em
produção. **Nada disto muda o que está publicado**: em produção quem serve
é o Apache, e estes ficheiros nem sequer são servidos pela web.
