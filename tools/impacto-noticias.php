<?php
// =====================================================
// IMPACTO DO FILTRO NAS NOTÍCIAS JÁ ESCRITAS
// =====================================================
// Mostra o que o filtro mudaria nas notícias que já estão guardadas, sem
// alterar coisa nenhuma. Serve para decidir com números à frente se vale
// a pena tratar o que já lá está.
//
// Uso:
//     php tools/impacto-noticias.php data/db.json
//     php tools/impacto-noticias.php backup-campinense-2026-09-24.json
//     php tools/impacto-noticias.php ficheiro.json --detalhe
//
// Aceita o data/db.json do servidor ou um ficheiro de backup exportado
// pelo painel. Não escreve nada: só lê e conta.
// =====================================================

require_once __DIR__ . '/../api/sanitizar.php';

$ficheiro = $argv[1] ?? null;
$detalhe  = in_array('--detalhe', $argv, true);

if (!$ficheiro || !is_file($ficheiro)) {
    fwrite(STDERR, "Indique o ficheiro a analisar.\n\n"
        . "    php tools/impacto-noticias.php data/db.json\n"
        . "    php tools/impacto-noticias.php backup-campinense-AAAA-MM-DD.json\n\n"
        . "Junte --detalhe para ver o antes e o depois de cada notícia.\n");
    exit(2);
}

$dados = json_decode(file_get_contents($ficheiro), true);
if (!is_array($dados)) { fwrite(STDERR, "Não consegui ler o JSON de $ficheiro.\n"); exit(2); }

$noticias = $dados['noticias'] ?? null;
if (!is_array($noticias)) { fwrite(STDERR, "Não encontrei notícias em $ficheiro.\n"); exit(2); }

function jsc_inventario($html) {
    $tags = [];
    if (preg_match_all('/<([a-zA-Z][a-zA-Z0-9]*)/', $html, $m)) {
        foreach ($m[1] as $t) $tags[strtolower($t)] = true;
    }
    $attrs = [];
    if (preg_match_all('/\s([a-zA-Z-]+)\s*=/', $html, $m)) {
        foreach ($m[1] as $a) $attrs[strtolower($a)] = true;
    }
    return [array_keys($tags), array_keys($attrs)];
}

$total = count($noticias);
$mudadas = 0;
$semTexto = 0;
$tagsRemovidas = [];
$attrsRemovidos = [];
$soEspacos = 0;
$linhas = [];

foreach ($noticias as $n) {
    $antes = (is_array($n) && isset($n['resumo']) && is_string($n['resumo'])) ? $n['resumo'] : '';
    if (trim($antes) === '') { $semTexto++; continue; }

    $depois = jsc_sanitizar_noticia($antes);
    if ($depois === $antes) continue;

    // Diferença só de espaços e aspas na serialização não é perda de nada.
    $norm = function ($s) { return preg_replace('/\s+/', ' ', strip_tags($s)); };
    $mesmoTexto = $norm($antes) === $norm($depois);

    [$tagsA, $attrsA] = jsc_inventario($antes);
    [$tagsD, $attrsD] = jsc_inventario($depois);
    $tagsFora  = array_values(array_diff($tagsA, $tagsD));
    $attrsFora = array_values(array_diff($attrsA, $attrsD));

    if (!$tagsFora && !$attrsFora && $mesmoTexto) { $soEspacos++; continue; }

    $mudadas++;
    foreach ($tagsFora as $t)  $tagsRemovidas[$t]  = ($tagsRemovidas[$t] ?? 0) + 1;
    foreach ($attrsFora as $a) $attrsRemovidos[$a] = ($attrsRemovidos[$a] ?? 0) + 1;

    $linhas[] = [
        'id'     => $n['id'] ?? '?',
        'titulo' => mb_substr((string)($n['titulo'] ?? '(sem título)'), 0, 54),
        'tags'   => $tagsFora,
        'attrs'  => $attrsFora,
        'texto'  => $mesmoTexto ? 'igual' : 'MUDA',
        'antes'  => $antes,
        'depois' => $depois,
    ];
}

echo "\nFicheiro: $ficheiro\n";
echo str_repeat('─', 62), "\n";
printf("%-42s %d\n", 'notícias analisadas', $total);
printf("%-42s %d\n", 'sem texto', $semTexto);
printf("%-42s %d\n", 'sem qualquer alteração', $total - $semTexto - $mudadas - $soEspacos);
printf("%-42s %d\n", 'só diferenças de espaços/aspas', $soEspacos);
printf("%-42s %d\n", 'COM ELEMENTOS OU ATRIBUTOS REMOVIDOS', $mudadas);
echo str_repeat('─', 62), "\n";

if ($tagsRemovidas) {
    echo "\nElementos que seriam removidos:\n";
    arsort($tagsRemovidas);
    foreach ($tagsRemovidas as $t => $n) printf("  <%s>%s em %d notícia(s)\n", $t, str_repeat(' ', max(1, 14 - strlen($t))), $n);
}
if ($attrsRemovidos) {
    echo "\nAtributos que seriam removidos:\n";
    arsort($attrsRemovidos);
    foreach ($attrsRemovidos as $a => $n) printf("  %-16s em %d notícia(s)\n", $a, $n);
}

if ($mudadas) {
    echo "\nNotícias afetadas:\n";
    foreach ($linhas as $l) {
        printf("  #%-6s %-56s texto: %s\n", $l['id'], $l['titulo'], $l['texto']);
        if ($l['tags'])  echo "          elementos: ", implode(', ', $l['tags']), "\n";
        if ($l['attrs']) echo "          atributos: ", implode(', ', $l['attrs']), "\n";
        if ($detalhe) {
            echo "          antes : ", mb_substr($l['antes'], 0, 300), "\n";
            echo "          depois: ", mb_substr($l['depois'], 0, 300), "\n";
        }
    }
    echo "\nNenhuma destas notícias foi alterada. Este comando só lê.\n";
    echo "As notícias já guardadas continuam como estão até haver decisão.\n";
} else {
    echo "\nNenhuma notícia perderia formatação. Este comando só lê.\n";
}
echo "\n";
exit($mudadas ? 1 : 0);
