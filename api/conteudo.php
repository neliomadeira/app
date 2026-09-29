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
