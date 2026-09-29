<?php
// =====================================================
// CONTEÚDO PUBLICADO — leitura para quem gera as páginas
// =====================================================
// Hoje a origem do conteúdo é o data/db.json. Amanhã pode ser a base de
// dados. Os modelos em modelos/ chamam estas funções e não sabem de onde
// vêm os dados: é aqui, e só aqui, que a origem se troca.
//
// Estas funções repetem, em PHP, as mesmas regras que o js/main.js aplica
// no browser: só notícias publicadas, ordenadas da mais recente para a
// mais antiga, com o limite que estiver nas configurações do site. Se as
// duas divergirem, o visitante com JavaScript veria uma coisa e o
// visitante sem JavaScript outra.
// =====================================================

require_once __DIR__ . '/config.php';

// ---- Escape ---------------------------------------------------------
// Equivalente ao jscEsc() do js/html.js: os mesmos cinco caracteres.
function jsc_esc($valor) {
    if ($valor === null) return '';
    return htmlspecialchars((string)$valor, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

// Equivalente ao jscEscUrl(): recusa esquemas perigosos antes de escapar.
function jsc_esc_url($valor) {
    if ($valor === null) return '';
    $s = trim((string)$valor);
    if (preg_match('/^\s*(javascript|vbscript)\s*:/i', $s)) return '';
    if (preg_match('/^\s*data\s*:/i', $s) && !preg_match('/^\s*data:image\//i', $s)) return '';
    return jsc_esc($s);
}

// Para valores que vão dentro de url('...') numa folha de estilo: além do
// escape de HTML, os caracteres que fechariam a função ou a string são
// percent-encoded. Tem de dar o mesmo resultado que o newsCardImg() do
// js/main.js, senão o cartão gerado e o cartão desenhado pelo JavaScript
// ficariam diferentes.
function jsc_esc_url_css($valor) {
    $s = preg_replace_callback('/[\'"()\\\\\s]/', function ($m) { return rawurlencode($m[0]); }, (string)$valor);
    return jsc_esc_url($s);
}

// Equivalente ao ptDate(): "5 de Março, 2026".
function jsc_data_pt($iso) {
    $iso = trim((string)$iso);
    if ($iso === '') return '';
    $meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
              'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    // O JavaScript faz new Date(str + 'T00:00:00'); uma data inválida dá
    // "NaN de undefined, NaN". Aqui devolve-se vazio, que é o que o cartão
    // deve mostrar quando a data não presta.
    $d = date_create_from_format('Y-m-d', substr($iso, 0, 10));
    if (!$d) return '';
    $mes = (int)$d->format('n');
    if ($mes < 1 || $mes > 12) return '';
    return (int)$d->format('j') . ' de ' . $meses[$mes - 1] . ', ' . $d->format('Y');
}

// ---- Origem do conteúdo --------------------------------------------
function jsc_conteudo_do_ficheiro() {
    if (!is_file(DATA_FILE)) return [];
    $raw = file_get_contents(DATA_FILE);
    if ($raw === false || $raw === '') return [];
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}

// Quando foi publicado este conteúdo. É esta a marca que vai para o HTML
// gerado, e é por ela que o JavaScript sabe se o que já está na página é
// atual e não precisa de ser reescrito.
function jsc_publicado_em(array $conteudo) {
    return isset($conteudo['publicadoEm']) && is_string($conteudo['publicadoEm'])
        ? $conteudo['publicadoEm'] : '';
}

// Quantas notícias mostra a página inicial. Mesma regra do main.js:
// site_config.homepageNewsCount, ou 3.
function jsc_limite_noticias(array $conteudo) {
    $n = 0;
    if (isset($conteudo['siteConfig']) && is_array($conteudo['siteConfig'])
        && isset($conteudo['siteConfig']['homepageNewsCount'])) {
        $n = (int)$conteudo['siteConfig']['homepageNewsCount'];
    }
    return $n > 0 ? $n : 3;
}

// Quantas notícias publicadas existem no total — o botão "Ver todas" só
// aparece quando há mais do que as que couberam na página inicial.
function jsc_total_noticias(array $conteudo) {
    return count(jsc_noticias_publicadas($conteudo));
}

// Ordena por data, do mais recente para o mais antigo, com desempate pela
// ordem original. O desempate não é um detalhe: o sort() do JavaScript é
// estável e mantém a ordem do array para datas iguais, mas o usort() do PHP
// só é estável a partir do PHP 8.0 — e o campinense.pt corre 7.4. Sem isto,
// duas notícias no mesmo dia podiam sair em ordens diferentes no HTML gerado
// e no HTML desenhado pelo browser.
function jsc_ordenar_por_data(array $lista, $descendente = true) {
    $indices = array_keys($lista);
    usort($indices, function ($i, $j) use ($lista, $descendente) {
        $a = isset($lista[$i]['data']) ? (string)$lista[$i]['data'] : '';
        $b = isset($lista[$j]['data']) ? (string)$lista[$j]['data'] : '';
        $cmp = $descendente ? strcmp($b, $a) : strcmp($a, $b);
        return $cmp !== 0 ? $cmp : ($i - $j);
    });
    $fora = [];
    foreach ($indices as $i) $fora[] = $lista[$i];
    return $fora;
}

function jsc_noticias_publicadas(array $conteudo) {
    if (!isset($conteudo['noticias']) || !is_array($conteudo['noticias'])) return [];
    $lista = [];
    foreach ($conteudo['noticias'] as $n) {
        if (!is_array($n)) continue;
        if (empty($n['publicada'])) continue;
        $lista[] = $n;
    }
    // Mesma ordenação do main.js: (b.data||'').localeCompare(a.data||'').
    // As datas são ISO (AAAA-MM-DD), por isso a comparação de texto basta.
    return jsc_ordenar_por_data($lista, true);
}

// A lista pronta para o modelo: já filtrada, ordenada, cortada e com os
// campos calculados. O modelo só escreve markup.
function jsc_noticias(array $conteudo, $limite = null) {
    $lista = jsc_noticias_publicadas($conteudo);
    if ($limite === null) $limite = jsc_limite_noticias($conteudo);
    $lista = array_slice($lista, 0, $limite);

    $fora = [];
    foreach ($lista as $i => $n) {
        $resumo = isset($n['resumo']) && is_string($n['resumo']) ? $n['resumo'] : '';
        if ($resumo !== '') {
            // Mesma regra do main.js: sem tags, cortado aos 160 caracteres.
            $resumo = preg_replace('/<[^>]+>/', '', $resumo);
            $resumo = mb_substr($resumo, 0, 160, 'UTF-8');
        }
        $fora[] = [
            'id'        => isset($n['id']) ? (string)$n['id'] : '',
            'titulo'    => isset($n['titulo']) ? (string)$n['titulo'] : '',
            'categoria' => isset($n['categoria']) ? (string)$n['categoria'] : '',
            'data'      => isset($n['data']) ? (string)$n['data'] : '',
            'dataPt'    => jsc_data_pt(isset($n['data']) ? $n['data'] : ''),
            'resumo'    => $resumo,
            'imagem'    => isset($n['imagem']) && is_string($n['imagem']) ? $n['imagem'] : '',
            // O main.js tira o "auto " do valor guardado no painel.
            'imagemSize'=> str_replace('auto ', '',
                             isset($n['imagemSize']) && is_string($n['imagemSize']) && $n['imagemSize'] !== ''
                                 ? $n['imagemSize'] : 'cover'),
            // Cuidado com os dois sentidos de "destaque": este é o cartão
            // visualmente grande, o primeiro da grelha. O campo de dados
            // n.destaque, esse, é a notícia que o painel marcou como
            // destaque da página de notícias — e chama-se 'emDestaque'.
            'grande'    => $i === 0,
            'variante'  => ($i % 3) + 1,      // news-card__img--1/2/3
        ];
    }
    return $fora;
}

// ---------------------------------------------------------------------
// PÁGINA DE NOTÍCIAS (noticias.html)
// ---------------------------------------------------------------------
// As regras aqui são as do js/noticias.js, não as da página inicial: a
// página de notícias mostra também as agendadas cujo momento já passou, não
// corta a lista, e os resumos têm outros tamanhos. Se as duas divergirem, o
// visitante com JavaScript vê uma coisa e o visitante sem JavaScript outra.

// Sem tags, cortado ao limite, com "…" só se de facto cortou.
function jsc_resumo_curto($html, $limite, $reticencias = true) {
    $texto = preg_replace('/<[^>]+>/', '', (string)$html);
    if ($texto === null) return '';
    if (mb_strlen($texto, 'UTF-8') <= $limite) return $texto;
    return mb_substr($texto, 0, $limite, 'UTF-8') . ($reticencias ? '…' : '');
}

// "3 min" — o mesmo cálculo do readingTime() do js/noticias.js.
function jsc_tempo_leitura($html) {
    $texto = trim(preg_replace('/<[^>]+>/', ' ', (string)$html));
    $palavras = $texto === '' ? 0 : count(preg_split('/\s+/', $texto, -1, PREG_SPLIT_NO_EMPTY));
    return max(1, (int)round($palavras / 200)) . ' min';
}

// A lista da página de notícias: publicadas, mais as agendadas cujo momento
// já passou. Sem corte — quem corta é a apresentação.
function jsc_noticias_pagina(array $conteudo, $agora = null) {
    if (!isset($conteudo['noticias']) || !is_array($conteudo['noticias'])) return [];
    if ($agora === null) $agora = gmdate('Y-m-d\TH:i:s.v\Z');

    $lista = [];
    foreach ($conteudo['noticias'] as $n) {
        if (!is_array($n)) continue;
        $publicada = !empty($n['publicada']);
        $agendada  = isset($n['scheduledAt']) && is_string($n['scheduledAt'])
                  && $n['scheduledAt'] !== '' && strcmp($n['scheduledAt'], (string)$agora) <= 0;
        if (!$publicada && !$agendada) continue;
        $lista[] = $n;
    }
    $lista = jsc_ordenar_por_data($lista, true);

    $fora = [];
    foreach ($lista as $i => $n) {
        $resumo = isset($n['resumo']) && is_string($n['resumo']) ? $n['resumo'] : '';
        $fora[] = [
            'id'         => isset($n['id']) ? (string)$n['id'] : '',
            'titulo'     => isset($n['titulo']) ? (string)$n['titulo'] : '',
            'categoria'  => isset($n['categoria']) ? (string)$n['categoria'] : '',
            'data'       => isset($n['data']) ? (string)$n['data'] : '',
            'dataPt'     => jsc_data_pt(isset($n['data']) ? $n['data'] : ''),
            // Dois tamanhos: 130 no cartão da grelha, 200 no cartão de
            // destaque. São os do js/noticias.js.
            'resumo130'  => jsc_resumo_curto($resumo, 130),
            'resumo200'  => jsc_resumo_curto($resumo, 200),
            'leitura'    => jsc_tempo_leitura($resumo),
            'imagem'     => isset($n['imagem']) && is_string($n['imagem']) ? $n['imagem'] : '',
            'imagemSize' => isset($n['imagemSize']) && is_string($n['imagemSize']) && $n['imagemSize'] !== ''
                              ? $n['imagemSize'] : 'cover',
            'focalPos'   => isset($n['focalPos']) && is_string($n['focalPos']) && $n['focalPos'] !== ''
                              ? $n['focalPos'] : 'center',
            'emDestaque' => !empty($n['destaque']),   // o campo de dados
            'variante'   => ($i % 3) + 1,
        ];
    }
    return $fora;
}

// A notícia em destaque: a primeira da lista já ordenada que o painel tenha
// marcado. O js/noticias.js faz _all.find(n => n.destaque).
function jsc_noticias_destaque(array $lista) {
    foreach ($lista as $n) if (!empty($n['emDestaque'])) return $n;
    return null;
}

// Categorias pela ordem em que aparecem na lista, sem repetições e sem
// vazias. Igual ao [...new Set(...)].filter(Boolean) do js/noticias.js.
function jsc_noticias_categorias(array $lista) {
    $cats = [];
    foreach ($lista as $n) {
        $c = trim((string)$n['categoria']);
        if ($c !== '' && !in_array($c, $cats, true)) $cats[] = $c;
    }
    return $cats;
}

// Quantos cartões a grelha mostra antes de ser preciso o "Ver mais".
// O PREVIEW do js/noticias.js.
function jsc_noticias_previa() {
    return 9;
}

// Equivalente ao encodeURIComponent(): o rawurlencode() do PHP escapa mais
// caracteres do que ele. Sem isto, as ligações de partilha geradas aqui não
// seriam iguais às que o JavaScript constrói para o mesmo cartão.
function jsc_enc_uri($valor) {
    return strtr(rawurlencode((string)$valor), [
        '%21' => '!', '%2A' => '*', '%27' => "'", '%28' => '(', '%29' => ')',
    ]);
}

// O endereço público do site, lido do <link rel="canonical"> da própria
// página. O JavaScript usa window.location.origin; aqui não há browser, e
// não se inventa nem se fixa um domínio no código: se o endereço mudar no
// HTML, muda também no que for gerado. Devolve '' se não houver canonical.
function jsc_url_base($ficheiro) {
    if (!is_file($ficheiro)) return '';
    $html = (string)@file_get_contents($ficheiro);
    if (!preg_match('/<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)["\']/i', $html, $m)) return '';
    $partes = parse_url(trim($m[1]));
    if (empty($partes['scheme']) || empty($partes['host'])) return '';
    return $partes['scheme'] . '://' . $partes['host']
         . (isset($partes['port']) ? ':' . $partes['port'] : '');
}

// ---------------------------------------------------------------------
// AGENDA (página inicial e agenda.html)
// ---------------------------------------------------------------------
// Fonte única deste bloco: db_agenda. O db_jogos é outra fonte, com outro
// modelo de dados, e não é misturado aqui — ver o AUDITORIA.md.
//
// As regras são as do js/main.js (grelha da página inicial) e do
// js/agenda.js (lista da agenda.html): eventos de hoje em diante, ordenados
// pela data, com a ordem original a desempatar. A página inicial corta nos
// primeiros seis; a agenda.html mostra todos.

// O dia de hoje, na hora local do servidor. É este valor que vai para o
// data-desde do bloco gerado, e é por ele que o JavaScript sabe se a lista
// gerada ainda é a do dia de hoje.
function jsc_hoje() {
    return date('Y-m-d');
}

function jsc_agenda_previa() {
    return 6;
}

// Cores e classes por tipo de evento. Mapa fixo do código, igual ao
// TIPO_COR do js/agenda.js e ao TIPO_CLS do js/main.js — não são dados do
// clube.
function jsc_agenda_cor($tipo) {
    $cores = [
        'Jogo' => '#22a75e', 'Torneio' => '#f59e0b', 'Treino' => '#3b82f6',
        'Reunião' => '#8b5cf6', 'Outro' => '#94a3b8',
    ];
    return isset($cores[$tipo]) ? $cores[$tipo] : $cores['Outro'];
}

function jsc_agenda_classe($tipo) {
    $classes = [
        'Jogo' => 'jogo', 'Torneio' => 'torneio', 'Treino' => 'treino',
        'Reunião' => 'reuniao', 'Outro' => 'outro',
    ];
    return isset($classes[$tipo]) ? $classes[$tipo] : 'outro';
}

function jsc_mes_curto($mes) {
    $meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
              'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    $i = (int)$mes - 1;
    return ($i >= 0 && $i <= 11) ? $meses[$i] : '';
}

// O valor do data-ics, igual ao que o js/agenda.js escreve hoje:
// encodeURIComponent(JSON.stringify({titulo, data, hora, local, descricao,
// tipo})). A ordem das chaves é a da inserção, e uma chave que não exista na
// origem não entra — como o JSON.stringify faz com undefined.
function jsc_agenda_ics(array $e) {
    $dados = [];
    foreach (['titulo', 'data', 'hora', 'local', 'descricao', 'tipo'] as $campo) {
        if (isset($e[$campo])) $dados[$campo] = (string)$e[$campo];
    }
    $json = json_encode($dados, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    return $json === false ? '' : jsc_enc_uri($json);
}

// Os eventos de hoje em diante, já preparados para os modelos.
//   $hoje    o dia a partir do qual se conta, em AAAA-MM-DD (para os testes)
//   $limite  quantos devolver, ou null para todos
function jsc_agenda_proximos(array $conteudo, $hoje = null, $limite = null) {
    if (!isset($conteudo['agenda']) || !is_array($conteudo['agenda'])) return [];
    if ($hoje === null) $hoje = jsc_hoje();

    $lista = [];
    foreach ($conteudo['agenda'] as $e) {
        if (!is_array($e)) continue;
        $data = isset($e['data']) ? (string)$e['data'] : '';
        if ($data === '' || strcmp($data, (string)$hoje) < 0) continue;   // já passou
        // Cancelado não aparece nas listas públicas. O painel ainda não
        // escreve este estado; quando escrever, isto já está certo.
        if (isset($e['estado']) && $e['estado'] === 'Cancelado') continue;
        $lista[] = $e;
    }

    $lista = jsc_ordenar_por_data($lista, false);   // data ascendente
    if ($limite !== null) $lista = array_slice($lista, 0, $limite);

    $fora = [];
    foreach ($lista as $e) {
        $data    = (string)$e['data'];
        $tipo    = isset($e['tipo']) ? trim((string)$e['tipo']) : '';
        $escalao = isset($e['escalao']) ? trim((string)$e['escalao']) : '';
        $fora[] = [
            'id'       => isset($e['id']) ? (string)$e['id'] : '',
            'titulo'   => isset($e['titulo']) ? (string)$e['titulo'] : '',
            'tipo'     => $tipo,
            'data'     => $data,
            'dia'      => (int)substr($data, 8, 2),
            'mesCurto' => jsc_mes_curto(substr($data, 5, 2)),
            'hora'     => isset($e['hora']) ? trim((string)$e['hora']) : '',
            'local'    => isset($e['local']) ? trim((string)$e['local']) : '',
            // "Todos" não é informação: não se mostra uma linha a dizer que
            // o evento é para todos os escalões.
            'escalao'  => ($escalao === 'Todos') ? '' : $escalao,
            'classe'   => jsc_agenda_classe($tipo),
            'cor'      => jsc_agenda_cor($tipo),
            'ics'      => jsc_agenda_ics($e),
        ];
    }
    return $fora;
}

// ---------------------------------------------------------------------
// EQUIPA PRINCIPAL (equipa-principal.html)
// ---------------------------------------------------------------------
// Três blocos: a barra de informação, o plantel e as publicações. As regras
// são as do js/main.js (barra e plantel) e do js/senior-posts.js
// (publicações), para o que é gerado e o que o browser desenha darem o
// mesmo.
//
// Não há aqui nenhum dado pessoal além dos quatro que o cartão de jogador já
// publica hoje: nome, número, posição e fotografia. O modelo de dados
// db_seniores não tem outros.

// Os quatro campos da barra, pela ordem fixa da página, só os preenchidos.
// Campo vazio não produz item, e com os quatro vazios não há barra nenhuma.
function jsc_seniores_info(array $conteudo) {
    $info = (isset($conteudo['senioresInfo']) && is_array($conteudo['senioresInfo']))
          ? $conteudo['senioresInfo'] : [];
    $campos = [
        ['chave' => 'liga',      'icone' => '&#127942;', 'rotulo' => 'Competição', 'id' => 'seniorLiga'],
        ['chave' => 'temporada', 'icone' => '&#128197;', 'rotulo' => 'Temporada',  'id' => 'seniorTemporada'],
        ['chave' => 'treinos',   'icone' => '&#128337;', 'rotulo' => 'Treinos',    'id' => 'seniorTreinos'],
        ['chave' => 'estadio',   'icone' => '&#128205;', 'rotulo' => 'Local',      'id' => 'seniorEstadio'],
    ];
    $fora = [];
    foreach ($campos as $c) {
        $valor = isset($info[$c['chave']]) ? trim((string)$info[$c['chave']]) : '';
        if ($valor === '') continue;
        $c['valor'] = $valor;
        $fora[] = $c;
    }
    return $fora;
}

// As iniciais que aparecem quando não há fotografia. Réplica exata do
// js/main.js: as duas primeiras palavras, a primeira letra de cada.
function jsc_iniciais($nome) {
    $partes = array_slice(explode(' ', (string)$nome), 0, 2);
    $ini = '';
    foreach ($partes as $p) {
        if ($p === '') continue;
        $ini .= mb_substr($p, 0, 1, 'UTF-8');
    }
    return mb_strtoupper($ini, 'UTF-8');
}

// O plantel, agrupado pelas posições que têm jogadores. Um grupo sem
// jogadores não é devolvido — e por isso não chega a ser escrito.
//
// A ordem dentro de cada grupo é a ordem do array, que é a que a página
// pública usa hoje. O painel mostra-os por número; aqui não se ordena.
function jsc_seniores_plantel(array $conteudo) {
    $plantel = (isset($conteudo['seniores']) && is_array($conteudo['seniores']))
             ? $conteudo['seniores'] : [];

    $grupos = [
        ['pos' => 'GR',  'label' => 'Guarda-redes', 'grelha' => 'squad-grid squad-grid--gr'],
        ['pos' => 'DEF', 'label' => 'Defesas',      'grelha' => 'squad-grid'],
        ['pos' => 'MEI', 'label' => 'Médios',       'grelha' => 'squad-grid'],
        ['pos' => 'AVA', 'label' => 'Avançados',    'grelha' => 'squad-grid'],
    ];

    $fora = [];
    foreach ($grupos as $g) {
        $jogadores = [];
        foreach ($plantel as $j) {
            if (!is_array($j)) continue;
            // Mesmo filtro do js/main.js: inativo não aparece.
            if (isset($j['ativo']) && $j['ativo'] === false) continue;
            if (!isset($j['posicao']) || (string)$j['posicao'] !== $g['pos']) continue;
            $foto = isset($j['foto']) && is_string($j['foto']) ? trim($j['foto']) : '';
            $nome = isset($j['nome']) ? (string)$j['nome'] : '';
            $numero = isset($j['numero']) ? trim((string)$j['numero']) : '';
            $jogadores[] = [
                'nome'     => $nome,
                // O traço faz parte do desenho do cartão: é o que ancora a
                // coluna do número quando o número não está preenchido.
                'numero'   => $numero !== '' ? $numero : '—',
                'posicao'  => (string)$j['posicao'],
                'posicaoFull' => (isset($j['posicaoFull']) && trim((string)$j['posicaoFull']) !== '')
                                 ? (string)$j['posicaoFull'] : (string)$j['posicao'],
                'foto'     => $foto,
                'iniciais' => $foto === '' ? jsc_iniciais($nome) : '',
            ];
        }
        if (!$jogadores) continue;
        $g['jogadores'] = $jogadores;
        $fora[] = $g;
    }
    return $fora;
}

// As publicações da equipa principal. Não há chave nem tabela à parte: é a
// categoria da notícia. Uma notícia do painel com categoria "Seniores" e
// publicada é uma publicação desta equipa — é o que o js/senior-posts.js
// faz.
//
// Ao contrário da noticias.html, aqui não entram as agendadas cujo momento
// já passou. Réplica fiel do que a página mostra hoje; a diferença está
// registada no AUDITORIA.md.
function jsc_seniores_posts_publicadas(array $conteudo) {
    if (!isset($conteudo['noticias']) || !is_array($conteudo['noticias'])) return [];
    $lista = [];
    foreach ($conteudo['noticias'] as $n) {
        if (!is_array($n)) continue;
        if (empty($n['publicada'])) continue;
        if (!isset($n['categoria']) || (string)$n['categoria'] !== 'Seniores') continue;
        $lista[] = $n;
    }
    return jsc_ordenar_por_data($lista, true);
}

function jsc_seniores_total_posts(array $conteudo) {
    return count(jsc_seniores_posts_publicadas($conteudo));
}

function jsc_seniores_previa() {
    return 4;
}

function jsc_seniores_posts(array $conteudo, $limite = null) {
    if ($limite === null) $limite = jsc_seniores_previa();
    $lista = array_slice(jsc_seniores_posts_publicadas($conteudo), 0, $limite);

    $fora = [];
    foreach ($lista as $i => $n) {
        $resumo = isset($n['resumo']) && is_string($n['resumo']) ? $n['resumo'] : '';
        $fora[] = [
            'id'         => isset($n['id']) ? (string)$n['id'] : '',
            'titulo'     => isset($n['titulo']) ? (string)$n['titulo'] : '',
            'dataPt'     => jsc_data_pt(isset($n['data']) ? $n['data'] : ''),
            // O js/senior-posts.js não corta o resumo: só lhe tira as tags.
            'resumo'     => $resumo === '' ? '' : trim(preg_replace('/<[^>]+>/', '', $resumo)),
            'imagem'     => isset($n['imagem']) && is_string($n['imagem']) ? $n['imagem'] : '',
            'imagemSize' => (isset($n['imagemSize']) && is_string($n['imagemSize']) && $n['imagemSize'] !== '')
                              ? $n['imagemSize'] : 'cover',
            'imagemPos'  => (isset($n['imagemPos']) && is_string($n['imagemPos']) && $n['imagemPos'] !== '')
                              ? $n['imagemPos'] : 'center',
            // O painel não escreve o campo img; fica 1, como no JavaScript.
            'variante'   => isset($n['img']) && (int)$n['img'] > 0 ? (int)$n['img'] : 1,
            'grande'     => $i === 0,
        ];
    }
    return $fora;
}

// ---- Escalões de formação ------------------------------------------
//
// Fonte única: o db_escaloes do painel. A formacao.html tinha oito cartões
// escritos à mão, com textos operacionais — frequências de treino, nomes de
// competições — que não têm campo nenhum no painel e que já hoje desapareciam
// assim que lá existisse um escalão. Saíram.
//
// Nenhum atleta é lido aqui. O cartão do escalão não publica pessoas: o
// campo treinador é texto livre do escalão, o mesmo que a página já mostrava.

// Quantos atletas mostrar no cartão. Só um inteiro maior que zero conta.
// Devolve null quando não há número para mostrar, e é por ser null que o
// modelo não escreve linha nenhuma.
//
// O js/main.js fazia apenas "if (e.atletas)": com o número 0 acertava, mas
// com a string "0" — que é o que chega de um JSON editado à mão ou de uma
// importação — escrevia "0 atletas inscritos". O js/escalao.js já fazia o
// parseInt com <= 0; é essa a versão correcta, e passa a ser a dos dois.
function jsc_escalao_atletas($valor) {
    if (is_bool($valor) || $valor === null) return null;
    if (is_string($valor)) {
        $valor = trim($valor);
        if ($valor === '' || !preg_match('/^-?\d+$/', $valor)) return null;
    }
    if (!is_numeric($valor)) return null;
    $n = (int)$valor;
    return $n > 0 ? $n : null;
}

// A ligação para a página do escalão. O nome vai no valor de um parâmetro,
// por isso é percent-encoded antes de ser escapado como atributo — um &,
// um espaço ou uma / no nome partiam a query string.
//
// jsc_enc_uri() é o equivalente do encodeURIComponent que já cá estava para
// as ligações de partilha das notícias. Não se cria mais nenhum escape.
function jsc_escalao_url($nome) {
    return 'escalao.html?escalao=' . jsc_enc_uri($nome);
}

// Os escalões que vão para os cartões, na ordem do array — a mesma ordem que
// a página pública usa hoje. Cada campo vazio é retirado aqui, para o modelo
// não ter de decidir nada.
//
// Um escalão sem nome é descartado: sem nome não há ligação possível nem
// título para o cartão.
function jsc_escaloes(array $conteudo) {
    $lista = (isset($conteudo['escaloes']) && is_array($conteudo['escaloes']))
           ? $conteudo['escaloes'] : [];

    $texto = function ($e, $chave) {
        return (isset($e[$chave]) && is_string($e[$chave])) ? trim($e[$chave]) : '';
    };

    $fora = [];
    foreach ($lista as $e) {
        if (!is_array($e)) continue;
        $nome = $texto($e, 'nome');
        if ($nome === '') continue;

        // Os itens da lista do cartão, pela ordem em que aparecem. Só entram
        // os que têm valor; se não entrar nenhum, não há <ul>.
        $itens = [];
        $treinos = $texto($e, 'treinos');
        if ($treinos !== '') $itens[] = $treinos;
        $treinador = $texto($e, 'treinador');
        if ($treinador !== '') $itens[] = 'Treinador: ' . $treinador;
        // competicao e local são administráveis na secção Futebol Formação do
        // painel e até agora não apareciam em sítio nenhum do site.
        $competicao = $texto($e, 'competicao');
        if ($competicao !== '') $itens[] = $competicao;
        $local = $texto($e, 'local');
        if ($local !== '') $itens[] = $local;
        $atletas = jsc_escalao_atletas(isset($e['atletas']) ? $e['atletas'] : null);
        if ($atletas !== null) $itens[] = $atletas . ' atletas inscritos';

        $fora[] = [
            'nome'       => $nome,
            'designacao' => $texto($e, 'designacao'),
            'faixa'      => $texto($e, 'faixa'),
            'descricao'  => $texto($e, 'descricao'),
            'itens'      => $itens,
            'destaque'   => !empty($e['destaque']),
            'url'        => jsc_escalao_url($nome),
        ];
    }
    return $fora;
}
