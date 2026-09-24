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
