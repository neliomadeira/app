# Torneio de Futebol

App standalone para gerir e publicar resultados e classificações de torneios de futebol.

## Estrutura

```
torneio/
├── index.html          # Página pública
├── css/
│   ├── styles.css      # Estilos base
│   └── torneio.css     # Estilos do torneio
├── js/
│   ├── main.js         # Navegação
│   └── torneio.js      # Lógica pública
├── data/
│   └── torneio-data.json  # Dados dos torneios
├── images/
│   └── logo.svg
└── admin/
    ├── index.html      # Painel admin
    ├── css/admin.css
    └── js/torneio-admin.js
```

## Como usar

1. Abre `admin/index.html` (utilizador: `admin`, senha: `admin123`)
2. Cria torneios, grupos e equipas
3. Insere resultados com **⚽ Inserir Resultados**
4. Exporta o JSON e coloca-o em `data/torneio-data.json`
5. A página `index.html` actualiza-se automaticamente

## Publicar online

Basta colocar a pasta `torneio/` num servidor web (Apache, Nginx, GitHub Pages, Netlify, etc.).
