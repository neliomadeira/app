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
