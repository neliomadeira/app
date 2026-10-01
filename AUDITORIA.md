# Auditoria antes do redesign

Leitura completa do projeto confrontada com os 45 pontos do skill
`campinense-premium-web`.

| | |
|---|---|
| Commit auditado | `bbd5f3a` — ramo `claude/continuar-site-r5rx9k` |
| Alterações feitas | nenhuma; auditoria em modo de leitura |
| Versão em página | https://claude.ai/artifact/Rfte1cTZdkCdZF2gPAhAHB |

Todos os números vêm de contagens e testes sobre o código. Onde não foi
possível verificar, está dito no texto.

---

## Duas coisas que mudam a premissa

**Não existe Firebase neste projeto.** Zero ocorrências de `firebase`,
`firestore`, `supabase`, `auth0` ou `amplify` em todo o JavaScript, HTML,
JSON e PHP. Não há projeto, coleções, documentos, regras, *buckets* nem
chaves expostas. O ponto 19 do skill não tem objeto: nada foi preservado,
alterado nem recriado porque não havia o quê.

**Não existe nada do que o ponto 42 manda executar.** Sem `package.json`,
`tsconfig.json`, configuração de *lint*, testes ou CI. Não há *build* que
possa falhar. A proposta de equivalente está na secção
[Ponto 42](#ponto-42--o-que-significa-validar-aqui).

---

## Estado atual

Site estático de 20 páginas com painel de administração no browser. Sem
framework, sem compilação, sem dependências de terceiros carregadas no
navegador. A gestão de conteúdo acontece em `localStorage` e um botão
publica tudo num ficheiro JSON no servidor.

| | |
|---|---|
| Stack | HTML5, CSS3, JavaScript ES6+ sem módulos. Apache com `.htaccess`. PHP em 6 *endpoints*. MariaDB/MySQL opcional e hoje desligada. |
| Build | Nenhum. Abre-se com Live Server no VS Code e envia-se por FTP. |
| Dependências | Zero no browser. Só o *scraper* tem `package.json` (axios, cheerio) e corre fora do site. |
| Tipografia | Bebas Neue para títulos, Roboto para texto. 20 variáveis CSS em `:root`. |
| Dados | 38 chaves de `localStorage` → `POST` para `api/save.php` → `data/db.json` → `js/sync.js` lê em cada página. |
| Autenticação | Só no browser. `admin_creds` em `localStorage`, SHA-256 sem *salt*, comparação no cliente. |
| Git | Árvore limpa, histórico intacto, 3 ramos. |

| Tipo | Ficheiros | Linhas | Maior ficheiro |
|---|--:|--:|---|
| JavaScript | 30 | 13 854 | `admin/js/admin.js` — 328 KB, 243 funções |
| HTML | 21 | 7 154 | `admin/index.html` — 95 KB |
| CSS | 5 | 6 900 | `css/styles.css` — 113 KB |
| PHP | 9 | 644 | `mail.php` |

**Painel (19 secções operacionais):** painel geral, inscrições, atletas,
notícias, mensagens, jogos, agenda, galeria, vídeos, escalões, formação,
seniores, treinadores, patrocinadores, modalidades, história, Facebook,
página inicial, configurações.

**Público:** notícias com filtros e destaque, agenda com exportação para
calendário, resultados, galeria, vídeos, pesquisa, 8 escalões com página
individual, inscrição, contactos, patrocinadores, história, modo escuro,
*service worker* com página offline, consentimento de *cookies*, dados
estruturados.

---

## Mobile first — teste real

O ponto 16 exige sete larguras sem *scroll* horizontal. Testadas todas em
19 páginas com Chromium sobre Apache local com o `.htaccess` real:
**133 combinações, 131 passam.**

| Página | 320 | 375 | 390 | 430 | 768 | 1024 | 1440 |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `patrocinadores.html` | **+24** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `historia.html` | ✓ | ✓ | ✓ | ✓ | ✓ | **+6** | ✓ |
| as outras 17 páginas | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Valores em pixels de transbordo horizontal. O painel passou nas sete.

### M1 — Título do CTA de patrocinadores não cabe a 320px

`patrocinadores.html`, regra `.sp-cta__title` na linha 230 (CSS embutido
na própria página). O título *Quer ser patrocinador?* está a
`font-size: 2.4rem` em Bebas Neue; a palavra "patrocinador?" mede 288px
numa caixa de 208px e não pode partir. A página passa a 344px num ecrã de
320.

### M2 — A animação de entrada da cronologia empurra a página para fora

`css/styles.css:1204` declara
`.timeline-item--right.tl-reveal { transform: translateX(30px) }` como
estado inicial da revelação. A 1024px transborda 6px enquanto o elemento
não é revelado.

Por trás há um problema maior: `.tl-reveal` começa com `opacity: 0`. A
página da história só aparece se o observador de *scroll* disparar. Com
JavaScript desligado, com um erro antes deste ficheiro, ou num leitor que
não role a página, o conteúdo fica invisível. Uma animação de entrada
deve partir de um estado visível.

---

## Conformidade com o skill

`cumpre` já está feito · `falta` é exigência ainda não implementada ·
`desvia` existe mas contraria o skill · `sem objeto` não se aplica a esta
arquitetura.

| Ponto | Exigência | Estado |
|---|---|---|
| 3, 4 | Identidade e logótipo oficiais | **cumpre** — paleta e ficheiros intactos |
| 7 | Design system com tokens centralizados | **desvia** — 20 variáveis, mas o modo escuro são 150 regras à mão |
| 8 | Homepage com jogos, notícias, equipas, patrocinadores | **falta** — faltam próximo jogo, último resultado, jogos de hoje |
| 9 | Páginas próprias por equipa | **falta** — futebol feminino e futsal feminino só existem como texto |
| 10, 22 | `/jogos` e Match Center em `/jogos/[id]` | **falta** — nenhuma das rotas existe |
| 11 | Tabelas de classificação responsivas | **falta** — só dados importados, sem página própria |
| 12 | Notícias com página individual | **cumpre** — com filtros, destaque e `NewsArticle` |
| 13 | `/clube/historia` | **desvia** — existe como `historia.html`, noutra rota |
| 14 | Patrocinadores por níveis, sem deformar logos | **cumpre** |
| 15 | `object-fit: cover`, WebP, lazy loading | **desvia** — 10 usos de object-fit, 21 lazy, nenhum WebP |
| 16 | Sete larguras sem scroll horizontal | **desvia** — 131 de 133; ver M1 e M2 |
| 17 | Performance | **cumpre** — 80 KB JS, 88 KB imagens, zero dependências externas |
| 18 | SEO e WCAG 2.1 AA | **desvia** — SEO quase completo; acessibilidade com quatro lacunas |
| 19 | Firebase e Firestore | **sem objeto** — não existe Firebase |
| 20 | Componentes reutilizáveis | **falta** — não há sistema de componentes |
| 21, 23, 24 | Matchday, jogo em destaque, admin de jogo | **falta** — 3 estados dos 7; nenhuma interface de dia de jogo |
| 25–28 | Automação, `SportsDataProvider`, deduplicação | **desvia** — scraping por proxies públicos; ver I2 |
| 29, 30 | Painel premium em `/admin` | **desvia** — existe e é rico, mas sem Matchday, épocas nem ações rápidas |
| 31, 32 | Permissões no servidor; `/admin` autenticado | **sem objeto** — não há verificação nenhuma no servidor; ver C2 |
| 33 | Auditoria de alterações e *soft-delete* | **falta** — apagar é definitivo e anónimo |
| 34 | Dashboard de fim de semana | **falta** |
| 35 | Dados estruturados para redes sociais | **falta** |
| 36 | PWA e notificações | **desvia** — PWA existe; sem notificações |
| 37 | Backups e exportação | **desvia** — exporta CSV; não há backup; ver I1 |
| 38 | Linguagem simples no painel | **cumpre** |
| 39 | Não inventar dados | **desvia** — 54 registos fictícios prontos a publicar; ver I4 |
| 40 | Verificar documentação antes de integrar | **desvia** — o scraping atual nunca foi autorizado |
| 41 | Git verificado, sem force push | **cumpre** |
| 42 | Build, lint, testes, TypeScript | **sem objeto** — nenhum existe |

### Ponto 20 — componentes nesta arquitetura

O skill sugere `GameCard`, `ResultCard`, `StandingsTable`, que são nomes
de componentes React. Aqui não há React nem sistema de componentes: cada
página constrói o seu HTML com *template strings*, e o cabeçalho e o
rodapé estão copiados em 20 ficheiros.

O equivalente honesto são funções de renderização num ficheiro partilhado
— `js/componentes.js` com `cartaoJogo()`, `cartaoResultado()`,
`tabelaClassificacao()` — mais `include` de PHP para cabeçalho e rodapé,
já que o servidor corre PHP. Mesmo resultado, sem framework nem
compilação.

### Ponto 42 — o que significa validar aqui

Não há *build* que possa falhar, nem *lint*, nem testes, nem TypeScript.
Declarar uma fase validada sem verificar nada seria pior do que não ter
regra.

Equivalente proposto, já usado para produzir esta auditoria: um Apache
local com o `.htaccess` real e um guião de Chromium que carrega as 20
páginas nas sete larguras e falha perante erro de JavaScript na consola,
transbordo horizontal, ou rota que deixe de responder. Foi o que apanhou
o M1 e o M2. Fica no repositório e corre-se com um comando ao fim de cada
fase.

---

## O que já está bom

Mantém-se, e não se toca sem razão concreta. O ponto 2 é explícito: uma
melhoria visual não justifica destruir o que funciona.

- **Ausência de framework e de compilação.** Um administrador,
  alojamento cPanel partilhado, 20 páginas, fluxo que já funciona com o
  VS Code. Introduzir Next.js acrescentava um passo de compilação que o
  servidor não corre e que ninguém no clube mantém.
- **Endpoints PHP bem escritos.** Consultas preparadas em todos os
  pontos, limite de 64 KB no corpo do pedido, *honeypot* anti-robôs,
  degradação limpa sem base de dados, lista de domínios no `proxy.php`.
  Nenhuma injeção SQL nos seis.
- **Segredos fora do repositório.** `api/config.php` carrega
  `api/config.local.php`, que está no `.gitignore`, com exemplo
  versionado.
- **Cabeçalhos de segurança, gzip e regra de indexação.** CSP,
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, *cache* de estáticos, `data/db.json` bloqueado. O
  *noindex* decide pelo `Host`, o que impede esquecê-lo no ambiente de
  teste e arrastá-lo para produção.
- **Peso e SEO.** 80 KB de JavaScript, 113 KB de CSS (21 KB comprimido),
  88 KB de imagens, zero dependências externas. Título, descrição, Open
  Graph, Twitter Card e *canonical* em todas as páginas públicas, com
  `SportsOrganization`, `WebSite` e `NewsArticle`. Zero `<img>` sem
  `alt`.

---

## Problemas críticos

### C1 — Visitante anónimo consegue executar código no painel

`admin/js/admin.js:430` escreve as mensagens de contacto por `innerHTML`
sem tratamento: `${m.nome}` e `${m.assunto}` diretamente no HTML.

```
formulário público  →  api/submit.php  →  MySQL
                    →  api/registos.php
                    →  admin.js:4981   DB.mensagens.unshift(item)
                    →  admin.js:430    tbody.innerHTML = `…${m.nome}…`
```

Quem submeter uma mensagem com `<img src=x onerror="…">` no nome fica com
código a correr na origem do painel quando o administrador o abrir. Desse
ponto lê `jsc_api_token` e `admin_creds` do `localStorage`, e com o token
faz `POST` a `api/save.php`, que reescreve o site inteiro.

Não existe uma única função de escape HTML no projeto. A `esc()` em
`admin.js:530` parece ser isso mas é escape de CSV. Nenhuma das 80
escritas `innerHTML` do painel escapa nada, nem nenhuma das 74 das
páginas públicas.

**Latente hoje porque a base de dados está desligada. Ativa-se no passo 8
do guia de instalação.**

### C2 — O painel não tem autenticação a sério

Toda a verificação acontece no browser: `admin_creds` em `localStorage`,
SHA-256 sem *salt*, comparação em JavaScript que o visitante controla.
Password por omissão `admin` / `1234`, escrita em `admin/js/admin.js:25`.

Contraria os pontos 31 e 32. O painel dá acesso a dados pessoais de
menores: nomes, datas de nascimento, contactos de encarregados de
educação. Solução já construída no ramo `claude/painel-mysql`.

### C3 — Token antigo comprometido no histórico do git

`campinense2025` esteve versionado e continua acessível em *commits*
anteriores. Já substituído no ficheiro atual, o que resolve o presente
mas não o passado. O ponto 41 proíbe reescrever histórico, e com razão: a
resposta correta é considerar o token público para sempre e nunca o
reutilizar.

### C4 — SSRF por redirecionamento em `proxy.php`

A lista de domínios permitidos — `zerozero.pt`, `fpf.pt`,
`ligaportugal.pt`, `afalgarve.pt` — é verificada só no URL inicial. A
seguir vêm `follow_location => 1` e `max_redirects => 5` sem validar os
destinos. Um domínio permitido que redirecione para `http://127.0.0.1/`
ou para a rede interna do alojamento é seguido, e o conteúdo devolvido a
quem pediu. O *endpoint* é público e não pede token.

`proxy.php`, linhas 21-31 e 41-46.

### C5 — Uma inscrição pode sobrescrever a de outra pessoa

`api/submit.php` aceita o `id` enviado pelo cliente e grava com
`ON DUPLICATE KEY UPDATE dados = VALUES(dados)`. Os identificadores são
*timestamps* em milissegundos, previsíveis dentro de uma janela
conhecida. Quem acertar num identificador existente substitui os dados
dessa inscrição, sem autenticação. São dados de menores.

`api/submit.php`, linhas 48 e 53-57.

---

## Problemas importantes

| | Problema | Onde |
|---|---|---|
| **I1** | Os dados do clube só existem no `localStorage` do computador de quem administra. Sem cópia de segurança, sem histórico, sem forma de duas pessoas trabalharem. O `data/db.json` é um instantâneo, não um arquivo. Ponto 37 por cumprir. | — |
| **I2** | Importação de plantéis e jogos por *scraping* do ZeroZero e FPF através de três *proxies* públicos em cadeia. Frágil, e passa dados por terceiros sem acordo. Contraria os pontos 25 e 40. | `admin.js:1050-1052` |
| **I3** | `js/security.js` bloqueia clique direito, F12, Ctrl+U, Ctrl+S, arrastar imagens **e a impressão**. Não protege nada, e impede um encarregado de educação de imprimir o formulário de inscrição ou guardar a fotografia do filho. | `js/security.js` |
| **I4** | 54 registos fictícios prontos a publicar: 11 atletas, 11 jogos, 9 patrocinadores, 8 treinadores, 7 inscrições, 4 notícias, 4 mensagens. Ponto 39 violado por omissão. | `admin/js/data.js` |
| **I5** | O modelo de jogos não suporta Matchday: 3 estados, sem competição, jornada, época, modalidade, `externalId` nem origem do dado. Sem conceito de acontecimento dentro do jogo. | `admin/js/data.js:55` |
| **I6** | `<main>` ausente em 15 das 20 páginas. `prefers-reduced-motion`: zero ocorrências com 6 animações declaradas. `:focus-visible`: uma. Três campos sem *label*. Saltos na ordem dos títulos. | vários |
| **I7** | Cabeçalho e rodapé copiados em 20 ficheiros: ~2 080 das 5 492 linhas de HTML (38%). Já falhou uma vez — o `sitemap.xml` cobre 14 das 20 páginas. | vários |
| **I8** | `app.zip` (226 KB) e `images/logo.png.bak` versionados, apesar do `.gitignore`, porque este não deixa de seguir ficheiros já seguidos. | raiz |
| **I9** | `admin/js/admin.js` concentra o painel inteiro em 328 KB e 243 funções. Principal travão a qualquer evolução. | `admin/js/admin.js` |

---

## Segurança Firebase / Firestore

**Não se aplica: não há Firebase neste projeto.** Procurado em todo o
JavaScript, HTML, JSON e PHP: zero ocorrências. Não há projeto, coleções,
documentos, regras, *buckets* nem chaves expostas. As regras inseguras
`allow read, write: if true` que o ponto 19 proíbe não existem porque não
existem regras. Nada foi alterado, apagado nem recriado.

Recomendação, se estiver a ponderar adotar Firebase: **não**. Para um
clube, um alojamento cPanel já pago com MySQL incluído e um ou dois
administradores, o Firebase acrescenta uma conta externa, um custo
variável, um SDK no browser e um modelo de regras para aprender — e nada
do que resolve é problema que este site tenha. O equivalente já está
construído em PHP e MySQL no ramo `claude/painel-mysql`.

O que se aplica é o princípio por trás dos pontos 31 e 32: as permissões
verificam-se no servidor, não na interface. Hoje não se verificam em lado
nenhum — é isso que o C2 descreve.

---

## Arquitetura premium proposta

Evolução, não recomeço. Mantém-se o site estático sem compilação. Cada
mudança é proposta antes de ser feita, no formato do ponto 44.

**Mantém-se:** HTML, CSS e JavaScript simples sem framework nem
compilação; Apache com `.htaccess`; *endpoints* PHP; *service worker* e
PWA; paleta amarelo, azul e branco; Bebas Neue com Roboto; os ficheiros
oficiais do logótipo sem qualquer alteração.

| Camada | Hoje | Proposta | Razão |
|---|---|---|---|
| Fonte de verdade | `localStorage` | MySQL, com `localStorage` só como cache | I1 · ponto 37 |
| Autenticação | JavaScript no cliente | Sessões PHP com `password_hash` | C2 · pontos 31, 32 |
| Permissões | Não existem | 6 perfis verificados no servidor a cada pedido | ponto 31 |
| Cabeçalho e rodapé | Copiados 20 vezes | `include` de PHP | I7 · ponto 20 |
| Peças repetidas | Template strings por página | `js/componentes.js` partilhado | ponto 20 |
| Escrita no HTML | `innerHTML` sem escape | `textContent`, ou escape obrigatório | C1 |
| Origem dos dados de jogos | Scraping direto no painel | Camada `SportsDataProvider` | pontos 26, 27, 28 |
| Apagar | Definitivo e anónimo | *Soft-delete* com registo de quem e quando | ponto 33 |
| Validação | Nenhuma | Apache local + Chromium nas 7 larguras | ponto 42 |

### Estados de Matchday

Os identificadores do ponto 21 passam a ser os valores guardados. Os três
estados portugueses atuais continuam aceites na leitura, para não quebrar
os jogos existentes: `Agendado` → `scheduled`, `Realizado` → `finished`,
`Cancelado` → `cancelled`.

```
scheduled   pre_match*   live*   halftime*   finished   postponed*   cancelled
```

`*` = não existe hoje. Apresentação ao visitante: PRÓXIMO JOGO, É DIA DE
JOGO, ● EM DIRETO, INTERVALO, RESULTADO FINAL.

### Modelo de dados a acrescentar

Sem apagar nada, com retrocompatibilidade: as chaves atuais continuam a
ser lidas, as novas tabelas passam a ser a fonte de verdade, e a migração
copia o conteúdo real do `localStorage` antes de qualquer alteração.
Nenhuma destas tabelas é criada sem apresentar primeiro o formato do
ponto 44.

- `epocas` — a dimensão que hoje falta por completo
- `competicoes` — nome, tipo, entidade organizadora, época
- `equipas` — separando modalidade de escalão, para o futebol feminino e
  o futsal feminino existirem como entidades e não como texto
- `jogos` — alargado com competição, jornada, época, equipa, modalidade,
  os 7 estados, `externalId` e origem do dado
- `jogo_eventos` — golo, substituição, disciplina, início e fim de parte
- `classificacoes` — por competição e jornada, com a origem de cada linha
- `utilizadores` e `permissoes` — os 6 perfis do ponto 31
- `auditoria` — utilizador, ação, entidade e data (ponto 33)
- `media` — ficheiros no disco, não em base64

### Rotas em falta

O skill pede `/jogos`, `/jogos/[id]` e `/clube/historia`. Nenhuma existe;
a história está em `historia.html`. Num site sem *router*, faz-se com
regras no `.htaccess` que já lá está, mapeando os endereços limpos para
os ficheiros e preservando os antigos com 301 — o mesmo mecanismo usado
para os endereços do WordPress.

### Automação

Pela ordem do ponto 25, com a nota que o ponto 40 torna obrigatória:
**não foi confirmado que a AF Algarve, a FPF ou o ZeroZero tenham API
pública documentada**, e não se vai assumir. O primeiro passo é perguntar
à AF Algarve se disponibiliza dados dos campeonatos distritais e em que
termos. Até haver resposta, a arquitetura assume administração manual com
importação estruturada, atrás da camada `SportsDataProvider`, para que
uma API futura entre sem refazer nada. Como manda o ponto 27: uma falha
externa nunca apaga dados existentes.

---

## Plano de implementação

Pela ordem do ponto 43 — **estabilidade → segurança → UX → design →
automação → extras** — e não pela ordem alfabética das fases. Nenhuma
está implementada.

**0 · Estabilidade — poder verificar que nada partiu.** O guião de
validação do ponto 42 entra no repositório primeiro: Apache local com o
`.htaccess` real, Chromium nas 20 páginas e nas 7 larguras, falha em erro
de consola, transbordo ou rota morta. Pequeno, já provado, não altera uma
linha do site. *Sem dependências.*

**A · Segurança e fundações.** Escape de HTML nas 154 escritas
`innerHTML` (C1). Sessões PHP com `password_hash` e os 6 perfis
verificados no servidor (C2). Validação de redirecionamentos no
`proxy.php` (C4). Identificadores gerados no servidor (C5). Retirar o
bloqueio de impressão e de atalhos (I3). Separar dados de demonstração
(I4). `git rm --cached` em `app.zip` e `logo.png.bak` (I8).
*Depende de 0.*

**B · UX e correções mobile.** M1 e M2. A animação da cronologia a partir
de um estado visível. `<main>`, ordem de títulos, `:focus-visible`,
`prefers-reduced-motion` e as três *labels* em falta (I6).
*Depende de 0 e A.*

**C · Design system.** Paleta, espaçamento, raios, sombras e breakpoints
em tokens (ponto 7); modo escuro por redefinição em vez de 150 regras à
mão. Escala tipográfica. Cabeçalho e rodapé em `include` de PHP e peças
repetidas em `js/componentes.js` (I7, ponto 20). *Depende de B.*

**D · Jogos e resultados.** Épocas, competições, jornadas, equipas e o
modelo de jogo alargado (I5). Centro de jogos em `/jogos` com os filtros
do ponto 10, classificações do ponto 11, arquivo por época.
*Depende de A. Alteração de modelo: formato do ponto 44 antes de
executar.*

**E · Matchday.** Os 7 estados, a tabela de acontecimentos, o Match
Center em `/jogos/[id]` (ponto 22), jogos de hoje com jogo em destaque
escolhido pelo administrador (ponto 23), e a interface de telemóvel do
ponto 24 com correção manual. *Depende de D.*

**F · Equipas e homepage premium.** Páginas por equipa (ponto 9), com
futebol feminino e futsal feminino como entidades. Homepage do ponto 8
com *hero*, próximo jogo, último resultado e jogos de hoje a lerem dados
reais — vazios enquanto não existirem, nunca preenchidos com números
inventados. *Depende de C, D, E.*

**G · Notícias e história.** Notícias com fotografia, categoria, destaque
e publicar/não publicar, na base de dados, com imagens em ficheiro em vez
de base64. `/clube/historia` (ponto 13). *Depende de A; parte já
construída em `claude/painel-mysql`.*

**H · Admin premium.** Divisão do `admin.js` por secção (I9). Dashboard
do ponto 29 com próximo jogo, jogos de hoje e do fim de semana (ponto
34), ações rápidas, épocas, classificações, media e utilizadores.
Auditoria e *soft-delete* (ponto 33). Critério de aceitação (ponto 45):
um dirigente cria jogo, publica, atualiza resultado, gere equipa e
publica notícia, sem tocar em código. *Depende de C, D, E.*

**I · Automação.** Começa por perguntar à AF Algarve o que disponibiliza
e em que termos (ponto 40). Camada `SportsDataProvider`, deduplicação por
`externalId`, distinção `external` / `manual` / `manual_override`
(pontos 26 e 28). Importação de CSV e JSON primeiro; API só depois de
confirmada. *Depende de D; bloqueada por uma resposta externa.*

**J · Extras e verificação final.** WebP com dimensões declaradas,
sitemap gerado, `SportsEvent` e `BreadcrumbList`, dados estruturados para
redes sociais (ponto 35), notificações opt-in (ponto 36), backups e
exportação (ponto 37), verificação final de WCAG 2.1 AA.
*Depende de todas as anteriores.*

---

## Ficheiros que precisam de alterações

Só as fases 0 e A.

| Ficheiro | Alteração | Motivo |
|---|---|---|
| `tools/validar.js` | Novo. Apache local, 20 páginas × 7 larguras, falha em erro de consola ou transbordo | Fase 0 · ponto 42 |
| `admin/js/admin.js` | Função de escape HTML nas 80 escritas `innerHTML`, a começar nas linhas 430 e 4981 | C1 |
| `js/*.js` | Mesmo tratamento nas 74 escritas das páginas públicas | C1 |
| `api/auth.php` | Novo. Sessões, `password_hash`, 6 perfis | C2 · pontos 31, 32 |
| `api/save.php`, `api/registos.php` | Verificar sessão e perfil, além do token | C2 |
| `admin/index.html`, `admin/js/admin.js` | Login contra o servidor; remover a password da linha 25 | C2 |
| `proxy.php` | Validar o destino de cada redirecionamento, ou desligar `follow_location` | C4 |
| `api/submit.php` | Identificador gerado no servidor; retirar o `ON DUPLICATE KEY UPDATE` | C5 |
| `api/schema.sql` | Tabela de utilizadores e perfis | C2 |
| `js/security.js` | Retirar o bloqueio de impressão, de atalhos e de clique direito | I3 |
| `admin/js/data.js` | Dados de demonstração separados, carregados só com a base vazia | I4 · ponto 39 |
| `app.zip`, `images/logo.png.bak` | `git rm --cached` | I8 |

---

## Riscos

- **O C1 ativa-se na instalação.** O guia de instalação tem a base de
  dados no passo 8, e é esse passo que abre o caminho do visitante ao
  painel. Instalar antes da fase A → deixar a base de dados desligada; o
  site funciona sem ela.
- **Migrar o `localStorage` para MySQL é a operação mais delicada.** Os
  dados reais estão hoje apenas no browser de quem administra. A migração
  começa por exportar esse conteúdo para ficheiro, com confirmação de que
  está completo, antes de tocar em nada. Plano de reversão: o
  `localStorage` continua a ser lido até a migração ser confirmada.
- **Distinguir dados reais de dados de demonstração precisa do clube.**
  Não é possível saber quais dos 54 registos são verdadeiros.
- **A fase I depende de terceiros.** Se a AF Algarve não disponibilizar
  dados, a automatização fica em importação manual estruturada. Não se
  constrói sobre scraping e se lhe chama automática.
- **O site vai substituir o WordPress em `campinense.pt`.** Os
  redirecionamentos dos endereços antigos já estão no `.htaccess` e
  testados, mas são uma rede genérica. O mapa artigo a artigo precisa do
  sitemap do WordPress antes de esse site ser desligado.
- **Reversibilidade.** Árvore limpa, histórico intacto, sem `force push`.
  Cada fase em *commits* próprios. O trabalho de MySQL já feito está
  preservado em `claude/painel-mysql`.

---

## Primeira fase recomendada

**Fase 0 e fase A, por esta ordem, e antes de o site ir para o ar.**

O ponto 43 manda começar pela estabilidade, e é o que muda em relação ao
que se proporia sem o skill: antes de corrigir a segurança, convém poder
verificar que a correção não partiu nada. O guião de validação é pequeno,
já está provado — foi ele que apanhou o M1 e o M2 — e não altera uma
linha do site.

A seguir, a fase A. Não muda nada do aspeto, e é por isso a menos
gratificante; é a segunda porque construir dez fases por cima de um
painel que um visitante anónimo controla é construir em cima de areia.

Passo ainda mais pequeno, se preferido: o C1 isolado — uma função de
escape e a sua aplicação, com o painel testado no browser a seguir.
Verificável e reversível, e fecha o caminho que vai do formulário público
até ao token de publicação.

---

## Estado depois da Fase A

A Fase A está concluída. O que segue são as limitações que ficaram
conhecidas e documentadas, para não serem confundidas com trabalho feito.

### A separação entre Futebol e Futsal NÃO é segurança por modalidade

Os perfis Futebol e Futsal existem e têm as suas capacidades verificadas no
servidor. Mas **hoje os dois veem e alteram exatamente os mesmos registos**.

A razão é o I5 desta auditoria: atletas, treinadores, escalões e jogos não
têm campo de modalidade. Sem esse campo não há por onde separar, e recusar
por omissão deixaria ambos os perfis sem nada que pudessem fazer.

A verificação já está escrita em `api/save.php` e passa a atuar sozinha
assim que os registos tiverem o campo: um registo com `modalidade` diferente
da do perfil é recusado. Enquanto não tiverem, é aceite pelos dois.

**Não apresentar isto como separação por modalidade.** Um utilizador do
perfil Futsal pode, hoje, alterar os jogos do futebol. A separação completa
faz parte da Fase D, com o novo modelo de equipas, atletas, treinadores,
escalões, jogos, competições e épocas.

### O perfil Matchday entra e não tem áreas

É intencional. A área de dia de jogo é da Fase E. O painel mostra a
indicação de que ainda não está disponível, em vez de um painel vazio sem
explicação.

### As notícias já escritas não foram filtradas

O filtro de HTML das notícias aplica-se a notícias novas e editadas. As que
já estavam guardadas mantêm-se exatamente como estavam, incluindo o que
nelas possa haver de perigoso.

Para ver o que mudaria, sem alterar nada:

```
php tools/impacto-noticias.php data/db.json
```

Tratar as antigas exige uma decisão à parte, com o impacto à vista.


---

# FASE B — UX, MOBILE E ACESSIBILIDADE

Autorizada a 27 de setembro de 2026. Nove alterações, todas em CSS, HTML e
JavaScript de apresentação. Nada da Fase A foi tocado: `api/`, `proxy.php` e
`admin/js/` não têm uma linha alterada.

## O que estava mal, e como se soube

A medição foi feita com o browser a sério, nas páginas construídas — não a
ler o código. Cada número abaixo veio de um guião que se pode voltar a
correr.

### Os dois problemas conhecidos

**M1 — patrocinadores, 320px.** O título "Quer ser patrocinador?" era
desenhado a 38px dentro de uma caixa com 32px de goteira fixa. A palavra
mais longa não cabia e empurrava a página: scroll horizontal em todos os
ecrãs pequenos. O tamanho e a goteira passaram a acompanhar a largura. Nos
ecrãs grandes o título ficou exatamente como estava, a 38,4px.

**M2 — história, 901 a ~1260px.** Os itens da direita entravam a deslizar
30px na horizontal. A goteira do container é de 24px e a diferença saía
para fora. O deslocamento passou a ser vertical em todas as larguras.

### O conteúdo que podia desaparecer

A cronologia da história escondia os itens pelo CSS e contava com o
JavaScript para os mostrar. Se o JavaScript falhasse a meio, ou se a página
fosse impressa antes de ser percorrida, ficava em branco — 22 itens
invisíveis no papel.

O mesmo defeito estava no `main.js`, em maior escala: `opacity: 0` posto em
linha em cada cartão de escalão, notícia, galeria e bloco de contacto.

Nos dois casos o estado invisível passou para o CSS, debaixo de uma marca
que o JavaScript só põe quando há de facto quem volte a mostrar. Medido em
formacao.html, com 8 elementos:

| condição | visíveis ao abrir | depois de percorrer |
|---|---|---|
| movimento normal | 3/8 | 8/8 |
| movimento reduzido | 8/8 | 8/8 |
| sem JavaScript | 8/8 | 8/8 |
| impressão | 8/8 | — |

### Foco e teclado

Nove sítios tinham `outline: none` sem nada no lugar. O indicador passou a
ser um anel de dois tons — amarelo por dentro, azul por fora — porque o
site tem fundos brancos, azuis e de fotografia e nenhuma cor sozinha se vê
em todos: o amarelo sobre branco dá 1,46:1.

Três casos precisaram de tratamento próprio: os campos de data (o Tab
percorre os sub-campos e o campo deixa de corresponder a `:focus-visible`),
a barra lateral do painel (o anel exterior saía da barra cortado) e o
`transition: all` de vários elementos, que fazia o anel entrar a
desvanecer.

O atalho "saltar para o conteúdo" não cumpria o que dizia: o `smooth
scroll` do `main.js` apanhava todas as ligações internas e chamava
`preventDefault()`, o que cancelava também o salto de foco. A página
deslizava e o foco ficava no cabeçalho.

Cartões que eram `<div onclick>` — publicações das modalidades, dos
seniores, itens do arquivo de notícias — não recebiam foco nem tinham tecla
que os acionasse.

### Estrutura

Catorze páginas não tinham `<main>`. Em três, o alvo do atalho era um
`<span aria-hidden="true">` escondido a meio do conteúdo.

Dezasseis páginas saltavam níveis de título. O caso repetido: as colunas do
rodapé eram `<h4>` por causa do tamanho, logo a seguir a um `<h1>`.

### Contraste

Medido o contraste real entre cada texto visível e o fundo por trás dele,
nas 20 páginas e nos dois temas.

| | antes | depois |
|---|---|---|
| tema claro | 38 | 5 |
| tema escuro | 31 | 0 |

Das 5 que ficam no tema claro, 4 são emojis — desenham-se com as suas
próprias cores e a cor do CSS não lhes toca. A quinta está por decidir,
abaixo.

O pior caso era o botão do modo escuro: `color: inherit` apanhava o preto
do corpo e ficava preto sobre o azul do cabeçalho, a 1,25:1, em 15 páginas.

No tema escuro o problema era de raiz: o cinzento do texto secundário está
definido para fundo branco e ficava a 2,6:1. Como é uma variável, bastou
redefini-la dentro do tema.

## Por decidir: o ano em destaque da cronologia

`.timeline-item--destaque .timeline-year` é escrito a `--yellow-dark`
(#E6B800) sobre branco, a 42px. Dá **1,87:1**; o mínimo para texto grande é
3:1.

| opção | rácio | o que muda |
|---|---|---|
| como está | 1,87 | — |
| #A88500 | 3,49 | o dourado escurece e aproxima-se do castanho |
| #8a6d00 | 4,92 | deixa de ser dourado |
| azul do clube | 10,42 | perde-se a distinção do marco em destaque |
| caixa amarela com o ano a azul | 7,13 | muda a forma, não só a cor |

Nenhuma destas é uma decisão técnica. Ficou como está, à espera de decisão.

## Verificação

- `node tools/validar.js --comparar`: **168 combinações, 0 problemas**, os
  dois conhecidos resolvidos, 0 novos;
- transbordo horizontal a 320, 375, 390, 430 e 768px, nas 20 páginas, com o
  menu fechado, aberto e com o submenu aberto: **nenhum**;
- Tab pelas 20 páginas públicas: **todos os elementos focáveis têm
  indicador visível**; no painel, 30 controlos, todos com indicador;
- 40 fotografias de página inteira comparadas pixel a pixel antes e depois
  de cada alteração estrutural;
- formulários: submeter vazio marca os 7 campos obrigatórios e mostra 7
  mensagens; escrever por teclado funciona; sem erros de JavaScript;
- Fase A intacta: publicar sem sessão devolve 401, pedir utilizadores sem
  sessão devolve 401, palavra-passe errada é recusada, os seis perfis
  continuam a ser listados.

## Como voltar a correr estas medições

Os guiões de medição desta fase não ficaram no repositório — são de
diagnóstico, não do site. O que fica é o `tools/validar.js`, que cobre
overflow, erros de consola, recursos em falta e as regras do `.htaccess`:

```
node tools/validar.js --comparar
```

---

# PRINCÍPIO — O QUE MUDA DURANTE A ÉPOCA GERE-SE NO PAINEL

Registado a 28 de setembro de 2026, por decisão do clube, para valer nas
fases seguintes.

**Informação operacional que muda durante a época deve, sempre que
adequado, ser gerível pelo painel e não exigir alteração manual do
código.**

Aplica-se, conforme o modelo de dados de cada fase, a: competição, época,
horários, locais, treinadores, plantéis, jogos, resultados, classificações
e outras informações desportivas variáveis.

Na prática, três regras que vieram da limpeza de setembro de 2026:

1. **Nada de valores de recurso no código.** Um horário, um local ou um
   resultado escritos num ficheiro `.js` aparecem no site sem ninguém os
   ter introduzido, e continuam lá depois de deixarem de ser verdade.
2. **Campo vazio é campo que não aparece.** Se a informação não foi
   introduzida, a página não mostra nem um travessão nem um zero: mostra
   nada, ou diz que ainda não há.
3. **O que se escreve no painel aparece; o que se apaga desaparece.** O
   caminho é sempre o mesmo — painel → `data/db.json` → `api/load.php` →
   página — e tem de funcionar nos dois sentidos.

Isto **não** é autorização para construir estas funcionalidades todas: é o
critério com que cada uma será construída quando a sua fase chegar.

## Onde isto já está feito

| informação | gerível no painel | campo vazio esconde |
|---|---|---|
| competição dos seniores | sim | sim |
| época | sim | sim |
| horário de treinos (sénior) | sim | sim |
| local dos jogos (sénior) | sim | sim |
| horário e local das modalidades | sim | sim |
| horário, treinador e nº de atletas dos escalões | sim | sim |
| notícias, agenda, galeria, vídeos, patrocinadores | sim | sim |

## Onde ainda não está

| informação | estado |
|---|---|
| jogos e resultados | importados por ficheiro ou escritos à mão no painel; sem ligação automática |
| classificações | importadas do scraper da FPF, com o identificador da época a ser editado no código |
| plantéis | geríveis no painel, mas sem separação por modalidade |
| dia de jogo (Matchday) | por construir — Fase E |

---

# FASE C — BLOCO-PILOTO: NOTÍCIAS DA PÁGINA INICIAL SEM JAVASCRIPT

Até aqui todo o conteúdo do site era desenhado pelo browser: as páginas
chegavam vazias e o JavaScript enchia-as a partir do `localStorage`. Quem
tivesse o JavaScript desligado, ou uma ligação que o cortasse a meio, via
uma página sem notícias, sem agenda e sem resultados. Os motores de busca
também.

Este bloco é o primeiro passo para mudar isso, e é só um: **as notícias da
página inicial**. O resto continua exatamente como estava.

## Como funciona

O `index.html` tem duas marcas:

```html
<!-- JSC:noticias:inicio -->
   ... aqui dentro é gerado ...
<!-- JSC:noticias:fim -->
```

Ao publicar, o `api/save.php` chama o `api/geracao.php`, que escreve o bloco
entre as marcas a partir do conteúdo publicado. O HTML que está fora das
marcas **não é analisado, é copiado byte a byte** — nunca é reformatado nem
reordenado.

Quem prepara os dados é o `api/conteudo.php`; quem escreve o markup é o
`modelos/noticias-inicio.php`. Essa separação existe para que, quando o
conteúdo passar para a base de dados, mude só o `api/conteudo.php` e os
modelos fiquem como estão.

O bloco gerado leva a marca `data-gerado` com a data da publicação. O
`js/main.js` compara-a com a sua e, se o que está na página já é o atual,
não mexe. Assim não há duplicação nem piscar, e quem chega sem JavaScript vê
as notícias mesmo assim.

## Publicar é uma transação

O requisito é não haver meias publicações: nunca o site com uma página nova
e outra antiga, nem os dados novos com o HTML antigo. O `api/geracao.php`
trata a publicação como uma transação, com estes passos:

1. **reparar** — se ficou um diário de uma publicação interrompida, restaura
   a última versão válida antes de qualquer coisa;
2. **gerar** para `data/publicacao/novo/`, nunca para o destino;
3. **validar** tudo, antes de promover o que quer que seja: hash do HTML
   fora das marcas, número de cartões, etiquetas equilibradas, o bloco
   passado por um parser, tamanho mínimo do ficheiro, releitura byte a byte;
4. **backup** da versão atual para `data/publicacao/anterior/` e escrita do
   diário `data/publicacao/transacao.json`;
5. **promover** com `rename()`, que é atómico por ficheiro — nunca se serve
   um ficheiro a meio;
6. **confirmar** o sha256 no destino e só então apagar o diário.

Qualquer erro até ao passo 4 aborta **sem tocar na versão pública**. Uma
falha durante a promoção faz voltar atrás, de imediato, os ficheiros já
promovidos. E se o processo morrer entre a primeira promoção e a
confirmação, o diário sobrevive: a publicação seguinte encontra-o e restaura
a última versão válida antes de tentar outra vez.

O que fica atómico por ficheiro é o `rename()`; um conjunto de ficheiros não
fica. A janela é entre a primeira e a última mudança de nome, sem geração
nem validação pelo meio — os bytes já estão todos em disco e validados — e é
essa janela que o diário cobre. Não há, neste alojamento, forma de a
eliminar sem mexer na sua configuração: a troca de *symlink* de uma pasta de
versão depende do `FollowSymLinks` do Apache, e gerar para outra pasta
depende de regras de reescrita novas.

Para voltar atrás de propósito: `php api/gerar.php --reverter`.

## Depois de enviar ficheiros para o alojamento

O `index.html` do repositório traz o bloco vazio. Depois de um envio de
ficheiros, carregue uma vez em **Regenerar páginas** no painel (Dados &
Backup), ou corra `php api/gerar.php` no terminal do alojamento. Sem isso as
notícias só reaparecem na publicação seguinte.

Regenerar automaticamente a partir do `api/load.php` foi considerado e
recusado: seria uma escrita em ficheiros do site disparada por um pedido
público.

## Como se verificou

`node tools/testar-sem-js.js` — 43 verificações, sobre uma cópia temporária
do site e com dados de teste que nunca entram no projeto
(`tools/teste/noticias-EXEMPLO-TESTE.json`, TESTE A/B/C):

- geração, com e sem notícias publicadas;
- página inicial **sem JavaScript**: 3 cartões, pela ordem certa, com links
  navegáveis, a 1440 e a 320 px;
- página inicial **com JavaScript**: os mesmos 3 cartões, sem duplicação e
  sem erros de consola;
- HTML fora das marcas igual **byte a byte**, por hash calculado fora do
  código que gera;
- `403` em `modelos/`, em `data/publicacao/` e no `data/db.json`;
- e a transação: modelo que rebenta, HTML desequilibrado, marca em falta e
  diário pendente — em todos, o `index.html` e o `data/db.json` ficam
  intactos byte a byte, ou são restaurados.

`node tools/validar.js --comparar` — sem problemas em 168 combinações,
**novos: 0**.

Fase A verificada à mão no `api/gerar.php`: `405` fora do POST, `401` sem
sessão, `403` para um perfil sem a área `noticias`, `200` para Comunicação.
Nada da autenticação foi alterado.

## O que este bloco NÃO faz

A `noticias.html`, o carrossel da página inicial, o arquivo de notícias, a
agenda, os resultados, a história, os patrocinadores, a galeria e os vídeos
continuam a depender de JavaScript. Entram nos blocos seguintes, um a um,
pelo mesmo mecanismo.

---

# FASE C — ARQUITETURA APROVADA E ORDEM DOS BLOCOS

O piloto das notícias da página inicial provou o mecanismo. O que segue é o
princípio com que os blocos seguintes são construídos, para não haver duas
maneiras de fazer a mesma coisa.

## O princípio, em seis regras

1. **Marcas no HTML.** Cada bloco gerado vive entre um par de comentários
   `<!-- JSC:<nome>:inicio -->` e `<!-- JSC:<nome>:fim -->`. O que está fora
   não é analisado: é copiado byte a byte, e a geração compara o hash do
   antes e do depois para o garantir.
2. **Um modelo por bloco**, em `modelos/`, só com apresentação.
3. **A leitura é sempre pelo `api/conteudo.php`.** Nenhum modelo lê o
   `data/db.json` diretamente. É esta a costura que permite trocar a origem
   por MariaDB na Fase D sem tocar nos modelos.
4. **Publicar é uma transação com diário** — `api/geracao.php`. Gera para
   `data/publicacao/novo/`, valida tudo, guarda backup, promove com
   `rename()`, confirma no destino e só então fecha o diário. Qualquer erro
   antes da promoção aborta sem tocar na versão pública; uma falha durante a
   promoção volta atrás; um processo morto a meio é reparado pela publicação
   seguinte. O conjunto move-se junto: `data/db.json` e as páginas, ou
   nenhum.
5. **Contra a dupla renderização**, dois atributos no contentor gerado:
   `data-gerado` (a data da publicação) e, onde a lista possa mudar sozinha,
   `data-itens` (quantos itens foram escritos). O JavaScript só desenha no
   arranque se o que tem for mais recente, ou se a contagem não bater. Tudo
   o que venha depois — filtrar, "ver mais", voltar de um artigo, o painel a
   gravar noutro separador — desenha sempre.
6. **Progressive enhancement, com o CSS a decidir o que se vê.** O conteúdo
   está todo no HTML. Duas convenções, reutilizáveis:
   `.jsc-so-com-js` sai da página quando não há JavaScript (um botão que não
   faz nada é pior do que botão nenhum), e listas longas geram-se completas
   com uma classe `--extra` que o CSS esconde e o `<noscript>` da página
   mostra.

## Ordem dos blocos

| # | Bloco | Estado |
|---|---|---|
| — | Notícias da página inicial (piloto) | **feito** |
| 1 | Notícias: página completa e arquivo | **feito** |
| 2 | Agenda e próximos jogos | **feito** (com o E1) |
| 3 | Equipa principal | **feito** |
| 4 | Formação e escalões (grelha) | por fazer |
| 5 | Patrocinadores | por fazer |
| 6 | Modalidades (grelha) | por fazer |
| 7 | Galeria e vídeos | por fazer |
| 8 | História (com consolidação da fonte) | por fazer |
| 9 | Institucional e SEO | por fazer |
| 10 | Extensão E2 do motor (ficheiros por entidade) | por fazer |
| 11 | Artigos de notícia e modalidades por endereço | por fazer — depende do 10 |
| 12 | Escalões (sem fichas de atleta) | por fazer — depende do 10 |
| 13 | Resultados e classificações | por fazer — depende do identificador da época |
| 14 | Modo de manutenção sem JavaScript | por fazer |

**Extensões do motor:** **E1**, várias marcas no mesmo ficheiro — **feito**,
ver mais abaixo. **E2**, gerar e apagar ficheiros por entidade dentro da mesma
transação — por fazer, é o Bloco 10.

**Fora de âmbito por decisão tomada:** as fichas individuais de atleta
(`atleta.html`) não são geradas — são dados pessoais de menores, e em HTML
estático ficariam indexáveis e arquiváveis. O plantel continua a mostrar
nome e número; a data de nascimento e a ficha individual ficam fora do que é
publicado.

---

# FASE C — BLOCO 1: A PÁGINA DE NOTÍCIAS SEM JAVASCRIPT

A `noticias.html` chegava vazia: seis esqueletos de carregamento e um
JavaScript que os substituía a partir do `localStorage`. Sem JavaScript não
havia uma notícia sequer — e esta é a página com mais conteúdo indexável do
site.

## O que passou a existir no HTML

Cartão de destaque (categoria, data, título, resumo de 200 caracteres), a
barra de filtros, a lista **completa** das notícias publicadas — mais as
agendadas cujo momento já passou — cada uma com imagem, categoria, data,
tempo de leitura, título, resumo de 130 caracteres e partilha, o estado
vazio e o botão "Ver mais".

## Sem JavaScript aparecem todas

Com JavaScript continuam a ser nove cartões e um botão "Ver mais", como
antes. Sem JavaScript não haveria botão que funcionasse, por isso aparecem
todas: os cartões além dos nove levam a classe `news-page__card--extra`, que
o `css/styles.css` esconde e o `<noscript>` da página mostra. Pelo mesmo
caminho saem os controlos que não funcionariam — filtros e copiar ligação.

## Cartões com ligação a sério

O "Ler mais" era um `<span>` com um `addEventListener` no cartão: sem
JavaScript não havia nada para clicar e com teclado não havia nada para
alcançar. Passou a ser um `<a href="noticias.html?id=N">`, no elemento que já
estava desenhado como ligação — sem mudança de aspeto e com acesso pelo
teclado. Com JavaScript, um ouvinte no contentor intercepta o clique e abre o
artigo como antes.

**O que este bloco não faz:** o texto integral do artigo continua a ser
desenhado pelo JavaScript. Sem ele, `noticias.html?id=N` mostra a lista. É o
Bloco 11, depois da extensão E2 — e as ligações que este bloco gera são
exatamente os endereços que esse bloco vai redirecionar.

## Notícias agendadas

A página de notícias mostra também as agendadas cujo momento já passou. Um
bloco gerado congela no momento da publicação, por isso uma notícia que
vença depois disso não estaria lá. É para isso que serve o `data-itens`: o
JavaScript conta a sua lista, vê que não bate com a do gerador, e desenha.

## Escape das URLs de imagem

O `jscEscUrlCss()` passou para o `js/html.js`, partilhado por todas as
páginas, e dá byte a byte o mesmo resultado que o `jsc_esc_url_css()` do
`api/conteudo.php`. Corrigidos neste bloco os três sítios das notícias que
metiam o endereço da imagem no atributo sem tratamento
(`js/noticias.js` no destaque, na grelha e no artigo) e os dois do arquivo em
sobreposição (`js/main.js`).

**Ficam por corrigir, cada um no seu bloco:** o plantel sénior
(`js/main.js`, Bloco 3), o carrossel do hero (`js/main.js`), a galeria
(`js/galeria.js`, Bloco 7) e as publicações da equipa
(`js/senior-posts.js`, Bloco 3).

## Visibilidade: `hidden`, não `style.display`

O projeto tem `[hidden] { display: none !important }` desde a Fase B. Os
contentores desta página passaram todos a usar o atributo `hidden`, em vez de
um `style="display:none"` inline que o JavaScript tinha de limpar. Havia aqui
um erro à espera: com o bloco gerado, um `style` inline deixado pela vista de
artigo escondia a barra de filtros para sempre.

## Como se verificou

`node tools/testar-sem-js.js` — **118 verificações**, sobre uma cópia
temporária e com dados de teste que nunca entram no site: geração das duas
páginas; lista completa visível sem JavaScript, a 1440 e a 320 px; nove
visíveis com JavaScript; "Ver mais"; filtro por categoria; `?id=`;
`?preview=1`; notícia agendada; divergência de `data-itens`; estado sem
notícias; ausência de duplicações; HTML fora das marcas igual byte a byte nas
duas páginas; `403` em `modelos/` e `data/publicacao/`; e a transação a
abortar ou a reverter com os **três** ficheiros intactos byte a byte.

`node tools/validar.js --comparar` — sem problemas em 168 combinações,
**novos: 0**.

Fase A verificada à mão outra vez, depois destas alterações: `405` fora do
POST, `401` sem sessão, `403` num perfil sem a área `noticias`, `200` em
Comunicação, `401` com palavra-passe errada, e o `api/save.php` a continuar a
recusar por área. Nada da autenticação foi alterado.

---

# FASE C — E1: VÁRIOS BLOCOS NO MESMO FICHEIRO

Até aqui cada ficheiro tinha uma região gerada. O `jsc_publicar()` percorria
os blocos e criava um alvo por bloco; dois blocos no mesmo ficheiro leriam
ambos a versão do disco, cada um produziria a página inteira com só o *seu*
bloco novo, e o último a ser promovido apagava o trabalho do primeiro. A
página inicial precisava das notícias **e** da agenda.

## O que mudou

O ciclo passou a ser **por ficheiro**, não por bloco:

1. os blocos são agrupados por ficheiro antes de qualquer leitura;
2. cada ficheiro é lido **uma vez**;
3. `jsc_regioes()` localiza e valida **todas** as marcas desse ficheiro antes
   de se gerar o que quer que seja;
4. `jsc_montar()` faz **uma única passagem** sobre os bytes originais: para
   cada região copia o que está antes (marca de início incluída), insere o
   miolo novo e salta para a marca de fim. Nada é substituído no sítio, por
   isso não há posições a invalidar;
5. o resultado é **uma só versão temporária por ficheiro**, um backup, uma
   entrada no diário e um `rename()`.

Com uma região só, a montagem devolve byte a byte `prefixo . miolo . sufixo`
— exatamente o que se obtinha antes. Foi assim que os testes dos blocos
anteriores continuaram a passar sem uma linha alterada.

## O que o motor recusa, antes de gerar

- marca **em falta** ou **duplicada** (contagem diferente de uma);
- marcas **fora de ordem** (fim antes do início);
- regiões **sobrepostas ou encaixadas** uma na outra;
- duas marcas configuradas de modo a confundirem-se (uma ser parte da outra),
  que faria as contagens mentir.

Em qualquer destes casos a publicação aborta **sem escrever nada**.

## O que ficou garantido

`jsc_fora_das_regioes()` produz o que está fora de **todas** as marcas, com um
separador no lugar de cada miolo, e o sha256 do antes e do depois tem de ser
igual. A validação própria de cada bloco corre sobre o **seu** miolo, e um
erro em qualquer um aborta a publicação inteira. O backup, o diário, a
promoção e o reverter continuam a trabalhar sobre o ficheiro completo.

Pelo caminho, a indentação da marca de fecho deixou de estar fixa em seis
espaços no motor e passa a ser a da linha onde a marca está — o `index.html`
usa seis, a `agenda.html` quatro.

**A consequência prática:** acrescentar um bloco novo à página inicial deixou
de ser um problema de arquitetura. Patrocinadores, escalões e modalidades
entram pelo mesmo mecanismo, na mesma publicação transacional.

---

# FASE C — BLOCO 2: AGENDA E PRÓXIMOS JOGOS

## O que passou a existir no HTML

**Página inicial:** os próximos **seis** eventos, com dia, mês, tipo, título,
hora, local e escalão. **`agenda.html`:** **todos** os eventos de hoje em
diante, com os mesmos campos e o botão "Adicionar ao calendário".

Regras, iguais nos dois lados e iguais ao que o JavaScript já fazia: eventos
de hoje em diante, ordenados pela data, com a **ordem original a desempatar**
quando a data é a mesma. Eventos passados não aparecem. Eventos com
`estado: 'Cancelado'` não aparecem — nem no HTML gerado, nem no calendário,
nem na lista desenhada pelo JavaScript.

Campo vazio não produz elemento: sem hora não há o ícone da hora, sem local
não há o do local, sem nenhum dos dois não há a linha, e `escalão = Todos`
não produz linha nenhuma. Antes escreviam-se os dois ícones sem nada ao lado.

## O que continua a ser do JavaScript

O **calendário mensal** e a **barra de filtros** são controlos, não conteúdo:
constroem-se sempre e, sem JavaScript, simplesmente não existem — o que é
melhor do que existirem sem funcionar. A **exportação `.ics`** continua no
`js/ics.js`; o botão é gerado com a classe `.jsc-so-com-js`, que o
`<noscript>` da página retira, e o clique é ouvido no contentor para funcionar
igual sobre a lista gerada e sobre a desenhada.

## A passagem do tempo

Um bloco gerado congela no momento da publicação. Ao lado do `data-gerado` e
do `data-itens`, a agenda escreve **`data-desde`**: o dia que serviu de
"hoje". Se o JavaScript, ao correr, vir outro dia, redesenha — um evento que
passou sai da lista à meia-noite.

**Sem JavaScript isto não se resolve dentro do HTML**, e não vale a pena
fingir o contrário: uma página gerada no dia D e não republicada mostra, no
dia D+3, os eventos de D, D+1 e D+2 que já aconteceram. A data está bem
visível em cada cartão. A solução verdadeira é regenerar todos os dias:

> **Melhoria futura (alojamento):** um cron diário no cPanel a correr
> `php api/gerar.php`. Não foi criado nem configurado neste bloco.

Gerar a partir de um pedido público (`api/load.php`) foi recusado: seria uma
escrita em ficheiros do site disparada por um GET.

## Duas fontes para a mesma coisa: `db_agenda` e `db_jogos`

Este bloco usa **exclusivamente `db_agenda`** — os eventos escritos na secção
Agenda do painel. O `db_jogos` é outra fonte, com outro modelo de dados
(`casa`, `fora`, `gcasa`, `gfora`), que alimenta a `resultados.html` e a
`escalao.html`, e **não foi misturado**.

**Elas são independentes, e nada as sincroniza.** O mesmo jogo pode existir
nas duas, numa só, ou em nenhuma, e quem o escreve tem de o escrever duas
vezes. Fica registado como trabalho a estudar: **uma fonte única para um
jogo**, que apareça na agenda e nos resultados sem dupla introdução. É uma
decisão de modelo de dados, não de apresentação, e deve ser tomada antes do
Bloco 13 (Resultados) ou com ele.

## Trabalho futuro do Admin

**Cancelar e restaurar eventos.** O formulário do painel não tem campo de
estado: o `salvarEvento()` escreve sempre `estado: 'Agendado'`, inclusive ao
editar. Hoje um evento cancelado apaga-se, não se marca. O site já sabe
esconder um evento cancelado — falta o painel saber cancelá-lo.

## Como se verificou

`node tools/testar-sem-js.js` — **231 verificações**, com dados de teste que
nunca entram no site. Os eventos da fixture não têm data: têm `_offsetDias`,
que o teste converte em data (0 = hoje) — uma agenda com datas fixas ficava no
passado e os testes começavam a falhar sozinhos.

Entre elas, os dez ensaios do E1: as duas regiões do `index.html` geradas na
mesma publicação; alterar a agenda não toca na região das notícias e
vice-versa, byte a byte; uma falha em qualquer dos quatro modelos deixa os
quatro ficheiros intactos; marca duplicada, sobreposta, encaixada e em falta
abortam sem escrever; o exterior a todas as marcas fica igual byte a byte; e
o reverter devolve o ficheiro inteiro, com as duas regiões de pé.

`node tools/validar.js --comparar` — sem problemas em 168 combinações,
**novos: 0**. Fase A verificada à mão outra vez: `405`, `401`, `403` e `200`
nos sítios certos, e o `api/save.php` a continuar a recusar por área.

---

# FASE C — BLOCO 3: EQUIPA PRINCIPAL

Três regiões no mesmo ficheiro, pelo mecanismo do E1: a barra de informação,
o plantel e as publicações da equipa.

## O que passou a existir no HTML

**Barra de informação** — um item por campo preenchido (Competição,
Temporada, Treinos, Local), pela ordem da página. Campo vazio não produz
item; com os quatro vazios a barra inteira sai, em vez de ficar uma caixa
vazia.

**Plantel** — agrupado pelas posições **que têm jogadores**. Antes existiam
sempre os quatro grupos no HTML, escondidos; agora um grupo sem jogadores não
chega a ser escrito. Jogador inativo não aparece. Sem plantel, fica só
"Plantel a atualizar.".

**Publicações** — as quatro mais recentes. Uma publicação da equipa principal
é uma notícia do painel com a categoria **"Seniores"** e publicada: não há
chave nem tabela à parte.

## Os dados pessoais publicados não aumentaram

O cartão de jogador publica os mesmos quatro campos de sempre: **nome,
número, posição e fotografia**. Nada mais — e o modelo de dados
`db_seniores` também não tem mais nada. A validação do bloco recusa a
publicação se aparecer no HTML gerado qualquer coisa parecida com data de
nascimento, idade, telefone ou email.

Isto é diferente do `atleta.html`, que mostra data de nascimento e idade de
menores e por isso continua fora de toda a Fase C.

## Uma consequência estrutural, resolvida

Se o bloco gerado só escreve os grupos com jogadores, o JavaScript deixa de
encontrar os contentores `#sgMEI` e companhia quando precisa de redesenhar —
e um grupo que não existe não se pode preencher. O renderizador do
`js/main.js` passou a escrever o bloco todo, grupos incluídos, em vez de
preencher grelhas que tinham de existir de antemão. Ganhou-se de passagem que
os rótulos dos grupos deixaram de existir em três sítios: estavam no HTML, no
JavaScript (onde nunca eram usados) e no painel.

## Um defeito encontrado pelo caminho

O botão "Ver todas as publicações" abria o arquivo de **todas** as notícias,
em vez do das publicações da equipa. O `js/senior-posts.js` substituía o
`openNewsArchive` no arranque do ficheiro, mas o `js/main.js` atribui a versão
dele **dentro** do seu `DOMContentLoaded`, que corre depois — e apagava a
substituição. A substituição passou para o arranque do senior-posts, que corre
a seguir ao do main. Foi o teste deste bloco que o apanhou.

## Escape das URLs de imagem

Corrigidos com o `jscEscUrlCss()` já centralizado, sem criar nada de novo: o
avatar do jogador (`js/main.js`) e os três sítios das publicações da equipa
(cartão, arquivo e artigo do modal, em `js/senior-posts.js`). Ficam por
corrigir, cada um no seu bloco: a galeria (`js/galeria.js`, Bloco 7) e o
carrossel do hero (`js/main.js`).

## Situações registadas, sem alteração de comportamento

**Dois campos do painel que não são mostrados em lado nenhum.** O formulário
da Equipa Sénior guarda `senioresInfo.treinador` e `senioresInfo.descricao`;
esta página não mostra nem um nem outro (só o `js/formacao.js` lê o
`treinador`, e esse ficheiro não é carregado por página nenhuma — é código
morto). Quem os preenche não vê efeito. Não ganharam comportamento novo neste
bloco.

**O `#seniorDescricao` parece administrável e não é.** Tem `id`, mas nenhum
JavaScript lhe toca: é texto institucional fixo.

**Notícias agendadas.** Esta página mostra só as `publicada: true`; a
`noticias.html` mostra também as agendadas cujo momento já passou. A mesma
notícia agendada aparece lá e não aqui. Replicado fielmente, sem alterar a
regra.

## Fonte única da barra de informação: fechado

A decisão foi tornar o painel a fonte única de competição, temporada, treinos
e local, e retirar do HTML os valores duplicados — **depois** de confirmar que
esses valores existem nos dados persistentes.

Essa confirmação não é possível a partir do repositório: o `data/db.json` não
existe aqui e está ignorado por desenho (é estado de cada servidor). Os
valores vivem no painel de quem publica, e só quem lá entra os pode ver. Foi
verificada por quem tem o painel, e confirmada na própria página: competição,
temporada e local preenchidos, treinos vazio e por isso ausente.

Com a confirmação feita, os três literais saíram do HTML. A região
`seniores-info` fica no repositório como uma barra vazia e escondida:

```html
<div class="senior-info" id="seniorInfoBar" hidden></div>
```

A partir daqui, os quatro campos têm **uma única fonte**, o
`db_seniores_info` do painel, e dois caminhos para chegar à página — a geração
(`modelos/seniores-info.php`) e, com JavaScript, o `js/main.js`. Um campo
vazio no painel não produz item; com os quatro vazios não há barra. **Não
existe fallback**, e não se volta a escrever valores à mão no HTML: um
literal aqui mostraria informação desatualizada assim que o painel mudasse,
que é exactamente o defeito que esta decisão fechou.

Há cinco verificações a guardar isto (`barra-base:` no
`tools/testar-sem-js.js`). Olham **só** para dentro da região
`seniores-info` da `equipa-principal.html`, antes de qualquer geração, e
exigem que lá esteja apenas a barra vazia e escondida: sem itens, sem os ids
dos quatro campos, sem texto visível. Não procuram textos concretos — procuram
a forma de um valor publicado, para apanharem também um fallback novo com um
valor que hoje ainda não existe. Não procuram no resto do projeto, onde os
mesmos textos são placeholders, dados iniciais ou conteúdo de outras páginas.
Provadas ao contrário: com um dos literais de volta na região, as cinco falham.

Os mesmos três textos continuam a existir noutros sítios, e são outra coisa:
`placeholder` das caixas do painel (`admin/index.html`), predefinições de
arranque dos dados (`admin/js/data.js`, `admin/js/admin.js`) e textos de
outras páginas (`resultados.html`, `formacao.html`). Nenhum deles alimenta a
barra da equipa principal; não foram tocados.

## Como se verificou

`node tools/testar-sem-js.js` — **336 verificações**. Desta página: barra com
os campos preenchidos e sem o vazio; três grupos de posição e nenhum grupo de
médios; cinco jogadores, sem o inativo; travessão no número em falta;
iniciais sem fotografia; URL com apóstrofo e parêntesis percent-encoded;
`posicaoFull` vazio a cair para a posição; quatro publicações com ligação
`<a>` a sério; botão "Ver todas" fora sem JavaScript e a abrir o arquivo com
ele; o "Ler mais" a abrir o modal com o rato **e com o teclado**; estado vazio
nos três blocos; 320 px e 1440 px; e o exterior às **três** regiões igual byte
a byte. A transação passou a cobrir cinco ficheiros, e o reverter devolve a
página inteira com as três regiões.

`node tools/validar.js --comparar` — sem problemas em 168 combinações,
**novos: 0**. Fase A verificada à mão outra vez.

---

# FASE C — BLOCO 4: FORMAÇÃO / ESCALÕES

Uma região num ficheiro: os cartões dos escalões da `formacao.html`,
alimentados só pelo `db_escaloes`. **Nenhuma pessoa em HTML gerado** — nenhum
atleta, nenhuma data de nascimento, nenhum contacto. O campo `treinador` do
escalão é texto livre do próprio escalão, o mesmo que o cartão já mostrava.

A `escalao.html` fica de fora: é parametrizada por `?escalao=`, o que exige a
extensão E2; metade do conteúdo é sobre menores; e a outra metade depende de
jogos, cuja fonte única é o Bloco 13. Só três alterações pontuais lá entraram,
todas de redução ou de correcção — descritas abaixo.

## Achados antes de implementar

**A1 — dados de menores que, juntos, davam a data de nascimento.** A
`escalao.html` publicava a **idade** de cada atleta no cartão do plantel
(calculada de `dataNascimento`) e, noutra secção da mesma página, o **dia do
mês** e a **idade** de quem fizesse anos no mês corrente. Cruzando as duas,
obtinha-se a data de nascimento quase completa de um menor. Não foi uma
decisão de publicar isso: foi o efeito de duas funcionalidades independentes
na mesma página. **As duas saíram** (ver "O que saiu").

**A2 — a `escalao.html` não funcionava sem JavaScript, em parte nenhuma.** O
HTML-base diz `A carregar plantel…`, `A carregar jogos…`, `A carregar equipa
técnica…`, `A carregar estatísticas…`, e o herói trazia `Sub-17` /
`Iniciados` / `16 a 17 anos` escritos à mão — quem abrisse
`escalao.html?escalao=Sub-9` sem JavaScript lia que estava no Sub-17. Um
fallback que mente, não um fallback vazio. Fica registado, não corrigido: é
trabalho do E2.

**A3 — a `formacao.html` tinha duas versões incompatíveis da mesma grelha.**
Oito cartões escritos à mão, e um `js/main.js` que substituía a grelha inteira
quando o `db_escaloes` existisse. Doze textos operacionais só existiam no HTML
e **não têm campo nenhum no painel**: `Treinos 5x por semana`, `Campeonato
Distrital AF Algarve`, `Regime semi-profissional`, `Primeiros torneios`,
`Tática coletiva`, `Preparação física`, `Alto rendimento`, `Integração na
equipa sénior`, `1.º e 2.º ano`, `Sem competição`, `Foco nos fundamentos`,
`Acompanhamento pedagógico`, `Técnica individual`. Já desapareciam assim que o
painel tivesse um escalão. Saíram de vez. Um deles — `Campeonato Distrital AF
Algarve` — é do mesmo tipo do `Campeonato de Portugal — Série F` que já tinha
sido corrigido: um nome de competição escrito no código, que pode estar errado.

**Fica registado como melhoria futura do painel:** um campo administrável de
"pontos" ou "informações adicionais" no escalão, lista livre, para quem publica
poder reintroduzir aquele tipo de linha. **Não foi criado.**

**A4 — `competicao` e `local` existiam no painel e não apareciam em sítio
nenhum.** Há **dois editores diferentes para o mesmo registo `db_escaloes`**,
com campos diferentes:

| Editor | Secção do painel | Campos que escreve |
|---|---|---|
| `editEscalao` / `salvarEscalao` | Categorias | `nome`, `designacao`, `faixa`, `atletas`, `treinador`, `treinos`, `descricao`, `destaque` |
| `_renderFormacaoInfo` / `_guardarInfoFormacao` | Futebol Formação | `designacao`, `faixa`, `treinador`, `treinos`, **`competicao`**, **`local`**, `descricao` |

Quem preenchia *"Competição / Liga"* e *"Local de Treino"* gravava em
`db_escaloes.competicao` e `db_escaloes.local`, e **nada público os lia** — o
único código que os lia era o `js/formacao.js`, que estava morto. **Passam a
aparecer no cartão, cada um só quando preenchido.** Nenhum dos dois editores
foi alterado.

Assimetria registada, sem alterar comportamento: o `_guardarInfoFormacao` usa
`|| e.designacao` para designação e faixa (não se conseguem apagar) e `|| ''`
para treinador, treinos, competição e local (apagam-se).

**A5 — `js/formacao.js` estava morto.** Nenhum `.html`, `.js`, `.php` ou
manifesto o referenciava, e os ids que procurava (`formacaoInfoBar`,
`formacaoPlantel`, `formacaoEscalaoTitle`) não existem em página pública
nenhuma. Antes de o apagar, o que tinha de único: **lia `competicao`**, **lia
`local`** — os dois campos órfãos do A4 — e usava **`—` como valor de
preenchimento** quando um campo estava vazio, que é exactamente o fallback que
a decisão da barra da equipa principal proibiu. Como competição e local passam
a ter destino real, não havia mais nada a preservar. **Removido.**

**A6 — a `escalao.html` lê jogos de três chaves diferentes.** O `loadJogos()`
tem prioridade em três degraus: `db_jogos` filtrado por escalão; se vier vazio,
`fpf_jogos_<escalao>` (cache do scraper, sincronizada pelo `js/sync.js` a
partir de `classData`); se vier vazio, nada. Alimenta *Resultados & Jogos* e
*Estatísticas da Época*, esta calculada no browser.

**Divergência a resolver no Bloco 13:** o `js/resultados.js` usa uma chave mais
específica, `fpf_jogos_<escalao>__<equipa>`, e o `js/escalao.js` usa
`fpf_jogos_<escalao>` sem sufixo. Com um escalão que tenha mais do que uma
equipa (`Sub-17__A`), o `resultados.js` encontra a cache e o `escalao.js` não.
Duas páginas, o mesmo facto, resultados diferentes. **Não foi tocado neste
bloco**: escolher entre as três chaves é definir a fonte única dos resultados.
Por construção, o Bloco 4 não lê `db_jogos` em sítio nenhum.

**A7 — escapes pendentes.** Três, todos corrigidos ou desaparecidos:

| Sítio | Era | Passou a ser |
|---|---|---|
| `js/escalao.js`, foto do treinador | `jscEscUrl` dentro de `url('…')` de CSS | `jscEscUrlCss()`, já centralizado |
| `js/main.js`, ligação do cartão | `jscEscUrl(e.nome)` no valor de um parâmetro | `jscEsc(encodeURIComponent(nome))` |
| `js/escalao.js`, aniversários | nome e foto interpolados **sem escape nenhum** | desapareceu com a secção |

O `js/pesquisa.js` já fazia `encodeURIComponent` para a mesma ligação: eram
duas páginas a construir o mesmo endereço de maneiras diferentes.

## O que saiu, e porquê

**A idade do cartão de cada atleta** (`escalao.html`). O cartão publica nome,
posição e fotografia. A idade era metade de uma data de nascimento, e a outra
metade estava na mesma página. A função `calcAge()` saiu com ela: esta página
não volta a ler a data de nascimento de ninguém.

**A secção "Aniversários do Mês"** (`escalao.html`), inteira — o renderizador,
as duas chamadas e o HTML da secção. Publicava nome, fotografia, dia do mês de
nascimento e idade de cada atleta do escalão, com destaque no próprio dia. Nas
páginas de formação os atletas são menores. As datas de nascimento continuam
guardadas no painel, para o que é preciso administrativamente; deixam de
alimentar aniversários públicos. **Nada a substituiu.**

**Os oito cartões escritos à mão** da `formacao.html`, com os doze textos sem
fonte do A3.

**`js/formacao.js`**, ficheiro inteiro (A5).

## A região, e o que cada campo faz

Uma marca só neste ficheiro — `<!-- JSC:escaloes:inicio -->` … `:fim` —, pelo
mecanismo do E1, que foi reutilizado **sem uma linha de alteração**. A
transacção passa a cobrir **seis** ficheiros, e o `--reverter` devolve os seis.

| Campo do `db_escaloes` | Vazio produz |
|---|---|
| `nome` | **o escalão inteiro é descartado** — sem nome não há ligação nem título |
| `designacao` | sem `<h3>` |
| `faixa` | sem `<p class="category-card__age-range">` |
| `descricao` | sem `<p class="category-card__desc">` |
| `treinos` | sem `<li>` |
| `treinador` | sem `<li>` |
| `competicao` | sem `<li>` |
| `local` | sem `<li>` |
| `atletas` não-inteiro, `0`, `"0"` ou negativo | sem `<li>` |
| nenhum dos itens acima | **sem `<ul>`**, em vez de uma lista vazia |
| `destaque` falso | sem badge e sem `--featured` |
| `db_escaloes` vazio | grelha com `jsc-vazio` e nada mais |

**Defeito corrigido no `js/main.js`:** fazia `if (e.atletas)`. Com o número `0`
acertava, mas com a string `"0"` — que é o que chega de um JSON editado à mão
ou de uma importação — escrevia **"0 atletas inscritos"**, que não diz que o
escalão está vazio, diz que ninguém preencheu o campo. O `js/escalao.js` já
fazia o `parseInt` com `<= 0`; é essa a versão correcta, e passou a ser a dos
dois, replicada em PHP no `jsc_escalao_atletas()`.

**Dupla renderização:** `data-gerado` e `data-itens` no contentor;
`jscBlocoAtual()` no `js/main.js`. Sem `data-desde` — um escalão não expira ao
virar da meia-noite.

**Texto de página que não é dado de escalão**, registado e não alterado: o
herói da `formacao.html` diz *"Do Sub-5 ao Sub-19"* e *"Inscrições abertas para
a época 2026/2027"*, e o subtítulo repete a escada. É texto editorial, não vem
do painel, e envelhece se os escalões mudarem. Fica para uma decisão futura.

## Guarda de regressão

Quatro verificações `grelha-base:` no `tools/testar-sem-js.js`. Olham **só**
para dentro da região `escaloes` da `formacao.html`, antes de qualquer geração,
e exigem que lá esteja apenas a grelha com o estado vazio: sem nenhuma classe
de cartão, sem ligação para `escalao.html`, e sem outro texto que não o do
estado vazio. Não procuram textos concretos — procuram a forma de um cartão
publicado, para apanharem também um cartão novo de um escalão que hoje não
existe. Provadas ao contrário: com um cartão de volta na região, as quatro
falham e as outras 395 continuam a passar.

## Como se verificou

`node tools/testar-sem-js.js` — **399 verificações**. Deste bloco: nove
cartões a partir de dez escalões (o sem nome é descartado); campo vazio sem
elemento; nenhuma lista vazia; os cinco itens do cartão completo pela ordem
certa; competição e local sozinhos; `atletas` a `0`, `"0"`, `-3` e `"muitos"`
sem linha nenhuma; `12` e `7` com linha; um só destaque; uma ligação `<a>` por
cartão, alcançável por teclado; o nome `TESTE A&B/C 1` percent-encoded no
`href`, escapado no texto, e recuperado **exacto** pelo `URLSearchParams` que o
`js/escalao.js` usa; o bloco gerado e atual não é redesenhado; `data-itens`
errado força o redesenho e o cartão desenhado é **o mesmo** que o gerado; 320 px
e 1440 px; estado vazio com e sem JavaScript; `/modelos/escaloes.php` → 403; o
exterior às marcas igual byte a byte nos seis ficheiros; e o reverter a devolver
a `formacao.html` inteira.

Privacidade: nenhum atleta e nenhum dado pessoal no bloco gerado — verificado
no teste **e** no validador do gerador, que recusa a publicação se encontrar
`dataNascimento`, `nascimento`, `idade`, `telefone`, `email` ou `encarregado`.
Na `escalao.html`: nenhuma idade em toda a página, a secção dos aniversários
não existe, e a foto do treinador com `'` e `( )` sai percent-encoded dentro do
`url(...)`.

`node tools/validar.js --comparar` — sem problemas em 168 combinações,
**novos: 0**. Fase A verificada à mão: `405` a não-POST, `401` sem sessão,
`401` com password errada, `200` para a Comunicação a alterar notícias, e
**`403` para a Comunicação a alterar `escaloes`** — a área dos escalões é
`equipas`, que aquele perfil não tem.

---

# FASE C — BLOCO 5: PATROCINADORES

Duas regiões, uma zona. A divisão por Ouro, Prata e Bronze **deixou de existir
na apresentação pública e no painel**: todos os patrocinadores ativos numa
grelha só, pela ordem dos dados, sem tratamento visual diferente entre eles.

## Os dois piores fallbacks da Fase C, ambos aqui

**A página de patrocinadores estava completamente vazia sem JavaScript.** O
`patrocinadores.html` tinha, literalmente, `<div id="sponsorsContent"></div>`, e
o conteúdo era construído por um `<script>` inline de 134 linhas dentro do
próprio HTML — a única página do site assim. Sem JavaScript não havia nada: nem
cartões, nem estado vazio, nem o convite final, debaixo de um cabeçalho que
promete "Quem nos apoia".

**A página inicial mostrava doze patrocinadores falsos.** Cartões escritos à
mão, com nomes de empresas que não existem, em três níveis. O `js/main.js` só
substituía uma fila **se houvesse patrocinadores ativos nesse nível**, e por
isso: base vazia → os doze ficavam todos; só patrocinadores num nível → os
outros sete falsos ficavam; desativar o último de um nível → os falsos desse
nível voltavam.

## Achados

**Campo `logo` inexistente no painel.** Os dois renderizadores públicos leem
`p.logo`, e o editor do Admin tinha `nome`, `sector`, `tier`, `desde` e
`website` — e mais nada. **Nenhum patrocinador podia ter logótipo.** Passa a
haver campo, por URL ou upload, com o `setupImageUpload` que o painel já usa.

**O painel gravava `'—'` dentro dos dados.** `sector: valor || '—'`. Deixar o
sector em branco gravava um travessão em `db_patrocinadores`, publicado depois
como se fosse o sector da empresa — e, na página inicial, como o nome do
cartão. O painel deixou de o gravar, e um travessão já gravado conta como
vazio.

**O nome nunca aparecia na página inicial.** O `<span class="__name">` recebia
o **sector**; o nome só surgia quando não havia logótipo. E como o logótipo era
uma **imagem de fundo CSS**, não tinha `alt`: o cartão ficava **sem nome
acessível nenhum**. Passa a `<img alt>` mais o nome em texto.

**O mesmo `website` dava destinos diferentes nas duas páginas.** A página de
patrocinadores punha `https://` quando faltava o esquema; a inicial não. Um
`empresa.pt` ficava `https://empresa.pt` numa e `campinense.pt/empresa.pt` —
404 — na outra. Uma regra só, agora, e **lista de permitidos**: `http` e
`https`, nada mais.

**Sem website, o cartão da inicial era um `<a>` sem `href`** — não focável, não
anunciado como ligação, mas com aspeto de clicável. Passa a `<div>`.

**Um `initials()` que apagava a página.** `nome.trim()` sem guarda: um registo
sem nome lançava `TypeError`, a exceção subia e o IIFE inteiro abortava —
nem os outros patrocinadores, nem o estado vazio, nem o convite eram escritos.

**Filtro de `ativo` divergente:** a inicial aceitava qualquer valor verdadeiro,
a página exigia exactamente `true`. Um `ativo: 1` aparecia numa e não na outra.

**Escape errado no logótipo da inicial:** `jscEscUrl` dentro de um `url('…')`
de CSS. O mesmo defeito dos cartões de notícia e da foto do treinador.
Desapareceu com o fundo CSS.

## O que foi removido, e o que fica por compatibilidade

**Removido da zona pública** — 83 ocorrências: os 24 blocos e cartões de nível
do `index.html`; as 41 do `patrocinadores.html` (o array de níveis, a
`tierHtml()`, o filtro por nível, o bloco que anunciava "não temos
patrocinadores" com patrocinadores ativos, e 18 regras CSS); as 13 do
`css/styles.css`; as 5 do `js/main.js`.

**Removido do painel** — 22 ocorrências: o selector de nível nos dois modais, a
escrita de `tier`, o agrupamento da lista, o cabeçalho de nível, o ponto de cor,
e as 11 regras CSS que ficaram sem uso.

**Dependência forçada, registada:** o `renderPatrocinadores()` agrupava por
`p.tier.toLowerCase()` **sem guarda**. No momento em que o selector sai e os
registos novos deixam de ter `tier`, essa linha lançaria `TypeError` e a lista
do painel deixaria de aparecer. Não era possível "só remover o selector": a
lista tinha de passar a grelha única na mesma alteração.

**Fica por compatibilidade histórica, sem qualquer efeito:** o campo `tier` nos
registos já guardados. **Nenhuma migração, nenhum registo reescrito, nenhum
campo apagado.** Os registos novos não o levam; antigos com `tier` e novos sem
convivem. A publicação ignora-o por completo — antigo, desconhecido (`Platina`),
vazio, nulo, numérico ou ausente dá tudo no mesmo resultado, sem erro. O
`api/save.php` e o `api/load.php` não conhecem patrocinadores (zero
ocorrências), a exportação e a importação do painel passam
`DB.patrocinadores` inteiro, e por isso o `tier` sobrevive a cópias de
segurança e restauros. **Pode ser removido mais tarde, quando se confirmar que
nada depende dele.**

**Não são patrocinadores e não foram tocados:** `Medalha Municipal de Mérito —
Grau Prata` (palmarés, 1995) no `js/historia.js`, `js/pesquisa.js` e
`admin/js/admin.js`; o esquema de cores `Vinho & Ouro` do painel.

## Ordenação

Não existe ordenação administrável: `db_patrocinadores` não tem campo de ordem,
o painel não tem arrastar nem setas, e a criação faz `push`. **A ordem
publicada é a ordem do array**, e um teste compara-a nome a nome com a fixture.
Fica registado como melhoria futura do painel — setas ou arrastar para
reordenar. Não foi construída.

## O estilo único

Sem as variantes de nível, o `.sponsor-card` ficava **sem borda e sem
espaçamento**: tudo isso vivia nas três variantes, e o mesmo na outra página
(barra de acento, altura e fundo da área do logótipo, tamanho das iniciais).
O estilo único vem do nível do meio, o mais sóbrio, **com a barra superior em
amarelo do clube** em vez das cores de medalha. Uma classe, um aspeto, nenhum
patrocinador em evidência.

## Tratamento de cada caso

| Caso | Resultado |
|---|---|
| `tier` antigo, desconhecido, vazio, nulo, numérico ou ausente | **ignorado, sem erro e sem efeito** |
| `nome` vazio/ausente | patrocinador descartado — e **sem `TypeError`** |
| `sector` vazio **ou `'—'`** | nenhum elemento |
| `desde` vazio, `"abc"` ou `"26"` | nenhum elemento; `"2019-05"` dá `2019` |
| `website` vazio, `javascript:` ou `data:` | **nenhum `<a>`** — o cartão é uma `<div>` |
| `website` sem esquema | `https://`, nas **duas** páginas |
| `logo` vazio | iniciais na página, nome em texto na inicial |
| `ativo` não verdadeiro | não aparece — regra única |
| `db_patrocinadores` vazio, ou todos inativos | estado vazio nas duas, e o convite final mantém-se |
| Dupla renderização | `data-gerado` + `data-itens` + `jscBlocoAtual()`, sem `data-desde` |

## Guardas de regressão

Oito verificações `zona-base:`, a olhar **só** para dentro de cada região, antes
de qualquer geração. Procuram a forma, não textos: as classes de cartão, as
classes de nível, as ligações externas e o `<script>`. Um patrocinador cujo
nome contenha "Bronze" é conteúdo legítimo e **não** é o que se proíbe — o
validador do gerador proíbe a *estrutura* do nível, não a palavra. Provadas ao
contrário: com um cartão de nível de volta no `index.html` e uma grelha de
nível com `<script>` na `patrocinadores.html`, as oito falham e as outras 518
continuam a passar.

## Como se verificou

`node tools/testar-sem-js.js` — **526 verificações**. Deste bloco: 17 cartões a
partir de 22 registos, nas duas páginas; inativos em quatro formas ausentes;
ordem igual à dos dados; `tier` em cinco formas ignorado; nenhuma classe de
nível na zona pública; todos os cartões com as mesmas classes; nenhum `<a>` sem
`href`; ligações alcançáveis por teclado; `alt` com o nome e a imagem a
resolver com um apóstrofo no endereço; travessão não publicado; base vazia e
todos inativos com estado vazio e convite; o bloco gerado e atual não
redesenhado; `data-itens` errado a forçar o redesenho e o cartão desenhado a
ser **o mesmo** que o gerado; um registo sem nome a não apagar a página; o
painel sem selector de nível, sem agrupamento e com campo de logótipo; 320 px e
1440 px; `/modelos/patrocinadores-*.php` → 403; o exterior às marcas igual byte
a byte nos **sete** ficheiros; o reverter a devolver os sete.

`node tools/validar.js --comparar` — sem problemas em 168 combinações,
**novos: 0**. Fase A verificada à mão: `405` a não-POST, `401` sem sessão,
`400` sem o cabeçalho do painel, `401` com password errada, `200` para a
Comunicação a alterar notícias **e patrocinadores** (é área dela), e `403` a
alterar `escaloes`.

---

# FASE C — BLOCO 6: MODALIDADES

Uma região, uma fonte. A grelha da página inicial passa a ser escrita a partir
do `db_modalidades`, e as três modalidades deixam de existir escritas no
código. **Continuam nos dados persistentes** — o que saiu foi a cópia.

## As modalidades que existem

Três, em `db_modalidades`: **Kickboxing**, **Judo** e **Futsal**, com ícone e
descrição de arranque. **Horários, locais e responsáveis estão todos vazios**,
e é esse o estado certo: foram esvaziados por não estarem confirmados. Nenhum
valor antigo foi recuperado e nenhum fallback foi criado.

O `data.js` classifica-as como configuração verdadeira do clube, ao lado dos
escalões e da época dos seniores — por isso o painel arranca com elas.

## Achados

**Três cartões escritos à mão na página inicial.** Nome, ícone e descrição,
iguais aos dados de arranque. O `js/main.js` só substituía a grelha
`if (lista.length)`: com a base vazia **os três ficavam**, com ou sem
JavaScript, e podiam já não corresponder ao painel.

**A lista estava em quatro sítios:** `admin/js/data.js` (a semente legítima),
`index.html` (3 cartões), `js/modalidade.js` (`DEFAULT_MODALIDADES`) e
`inscricao.html` (3 opções de rádio). Os três primeiros passam a ser um.

**Uma caixa vazia que desenhava um traço.** O `.modality-card__info` tem
`padding-top:14px; border-top:1px solid #eee`. Os três cartões fixos traziam-na
**vazia**, e o renderizador escrevia-a sempre: a página mostrava um traço
horizontal e 14 px de espaço debaixo da descrição, sem nada a seguir. Agora só
existe quando tem itens.

**O ícone entrava em `innerHTML` sem escape.** `${m.icone || '🏅'}` — o único
campo desta zona sem `jscEsc`. O ícone vem do painel.

**A imagem do herói de `modalidade.html` não tinha escape nenhum:**
`url('${m.imagem}')` cru, atribuído a `style.backgroundImage`. Um apóstrofo
fechava o `url(...)` e o resto passava a ser CSS.

**A imagem do cartão usava o escaper errado:** `jscEscUrl` dentro de um
`url('…')`, que escapa HTML mas não percent-encode. Mesmo defeito dos cartões
de notícia, da foto do treinador e do logótipo do patrocinador.

**A ligação usava `jscEscUrl(m.id)`** num valor de parâmetro, sem
percent-encoding. Mesmo defeito da ligação do escalão.

**O menu móvel de `modalidade.html` estava partido.** O `js/nav.js` e o
`js/modalidade.js` registavam **cada um** um ouvinte de clique no hamburger,
com as mesmas duas alternâncias de classe. Cada clique alternava duas vezes: o
menu abria e fechava no mesmo instante e nunca aparecia, e o `aria-expanded`
ficava dessincronizado do estado visível. Ficou só o do `js/nav.js`.

**Uma modalidade inativa continuava publicada por endereço directo.** O
`find` por id não olhava a `ativo`: desativar no painel tirava-a da página
inicial e deixava-a completa em `modalidade.html?id=N`. E **também não olhava
ao nome**: uma modalidade sem nome abria com um título vazio. As duas passam a
ser tratadas como inexistentes.

**Correcção de um achado meu que estava errado.** O plano dizia que a regra
`html[data-theme="dark"] .modality-card__title` deixava o nome da modalidade
com a cor do tema claro no escuro. **Não deixava:** existe, mais abaixo no
mesmo ficheiro, uma regra da Fase B que trata `.modality-card__name` com a
mesma cor. O `__title` era apenas CSS morto. A correcção certa era **apagar o
selector morto**, e não acrescentar uma regra duplicada — foi isso que se fez.

## Sem dados fictícios e sem hardcodes operacionais

Ao contrário do Bloco 4 (12 textos operacionais sem fonte) e do Bloco 5 (12
patrocinadores falsos), aqui **não havia nenhum horário, local, responsável,
imagem de demonstração, estatística inventada nem modalidade fictícia**. O
único hardcode operacional eram as descrições, e essas têm campo no painel.

## O mapa dos campos: sem órfãos

Os nove campos de `db_modalidades` — `nome`, `icone`, `descricao`, `treinos`,
`local`, `responsavel`, `imagem`, `imagemPos`, `ativo` — são **todos
administráveis e todos publicados**. Não foi preciso acrescentar nada ao
painel, ao contrário dos escalões (`competicao`/`local` invisíveis) e dos
patrocinadores (`logo` inexistente). **O Admin não foi tocado.**

## Privacidade

O único campo relativo a uma pessoa é `responsavel` — **um nome, em texto
livre**. Não existe campo de telefone, e-mail ou qualquer contacto para
modalidades, nem foi criado. Os três estão vazios nos dados. O validador do
gerador recusa a publicação se encontrar `telefone`, `email`, `contacto` ou
`dataNascimento` no bloco — rede de segurança, não expectativa.

## `jscUrlCss()` e `jscEscUrlCss()`: dois contextos, uma regra

Um URL dentro de um `url('…')` de CSS precisa de percent-encoding. Se esse CSS
for um `style="…"` escrito em `innerHTML`, precisa **também** de escape de
HTML; se for atribuído a `element.style.backgroundImage`, **não** — o valor não
passa por um parser de HTML, e escapá-lo transformaria um `&` legítimo da query
em `&amp;`, com a imagem a deixar de carregar.

Passam a existir os dois, um construído sobre o outro:

```js
jscUrlCss(v)     // percent-encoding + recusa de esquemas — para style.*
jscEscUrlCss(v)  // jscEsc(jscUrlCss(v))                  — para style="..."
```

A ordem das operações é a mesma do `jsc_esc_url_css()` do PHP — percent-encode,
depois trim, depois recusa de esquemas. Trocá-la fazia os dois divergirem num
endereço com espaços à volta. **Verificado: `jsc_esc_url_css()` e
`jscEscUrlCss()` dão resultados idênticos nos nove casos testados**, incluindo
`javascript:`, `data:`, apóstrofos, parêntesis, `&` e espaços.

## Tratamento de cada caso

| Caso | Resultado |
|---|---|
| `nome` vazio ou só espaços | modalidade **descartada** na grelha **e** por endereço directo |
| `ativo === false` | não aparece na grelha **nem** por endereço directo |
| `ativo` ausente | conta como ativa — é a regra que o site já usava |
| `descricao` vazia | sem `<p>` |
| `treinos`, `local`, `responsavel` vazios | sem `<span>` cada um |
| **os três vazios** | **sem `<div class="modality-card__info">`** — o traço desaparece |
| `imagem` vazia | sem atributo `style`; fica o gradiente do CSS |
| `imagem` presente | `jsc_esc_url_css()` no cartão, `jscUrlCss()` no herói |
| `imagemPos` vazio | `center` |
| `icone` vazio | `🏅`, **escapado** |
| `db_modalidades` vazio, ou todas inativas | `<p class="jsc-vazio">` e nenhuma das três a reaparecer |
| Ordem | ordem do array |
| Dupla renderização | `data-gerado` + `data-itens` + `jscBlocoAtual()`, sem `data-desde` |

O ícone leva `aria-hidden="true"`: é decoração, e quem identifica o cartão é o
`<h3>`. A imagem **continua a ser fundo CSS** e não `<img>` — é uma textura
atrás do ícone e de um gradiente opaco, não um logótipo, e um `alt` com o nome
repetiria o título para quem usa leitor de ecrã.

## O que fica para o E2

A `modalidade.html` é parametrizada por `?id=` e **fica fora da geração**.
Adiado: herói, barra de informação, publicações, estado "não encontrada", e uma
ligação real para cada publicação — hoje o cartão de post é um `<div
role="button" onclick>` e **sem JavaScript não há como abrir uma publicação**,
porque ela vive dentro da página parametrizada e não há destino possível.

Sem JavaScript, a página mostra o herói com `🏅` e o título `Modalidade`
escritos à mão, e três secções vazias. Registado, não corrigido.

## Divergência registada para um bloco de Inscrições

O `inscricao.html` tem as opções de modalidade **escritas à mão**: `Futebol`,
`Kickboxing` e `Judo` — **oferece Futebol**, que não é uma modalidade de
`db_modalidades`, e **não oferece Futsal**, que é. O `js/inscricao.js` tem
ainda `|| 'Futebol'` como valor por omissão, e escreve num
`db_inscricoes_modalidades` que não foi auditado. Acrescentar uma modalidade no
painel **não a acrescenta ao formulário**.

Não foi tocado neste bloco: o formulário tem validação própria, envio de e-mail
e uma chave de dados própria, e decidir o lugar de "Futebol" é uma decisão de
modelo de dados. **Fica para um bloco próprio de Inscrições.**

## Melhoria futura do painel, registada e não construída

Não existe ordenação administrável das modalidades: nem campo de ordem, nem
arrastar, nem setas. A ordem publicada é a ordem do array, que é a ordem de
criação. Quem quiser uma modalidade primeiro não tem como o dizer pelo painel.

## Guardas de regressão

Cinco verificações. Quatro `grelha-base:` olham **só** para dentro da região
`modalidades` do `index.html`, antes de qualquer geração, e exigem que lá esteja
apenas a grelha com o estado vazio: sem classes de cartão, sem ligação para
`modalidade.html`, sem outro texto. A quinta, `fonte única:`, varre
`index.html`, `js/main.js` e `js/modalidade.js` — **sem comentários** — e exige
que os nomes das três modalidades não existam em código público nenhum.

Provadas ao contrário: com um cartão de Kickboxing de volta na região e um
`DEFAULT_MODALIDADES` com Futsal de volta no JavaScript, as cinco falham — a
última a nomear os dois ficheiros — e as outras 612 continuam a passar.

## Como se verificou

`node tools/testar-sem-js.js` — **617 verificações**. Deste bloco: 9 cartões a
partir de 12 registos (inativa, sem nome e só-espaços descartadas); ordem igual
à dos dados; caixa de informação só quando tem itens, e **zero vazias**; os três
itens pela ordem certa, e cada um sozinho a dar uma caixa de um item; ícone com
`<b>&x</b>` a aparecer **como texto** e marcado como decorativo; ícone de
omissão quando vazio; imagem com apóstrofo e parêntesis percent-encoded **e a
resolver no browser**; sem imagem, sem `url()` e só o gradiente; `imagemPos`
resolvida pelo browser (`50% 0%` e `50% 100%`); uma ligação `<a>` real por
cartão, com o id `609 a&b/c` percent-encoded e **recuperado exacto** pelo
`URLSearchParams`; nenhum contacto na grelha; **as sete larguras** (320, 375,
390, 430, 768, 1024, 1440) sem transbordo; base vazia e todas inativas com
estado vazio e **nenhuma das três a reaparecer**; o bloco gerado e atual não
redesenhado; `data-itens` errado a forçar o redesenho e o cartão desenhado a ser
**o mesmo** que o gerado; `/modelos/modalidades.php` → 403; o exterior às
**quatro** regiões do `index.html` igual byte a byte; o reverter a devolver os
sete ficheiros.

Da `modalidade.html`: a modalidade ativa abre com nome, descrição, barra e
publicação; a imagem do herói com `'` e `( )` resolve percent-encoded; **a
inativa dá "Modalidade não encontrada"** e a sua publicação não aparece; a sem
nome também; um id inexistente também; **o menu móvel abre com um clique** e o
`aria-expanded` fica `true`; em tema escuro o nome não fica com a cor do tema
claro.

`node tools/validar.js --comparar` — sem problemas em 168 combinações,
**novos: 0**. Fase A verificada à mão: `405` a não-POST, `401` sem sessão,
`400` sem o cabeçalho do painel, `401` com password errada, `200` para o
super-admin a alterar `modalidades`, **`403` para a Comunicação a alterar
`modalidades`** e **`403` a alterar `modPosts`** — a área é `modalidades`, que
aquele perfil não tem —, e `200` para a Comunicação a alterar notícias.

---

# FASE C — BLOCO 7: GALERIA / VÍDEO

Três regiões, uma fonte. A galeria da página inicial, a galeria completa e a
página de vídeos passam a ser escritas no servidor a partir do `db_galeria` e do
`db_videos`. Saíram **cinco fotografias inventadas** e **seis esqueletos de
carregamento permanentes**.

## As cinco legendas inventadas, e a pior delas

A galeria da página inicial trazia cinco cartões escritos à mão, com legendas
que ninguém confirmou. Um deles afirmava **"Equipa Sub-19 – Campeão Distrital
2025"**: um título que o clube pode não ter conquistado, publicado na página de
entrada como se fosse facto. Apareciam **sempre**, com ou sem JavaScript,
porque o `js/main.js` só substituía a grelha quando havia fotografias na base —
e a base está vazia. Saíram os cinco.

## Os seis esqueletos permanentes

A `galeria.html` e a `videos.html` traziam caixas `class="skeleton"` no HTML.
Um esqueleto é uma promessa: "está a carregar". Sem JavaScript nunca carregava
nada, e a promessa ficava na página para sempre. Saíram os seis, e cada página
passa a ter o estado vazio a sério: **"Ainda não há fotos na galeria."** e
**"Ainda não há vídeos publicados."**

Na página inicial a decisão foi outra, e mais dura: sem fotografias
publicáveis **a secção inteira desaparece** — etiqueta, título, subtítulo,
filtros, grelha e botão. Uma secção "Galeria" com uma caixa a dizer que não há
nada é pior do que não ter secção. A região abrange por isso a `<section>`
toda.

O motor recusa um bloco que não escreva nada, e com razão: um modelo calado é
quase sempre um modelo avariado. Por isso o caso sem fotografias escreve **um
comentário HTML** — que explica a decisão a quem leia a fonte e não produz
elemento nenhum na página. O validador tira os comentários antes de verificar
que não sobrou nada visível.

## Achados

**A galeria mostrava HTML como texto.** O `js/galeria.js` construía o conteúdo
do fundo e depois passava a coisa toda por `jscEsc()`: as etiquetas apareciam
escritas na página em vez de desenhadas.

**Escape duplo.** Valores já escapados voltavam a passar pelo escapador, e um
`&` de um título aparecia como `&amp;amp;`.

**Um `_escHtml` duplicado.** O `js/galeria.js` tinha a sua própria função de
escape, ao lado da do `js/html.js`. Duas implementações da mesma regra é uma
que fica atrás.

**O escapador de CSS errado.** A imagem de fundo usava `jscEscUrl` dentro de
`url('…')` — escapa HTML mas não percent-encode. O mesmo defeito dos cartões de
notícia, da foto do treinador, do logótipo do patrocinador e do cartão de
modalidade. Passa a usar `jscEscUrlCss` / `jsc_esc_url_css`.

**Um `src` sem política de endereços.** A imagem da caixa de luz recebia o
endereço cru dos dados. Passa por `jscEscUrl`, que recusa `javascript:`,
`vbscript:` e `data:` que não seja de imagem.

**Um global implícito.** O `_allFotos` do `js/main.js` não era declarado:
existia no `window`, visível a qualquer outro guião.

**Nenhum refresco depois de publicar.** As duas zonas não ouviam `jsc:synced`,
e não havia `jscBlocoAtual()`: com o bloco já escrito no servidor, o JavaScript
redesenhava-o por cima.

**A caixa de luz nunca esteve a funcionar como o CSS dizia.** O
`.lightbox` tem `flex-direction`, `align-items` e `justify-content`, mas
**não tinha `display: flex`**. Abria com `hidden` removido, ficava
`display: block`, e as três propriedades não faziam nada. Defeito anterior a
este bloco; corrigido aqui porque é aqui que a caixa de luz passa a ser testada.

**O `js/main.js` sequestrava a caixa de luz da `galeria.html`.** As duas
páginas têm `id="lightbox"`, e o `js/main.js` carrega nas duas: o seu ouvinte de
`Escape` fechava a caixa antes de o `js/galeria.js` poder devolver o foco. Toda
a ligação da caixa de luz da página inicial passa a estar presa à existência do
`#galleryGrid`.

**Um vídeo que não fosse do YouTube gravava sem aviso.** O painel aceitava
qualquer endereço, e o resultado era um cartão sem miniatura e um `<iframe>`
vazio. A extração do id passa a estar num sítio só, e o painel recusa ao gravar.

## Os três endereços vêm sempre do id validado

O `jsc_video_id()` (e o `jscVideoId()` gémeo) aceita as quatro formas que o
painel usa — `watch?v=`, `youtu.be/`, `shorts/`, `embed/` — e devolve os onze
caracteres do id, ou nada. **Um vídeo sem título ou sem id válido não é
publicado.**

Miniatura, ligação e `embed` são construídos a partir desses onze caracteres,
**nunca do endereço escrito no painel**:

    miniatura → https://img.youtube.com/vi/<ID>/hqdefault.jpg
    ligação   → https://www.youtube.com/watch?v=<ID>
    embed     → https://www.youtube.com/embed/<ID>?autoplay=1&rel=0

Não se acrescentou nenhum outro fornecedor de vídeo: o projeto usa YouTube, e
alargar a lista sem necessidade é alargar a superfície.

## Cada cartão de vídeo é uma ligação a sério

O cartão passou de `<div>` a `<a href="https://www.youtube.com/watch?v=<ID>"
target="_blank" rel="noopener noreferrer">`. Sem JavaScript o vídeo abre no
YouTube; com JavaScript o clique é interceptado e abre-se o modal — o mesmo
padrão do "Ler mais" da equipa principal. **Não há `<iframe>` dentro da
região**: o único da página é o do modal, escondido, e recebe o `src` no
momento em que o modal abre e perde-o quando fecha. O `title` do `iframe` passa
a ser o título real do vídeo, escapado, em vez de um "Vídeo" genérico.

## O campo `ativo`, sem migração

`db_galeria` e `db_videos` passam a ter `ativo`. **Campo ausente = ativo**:
nenhum registo existente foi reescrito, nenhum desapareceu, e não houve
migração. Um registo inativo não aparece em sítio nenhum público — nem na
página inicial, nem na galeria completa, nem na página de vídeos, nem nos
filtros.

## Privacidade

A galeria pode ter fotografias de atletas e de menores. **Não se criou nenhum
campo pessoal**: nem identificação de atletas, nem data de nascimento, nem
contactos, nem etiquetas de pessoas. Os títulos e as descrições continuam a ser
escritos à mão no painel, e o que é publicado é exactamente o que lá está.

O que se acrescentou é **editorial**: um aviso curto junto aos campos de título
e descrição, a pedir que não se incluam nomes nem outros dados pessoais de
menores sem autorização adequada. É um aviso, não uma validação — a decisão
continua a ser de quem escreve. A página **não** leva `noindex`.

## Ordenação

A ordem publicada é a ordem do array, que é a ordem de criação (com a mais
recente à frente, porque o painel faz `unshift`). Não se ordenou por data, não
se criou campo de ordem, nem arrastar, nem setas. **Ordenação administrável
fica registada como melhoria futura**, não construída.

## Categorias

Nenhuma categoria nova e nenhuma eliminada. Os ícones por categoria — Jogo,
Treino, Conquista, Evento — estavam em três sítios e passam a estar num só,
no `jsc_galeria()`. Uma categoria sem nada publicável **não produz botão de
filtro**: a lista de filtros sai dos dados, não de uma lista fixa.

## Tratamento de cada caso

| Situação | O que acontece |
|---|---|
| Fotografia sem título | Descartada — sem título não há texto alternativo, legenda nem nome acessível |
| Fotografia sem endereço | Fica o cartão de categoria, com o ícone; não se inventa imagem |
| Endereço recusado (`javascript:`, `data:` não-imagem) | Tratado como sem endereço |
| `imgPos` / `imgSize` vazios | `center` e `cover` |
| Vídeo sem título | Não publicado |
| Vídeo sem id de YouTube válido | Não publicado — sem cartão sem miniatura e sem `iframe` vazio |
| Registo com `ativo: false` | Não aparece em lado nenhum público |
| Registo sem o campo `ativo` | Publicado |
| Base de fotografias vazia | A secção da página inicial desaparece; a `galeria.html` mostra o estado vazio |
| Base de vídeos vazia | A `videos.html` mostra o estado vazio |
| Uma só categoria | Sem barra de filtros |

## Acessibilidade da caixa de luz e do modal

As duas continuam a ser melhoria progressiva, e ganharam o que lhes faltava:
`display: flex` a sério; foco preso dentro da caixa enquanto está aberta;
**foco devolvido** ao cartão que a abriu; `Enter` e espaço a abrir, com o
espaço a não deslizar a página; `Escape` a fechar; anterior e seguinte; e um
nome acessível em cada cartão (`Abrir foto: <título>`).

## Guardas de regressão

Nove verificações. As `galeria-base:` e `videos-base:` olham **só** para dentro
das regiões, antes de qualquer geração, e exigem que lá esteja apenas o
esqueleto legítimo: sem cartão escrito à mão, sem esqueleto de carregamento,
sem `<iframe>`, sem ligação externa, e com o estado vazio como único texto. As
`fonte única:` varrem o código público **sem comentários** e exigem que não
exista nenhuma fotografia fictícia, que o `_escHtml` duplicado não volte, e que
a extração do id do YouTube continue centralizada.

Provadas ao contrário: com a legenda do Sub-19 de volta na região do
`index.html`, um `skeleton` de volta na `galeria.html`, um cartão de vídeo e um
`<iframe>` escritos à mão na `videos.html`, e os `_escHtml`/`_yt` duplicados de
volta nos dois guiões, **as nove falham** — nomeando os ficheiros — e as outras
763 continuam a passar.

## Como se verificou

`node tools/testar-sem-js.js` — **772 verificações**. Deste bloco: 11 registos
de galeria a dar as fotografias certas (sem título e inativa descartadas);
endereço com `'` e `( )` percent-encoded **e a resolver no browser**;
`javascript:` e `data:text/html` tratados como sem endereço; `imgPos` e
`imgSize` respeitados na página inicial **e** na `galeria.html`; título com
`&` e `<b>` a aparecer **como texto**; 9 registos de vídeo a dar os que têm
título e id válido, com as quatro formas de endereço a produzirem o mesmo id;
cada cartão de vídeo uma ligação real para `watch?v=<ID>`; **nenhum `<iframe>`
dentro da região**; o `title` do `iframe` com o título real ao abrir e o `src`
limpo ao fechar; base vazia com a secção da página inicial **ausente por
inteiro** e as duas páginas com o estado vazio; **as sete larguras** (320, 375,
390, 430, 768, 1024, 1440) nas três zonas sem transbordo; blocos gerados não
redesenhados pelo JavaScript e `data-itens` errado a forçar o redesenho para o
**mesmo** resultado; caixa de luz e modal com `Enter`, espaço, `Escape`, foco
preso e foco devolvido; `/modelos/galeria-inicio.php`,
`/modelos/galeria-pagina.php` e `/modelos/videos.php` → **403**; o exterior às
**cinco** regiões do `index.html` igual byte a byte; o reverter a nomear e devolver as
oito páginas.

Do painel: fotografia e vídeo com a caixa de publicação e o selo "Não
publicada"/"Não publicado"; o aviso editorial junto ao título e à descrição da
fotografia; o limite do carregamento a dizer **5MB**, que é o que o código
aplica; um endereço que não é do YouTube **recusado ao gravar**.

`node tools/validar.js --comparar` — sem problemas em 168 combinações,
**novos: 0** (e 2 resolvidos, de blocos anteriores).

Fase A reverificada ponta-a-ponta, com perfis de teste numa cópia do projeto e
credenciais descartáveis que nunca entraram no repositório: `400` a um GET ao
`auth.php`, `400` a entrar sem o cabeçalho do painel, `401` com password
errada, `401` a escrever sem sessão, `405` a um GET ao `save.php`, `200` para a
Comunicação a alterar `galeria` e `videos`, **`403` para a Comunicação a
alterar `atletas`**, e **`403` para o Matchday a alterar `galeria` ou `videos`**
— o perfil entra e não tem nenhuma das duas áreas. O `conteudo.php` continua
sem escrever: nenhuma escrita provocada por GET público.

---

# FASE C — BLOCO 8: HISTÓRICO

Duas regiões, uma fonte. A cronologia e o palmarés passam a ser escritos no
servidor a partir do `db_historia` e do `db_palmares`. Saíram **dois "A
carregar…" permanentes**, **três cópias completas** dos 38 factos históricos, e
**uma faixa de quatro números sem fonte nenhuma**.

Nenhum facto histórico foi perdido. Os três que mudaram, mudaram por
confirmação do responsável do clube, e estão nomeados abaixo.

## O pior caso da Fase C inteira

Sem JavaScript, a página de História mostrava isto:

    <div class="timeline" id="historiaTimeline">
      <p ...>A carregar...</p>
    </div>

E o mesmo no palmarés. **22 marcos de 1947 a 2026 e 16 títulos ficavam
invisíveis**, atrás de uma promessa que nunca se cumpria. Era o único conteúdo
público que continuava a depender inteiramente do JavaScript.

## Três cópias dos mesmos 38 factos

A cronologia e o palmarés estavam escritos, por inteiro, em **três** ficheiros:
`js/historia.js` (`DEFAULT_TIMELINE`/`DEFAULT_PALMARES`), `admin/js/admin.js`
(`HISTORIA_SEED`/`PALMARES_SEED`) e `js/pesquisa.js`
(`DEFAULT_HISTORIA`/`DEFAULT_PALMARES`). Comparei-as campo a campo antes de
tocar em nada: **ano, título e descrição eram idênticos nas três**. Não havia
contradição — havia três sítios para manter um facto, e dois deles serviam de
fallback quando a base estava vazia.

Saíram as três. A semente única passou para `admin/js/data.js`, ao lado dos
escalões, das modalidades e da época dos seniores — onde a configuração
verdadeira do clube já vive. **A semente foi gerada a partir dos dados
existentes por um guião, não reescrita à mão**, precisamente para não alterar
um facto por distração; as duas correcções autorizadas foram aplicadas depois,
e verificadas uma a uma.

## A faixa de quatro números sem fonte

A `historia.html` tinha uma faixa com `1947`, `75+ Anos de História`,
`80+ Títulos Conquistados` e `300+ Atletas Formados`. Os quatro estavam
escritos no HTML, e os **oito ids** que os identificavam — `hStat1Num` a
`hStat4Label` — **não eram escritos por ficheiro nenhum do projeto**. Verifiquei
os oito.

O clube não confirma os 80+ títulos nem os 300+ atletas. A faixa saiu inteira,
e **não foi substituída por números calculados nem por outros números**. Em
particular, não se usou a contagem do palmarés para afirmar que o clube tem 16
títulos.

## 1923: conteúdo de demonstração que sobreviveu a todas as limpezas

Quatro campos do painel sugeriam um **ano de fundação que não é o do clube**:

    admin/index.html  placeholder="Ex: Formando Campeões desde 1923"
    admin/index.html  placeholder="100+"        (rótulo: Anos de história)
    admin/index.html  placeholder="EST. 1923"
    admin/index.html  placeholder="1923"        (rótulo: Ano de fundação)

Um clube de 1923 teria mais de um século — que é exactamente o que o herói da
página afirmava. Os quatro passaram a exemplos neutros, **sem ano e sem
substituir por outro facto**. Pelo mesmo critério, os exemplos que sugeriam
`300+`, `80+` e um título histórico real também deixaram de o fazer: um exemplo
que afirma um facto não é um exemplo.

## Factos alterados, por confirmação do clube

| Antes | Agora | Onde |
|---|---|---|
| `V Torneio Humberto «Laranjeira» Faísca` | `V Torneio Humberto Faísca` | cronologia, 2018 |
| `2.º lugar — subida à Liga 1` | `2.º lugar — subida à 1.ª Divisão Distrital` | palmarés, Juvenis 2025 |
| `Mais de um século a formar campeões` | `Mais de sete décadas a formar campeões` | herói da `historia.html` |
| `80+ Títulos` · `300+ Atletas Formados` | retirados, sem substituição | faixa da `historia.html` |

Cada uma foi aplicada **uma vez**, e o guião abortava se encontrasse a frase
mais ou menos do que uma vez.

## Factos preservados por falta de confirmação

Nada disto foi tocado, reinterpretado ou completado:

- **Boxe (1994)** e **Ténis de Mesa (2012)**, confirmados como factos a manter.
  Não existirem hoje em `db_modalidades` não é motivo para apagar história.
- **O `id 8` em falta** na cronologia. Os ids vão de 1 a 23 sem o 8. Não se
  reconstruiu nem se inventou acontecimento para tapar o buraco.
- **Os totais da Taça de Portugal e das divisões** — "12 participações" e "nove
  épocas na III Divisão" dentro de entradas de 1982 e 1985, quando há
  participações e épocas depois. Ficam como estão.
- **2022 vs 2023** para o título distrital da 2.ª Divisão: cronologia sob 2022,
  palmarés sob 2023. Não se unificou.
- **A numeração V (2018) → IX (2026)** do torneio.
- **1950, 1978 e 2010**, que descrevem décadas presas a um único ano. Não se
  criou campo de período.
- **`Campeão — subida à Liga 1`** no título dos Iniciados de 2023 — é outro
  acontecimento, e a uniformização autorizada era só a dos Juvenis de 2025.
  A divergência de nomenclatura entre os dois fica registada aqui.

Não se consultou nenhuma fonte externa.

## Defeitos corrigidos

**O palmarés estava publicado na ordem errada — agora.** O código ordenava por
ano decrescente só quando havia dados publicados; sem eles devolvia o array, que
começava em 1984 e não em 2026. Sem dados publicados — o estado actual — a
página mostrava a ordem errada, e publicar mudava-a sozinha. A ordem passa a ser
a mesma com e sem dados, nos dois lados.

**Editar qualquer título apagava-lhe o escalão.** O `<select>` tinha 14 opções
fixas e **nenhum** dos 16 títulos usava uma delas: `Seniores`, `Iniciados`,
`Traquinas A`, `Juvenis (Sub-17)`, `Sen. Femininos`, `Equipa` e quatro nomes de
atletas não existiam na lista. Abrir e gravar punha o campo a vazio — em todos
os 16. Passa a ser texto livre, com os valores em uso oferecidos por um
`<datalist>`: sugerir não apaga nada, ao contrário de escolher.

**A observação entrava no painel sem escape.** Era o único furo:
`' … · ' + t.observacao + '</span>'` dentro de `innerHTML`. A versão pública já
escapava. Corrigido.

**Uma imagem recusada produzia `src=""`.** `item.imagem ? <img src="${jscEscUrl(...)}">` —
um `javascript:` é truthy, o escapador devolve vazio, e fica `src=""`, que em
vários browsers reemite o pedido do próprio documento. Endereço recusado passa a
contar como ausência: o marco sai sem `<img>`.

**Nenhum refresco depois de publicar.** A História era a única zona sem
`jsc:synced` e sem `jscBlocoAtual()`.

**A imagem do marco repetia o título.** O `alt` era o próprio título, que
aparece no `<h3>` logo abaixo: um leitor de ecrã lia a mesma frase duas vezes.
A imagem é decorativa — `alt=""` e `aria-hidden="true"`.

## Ordenação estável, e porque é que isso é preciso

A cronologia sai por ano **crescente**, o palmarés por ano **decrescente**. Nos
dois casos o desempate entre anos repetidos é o **índice de entrada**, e não a
ordem que a linguagem der.

Isto não é zelo: o `usort()` do PHP **só é estável desde o 8.0**, e o alojamento
de `campinense.pt` corre **PHP 7.4**. O `Array.prototype.sort()` do JavaScript é
estável desde o ES2019. Sem o índice como critério, três títulos de 2025
podiam sair numa ordem em 7.4, noutra em 8.3, e noutra no JavaScript — e a
comparação byte a byte entre o bloco gerado e o redesenhado acusava a diferença.
A paridade foi provada com os 16 anos reais do palmarés, nos dois sentidos.

## O campo `ativo`, sem migração

`db_historia` e `db_palmares` passam a ter `ativo`. **Campo ausente = ativo**:
nenhum registo foi reescrito, nenhum desapareceu, e não houve migração. Um
registo inativo não aparece na página de História **nem na pesquisa**. No painel
há um interruptor por linha e uma caixa em cada modal, marcada por omissão.

A regra do "está publicado?" existia em três funções iguais
(`jsc_media_ativo`, `jscMediaAtivo`, e a das modalidades). Passa a viver numa
só, `jsc_ativo()` / `jscAtivo()`, e a do Bloco 7 delega — comportamento
idêntico, provado em dez casos, sem duas cópias da mesma regra.

## O ano de fundação: uma fonte administrável

`dados_clube.ano` era administrável e **nunca publicado em sítio nenhum** —
verifiquei `site-config.js`, `seo.js`, todos os modelos e `conteudo.php`. Passa
a alimentar o `foundingDate` do JSON-LD, que tinha `'1947'` escrito à mão. **Com
o campo vazio não há `foundingDate`**: 1947 não volta como valor por omissão,
porque uma data estruturada errada é pior do que uma ausente — os motores de
busca citam-na como se fosse do clube.

**O que fica em aberto, e está fora deste bloco:** a `historia.html` continua a
ter `1947` escrito à mão em três sítios de prosa — o herói ("Desde 1947"), a
intro ("fundado a 12 de dezembro de 1947") e o selo ("Est. 1947") — e a página
inicial tem o ano dentro de duas frases administráveis
(`siteConfig.heroTag`, `siteConfig.aboutEst`). Fechar isto exigia uma terceira
região na `historia.html`, que não foi autorizada, e a data completa de fundação
não cabe num campo que só guarda o ano. Fica registado, não resolvido.

## Fora deste bloco, por decisão

Os **cinco parágrafos** de `index.html #aboutMore` continuam escritos no HTML,
com `style="display:none"` e um `onclick` inline: sem JavaScript o botão "Ler
mais" é um controlo morto e os cinco parágrafos — que contêm afirmações
históricas sobre a Taça de Portugal, os campeonatos nacionais e o futebol
feminino — são inalcançáveis. Foi decidido deixar como está e apenas documentar.

## Os dois números também saíram da página inicial

A decisão foi depois confirmada para a página inicial: `300+ Atletas` e
`80+ Títulos` saem também da faixa do herói, enquanto não houver fonte
confirmada. Não foram substituídos por outros números, o total de títulos **não**
é calculado a partir do palmarés, e não se inventou número de atletas.

A faixa é administrável via `siteConfig`, e por isso os dois números podiam
voltar por quatro caminhos. Fecharam-se os quatro:

1. **Escritos no HTML** — saíram do `index.html`.
2. **Escritos em JavaScript** — não existem no `js/main.js` nem no
   `js/site-config.js`.
3. **Como valor por omissão do `siteConfig`** — os `SITE_DEFAULTS` do painel
   tinham `stat1Num: '300+'` e `stat4Num: '80+'`. Isso não era só o que o painel
   mostrava: era o que ele **enviava ao publicar**. Passaram a vazio.
4. **Na semente** — o `admin/js/data.js` não tem `siteConfig`, e continua sem.

**O lugar fica, e continua administrável.** Apagar os dois `.stat` do HTML teria
deixado quatro campos do painel a escrever em elementos inexistentes — o mesmo
defeito dos oito ids `hStat*` que este bloco veio corrigir. Em vez disso os dois
lugares ficam no HTML **vazios e com `hidden`**, e uma regra única no
`js/site-config.js` esconde qualquer estatística sem número e mostra qualquer
uma que o tenha. Sem JavaScript vale o `hidden` do HTML, e não aparece cartão
vazio; basta guardar um valor no painel para o lugar voltar.

Os dois que não estavam abrangidos pela decisão — `6 Escalões` e `75+ Anos de
história` — ficaram exactamente como estavam.

Sete guardas novas medem os quatro caminhos e o resultado no browser, com e sem
JavaScript. Provadas ao contrário: com os dois números de volta no HTML, de volta
nos valores por omissão do painel, e a regra de esconder desfeita, **as 11
verificações falham** — nomeando `index.html` e `admin/js/admin.js` — e as outras
879 continuam a passar. Os três ficheiros foram depois confirmados
**byte-idênticos** aos backups.

As **três referências factuais a 1947** da `historia.html` ficaram como estão,
como decidido. Não se criou terceira região nem campo novo.

## Acessibilidade

O que já estava certo e não se mexeu: um `h1`, um `h2` por secção, um `h3` por
marco; a ordem de leitura é a ordem cronológica do DOM; o ano não é lido duas
vezes (o `.timeline-card__year-mobile` é `display:none` por omissão e só aparece
≤768px, onde o `.timeline-year-wrap` passa a `display:none`); o contraste do ano
em destaque já foi resolvido na Fase B; o `@media print` e o
`prefers-reduced-motion` já desligavam a revelação; e o CSS sozinho nunca
esconde — o estado invisível existe só com `html.jsc-anima`, marca que o
JavaScript põe.

O que mudou: a imagem do marco é decorativa, e as duas zonas passam a existir
sem JavaScript.

## Guardas de regressão

Vinte e quatro verificações. As `historia-base:` e `palmares-base:` olham **só**
para dentro das regiões, antes de qualquer geração, e exigem que lá esteja
apenas o contentor com o estado vazio: sem marco nem título escrito à mão, sem
"A carregar", e com o texto do estado vazio como único texto. As `fonte única:`
varrem o código público **sem comentários** e exigem que as três cópias não
voltem, que nenhum marco exista em código público, que a semente esteja no
`admin/js/data.js`, e que a regra do `ativo` continue a viver num sítio só. As
`admin-base:` exigem que 1923 não volte a nenhum exemplo e que nenhum exemplo
sugira um número não confirmado. E as do painel exigem que o Boxe de 1994, o
Ténis de Mesa de 2012 e a ausência do `id 8` continuem exactamente como estão.

Provadas ao contrário: com o "A carregar" e um marco de volta na região, a faixa
de estatísticas e o "Mais de um século" de volta, o 1923 de volta em dois
exemplos, duas das três cópias de volta, o `1947` de volta no JSON-LD, a semente
fora do `data.js`, o `<select>` fechado de volta e o escape da observação
outra vez em falta — **as 24 falham**, nomeando os ficheiros — e as outras 848
continuam a passar. Os sete ficheiros foram depois confirmados **byte-idênticos**
aos backups.

## Como se verificou

`node tools/testar-sem-js.js` — **872 verificações**. Deste bloco: 11 marcos de
14 registos e 8 títulos de 10 (inativos, sem título e sem competição
descartados); ordem crescente na cronologia e **decrescente** no palmarés, nos
dois casos igual com e sem JavaScript; **dois marcos e dois títulos do mesmo ano
mantêm a ordem do array**; os registos sem ano utilizável ficam no fim, sem
elemento de ano; marco mínimo só com ano e título; descrição vazia não produz
parágrafo; escalão vazio não produz etiqueta; título com `&` e `<b>` e
observação com `&` e `<i>` a aparecerem **como texto**; imagem com apóstrofo e
parêntesis a resolver **no browser**; `javascript:` e `data:text/html` a saírem
**sem `<img>`** e **nenhuma imagem com `src=""`**; `ativo` ausente publicado e
`ativo:false` ausente da página e da pesquisa; escalão `Traquinas A`,
`Sen. Femininos` e um nome de atleta preservados; o bloco gerado e atual não
redesenhado, e um `data-itens` errado a forçar o redesenho para o **mesmo**
resultado, byte a byte; **na impressão e com `prefers-reduced-motion` nada fica
invisível**; **as sete larguras** (320, 375, 390, 430, 768, 1024, 1440) sem
transbordo; base vazia e tudo inativo com os dois estados vazios e **nenhum dos
38 factos de volta**; `/modelos/historia-cronologia.php` e
`/modelos/historia-palmares.php` → **403**; o reverter a nomear e devolver as
**nove** páginas.

Do painel: a semente vem do `DB` e tem 22 marcos e 16 títulos; a designação do
torneio uniformizada; os Juvenis de 2025 com "1.ª Divisão Distrital"; o Boxe de
1994 e o Ténis de Mesa de 2012 preservados; nenhum acontecimento inventado para
o `id 8`; caixa de publicado marcada por omissão nos dois modais; o escalão é um
`<input>`, e abrir um título com `Traquinas A` **devolve `Traquinas A`**.

`node tools/validar.js --comparar` — sem problemas em 168 combinações,
**novos: 0**.

Fase A reverificada ponta-a-ponta, com perfis de teste numa cópia do projeto e
credenciais descartáveis que nunca entraram no repositório: `400` a um GET ao
`auth.php`, `400` sem o cabeçalho do painel, `401` com password errada, `401` a
escrever sem sessão, `405` a um GET ao `save.php`, `200` para a Comunicação a
alterar `historia` e `palmares`, **`403` para a Comunicação a alterar
`atletas`**, e **`403` para o Futebol a alterar `historia` ou `palmares`** — a
área é `institucional`, que aquele perfil não tem. O `conteudo.php` continua sem
escrever: nenhuma escrita provocada por GET público.

---

# FASE C — BLOCO 9: INSTITUCIONAL / SEO

O rodapé institucional, os dados estruturados e o sitemap passam a ser escritos
no servidor a partir de duas fontes únicas: `dados_clube` para a identidade e
`siteConfig` para os contactos. Corrigiram-se os oito defeitos de segurança da
auditoria, e o pior deles estava a correr.

## O que estava mal, medido

**O título de SEO do painel sobrescrevia as 16 páginas.** O `js/site-config.js`
aplicava `cfg.seoTitle` a `document.title` e `cfg.seoDesc` à meta description
**sem âmbito nenhum**, e carrega em 16 páginas. Medido: com os dois campos
preenchidos, a História, as Notícias, o Contacto e a Formação ficavam **todas**
com o mesmo título e a mesma descrição. Dois campos do painel colapsavam 16
títulos distintos num só — o pior caso possível de conteúdo duplicado, e os
motores de busca executam JavaScript.

**A morada aparecia com `<br />` como texto.** O valor por omissão tem um `<br>`
entre a rua e o código postal; a página de contacto usava `innerHTML`, o rodapé
usava `textContent`. Medido: o rodapé de 17 páginas mostrava a etiqueta.

**54 ligações sociais mortas.** `href="#"` em 16 páginas, e não existem
endereços por omissão: sem configuração eram 54 botões que não iam a lado
nenhum, e sem JavaScript nunca funcionavam.

**O nome oficial do clube era editável e nunca publicado.** `dados_clube.nome`,
`.sigla` e `.estadio`: três dos sete campos não chegavam a sítio nenhum.
Medido: mudar o nome no painel não mexia no `<title>` nem no JSON-LD.

**O ano do copyright estava escrito à mão em 17 páginas** — 16 diziam 2026, a
`atleta.html` dizia **2024**, e ninguém o actualizava.

**Os dados estruturados existiam só com JavaScript**, e 14 das suas 15
propriedades estavam escritas à mão. Sem `sameAs`, sem `email`, com a morada e o
telefone a divergirem do painel.

**`og:url` não existia em nenhuma das 20 páginas.**

**O `sitemap.xml` tinha `lastmod` 2026-07-01 nas 14 entradas** — igual e com três
meses de atraso — e incluía a página de pesquisa.

**`/AUDITORIA.md` era servido inteiro**: 118 835 bytes que nomeiam, ficheiro a
ficheiro, cada defeito conhecido do projeto, incluindo os que ainda não estavam
corrigidos. E `/scraper/` não tinha `.htaccess`.

## Os oito defeitos de segurança, e o que se mediu de cada um

Todos em `js/site-config.js`, com um em `js/main.js`. O ficheiro nunca foi um
bloco da Fase C, e é por isso que as correcções dos Blocos 5, 6 e 7 não lhe
chegaram — o `js/main.js` usa `jscEscUrlCss` corretamente em seis sítios, e este
usava interpolação crua.

| # | Campo | O que acontecia | Medido |
|---|---|---|---|
| S1 | `heroTitle` | `innerHTML` sem filtro | **o `<img onerror>` correu** |
| S2 | `contactAddress` | idem | mesmo caminho |
| S3 | `heroBtn1Url`/`heroBtn2Url` | `href` sem política | `javascript:` no href, a correr ao clique |
| S4 | redes sociais (×6 por página) | idem | `javascript:` no href |
| S5 | `heroOverlay` | cru dentro de `rgba()` | **injecção de CSS confirmada**: `0.5),rgb(0,0,255` acrescentou paradas de cor ao gradiente |
| S6 | `heroImagem` | cru em `url('…')` | um apóstrofo num nome de ficheiro legítimo **anulava a declaração** e o herói perdia a imagem |
| S7 | slideshow do herói (`js/main.js`) | idem, com imagens de notícias | mesmo defeito |
| S8 | `heroImgPos` | cru em `backgroundPosition` | sem injecção; valor inválido degradava para `0% 0%` |

**Como se corrigiram.** O filtro a sério é no **servidor**, antes de gravar, como
já acontecia com os textos legais: nasceu o `jsc_sanitizar_inline()`, com uma
lista estreita — `br`, `span`, `strong`, `em`, `b`, `i` e **nenhum atributo** —
sem duplicar o percorrer da árvore do `jsc_sanitizar_html()`, que passou a
aceitar as listas como parâmetro. O comportamento dos textos legais foi verificado
inalterado.

No browser ficam quatro ajudantes novos em `js/html.js`: `jscHrefSeguro()`
(réplica exacta do `jsc_href_seguro()`, **provada em 26 casos** — 15 recusados),
`jscHtmlSeguro()` (mesma lista do PHP, via `<template>`, que não executa nada do
que analisa), `jscOpacidade()` e `jscPosicaoFundo()`. As imagens de CSS passam
pelo `jscUrlCss()` que o Bloco 6 criou.

## Fontes únicas

| Tipo | Fonte |
|---|---|
| Identidade: nome, sigla, ano, logótipo | **`dados_clube`** |
| Contactos: morada, telefone, e-mail, redes | **`siteConfig`** |
| Texto legal | **`siteLegal`** *(já era)* |
| SEO por página | **o HTML de cada página** — um campo global não serve 20 páginas |
| Dados estruturados | **derivados** das duas primeiras |
| Endereço oficial do site | **`JSC_SITE_URL`**, um sítio só |

A identidade do clube passou a ter semente em `admin/js/data.js`, ao lado dos
escalões, das modalidades e da história. Os quatro valores são **exactamente os
que o site já publicava**, escritos à mão em 17 páginas e no `js/seo.js`: nada foi
inventado. O **ano de fundação arranca vazio**, de propósito — a decisão do Bloco
8 foi que um campo vazio não inventa 1947, e enquanto ninguém o escrever no
painel os dados estruturados saem sem `foundingDate`.

## As três regiões do rodapé, e porque são estreitas

O rodapé está copiado em 17 páginas e **não é igual nas 17**: a lista "Links
rápidos" muda de página para página. Envolver o rodapé inteiro obrigaria o modelo
a reproduzir essas diferenças, e um modelo que tem de saber em que página está é
saída parametrizada — E2. As regiões cercam por isso **só os valores
institucionais**: as ligações de dentro do `.footer__social` (16 páginas), as três
linhas de dentro do `.footer__contact` (15), e o `<p>` de dentro do
`.footer__bottom` (17). São 48 entradas, geradas por ciclo e não escritas à mão.

Os dados estruturados vão dentro da terceira. Um `<script type="application/
ld+json">` é conteúdo de fluxo e vale em qualquer parte do documento; fica ali
porque é a região que existe em todas as páginas e porque os dados são os mesmos
— um `<head>` gerado por página exigiria E2.

## Campo vazio não produz nada

Sem endereço, o botão de rede social **não é escrito** — e nunca `href="#"`. Sem
morada, telefone ou e-mail, a linha não existe. Sem nome guardado, a linha de
direitos fica sem nome em vez de inventar um. E **nenhuma propriedade vazia entra
no JSON-LD**: uma morada incompleta ou um `sameAs` vazio nos dados estruturados é
pior do que a ausência, porque os motores de busca citam-nos como se fossem do
clube.

## Sitemap e robots

O `sitemap.xml` passa a ser gerado, com o `lastmod` da publicação. As marcas
ficam **dentro** do `<urlset>`: a declaração XML tem de ser a primeiríssima coisa
do documento, e um comentário antes dela torna o XML inválido.

**13 entradas.** Fora ficam, e cada ausência tem a razão escrita ao lado em
`jsc_sitemap_paginas()`: `admin/`, `api/`, `modelos/`, manutenção, offline, 404,
fichas de atleta, **a pesquisa** — que passou a ter `noindex, follow`, porque
resultados de pesquisa interna são combinações do que já está indexado — e
**`modalidade.html` e `escalao.html`**, que só existem preenchidas por parâmetro
e cujo canonical aponta para a página base, a qual sem parâmetro mostra "não
encontrada". Listar um endereço que mostra um estado de erro é pior do que não o
listar.

O `robots.txt` cobre `/admin/`, `/api/`, `/scraper/`, `/AUDITORIA.md`,
manutenção e offline, e **não** bloqueia a pesquisa — o motor precisa de poder
lê-la para ver o `noindex`. O `.htaccess` acrescentou `.md` à lista de extensões
bloqueadas e fechou `/scraper/`: **é o Apache que impede, e o robots.txt que
pede.** Verificado: `/AUDITORIA.md` e `/scraper/*` respondem **403**, e o
`manifest.json`, o `robots.txt` e o `sitemap.xml` continuam a **200**.

## Estratégia de indexação mantida

Os canonicals das páginas parametrizadas continuam a apontar para a página base:
notícias, modalidades e escalões **não passam a ser indexáveis individualmente**
neste bloco. SEO por entidade exige um `<head>` parametrizado, que é E2, e fica
registado para depois.

## Dois enganos meus, e o que ficou no lugar deles

**O `?>` dentro de um comentário fecha o bloco PHP.** O comentário do modelo do
sitemap citava a declaração XML, e tudo o que vinha depois era emitido como
texto — o sitemap saía com o comentário lá dentro. A guarda do `lastmod` apanhou.

**O `extract($vars, EXTR_SKIP)` não sobrepõe.** O `jsc_gerar_bloco()` tem
`$nome` no seu âmbito — é o nome do bloco — e o modelo pedia `$nome` para o nome
do clube. Resultado: o rodapé saiu com **"© 2026 rodape-base@index.html"**.
Renomeado para `$clubeNome`, e nasceu uma guarda nova: nenhuma chave passada aos
modelos pode colidir com as variáveis do motor.

**E um teste meu rebentava em vez de falhar.** Ao provar as guardas ao contrário,
uma asserção lia `jsonld[0].name` num array vazio e atirava um `TypeError`, que
esconde todas as verificações seguintes. Passou a ler um objecto que existe
sempre. Um teste que rebenta não é um teste que falha.

## O rollback passou de 9 para 19 alvos

A transação cobre agora 18 ficheiros com regiões mais o `data/db.json`. A
atomicidade com este número nunca tinha sido exercitada: o teste rabisca **todos**
e exige que **todos** voltem, com as suas regiões de pé e o sitemap ainda XML
válido. Passa. Não foi preciso enfraquecer nada.

## Acessibilidade

Já estava certo e não se mexeu: `lang="pt-PT"`, charset e viewport nas 20
páginas; `skip-link` nas 20; um `header`/`nav`/`main`/`footer` por página; um
`h1` por página; zero imagens sem `alt`. O que mudou: as redes sociais deixam de
ser ligações mortas, e as que existem levam `aria-label`, `target="_blank"` e
`rel="noopener noreferrer"` — verificado no bloco gerado.

## O que fica em aberto, e porquê

- **A `historia.html` tem `1947` escrito à mão em três sítios de prosa** — o
  herói, a intro (com a data completa, que um campo de ano não sabe guardar) e o
  selo. Fechar isto exigia uma terceira região naquela página, que não foi
  autorizada. Decisão tomada: manter como está.
- **O logótipo da página inicial aponta para `#`** e o botão do popup também.
  Não são ligações sociais, não estavam em nenhuma decisão aprovada, e ficaram.
- **SEO por entidade** (notícias, modalidades, escalões): E2.
- **Direção, órgãos sociais, NIF e instalações**: não existem no projeto. Não se
  criaram campos nem se inventou informação.

## Guardas de regressão

Provadas ao contrário com **nove regressões** reintroduzidas de uma vez: o
`seoTitle` a contaminar todas as páginas, o `innerHTML` sem filtro, o `href` sem
política, as redes de volta a `href="#"`, a imagem e a opacidade do herói cruas,
o `1947` escrito à mão no JSON-LD, os escalões de volta a 6, o `og:url` fora, o
`robots.txt` sem o scraper, e o Apache a servir o `.md` e o `scraper/`.

**74 verificações falharam** — entre elas as 12 que exigem que cada página
mantenha o seu título, o `<img onerror>` a correr, os dois 403 do Apache, e o
caso da base vazia — e as outras 997 continuaram a passar. Os oito ficheiros
foram depois confirmados **byte-idênticos** aos backups.

## Como se verificou

`node tools/testar-sem-js.js` — **1034 verificações** (890 antes). Deste bloco: o
rodapé com os contactos da fonte única e a morada com o `<br>` a valer como salto
de linha e **não** como texto; o ano da publicação e o nome do clube com o `&` e
o `<b>` escapados; **nenhuma página a dizer 2024**; só as redes com endereço
válido escritas, a de `javascript:` recusada, com `rel` e nome acessível;
**JSON-LD presente SEM JavaScript**, dois schemas, sem propriedade vazia em
nenhum nível, com `name`, `alternateName`, `foundingDate`, `address` partida em
rua e código postal, `contactPoint` e `sameAs` só com as válidas; com JavaScript
**os mesmos dois, sem duplicar**; o `<img onerror>` do título do herói a **não
correr**, mantendo o `<br>` e o `<span>` permitidos; o `javascript:` do botão do
herói recusado e o endereço válido a passar; a imagem do herói com apóstrofo e
parêntesis **a resolver no browser**; o `heroOverlay` fora de formato a **não**
injectar CSS; **12 páginas a manterem o seu título e a sua descrição** com o
`seoTitle` da inicial preenchido; `og:url` igual ao canonical e um `h1` em sete
páginas; a pesquisa com `noindex, follow`; os escalões a dizerem **8**; as duas
datas do texto legal fora; o sitemap com 13 entradas, um só `lastmod`, e sem
nada do que não deve entrar; o `robots.txt` a cobrir o scraper e a documentação
interna; base institucional vazia sem botões, sem linhas de contacto e sem
propriedades vazias, com e sem JavaScript; **as sete larguras** (320, 375, 390,
430, 768, 1024, 1440) com o rodapé gerado e sem transbordo; os quatro modelos
novos, o `/AUDITORIA.md` e o `/scraper/` → **403**, com o `manifest.json` ainda a
200; o exterior às regiões igual byte a byte em **18** ficheiros; e o reverter a
devolver os **19 alvos**.

`node tools/validar.js --comparar` — sem problemas em 168 combinações,
**novos: 0**.

Fase A reverificada ponta-a-ponta numa cópia do projeto, com três perfis de teste
e credenciais descartáveis que nunca entraram no repositório: `400` a um GET ao
`auth.php`, `400` sem o cabeçalho do painel, `401` com password errada, `401` a
escrever sem sessão, `405` a um GET ao `save.php`; **`200` para a Comunicação a
alterar `dadosClube` e `siteLegal`** e **`403` a alterar `siteConfig`** — são
capacidades diferentes, `institucional` e `configuracoes`; `200` para o
Administrador a alterar `siteConfig`; **`403` para o Matchday nas duas**; o
`<img onerror>` e o `<script>` filtrados **ao gravar**, com o `<br>` e o `<span>`
preservados; e o `conteudo.php` continua sem escrever.

Uma nota sobre o método: a primeira versão deste guião corria sobre uma cópia
dentro da pasta privada da sessão, a `0700`, onde o Apache — que corre como
`www-data` — responde 403 a **todos** os ficheiros estáticos. Os 403 do
`AUDITORIA.md` e do `scraper/` passavam pela razão errada. A cópia passou para
um sítio alcançável, e só então as asserções mediram o que dizem medir.

# FASE C — BLOCO 10: NOTÍCIA INDIVIDUAL (E2 — MINI-PILOTO)

O primeiro conteúdo do projeto gerado **ao pedido**, e não na publicação. O
`noticias.html?id=N` passa a ser respondido pelo `api/noticia.php`, por reescrita
interna do Apache: o endereço público não muda, o visitante continua a ver
`noticias.html?id=N`, e o artigo, o `<head>` e os dados estruturados dessa notícia
vão no HTML que o servidor entrega.

O âmbito é um só: a notícia individual. Nada mais passou a ser gerado ao pedido.

## O que estava mal, medido

**Uma notícia só existia com JavaScript.** O artigo era desenhado pelo
`showArticle()` do `js/noticias.js` a partir do `localStorage`. Sem JavaScript,
`noticias.html?id=1001` respondia **200 com a lista inteira** e o artigo nunca
aparecia. O contentor `#notArticle` ficava vazio e escondido.

**As 21 notícias tinham um só título e uma só descrição.** O `<head>` era o da
lista: `<title>Notícias – …</title>`, a mesma `description`, o mesmo `og:title`,
o mesmo `og:image` (o logótipo), e o canonical a apontar sempre para
`/noticias.html`. Medido: cada artigo partilhado no WhatsApp ou no Facebook
mostrava o cartão da página de notícias, não o da notícia. E para os motores de
busca, os 21 endereços eram **uma página só**.

**Um id inventado respondia 200.** `noticias.html?id=999999` devolvia a lista
com estado 200 — um endereço indexável, infinitamente multiplicável, a mostrar
sempre o mesmo conteúdo.

**O service worker guardava qualquer resposta de documento.** O ramo dos
documentos fazia `c.put(e.request, clone)` **sem olhar ao estado**. Enquanto
todas as páginas eram ficheiros estáticos isso era inofensivo. Com respostas 404
a sério deixava de ser: uma 404 guardada passava a ser servida no lugar da
página, inclusive depois de a notícia ser publicada, e inclusive offline, onde a
resposta guardada é a única que há. É a correcção **J2**.

**A imagem do artigo saía escrita por extenso.** O `showArticle()` fazia
`${jscEsc(topImg)}` e `${jscEsc(midImg)}` — e o `topImg` é marcação, não texto.
Resultado: a etiqueta `<div class="news-article__img" style="…">` aparecia como
texto visível no meio do artigo, em vez da imagem. O endereço da imagem, esse,
estava bem escapado, um nível acima.

**O caminho de volta era um `<button>`.** Sem JavaScript não fazia nada, e era o
único caminho de volta que o artigo oferecia. Os cartões de notícias relacionadas
tinham o mesmo problema: `<div onclick>` sem ligação por dentro.

**O JSON-LD do artigo escrevia propriedades vazias e um nome em constante.**
`headline` com o título que não havia, `datePublished: ''` quando a data faltava,
e `publisher.name` escrito à mão como `'Juventude Sport Campinense'` — o único
sítio do projeto onde o nome do clube voltava a ser uma constante depois de
passar a ter fonte única no Bloco 9.

## A reescrita interna, confirmada no alojamento antes de ser escrita

A arquitectura foi confirmada no alojamento real (`novo.campinense.pt`, cPanel)
**antes** de se implementar: PHP 8.3.33 com SAPI `cgi-fcgi`, `mod_rewrite`
activo, a `RewriteRule` a fazer reescrita interna para um ficheiro PHP
preservando o endereço público, o PHP a receber o `id` e a query completa, e o
ramo de 404 a executar. A regra de teste, temporária e com nome inequívoco, foi
retirada depois.

A regra definitiva, no `.htaccess`:

```
RewriteCond %{QUERY_STRING} (^|&)id=[0-9]+(&|$)
RewriteCond %{QUERY_STRING} !(^|&)preview=
RewriteRule ^noticias\.html$ /api/noticia.php [L,QSA]
```

Três linhas, três decisões. Só actua com um `id` de dígitos — sem `id`, ou com um
`id` que não seja número, a página serve-se estática como sempre. O `?preview=1`
fica **de fora**: a pré-visualização é o rascunho que o painel guarda no
`sessionStorage` do próprio browser, não está publicado, e não pode passar a
existir no servidor. E não há `[R]`: é reescrita, não redirecionamento.

## O canonical nunca sai do REQUEST_URI

Depois da reescrita, `$_SERVER['REQUEST_URI']` diz `/api/noticia.php?id=N`. Foi
medido. Um canonical, um `og:url` ou um `url` de JSON-LD construídos a partir
dele publicariam o endereço interno — e seria o endereço que os motores de busca
guardariam.

Por isso todos eles se montam da `JSC_SITE_URL` mais o `id` **já validado**, e há
uma asserção que exige que nem o canonical, nem o `og:url`, nem o JSON-LD
contenham `api/noticia.php`.

## O id compara-se como texto, nunca com `==`

O `js/noticias.js` faz `_all.find(x => x.id == idParam)`. Em JavaScript o `==`
entre número e texto converte: `'1e3' == 1000` é verdade, e `' 12' == 12` também.

No servidor o id passa primeiro por `jsc_noticia_id_valido()` — `^\d{1,19}$`, só
dígitos, dezenove no máximo porque é o que cabe num inteiro de 64 bits — e só
depois se procura, com comparação de **texto**. Um `?id=1e3` não chega a ser
procurado: a própria `RewriteCond` já não reescreve, e se chegasse seria 404.
`?id[]=1` chega como array e `?id=1&id=abc` chega como `'abc'`; em qualquer dos
casos a resposta é a mesma de um id que não existe.

## As três situações que dão 404, e são a mesma

Notícia que não existe, notícia não publicada, notícia agendada para um momento
que ainda não chegou: **404** nas três, com a mesma página. É deliberado — uma
resposta diferente para a notícia que existe mas não está publicada diria a quem
adivinhasse o número que ela existe.

O filtro é o **mesmo** da lista pública, `jsc_noticias_pagina()`, chamado e não
reescrito: duas cópias do filtro divergem, e a divergência aqui significaria uma
notícia por publicar legível a quem adivinhasse o id. A página pública nunca lê
conteúdo administrativo não publicado, e isso foi medido **com e sem sessão de
Comunicação aberta**: nem o título da notícia não publicada nem o da agendada
para o futuro aparecem no HTML.

O 404 leva `noindex, follow` no HTML **e** no cabeçalho `X-Robots-Tag`, uma
ligação a sério para as notícias, e **nenhum** canonical, `og:` ou JSON-LD: um
canonical numa página de erro manda o motor de busca juntar o erro a outro
endereço, e um `og:title` a dizer "não encontrada" só serve para ser partilhado
por engano.

## Sem lista de notícias não se decide nada

Há uma diferença entre *a lista existe e esta notícia não está lá* — que é 404 —
e *não há lista para consultar*, que é o que acontece quando o `data/db.json`
ainda não foi enviado para o alojamento. No segundo caso serve-se a página como
está, que é o que o visitante receberia sem o E2: responder 404 a todos os
endereços de notícia transformava uma instalação incompleta num site com centenas
de erros indexáveis. Uma lista que existe e está **vazia** é outra coisa, e aí a
resposta certa é 404. As duas situações têm asserção própria.

## Três regiões trocadas ao pedido, duas delas novas

```
JSC:noticia-head      o <head> da notícia: título, descrição, OG, Twitter,
                      canonical e o JSON-LD do artigo
JSC:noticia-artigo    o contentor #notArticle, com o artigo inteiro
JSC:noticias-pagina   a lista, que na vista de artigo fica escondida
```

As duas primeiras são marcas novas na `noticias.html` e **não são regiões do
E1**: o `api/geracao.php` não as conhece, e há uma asserção que o exige. O que
está entre elas no ficheiro publicado é o `<head>` da lista e o contentor vazio e
escondido — e é isso que o visitante recebe quando pede o `noticias.html` sem
`id`. Como ficam **fora** de todas as regiões do E1, estão protegidas pelo hash
do exterior: o gerador não lhes pode tocar. O `<link rel="canonical">` mudou de
lugar no `<head>` para ficar dentro da região, contíguo às outras marcas.

A terceira é a região do E1, e o E2 escreve-lhe **na resposta**, nunca no
ficheiro. A razão é que a vista de artigo mostra o artigo, não a lista: o
`showArticle()` esconde os cinco contentores antes de desenhar, e sem JavaScript
ninguém os esconderia — o visitante receberia o artigo com a lista inteira por
baixo, e com um canonical, um `og:title` e um `<h1>` de artigo numa página que
mostra uma lista. Os cinco contentores ficam lá, vazios e escondidos, porque o
`js/noticias.js` procura-os pelo id; e **sem** `data-gerado` no `#notGrid`, que é
como o JavaScript sabe que a lista não vem servida.

## Paridade PHP ↔ JavaScript, verificada por comparação directa

O servidor e o `js/noticias.js` escrevem o **mesmo HTML** para o mesmo artigo. Não
é uma afirmação: é um teste. Pede-se o artigo duas vezes — uma pelo E2, outra com
`&preview=0`, que faz o `.htaccess` não reescrever e portanto é o JavaScript a
desenhar — e comparam-se os dois `innerHTML`, com a origem normalizada (o
JavaScript usa a origem a sério do browser, o servidor usa o endereço oficial).
Cinco notícias, cinco comparações, mais o JSON-LD de cada uma.

Foi esta comparação que encontrou a última divergência: o botão "Copiar link" dos
cartões gerados levava `jsc-so-com-js` — a classe que o `<noscript>` esconde,
porque precisa do `navigator.clipboard` — e o mesmo botão desenhado pelo
JavaScript não levava. Divergência anterior a este bloco, e corrigida aqui.

Para a paridade existir, acrescentaram-se dois gémeos ao `js/html.js`:
`jscNoticiaImagemPos()` e `jscUrlAbsoluta()`, réplicas de
`jsc_noticia_imagem_pos()` e `jsc_url_absoluta()`.

## O filtro de HTML aplica-se também ao servir

O `api/save.php` filtra o resumo de cada notícia com `jsc_sanitizar_noticia()`
**ao gravar**, desde o commit `ce014d4`. O `api/noticia.php` aplica o **mesmo**
filtro ao servir. Não é redundância cega: as notícias guardadas antes de o filtro existir
nunca foram filtradas, e é este ficheiro que as escreve no HTML do servidor. Para
tudo o que foi gravado depois do filtro não muda nada — é a mesma função, e é
idempotente.

Medido com um resumo que leva `<script>`, `<img src=x onerror>`, um
`href="javascript:"` e um `style="position:fixed"`: nada disso chega ao HTML, o
texto legítimo sobrevive, e o `window.__xss` continua `undefined` com e sem
JavaScript. O `src="x"` do ensaio não existe de propósito — é o que faz o browser
tentar carregá-lo e falhar, que é quando um `onerror` correria —, e há uma
asserção a exigir que esse pedido tenha mesmo sido feito e tenha mesmo falhado.
Sem ela o ensaio podia estar a medir nada.

## Campo vazio não produz propriedade

Notícia sem imagem: **sem** `og:image`, sem `twitter:image`, e o
`twitter:card` volta a `summary` em vez de `summary_large_image`. Um `og:image`
com o logótipo do clube em vez da imagem do artigo é uma partilha que mostra
outra coisa.

Notícia sem texto: **sem** `description`, sem `og:description`, e o JSON-LD sai
sem `description`. A página diz "Sem texto disponível", que é verdade.

Notícia sem título: o `<title>` fica "Notícias" com o nome do clube atrás, e o
JSON-LD sai sem `headline`. Sem nome de clube guardado não se inventa sufixo.

Uma imagem embutida (`data:`) não produz `og:image`: não tem endereço público.

## Falha nenhuma deixa a página em branco

Se o ficheiro não se ler, se uma marca não estiver onde devia, se um modelo não
escrever nada ou escrever um aviso do PHP — serve-se a `noticias.html` tal como
está no disco, que é **exactamente** o que o visitante receberia sem o E2.
Degradação, não erro. Medido: com a marca de fim do artigo estragada e com a
marca de início da cabeça estragada, a resposta é 200 e a página de notícias
continua de pé com os seus cartões.

O `jsc_e2_bloco()` repete as guardas do motor do E1: modelo em falta, excepção,
saída vazia, e as cinco marcas de aviso do PHP (`Fatal error`, `Parse error`,
`Warning:`, `Notice:`, `Deprecated:`).

## A armadilha do `extract()`, outra vez

O `jsc_gerar_bloco()` do E1 faz `extract($vars, EXTR_SKIP)`, e no Bloco 9 isso
fez o rodapé sair com `© 2026 rodape-base@index.html` porque o modelo pedia
`$nome` e o motor tinha uma variável com esse nome no âmbito.

O `jsc_e2_bloco()` faz o mesmo `extract()`. Por isso **todas** as suas variáveis
locais levam prefixo `jscE2`, e há uma guarda que lê o corpo da função e exige
que nenhuma variável sem esse prefixo exista lá dentro — mais outra que exige que
nenhuma chave passada aos modelos comece por `jscE2`.

## O sitemap passa a listar as notícias

21 entradas novas no sitemap de teste, uma por notícia publicada, cada uma com o
**seu** `lastmod` — a data da notícia, não a da publicação que gerou o ficheiro.
As páginas continuam com a data da publicação.

Entram pela mesma lista que o `api/noticia.php` serve com 200, e os ids passam
pela mesma validação: nenhum endereço do sitemap pode responder 404. E não entram
as não publicadas nem as agendadas para o futuro — há asserção pelos dois lados,
a exigir que cada publicada esteja lá uma vez e que as outras não estejam.

A estratégia de indexação do Bloco 9 (H1) mantém-se: as modalidades e os escalões
continuam fora, e a pesquisa continua com `noindex, follow`.

## Só lê

O `api/noticia.php` não tem uma única instrução de escrita, e não requer o
`api/sessao.php` nem o `api/geracao.php` — não entra no caminho de autenticação
nem no de geração. Um `GET` público nunca provoca escrita.

A reescrita do Apache olha para o endereço, não para o método: um `POST` ao
`noticias.html?id=1` chegaria aqui. Responde **405** com `Allow: GET, HEAD`, e o
`HEAD` continua a responder 200. Medido com `POST`, `PUT`, `DELETE` e `PATCH`, e
com o `data/db.json` comparado byte a byte antes e depois.

## Acessibilidade

O caminho de volta passou a ser `<a href="noticias.html">` em vez de `<button>`:
funciona sem JavaScript, recebe foco e tem endereço. Com JavaScript o clique
continua a ser interceptado, para a navegação ser feita pelo `history`.

Cada cartão de notícias relacionadas ganhou uma ligação a sério no título, e o
título do bloco passou de `<h3>` para `<h2>` — o artigo tem o `<h1>`, e um `<h3>`
a seguir saltava um nível. Os `<time>` passaram a levar `datetime`.

Sem categoria não há bloco de relacionadas: antes escrevia-se "Mais em " com o
título a meio, e juntavam-se ao artigo todas as outras notícias sem categoria
como se fossem do mesmo tema.

## O que fica em aberto, e porquê

**Dois `<h1>` na vista de artigo.** O herói da página diz
`<h1 class="page-hero__title">Notícias</h1>`, e está **fora** das duas regiões do
E2. O artigo acrescenta o seu `<h1>`, que é o que os motores de busca devem ler
como título do artigo. Não é uma regressão — com JavaScript já era assim antes
deste bloco —, mas passa a ser visível para quem rastreia. Resolvê-lo exige uma
região no herói, e isso é âmbito de outro bloco.

**`background-size: auto cover`.** Uma notícia da fixture tem `imagemSize` com o
prefixo `auto `, e `auto cover` não é um valor válido de `background-size`: o
browser descarta a declaração. O `jsc_noticias()` da página inicial retira esse
prefixo; o `jsc_noticias_pagina()` não. O servidor e o JavaScript produzem o mesmo
valor, por isso não há divergência — é um defeito de dados anterior a este bloco,
e corrigi-lo é mudar o que a lista mostra, fora do âmbito.

**As notícias antigas não foram migradas.** Nenhum registo foi alterado. O E2 lê
o que está publicado, como está.

**Atleta, modalidade e escalão continuam fora do E2.** O piloto é a notícia
individual, e só.

## Guardas de regressão

Nove, todas a falhar se o que corrigiram voltar: o canonical e o `og:url` a não
conterem `api/noticia.php`; as duas marcas novas a aparecerem exactamente uma vez
e em par; o `api/geracao.php` a **não** as registar como blocos; o conteúdo
estático das duas regiões a continuar a ser o da lista depois de gerar; as
marcas do E2 a voltarem intactas depois de um `--reverter`; o ramo dos documentos
do `sw.js` a verificar o estado antes de guardar; o `api/noticia.php` sem
instruções de escrita e sem requerer `sessao.php` ou `geracao.php`; as variáveis
do `jsc_e2_bloco()` todas com prefixo; e a paridade do HTML e do JSON-LD entre o
servidor e o JavaScript, em cinco notícias.

## Como se verificou

`node tools/testar-sem-js.js` — **1160 verificações** (1034 antes). Deste bloco:
o artigo visível **sem JavaScript**, com o corpo, a data, a categoria, o tempo de
leitura, a imagem na posição guardada e as três relacionadas, cada uma com
ligação navegável; a lista escondida e sem `data-gerado`; o `<title>`, a
`description`, o canonical, o `og:url`, o `og:type`, o `og:title`, o
`twitter:title` e o `og:image` **da notícia** e não da lista; um e um só JSON-LD
de artigo, sem propriedades vazias, com o editor vindo do nome guardado; notícia
sem imagem sem `og:image` e com `twitter:card` a voltar a `summary`; notícia sem
texto sem `description` em sítio nenhum; o `&` e o `<b>` do título a ficarem
texto; a imagem com apóstrofo e parêntesis a não fechar o `url()` do CSS; a
agendada já vencida a responder 200; **404** para a que não existe, a não
publicada, a agendada para o futuro e um id de vinte dígitos, as quatro com
`noindex` no HTML e no cabeçalho, com ligação para as notícias, sem canonical nem
Open Graph, sem JSON-LD, sem vestígio do título, e sem a lista por baixo; com
JavaScript o artigo a continuar um só e o bloco servido a ser reconhecido pelo
`data-id` e pelo `data-gerado`; a paridade do HTML e do JSON-LD em cinco
notícias; o `?preview=1` a não ser reescrito e a continuar a ser o rascunho do
browser; as duas marcas estragadas a darem 200 com a página de pé; sem lista de
notícias a responder 200 e com lista vazia a responder 404; o service worker a
guardar o 200 e **a não guardar o 404**, com a página mesmo sob o seu controlo; o
`POST` a dar 405 sem alterar os dados; os três modelos novos → **403**; o
`<script>`, o `onerror`, o `javascript:` e o `position:` filtrados ao servir, com
o texto legítimo intacto; o sitemap com 13 páginas mais 21 notícias, cada notícia
com a sua data e nenhuma não publicada; **as sete larguras** (320, 375, 414, 768,
1024, 1280, 1440) com e sem JavaScript, sem transbordo; o exterior às regiões
igual byte a byte em 18 ficheiros; e o reverter a devolver os 19 alvos e as
quatro marcas do E2.

`node tools/validar.js --comparar` — sem problemas em 168 combinações,
**novos: 0**. O `noticias.html?id=1` passou a aceitar **200 ou 404** nesse guião,
porque as duas são legítimas e dependem do conteúdo publicado que esteja no sítio
onde ele corre: sem `data/db.json` — o caso do projeto, que não o versiona — não
há lista para consultar e serve-se a página, 200; com lista e sem esse id, 404. A
regra do E2 é medida onde há dados de teste, no `testar-sem-js.js`; aqui o que se
mede é que a página não esteja partida, e continua a ser medida como as outras —
texto visível, transbordo, consola, erros de JavaScript.

Fase A reverificada ponta-a-ponta numa cópia do projeto, com três perfis de teste
e credenciais descartáveis que nunca entraram no repositório: `400` a um GET ao
`auth.php`, `400` sem o cabeçalho do painel, `401` com password errada, `401` a
escrever sem sessão, `405` a um GET ao `save.php`; `200` para a Comunicação a
alterar notícias e `403` a alterar `siteConfig`; `403` para o Matchday nas duas;
`200` para o Administrador a alterar `siteConfig`; o E2 a responder 200 à
publicada e 404 à não publicada e à agendada, **com e sem sessão aberta** e sem
vestígio nenhum do que não está publicado; `405` a `POST`, `PUT`, `DELETE` e
`PATCH` com o `data/db.json` inalterado; os três modelos novos, o `/data/db.json`
e o `/AUDITORIA.md` a 403 com o `manifest.json` ainda a 200; e o `api/sessao.php`
sem uma linha sobre este bloco.

Não houve deploy. A raiz de `novo.campinense.pt` ainda não contém o site
completo, e este bloco não a alterou.
