# FPF Scraper — Juventude Sport Campinense

Importa classificações e resultados de **resultados.fpf.pt** para o painel admin.

## Instalação

```bash
cd scraper
npm install
```

## Passo 1 — Descobrir o ID da AF Algarve

```bash
node fpf-scraper.js --descobrir-af
```

Procure na lista o ID que corresponde a **"Algarve"** e actualize `CONFIG.associationId` no ficheiro `fpf-scraper.js`.

## Passo 2 — Listar as competições disponíveis

```bash
node fpf-scraper.js --listar
```

Vai mostrar todas as competições da época com o respectivo **ID**.

## Passo 3 — Importar uma competição específica

```bash
# Importar só Sub-17:
node fpf-scraper.js --competicao 12345

# Importar todas as competições da associação:
node fpf-scraper.js
```

## Passo 4 — Importar no Admin

1. Copie o ficheiro gerado para `../data/fpf-data.json`
2. Abra o painel admin → **Jogos**
3. Clique em **"Importar FPF"**
4. Os dados são carregados automaticamente

## Configuração (`fpf-scraper.js`)

| Opção | Descrição | Default |
|---|---|---|
| `associationId` | ID da AF Algarve em resultados.fpf.pt | 218 |
| `seasonId` | ID da época (ex: 103 = 2025/26) | 103 |
| `clube` | Nome do clube para destacar | `'Sport Campinense'` |
| `competicaoIds` | Lista de IDs a importar ([] = todas) | `[]` |

## Notas

- O scraper respeita um intervalo de 500ms entre pedidos para não sobrecarregar o servidor da FPF.
- Se o `seasonId` estiver errado, corra `--listar` com diferentes valores (100–110) até encontrar a época correcta.
- Caso a FPF altere a estrutura da API, edite os campos em `obterClassificacao()` e `obterJogos()`.
