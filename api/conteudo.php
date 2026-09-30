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

// ---- Patrocinadores -------------------------------------------------
//
// Zona única: todos os patrocinadores ativos numa grelha só, pela ordem do
// array. Havia uma divisão por Ouro, Prata e Bronze, escrita em seis sítios
// diferentes, e era ela a causa de metade dos defeitos desta zona — entre
// eles um patrocinador ativo com nível desconhecido desaparecer enquanto a
// página anunciava que não havia patrocinadores. Saiu.
//
// O campo tier continua nos dados já guardados, por compatibilidade
// histórica, e é aqui completamente ignorado: antigo, desconhecido, vazio,
// ausente ou de outro tipo, dá tudo no mesmo. Os registos novos não o levam.

// Um patrocinador está ativo? Réplica exacta do jscPatrocinadorAtivo() do
// js/html.js. As duas páginas discordavam: a inicial aceitava qualquer valor
// verdadeiro, a de patrocinadores exigia exactamente true, e um "ativo": 1
// aparecia numa e não na outra.
function jsc_patrocinador_ativo($valor) {
    if ($valor === true) return true;
    if (is_int($valor) || is_float($valor)) return (int)$valor === 1;
    if (is_string($valor)) {
        $v = strtolower(trim($valor));
        return $v === 'true' || $v === '1';
    }
    return false;
}

// O endereço do site de um patrocinador. Só http e https — lista de
// permitidos, e não de proibidos: o que não é um dos dois não produz ligação.
// Sem esquema assume-se https, que é o que a página de patrocinadores já
// fazia; a página inicial não o fazia, e por isso "empresa.pt" ficava uma
// ligação relativa quebrada. Passa a ser a mesma regra nas duas.
function jsc_patrocinador_url($website) {
    $s = trim((string)$website);
    if ($s === '') return '';
    if (!preg_match('~^[a-z][a-z0-9+.-]*:~i', $s)) $s = 'https://' . ltrim($s, '/');
    if (!preg_match('~^https?://[^\s/?#]~i', $s)) return '';
    return $s;
}

// O sector. O painel gravava um travessão quando o campo ficava em branco, e
// o travessão era publicado como se fosse o sector da empresa. Um travessão
// não é um sector: é a marca de um campo não preenchido, e conta como vazio.
// O painel deixou de o gravar.
function jsc_patrocinador_sector($valor) {
    $s = trim((string)$valor);
    return ($s === '-' || $s === '—' || $s === '–') ? '' : $s;
}

// O ano de "Parceiro desde". Só um ano de quatro algarismos plausível conta;
// o resto não produz elemento nenhum, em vez de escrever "Parceiro desde ab".
function jsc_patrocinador_desde($valor) {
    if (!preg_match('/(\d{4})/', (string)$valor, $m)) return '';
    $ano = (int)$m[1];
    return ($ano >= 1900 && $ano <= 2100) ? (string)$ano : '';
}

// Os patrocinadores publicáveis, numa lista plana e pela ordem do array — que
// é a ordem em que o painel os acrescenta. Não há campo de ordenação nem
// forma de reordenar no painel; não se inventa aqui uma ordem que ninguém
// pode controlar.
//
// Inativo não aparece. Sem nome é descartado: sem nome não há título, não há
// texto alternativo para o logótipo e não há iniciais.
function jsc_patrocinadores(array $conteudo) {
    $lista = (isset($conteudo['patrocinadores']) && is_array($conteudo['patrocinadores']))
           ? $conteudo['patrocinadores'] : [];

    $fora = [];
    foreach ($lista as $p) {
        if (!is_array($p)) continue;
        if (!jsc_patrocinador_ativo(isset($p['ativo']) ? $p['ativo'] : null)) continue;

        $nome = isset($p['nome']) && is_string($p['nome']) ? trim($p['nome']) : '';
        if ($nome === '') continue;

        $fora[] = [
            'nome'     => $nome,
            'sector'   => jsc_patrocinador_sector(isset($p['sector']) ? $p['sector'] : ''),
            'desde'    => jsc_patrocinador_desde(isset($p['desde']) ? $p['desde'] : ''),
            'url'      => jsc_patrocinador_url(isset($p['website']) ? $p['website'] : ''),
            'logo'     => isset($p['logo']) && is_string($p['logo']) ? trim($p['logo']) : '',
            'iniciais' => jsc_iniciais($nome),
        ];
    }
    return $fora;
}

// ---- Modalidades ----------------------------------------------------
//
// Fonte única: o db_modalidades do painel. A página inicial tinha três
// cartões escritos à mão — Kickboxing, Judo e Futsal, com as descrições —,
// e ficavam lá sempre que a base estivesse vazia. Saíram. As modalidades
// continuam nos dados persistentes; o que saiu foi a cópia no código.
//
// Nenhum horário, local ou responsável escrito aqui. Os três estão vazios
// nos dados, e é esse o estado certo: não foram confirmados.

// Está ativa? Uma modalidade sem o campo conta como ativa — é a regra que o
// site já usa (ativo !== false), e apertá-la esconderia modalidades que hoje
// aparecem. Réplica exacta do jscModalidadeAtiva() do js/html.js.
function jsc_modalidade_ativa($valor) {
    return $valor !== false;
}

// As modalidades publicáveis, pela ordem do array — a ordem em que o painel
// as mostra. Não há campo de ordenação nem forma de reordenar; não se inventa
// aqui uma ordem que ninguém pode controlar.
//
// Inativa não aparece. Sem nome é descartada: sem nome não há título nem
// identificação nenhuma do cartão.
function jsc_modalidades(array $conteudo) {
    $lista = (isset($conteudo['modalidades']) && is_array($conteudo['modalidades']))
           ? $conteudo['modalidades'] : [];

    $texto = function ($m, $chave) {
        return (isset($m[$chave]) && is_string($m[$chave])) ? trim($m[$chave]) : '';
    };

    $fora = [];
    foreach ($lista as $m) {
        if (!is_array($m)) continue;
        if (!jsc_modalidade_ativa(isset($m['ativo']) ? $m['ativo'] : null)) continue;

        $nome = $texto($m, 'nome');
        if ($nome === '') continue;

        // Os itens da barra do cartão, pela ordem em que aparecem. Só entram
        // os que têm valor; sem nenhum, não há a caixa — que desenha um traço
        // e 14px de espaço mesmo quando está vazia.
        $itens = [];
        foreach ([
            ['chave' => 'treinos',     'icone' => '&#128337;'],
            ['chave' => 'local',       'icone' => '&#128205;'],
            ['chave' => 'responsavel', 'icone' => '&#128100;'],
        ] as $campo) {
            $valor = $texto($m, $campo['chave']);
            if ($valor === '') continue;
            $itens[] = ['icone' => $campo['icone'], 'valor' => $valor];
        }

        $pos = $texto($m, 'imagemPos');

        $fora[] = [
            'nome'      => $nome,
            // O ícone é um emoji escrito no painel. Vai escapado: era o único
            // campo desta zona que entrava em innerHTML sem escape.
            'icone'     => $texto($m, 'icone') !== '' ? $texto($m, 'icone') : '🏅',
            'descricao' => $texto($m, 'descricao'),
            'itens'     => $itens,
            'imagem'    => $texto($m, 'imagem'),
            'imagemPos' => $pos !== '' ? $pos : 'center',
            // O id vai no valor de um parâmetro, por isso é percent-encoded
            // antes de ser escapado como atributo.
            'url'       => 'modalidade.html?id=' . jsc_enc_uri(isset($m['id']) ? $m['id'] : ''),
        ];
    }
    return $fora;
}

// ---- Galeria e vídeos -----------------------------------------------
//
// Fontes únicas: o db_galeria e o db_videos do painel. A página inicial tinha
// cinco fotografias escritas à mão, uma delas a afirmar um título distrital
// que o clube pode não ter conquistado; a galeria.html tinha seis esqueletos
// de carregamento permanentes; a videos.html ficava em branco. Saíram.
//
// Nenhum campo pessoal existe nestas duas listas e nenhum é criado: não há
// nome de atleta, data de nascimento, contacto nem etiqueta de pessoa. O
// título e a descrição são texto livre de quem publica.

// Está publicado? Um registo sem o campo conta como publicado, para não
// esconder o que já esteja lá.
//
// A regra é a mesma para fotografias, vídeos, marcos históricos e títulos do
// palmarés, e por isso vive num sítio só — o jsc_ativo() mais abaixo. Este
// nome fica porque é o que os blocos do Bloco 7 usam; o comportamento é, à
// letra, o mesmo de antes. Réplica exacta do jscMediaAtivo() do js/html.js.
function jsc_media_ativo($valor) {
    return jsc_ativo($valor);
}

// O id de um vídeo do YouTube, a partir de qualquer dos endereços que o painel
// aceita. Devolve '' quando não é um deles — e é por isso que o endereço do
// iframe e a ligação pública nunca são o endereço que alguém escreveu, mas
// sempre construídos a partir de onze caracteres validados aqui.
//
// Réplica exacta do jscVideoId() do js/html.js.
function jsc_video_id($url) {
    if (!preg_match('~(?:youtube\.com/(?:watch\?v=|shorts/|embed/)|youtu\.be/)([a-zA-Z0-9_-]{11})~',
                    (string)$url, $m)) {
        return '';
    }
    return $m[1];
}

// Quantas fotografias mostra a página inicial. O mesmo número que o PREVIEW
// do js/main.js.
function jsc_galeria_previa() {
    return 6;
}

// As fotografias publicáveis, pela ordem do array — a ordem em que o painel as
// mostra, com a mais recente à frente porque a criação faz unshift. Não há
// campo de ordenação nem forma de reordenar; não se inventa aqui uma ordem que
// ninguém pode controlar.
//
// Sem título é descartada: o título é obrigatório no painel, e sem ele não há
// texto alternativo, legenda nem nome acessível.
//
// Sem endereço fica o cartão de categoria que a página completa já usava — não
// se inventa imagem, e não se descarta a fotografia como a página inicial
// fazia.
function jsc_galeria(array $conteudo) {
    $lista = (isset($conteudo['galeria']) && is_array($conteudo['galeria']))
           ? $conteudo['galeria'] : [];

    $texto = function ($f, $chave) {
        return (isset($f[$chave]) && is_string($f[$chave])) ? trim($f[$chave]) : '';
    };

    // Ícone e classe por categoria. Um sítio só, em vez dos três de antes.
    $icones = [
        'Jogo'      => '&#9917;',
        'Treino'    => '&#127939;',
        'Conquista' => '&#127942;',
        'Evento'    => '&#127881;',
    ];

    $fora = [];
    foreach ($lista as $f) {
        if (!is_array($f)) continue;
        if (!jsc_media_ativo(isset($f['ativo']) ? $f['ativo'] : null)) continue;

        $titulo = $texto($f, 'titulo');
        if ($titulo === '') continue;

        $categoria = $texto($f, 'categoria');
        $pos  = $texto($f, 'imgPos');
        $size = $texto($f, 'imgSize');

        $fora[] = [
            'titulo'    => $titulo,
            'categoria' => $categoria,
            'slug'      => $categoria !== '' ? jsc_media_slug($categoria) : 'outro',
            'icone'     => isset($icones[$categoria]) ? $icones[$categoria] : '&#128247;',
            'data'      => $texto($f, 'data'),
            'dataPt'    => jsc_data_pt($texto($f, 'data')),
            // jsc_esc_url() rejeita javascript:, vbscript: e data: que não seja
            // de imagem. Uma fotografia cujo endereço seja recusado fica com o
            // cartão de categoria, como se não tivesse endereço nenhum.
            'url'       => jsc_esc_url($texto($f, 'url')) !== '' ? $texto($f, 'url') : '',
            'imgPos'    => $pos !== ''  ? $pos  : 'center',
            'imgSize'   => $size !== '' ? $size : 'cover',
            'descricao' => $texto($f, 'descricao'),
        ];
    }
    return $fora;
}

// A classe da categoria, em minúsculas e sem acentos, para o CSS.
function jsc_media_slug($categoria) {
    $s = strtolower(trim((string)$categoria));
    $s = strtr($s, ['á'=>'a','à'=>'a','ã'=>'a','â'=>'a','é'=>'e','ê'=>'e',
                    'í'=>'i','ó'=>'o','ô'=>'o','õ'=>'o','ú'=>'u','ç'=>'c']);
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    return trim($s, '-') !== '' ? trim($s, '-') : 'outro';
}

// As categorias que têm conteúdo publicável, pela ordem em que aparecem. Não
// se escreve uma lista fixa: uma categoria sem nada não produz botão.
function jsc_media_categorias(array $lista) {
    $fora = [];
    foreach ($lista as $item) {
        $c = isset($item['categoria']) ? $item['categoria'] : '';
        if ($c === '' || in_array($c, $fora, true)) continue;
        $fora[] = $c;
    }
    return $fora;
}

// Os vídeos publicáveis, pela ordem do array. Sem título ou sem um id de
// YouTube válido não é publicado: antes, um endereço que não fosse do YouTube
// gravava sem aviso e produzia um cartão sem miniatura e um iframe vazio.
function jsc_videos(array $conteudo) {
    $lista = (isset($conteudo['videos']) && is_array($conteudo['videos']))
           ? $conteudo['videos'] : [];

    $texto = function ($v, $chave) {
        return (isset($v[$chave]) && is_string($v[$chave])) ? trim($v[$chave]) : '';
    };

    $fora = [];
    foreach ($lista as $v) {
        if (!is_array($v)) continue;
        if (!jsc_media_ativo(isset($v['ativo']) ? $v['ativo'] : null)) continue;

        $titulo = $texto($v, 'titulo');
        if ($titulo === '') continue;

        $id = jsc_video_id($texto($v, 'url'));
        if ($id === '') continue;

        $categoria = $texto($v, 'categoria');

        $fora[] = [
            'titulo'    => $titulo,
            'categoria' => $categoria,
            'slug'      => $categoria !== '' ? jsc_media_slug($categoria) : 'outro',
            'data'      => $texto($v, 'data'),
            'dataPt'    => jsc_data_pt($texto($v, 'data')),
            'descricao' => $texto($v, 'descricao'),
            'videoId'   => $id,
            // Os três endereços são construídos do id validado, nunca do que
            // foi escrito no painel.
            'miniatura' => 'https://img.youtube.com/vi/' . $id . '/hqdefault.jpg',
            'ligacao'   => 'https://www.youtube.com/watch?v=' . $id,
            'embed'     => 'https://www.youtube.com/embed/' . $id . '?autoplay=1&rel=0',
        ];
    }
    return $fora;
}

// =====================================================
// HISTÓRIA DO CLUBE — cronologia e palmarés
// =====================================================
// Estes dois blocos são factos históricos do clube. A regra que os governa é
// diferente de todas as outras da Fase C: onde uma notícia mal preenchida se
// descarta sem perda, um marco histórico perdido não se recupera. Por isso
// aqui não se descarta por falta de campos opcionais — só o que não tem nome
// não pode ser publicado, porque não haveria título nem nome acessível.
//
// Não existe fallback. Havia três cópias completas dos 38 registos no código
// — js/historia.js, admin/js/admin.js e js/pesquisa.js — e saíram as três. A
// semente única está em admin/js/data.js, ao lado dos escalões e das
// modalidades. Base vazia mostra o estado vazio; nunca reaparece história
// escrita no código.

// Está publicado? Campo ausente conta como publicado, para não esconder
// registos que nunca o tiveram. É a mesma regra do jsc_media_ativo() do
// Bloco 7, que agora delega aqui em vez de a repetir.
// Réplica exacta do jscAtivo() do js/html.js.
function jsc_ativo($valor) {
    return $valor !== false;
}

// Ordenação estável por ano, sem depender da estabilidade do sort da
// linguagem. O alojamento de campinense.pt corre PHP 7.4, onde o usort() NÃO
// é estável — só passou a ser no PHP 8.0. Sem o índice como critério de
// desempate, dois títulos do mesmo ano podiam sair em ordens diferentes em
// 7.4 e em 8.3, e a comparação byte a byte do gerador acusava a diferença.
// O Array.prototype.sort() do JavaScript é estável desde o ES2019, logo é o
// índice que garante a paridade entre os dois lados.
//
// Réplica exacta do jscOrdenarPorAno() do js/html.js.
function jsc_ordenar_por_ano(array $lista, $crescente) {
    $com_indice = [];
    foreach ($lista as $i => $item) {
        $com_indice[] = ['i' => $i, 'item' => $item];
    }
    usort($com_indice, function ($a, $b) use ($crescente) {
        $aa = isset($a['item']['_ano']) ? $a['item']['_ano'] : 0;
        $bb = isset($b['item']['_ano']) ? $b['item']['_ano'] : 0;
        if ($aa !== $bb) return $crescente ? ($aa < $bb ? -1 : 1) : ($aa > $bb ? -1 : 1);
        return $a['i'] < $b['i'] ? -1 : ($a['i'] > $b['i'] ? 1 : 0);
    });
    $fora = [];
    foreach ($com_indice as $e) $fora[] = $e['item'];
    return $fora;
}

// O ano de um registo histórico, como número, ou 0 quando não há nenhum
// utilizável. Um ano com texto ('mil novecentos') dá 0: não se adivinha.
// Réplica exacta do jscAnoHistorico() do js/html.js.
function jsc_ano_historico($valor) {
    if (is_int($valor)) return $valor;
    $s = trim((string)$valor);
    if ($s === '' || !preg_match('/^-?\d+$/', $s)) return 0;
    return (int)$s;
}

// Os marcos publicáveis, por ano CRESCENTE — a cronologia lê-se do início
// para o presente. Mesma ordem que o painel mostra.
//
// Um marco sem ano utilizável não é descartado: fica no fim, sem o elemento
// do ano. Perder um facto por causa de um campo mal preenchido seria pior do
// que publicá-lo sem a data.
function jsc_historia(array $conteudo) {
    $lista = (isset($conteudo['historia']) && is_array($conteudo['historia']))
           ? $conteudo['historia'] : [];

    $texto = function ($h, $chave) {
        return (isset($h[$chave]) && is_string($h[$chave])) ? trim($h[$chave]) : '';
    };

    $fora = [];
    foreach ($lista as $h) {
        if (!is_array($h)) continue;
        if (!jsc_ativo(isset($h['ativo']) ? $h['ativo'] : null)) continue;

        // Sem título não há <h3> nem nome acessível: o registo fica nos dados,
        // mas não vai para a página.
        $titulo = $texto($h, 'titulo');
        if ($titulo === '') continue;

        $ano = jsc_ano_historico(isset($h['ano']) ? $h['ano'] : null);

        // jsc_esc_url() recusa javascript:, vbscript: e data: que não seja de
        // imagem. Um endereço recusado conta como ausente: o marco sai sem
        // imagem, em vez de produzir <img src="">, que em vários browsers
        // reemite o pedido do próprio documento.
        $imagem = $texto($h, 'imagem');
        if ($imagem !== '' && jsc_esc_url($imagem) === '') $imagem = '';

        $fora[] = [
            '_ano'      => $ano === 0 ? PHP_INT_MAX : $ano,  // sem ano vai para o fim
            'ano'       => $ano === 0 ? '' : (string)$ano,
            'titulo'    => $titulo,
            'descricao' => $texto($h, 'descricao'),
            'imagem'    => $imagem,
            'destaque'  => !empty($h['destaque']),
        ];
    }

    $fora = jsc_ordenar_por_ano($fora, true);
    foreach ($fora as &$e) unset($e['_ano']);
    unset($e);
    return $fora;
}

// Os títulos publicáveis, por ano DECRESCENTE — o palmarés lê-se do mais
// recente para trás. Mesma ordem que o painel mostra.
//
// Sem competição não é publicado: é o nome do título, e sem ele o cartão não
// diz nada. Um título sem ano fica no fim, sem o ano.
function jsc_palmares(array $conteudo) {
    $lista = (isset($conteudo['palmares']) && is_array($conteudo['palmares']))
           ? $conteudo['palmares'] : [];

    $texto = function ($t, $chave) {
        return (isset($t[$chave]) && is_string($t[$chave])) ? trim($t[$chave]) : '';
    };

    $fora = [];
    foreach ($lista as $t) {
        if (!is_array($t)) continue;
        if (!jsc_ativo(isset($t['ativo']) ? $t['ativo'] : null)) continue;

        $competicao = $texto($t, 'competicao');
        if ($competicao === '') continue;

        $ano = jsc_ano_historico(isset($t['ano']) ? $t['ano'] : null);

        $fora[] = [
            '_ano'       => $ano === 0 ? PHP_INT_MIN : $ano,  // sem ano vai para o fim
            'ano'        => $ano === 0 ? '' : (string)$ano,
            'competicao' => $competicao,
            // O escalão guarda hoje grupos etários ('Sub-17'), designações
            // ('Traquinas A', 'Sen. Femininos') e nomes de atletas. É texto
            // livre de propósito: um <select> fechado apagava-os ao editar.
            'escalao'    => $texto($t, 'escalao'),
            'observacao' => $texto($t, 'observacao'),
        ];
    }

    $fora = jsc_ordenar_por_ano($fora, false);
    foreach ($fora as &$e) unset($e['_ano']);
    unset($e);
    return $fora;
}

// O endereço oficial do site. Está aqui uma vez, e é daqui que saem os
// endereços absolutos dos dados estruturados e do sitemap. Sem barra no fim.
//
// Não substitui os canonicals das páginas, que continuam escritos no HTML de
// cada uma: isso exigiria uma região no <head> de 17 páginas, e não foi
// autorizado neste bloco.
if (!defined('JSC_SITE_URL')) define('JSC_SITE_URL', 'https://campinense.pt');

// =====================================================
// IDENTIDADE INSTITUCIONAL — rodapé, dados estruturados e sitemap
// =====================================================
// Duas estruturas persistentes, uma por tipo de informação:
//   dados_clube  identidade (nome, sigla, ano, logótipo)
//   siteConfig   contactos, redes sociais e texto editorial
//
// Nenhuma delas é nova, e não se criou campo nenhum. O que se fez foi ligar o
// que já era administrável ao que é publicado: o nome oficial do clube era
// editável no painel e não chegava a sítio nenhum, e a morada, o telefone e o
// e-mail do painel não chegavam aos dados estruturados.
//
// Regra em toda esta zona: campo vazio não produz elemento, ligação nem
// propriedade. Não se inventa nada, e não há valor por omissão.

// O nome oficial do clube. Fonte única: dados_clube.nome.
function jsc_clube_nome(array $conteudo) {
    $c = (isset($conteudo['dadosClube']) && is_array($conteudo['dadosClube']))
       ? $conteudo['dadosClube'] : [];
    return (isset($c['nome']) && is_string($c['nome'])) ? trim($c['nome']) : '';
}

// O ano de fundação, ou '' — quatro dígitos e nada mais. Mesma regra do
// js/seo.js desde o Bloco 8: campo vazio não inventa 1947.
function jsc_clube_ano(array $conteudo) {
    $c = (isset($conteudo['dadosClube']) && is_array($conteudo['dadosClube']))
       ? $conteudo['dadosClube'] : [];
    $ano = isset($c['ano']) ? trim((string)$c['ano']) : '';
    return preg_match('/^\d{4}$/', $ano) ? $ano : '';
}

// A sigla / nome abreviado do clube. Fonte única: dados_clube.sigla.
function jsc_clube_sigla(array $conteudo) {
    $c = (isset($conteudo['dadosClube']) && is_array($conteudo['dadosClube']))
       ? $conteudo['dadosClube'] : [];
    return (isset($c['sigla']) && is_string($c['sigla'])) ? trim($c['sigla']) : '';
}

// Um campo de texto do siteConfig, já aparado.
function jsc_config_texto(array $conteudo, $chave) {
    $cfg = (isset($conteudo['siteConfig']) && is_array($conteudo['siteConfig']))
         ? $conteudo['siteConfig'] : [];
    return (isset($cfg[$chave]) && is_string($cfg[$chave])) ? trim($cfg[$chave]) : '';
}

// Contactos publicáveis. Cada um vem vazio quando não está preenchido, e é o
// modelo que decide não escrever a linha.
function jsc_contactos(array $conteudo) {
    return [
        'morada'   => jsc_config_texto($conteudo, 'contactAddress'),
        'telefone' => jsc_config_texto($conteudo, 'contactPhone'),
        'email'    => jsc_config_texto($conteudo, 'contactEmail'),
        'tagline'  => jsc_config_texto($conteudo, 'footerTagline'),
    ];
}

// As redes sociais com endereço válido, pela ordem em que aparecem no rodapé.
//
// Sem endereço, o botão não é escrito. Antes ficava com href="#": eram 54
// ligações mortas em 16 páginas, porque não existem endereços por omissão.
//
// O jsc_href_seguro() é o mesmo que filtra as ligações dos textos legais, e
// tem gémeo em JavaScript (jscHrefSeguro, em js/html.js).
function jsc_redes(array $conteudo) {
    if (!function_exists('jsc_href_seguro')) {
        require_once __DIR__ . '/sanitizar.php';
    }
    $wa = jsc_config_texto($conteudo, 'socialWhatsappUrl');
    $bruto = [
        ['chave' => 'Instagram', 'url' => jsc_config_texto($conteudo, 'socialInstagramUrl')],
        ['chave' => 'Facebook',  'url' => jsc_config_texto($conteudo, 'socialFacebookUrl')],
        // O painel guarda só os dígitos do WhatsApp; o endereço monta-se aqui,
        // como o js/site-config.js faz.
        ['chave' => 'WhatsApp',  'url' => $wa !== '' ? 'https://wa.me/' . preg_replace('/\D/', '', $wa) : ''],
    ];
    $fora = [];
    foreach ($bruto as $r) {
        if ($r['url'] === '') continue;
        $seguro = jsc_href_seguro($r['url']);
        if ($seguro === null || $seguro === '') continue;
        $r['url'] = $seguro;
        $fora[] = $r;
    }
    return $fora;
}

// Os dados estruturados do clube, prontos a serializar.
//
// Estavam escritos à mão no js/seo.js — 14 das 15 propriedades — e só existiam
// com JavaScript. Passam a ser derivados das duas fontes únicas e escritos no
// HTML gerado, com o JavaScript a servir de melhoria progressiva.
//
// Uma propriedade sem valor NÃO é escrita: uma morada incompleta ou um sameAs
// vazio nos dados estruturados é pior do que a ausência, porque os motores de
// busca citam-nos como se fossem do clube.
function jsc_dados_estruturados(array $conteudo) {
    $nome = jsc_clube_nome($conteudo);
    $c    = jsc_contactos($conteudo);
    $ano  = jsc_clube_ano($conteudo);

    $org = [
        '@context' => 'https://schema.org',
        '@type'    => 'SportsOrganization',
    ];
    if ($nome !== '') $org['name'] = $nome;
    // O alternateName estava escrito à mão no js/seo.js como 'JS Campinense';
    // passa a vir do campo Sigla do painel.
    $sigla = jsc_clube_sigla($conteudo);
    if ($sigla !== '' && $sigla !== $nome) $org['alternateName'] = $sigla;
    $org['url']  = JSC_SITE_URL;
    $org['logo'] = JSC_SITE_URL . '/images/logo.png';
    $org['sport'] = 'Football';
    // Descrição confirmada pelo clube. Fica no código por ser o único texto
    // desta zona que não tem campo no painel; não se inventou nem se alterou.
    $org['description'] = 'Clube desportivo de Loulé, Algarve, com escalões de formação de Sub-5 a Sub-19.';
    if ($ano !== '') $org['foundingDate'] = $ano;

    // A morada vem de um campo só, com um <br> a separar a rua do código
    // postal. Sem uma segunda linha reconhecível não se parte em campos: só o
    // streetAddress, que é verdade, em vez de um postalCode adivinhado.
    if ($c['morada'] !== '') {
        $linhas = preg_split('~\s*<br\s*/?>\s*~i', $c['morada']);
        $linhas = array_values(array_filter(array_map('trim', $linhas), function ($l) { return $l !== ''; }));
        $endereco = ['@type' => 'PostalAddress'];
        $endereco['streetAddress'] = strip_tags($linhas[0]);
        if (count($linhas) > 1) {
            $segunda = strip_tags($linhas[1]);
            if (preg_match('/^(\d{4}-\d{3})\s+(.+?)(?:,.*)?$/u', $segunda, $m)) {
                $endereco['postalCode']      = $m[1];
                $endereco['addressLocality'] = trim($m[2]);
            } else {
                $endereco['addressLocality'] = $segunda;
            }
        }
        $endereco['addressCountry'] = 'PT';
        $org['address'] = $endereco;
    }

    // O contactPoint só existe se tiver por onde contactar.
    $ponto = ['@type' => 'ContactPoint', 'contactType' => 'customer service',
              'availableLanguage' => 'Portuguese'];
    $tem = false;
    if ($c['telefone'] !== '') { $ponto['telephone'] = $c['telefone']; $tem = true; }
    if ($c['email'] !== '')    { $ponto['email']     = $c['email'];    $tem = true; }
    if ($tem) $org['contactPoint'] = $ponto;

    // sameAs só com endereços válidos.
    $redes = jsc_redes($conteudo);
    if ($redes) {
        $org['sameAs'] = array_values(array_map(function ($r) { return $r['url']; }, $redes));
    }

    $site = [
        '@context' => 'https://schema.org',
        '@type'    => 'WebSite',
        'url'      => JSC_SITE_URL,
        'potentialAction' => [
            '@type'  => 'SearchAction',
            'target' => [
                '@type'       => 'EntryPoint',
                'urlTemplate' => JSC_SITE_URL . '/pesquisa.html?q={search_term_string}',
            ],
            'query-input' => 'required name=search_term_string',
        ],
    ];
    if ($nome !== '') $site['name'] = $nome;

    return [$org, $site];
}

// As páginas que entram no sitemap, com a prioridade e a frequência que já
// estavam no ficheiro estático.
//
// A lista é fixa e explícita, e é isso que se quer: não se varre a pasta, para
// que acrescentar um ficheiro HTML não o ponha no sitemap por acidente.
//
// Fora, e porquê:
//   admin/, api/, modelos/   não são conteúdo; o Apache devolve 403 ou o painel
//                            tem autenticação própria
//   manutencao, offline, 404 existem para o visitante, não para os motores
//   pesquisa                 resultados de pesquisa interna, com noindex
//   atleta                   página individual de atleta
//   modalidade, escalao      só existem preenchidas por parâmetro, e o canonical
//                            de cada uma aponta para a página base, que sem
//                            parâmetro mostra "não encontrada". Listar um
//                            endereço que mostra um estado de erro é pior do que
//                            não o listar.
function jsc_sitemap_paginas() {
    return [
        ['loc' => '/',                       'freq' => 'weekly',  'pri' => '1.0'],
        ['loc' => '/noticias.html',          'freq' => 'daily',   'pri' => '0.9'],
        ['loc' => '/agenda.html',            'freq' => 'weekly',  'pri' => '0.8'],
        ['loc' => '/resultados.html',        'freq' => 'weekly',  'pri' => '0.8'],
        ['loc' => '/inscricao.html',         'freq' => 'monthly', 'pri' => '0.8'],
        ['loc' => '/galeria.html',           'freq' => 'monthly', 'pri' => '0.7'],
        ['loc' => '/videos.html',            'freq' => 'monthly', 'pri' => '0.7'],
        ['loc' => '/equipa-principal.html',  'freq' => 'monthly', 'pri' => '0.7'],
        ['loc' => '/formacao.html',          'freq' => 'monthly', 'pri' => '0.7'],
        ['loc' => '/historia.html',          'freq' => 'yearly',  'pri' => '0.6'],
        ['loc' => '/contacto.html',          'freq' => 'yearly',  'pri' => '0.6'],
        ['loc' => '/patrocinadores.html',    'freq' => 'monthly', 'pri' => '0.5'],
        ['loc' => '/privacidade.html',       'freq' => 'yearly',  'pri' => '0.3'],
    ];
}

// A data que o sitemap declara: o dia da publicação que o gerou. Era
// 2026-07-01 escrito à mão em todas as 14 entradas.
function jsc_sitemap_data(array $conteudo) {
    $p = jsc_publicado_em($conteudo);
    if ($p !== '' && preg_match('/^(\d{4}-\d{2}-\d{2})/', $p, $m)) return $m[1];
    return gmdate('Y-m-d');
}
