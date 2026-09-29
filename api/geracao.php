<?php
// =====================================================
// GERAÇÃO DAS PÁGINAS — transação com diário
// =====================================================
// Escreve o conteúdo publicado dentro das páginas HTML, para que quem visita
// o site veja as notícias mesmo sem JavaScript.
//
// O princípio é o de uma transação: ou a publicação fica inteira, ou não
// acontece. Nunca pode ficar o site com uma página nova e outra antiga, nem
// com o data/db.json novo e o HTML antigo.
//
//   1. reparar    — se ficou um diário de uma publicação interrompida,
//                   restaura a última versão válida antes de tudo
//   2. dividir    — cada página é cortada nas duas marcas: o que está fora
//                   delas não é sequer analisado, só copiado byte a byte
//   3. gerar      — o bloco novo é escrito em data/publicacao/novo/
//   4. validar    — todos os ficheiros, antes de promover qualquer um.
//                   Um único erro aqui aborta sem tocar na versão pública.
//   5. backup     — cópia da versão atual + diário da transação
//   6. promover   — rename() de cada ficheiro. É atómico por ficheiro: nunca
//                   se serve um ficheiro a meio. Se uma falhar, as que já
//                   foram promovidas voltam atrás imediatamente.
//   7. confirmar  — sha256 no destino igual ao validado; só então o diário
//                   é apagado. Enquanto existir, a publicação seguinte sabe
//                   que a anterior não terminou e restaura.
//
// O backup fica em data/publicacao/anterior/ e serve o "reverter".
// =====================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/conteudo.php';

// Os modelos recusam-se a correr sem isto: pedidos diretamente não têm
// contexto e não devem responder nada.
define('JSC_GERACAO', true);

define('JSC_RAIZ',       dirname(__DIR__));
define('JSC_PUB',        dirname(__DIR__) . '/data/publicacao');
define('JSC_PUB_NOVO',   JSC_PUB . '/novo');
define('JSC_PUB_ANT',    JSC_PUB . '/anterior');
define('JSC_PUB_DIARIO', JSC_PUB . '/transacao.json');

// ---------------------------------------------------------------------
// Que blocos existem
// ---------------------------------------------------------------------
// Um bloco = um par de marcas dentro de um ficheiro + o modelo que escreve
// o que vai lá dentro + o que validar no resultado. Acrescentar um bloco
// novo (agenda, resultados, ...) é acrescentar uma entrada aqui.
function jsc_blocos() {
    return [
        'noticias' => [
            'ficheiro' => 'index.html',
            'modelo'   => 'noticias-inicio.php',
            'inicio'   => '<!-- JSC:noticias:inicio -->',
            'fim'      => '<!-- JSC:noticias:fim -->',
            // Variáveis entregues ao modelo.
            'dados'    => function (array $conteudo) {
                return [
                    'noticias' => jsc_noticias($conteudo),
                    'total'    => jsc_total_noticias($conteudo),
                    'limite'   => jsc_limite_noticias($conteudo),
                ];
            },
            // Validação própria: tantos cartões quantas as notícias, e o
            // contentor que o JavaScript procura tem de continuar lá.
            'validar'  => function ($meio, array $conteudo) {
                $erros = [];
                $esperados = count(jsc_noticias($conteudo));
                $obtidos   = substr_count($meio, '<article class="news-card');
                if ($obtidos !== $esperados) {
                    $erros[] = "gerou $obtidos cartões, esperava $esperados";
                }
                if (strpos($meio, 'id="newsGrid"') === false) {
                    $erros[] = 'o bloco gerado não tem o contentor id="newsGrid"';
                }
                if ($esperados === 0 && strpos($meio, 'jsc-vazio') === false) {
                    $erros[] = 'sem notícias, o bloco tem de manter a mensagem de lista vazia';
                }
                return $erros;
            },
        ],
    ];
}

// Ficheiros que esta transação tem autorização para escrever. Um diário
// alterado à mão não consegue apontar para fora desta lista.
function jsc_alvos_permitidos() {
    $lista = ['data/db.json'];
    foreach (jsc_blocos() as $b) $lista[] = $b['ficheiro'];
    return $lista;
}

function jsc_nome_plano($relativo) {
    return str_replace('/', '__', $relativo);
}

// ---------------------------------------------------------------------
// Auxiliares de ficheiros
// ---------------------------------------------------------------------
// Escrita que só substitui o destino depois de o conteúdo estar todo em
// disco. Devolve false se escrever menos bytes do que os pedidos (disco
// cheio) ou se a releitura não der exatamente o mesmo.
function jsc_escrever_verificado($caminho, $bytes) {
    $tmp = $caminho . '.tmp';
    $n = @file_put_contents($tmp, $bytes);
    if ($n !== strlen($bytes)) { @unlink($tmp); return false; }
    if (@file_get_contents($tmp) !== $bytes) { @unlink($tmp); return false; }
    if (!@rename($tmp, $caminho)) { @unlink($tmp); return false; }
    return true;
}

function jsc_restaurar($backup, $destino) {
    if (!is_file($backup)) return false;
    $bytes = @file_get_contents($backup);
    if ($bytes === false) return false;
    return jsc_escrever_verificado($destino, $bytes);
}

function jsc_limpar_pasta($dir) {
    if (!is_dir($dir)) return;
    foreach (scandir($dir) as $f) {
        if ($f === '.' || $f === '..' || $f === '.htaccess') continue;
        $p = $dir . '/' . $f;
        if (is_file($p)) @unlink($p);
    }
}

// ---------------------------------------------------------------------
// 1. Reparar uma transação interrompida
// ---------------------------------------------------------------------
// O diário só sobrevive se o processo morreu entre a primeira promoção e a
// confirmação final. Nesse caso não se sabe em que estado ficou o conjunto,
// por isso restaura-se tudo o que ele lista — restaurar um ficheiro que já
// estava na versão antiga não faz diferença nenhuma.
function jsc_reparar_transacao(&$avisos) {
    if (!is_file(JSC_PUB_DIARIO)) return true;
    $t = json_decode((string)@file_get_contents(JSC_PUB_DIARIO), true);
    $permitidos = jsc_alvos_permitidos();
    $ok = true;
    $repostos = 0;
    if (is_array($t) && isset($t['ficheiros']) && is_array($t['ficheiros'])) {
        foreach ($t['ficheiros'] as $f) {
            if (!is_array($f) || !isset($f['destino'])) continue;
            if (!in_array($f['destino'], $permitidos, true)) { $ok = false; continue; }
            $backup = JSC_PUB_ANT . '/' . jsc_nome_plano($f['destino']);
            if (!is_file($backup)) continue;
            if (jsc_restaurar($backup, JSC_RAIZ . '/' . $f['destino'])) $repostos++;
            else $ok = false;
        }
    }
    if ($ok) {
        @unlink(JSC_PUB_DIARIO);
        $avisos[] = 'uma publicação anterior não tinha terminado: a última versão válida foi restaurada'
                  . ($repostos ? " ($repostos ficheiro(s))" : '');
    }
    return $ok;
}

// ---------------------------------------------------------------------
// 2. Dividir pelas marcas
// ---------------------------------------------------------------------
// Devolve [prefixo, meio, sufixo]. O prefixo inclui a marca de início e o
// sufixo a marca de fim: as marcas contam como HTML manual e também não
// podem mudar.
function jsc_dividir($html, array $b, &$erro) {
    $ni = substr_count($html, $b['inicio']);
    $nf = substr_count($html, $b['fim']);
    if ($ni !== 1) { $erro = "a marca de início aparece $ni vez(es), tem de aparecer exatamente uma"; return false; }
    if ($nf !== 1) { $erro = "a marca de fim aparece $nf vez(es), tem de aparecer exatamente uma"; return false; }
    $pi = strpos($html, $b['inicio']) + strlen($b['inicio']);
    $pf = strpos($html, $b['fim']);
    if ($pf < $pi) { $erro = 'as marcas estão fora de ordem'; return false; }
    return [substr($html, 0, $pi), substr($html, $pi, $pf - $pi), substr($html, $pf)];
}

// ---------------------------------------------------------------------
// 3. Gerar o bloco
// ---------------------------------------------------------------------
function jsc_gerar_bloco($nome, array $b, array $conteudo, $gerado, &$erro) {
    $modelo = JSC_RAIZ . '/modelos/' . $b['modelo'];
    if (!is_file($modelo)) { $erro = 'o modelo modelos/' . $b['modelo'] . ' não existe'; return null; }

    $vars = call_user_func($b['dados'], $conteudo);
    $vars['gerado'] = $gerado;

    ob_start();
    try {
        extract($vars, EXTR_SKIP);
        include $modelo;
    } catch (Throwable $e) {
        ob_end_clean();
        $erro = 'o modelo falhou: ' . $e->getMessage();
        return null;
    }
    $saida = ob_get_clean();
    if ($saida === false || trim($saida) === '') { $erro = 'o modelo não escreveu nada'; return null; }

    // Um aviso do PHP impresso pelo modelo iria direto para o site.
    foreach (['Fatal error', 'Parse error', 'Warning:', 'Notice:', 'Deprecated:'] as $marca) {
        if (strpos($saida, $marca) !== false) {
            $erro = 'o modelo escreveu uma mensagem de erro do PHP (' . $marca . ')';
            return null;
        }
    }

    // A marca de fim fica indentada como no ficheiro: o meio acaba com a
    // indentação dessa linha.
    return "\n" . rtrim($saida, "\n") . "\n      ";
}

// ---------------------------------------------------------------------
// 4. Validar
// ---------------------------------------------------------------------
function jsc_validar_html(array $alvo, array $conteudo) {
    $erros = [];
    $b     = $alvo['bloco'];
    $novo  = $alvo['bytes'];
    $orig  = $alvo['original'];
    $rel   = $alvo['relativo'];

    // (a) Dividir outra vez o resultado e comparar o que está fora das
    //     marcas com o original, por hash. É esta a garantia de que o HTML
    //     manual não foi tocado.
    $erroDiv = '';
    $novoPartes = jsc_dividir($novo, $b, $erroDiv);
    if (!$novoPartes) { $erros[] = "$rel: o ficheiro gerado não passa na divisão pelas marcas ($erroDiv)"; return $erros; }
    $origPartes = jsc_dividir($orig, $b, $erroDiv);
    if (!$origPartes) { $erros[] = "$rel: o ficheiro original deixou de passar na divisão ($erroDiv)"; return $erros; }
    if (hash('sha256', $novoPartes[0]) !== hash('sha256', $origPartes[0])) {
        $erros[] = "$rel: o HTML antes da marca de início mudou";
    }
    if (hash('sha256', $novoPartes[2]) !== hash('sha256', $origPartes[2])) {
        $erros[] = "$rel: o HTML depois da marca de fim mudou";
    }

    $meio = $novoPartes[1];

    // (b) Validação própria do bloco.
    foreach (call_user_func($b['validar'], $meio, $conteudo) as $e) $erros[] = "$rel: $e";

    // (c) Etiquetas equilibradas no bloco gerado. Apanha uma geração
    //     truncada, que o parser mais tolerante ainda aceitaria.
    foreach (['article', 'div', 'p', 'h3', 'time', 'a', 'span'] as $tag) {
        $abre  = preg_match_all('/<' . $tag . '(\s|>)/i', $meio);
        $fecha = preg_match_all('/<\/' . $tag . '\s*>/i', $meio);
        if ($abre !== $fecha) {
            $erros[] = "$rel: <$tag> abre $abre vez(es) e fecha $fecha no bloco gerado";
        }
    }

    // (d) O bloco gerado, e só ele, passado por um parser a sério.
    $doc = new DOMDocument();
    $anterior = libxml_use_internal_errors(true);
    libxml_clear_errors();
    $doc->loadHTML('<meta http-equiv="Content-Type" content="text/html; charset=utf-8">'
                 . '<div id="jsc-fragmento">' . $meio . '</div>');
    foreach (libxml_get_errors() as $e) {
        // 801 = etiqueta desconhecida. O parser do libxml é de antes do
        // HTML5 e não conhece <article> nem <time>: isso não é erro de
        // estrutura, que é o que aqui interessa apanhar.
        if ((int)$e->code === 801) continue;
        if ($e->level >= LIBXML_ERR_ERROR) {
            $erros[] = "$rel: HTML inválido no bloco gerado — " . trim($e->message);
        }
    }
    libxml_clear_errors();
    libxml_use_internal_errors($anterior);

    // (e) O ficheiro novo tem de continuar a ter o HTML manual todo.
    $minimo = (int)((strlen($orig) - strlen($origPartes[1])) * 0.9);
    if (strlen($novo) < $minimo) {
        $erros[] = "$rel: ficou com " . strlen($novo) . " bytes, menos do que os $minimo mínimos — o HTML manual não sobreviveu";
    }

    return $erros;
}

function jsc_validar_json(array $alvo) {
    $erros = [];
    $d = json_decode($alvo['bytes'], true);
    if (!is_array($d)) $erros[] = $alvo['relativo'] . ': o conteúdo a gravar não é JSON válido';
    return $erros;
}

// ---------------------------------------------------------------------
// A publicação
// ---------------------------------------------------------------------
// $conteudo  o conteúdo publicado (já validado por quem chama)
// $jsonNovo  os bytes exatos a gravar em data/db.json, ou null para apenas
//            regenerar as páginas a partir do que já está publicado
function jsc_publicar(array $conteudo, $jsonNovo = null, $porQuem = '') {
    $erros = [];
    $avisos = [];

    $falhar = function ($erros, $avisos, $revertido = false) {
        jsc_limpar_pasta(JSC_PUB_NOVO);
        return ['ok' => false, 'erros' => $erros, 'avisos' => $avisos,
                'ficheiros' => [], 'revertido' => $revertido];
    };

    // 1. Reparar antes de tudo.
    if (!jsc_reparar_transacao($avisos)) {
        return $falhar(['ficou uma publicação anterior interrompida que não foi possível restaurar — '
                      . 'o site mantém-se como está; ver data/publicacao/transacao.json'], $avisos);
    }

    foreach ([JSC_PUB, JSC_PUB_NOVO, JSC_PUB_ANT] as $d) {
        if (!is_dir($d) && !@mkdir($d, 0755, true)) $erros[] = 'não foi possível criar ' . $d;
    }
    if ($erros) return $falhar($erros, $avisos);
    jsc_limpar_pasta(JSC_PUB_NOVO);

    // 2+3. Gerar tudo para a área temporária.
    $alvos  = [];
    $gerado = jsc_publicado_em($conteudo);

    foreach (jsc_blocos() as $nome => $b) {
        $destino = JSC_RAIZ . '/' . $b['ficheiro'];
        if (!is_file($destino)) { $erros[] = $b['ficheiro'] . ': não existe'; continue; }
        $orig = @file_get_contents($destino);
        if ($orig === false) { $erros[] = $b['ficheiro'] . ': não foi possível ler'; continue; }

        $erro = '';
        $partes = jsc_dividir($orig, $b, $erro);
        if (!$partes) { $erros[] = $b['ficheiro'] . ': ' . $erro; continue; }

        $meio = jsc_gerar_bloco($nome, $b, $conteudo, $gerado, $erro);
        if ($meio === null) { $erros[] = $b['ficheiro'] . ': ' . $erro; continue; }

        $alvos[] = [
            'tipo' => 'html', 'nome' => $nome, 'relativo' => $b['ficheiro'],
            'destino' => $destino, 'bloco' => $b, 'original' => $orig,
            'bytes' => $partes[0] . $meio . $partes[2],
        ];
    }

    if ($jsonNovo !== null) {
        $alvos[] = [
            'tipo' => 'json', 'nome' => 'db', 'relativo' => 'data/db.json',
            'destino' => DATA_FILE, 'bytes' => $jsonNovo,
            'original' => is_file(DATA_FILE) ? (string)@file_get_contents(DATA_FILE) : null,
        ];
    }

    if ($erros) return $falhar($erros, $avisos);
    if (!$alvos) return $falhar(['não havia nada para gerar'], $avisos);

    // 4. Validar tudo, e só depois escrever a área temporária.
    foreach ($alvos as $a) {
        $e = $a['tipo'] === 'html' ? jsc_validar_html($a, $conteudo) : jsc_validar_json($a);
        foreach ($e as $x) $erros[] = $x;
    }
    if ($erros) return $falhar($erros, $avisos);

    foreach ($alvos as $i => $a) {
        $tmp = JSC_PUB_NOVO . '/' . jsc_nome_plano($a['relativo']);
        if (!jsc_escrever_verificado($tmp, $a['bytes'])) {
            return $falhar([$a['relativo'] . ': não foi possível escrever a versão nova na área temporária '
                          . '(espaço em disco ou permissões) — a versão pública não foi tocada'], $avisos);
        }
        $alvos[$i]['tmp'] = $tmp;
        $alvos[$i]['sha'] = hash('sha256', $a['bytes']);
    }

    // 5. Backup da versão atual + diário.
    $diario = ['iniciada' => date('c'), 'por' => (string)$porQuem, 'ficheiros' => []];
    foreach ($alvos as $a) {
        if ($a['original'] === null) {           // ficheiro que ainda não existia
            $diario['ficheiros'][] = ['destino' => $a['relativo'], 'novo' => true];
            continue;
        }
        $backup = JSC_PUB_ANT . '/' . jsc_nome_plano($a['relativo']);
        if (!jsc_escrever_verificado($backup, $a['original'])
            || hash_file('sha256', $backup) !== hash('sha256', $a['original'])) {
            return $falhar([$a['relativo'] . ': não foi possível guardar o backup — publicação abortada '
                          . 'antes de tocar na versão pública'], $avisos);
        }
        $diario['ficheiros'][] = [
            'destino' => $a['relativo'],
            'sha256_antes' => hash('sha256', $a['original']),
        ];
    }

    if (!jsc_escrever_verificado(JSC_PUB_DIARIO, json_encode($diario, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT))) {
        return $falhar(['não foi possível escrever o diário da transação — publicação abortada '
                      . 'antes de tocar na versão pública'], $avisos);
    }

    // 6. Promover. Daqui para a frente já não há geração nem validação: só
    //    mudanças de nome, com os bytes todos em disco. Se alguma falhar,
    //    volta atrás tudo o que já foi promovido.
    $promovidos = [];
    foreach ($alvos as $a) {
        $modo = is_file($a['destino']) ? (fileperms($a['destino']) & 0777) : 0644;
        @chmod($a['tmp'], $modo);
        if (!@rename($a['tmp'], $a['destino'])) {
            $reverteu = jsc_reverter_promovidos($promovidos, $erros);
            @unlink(JSC_PUB_DIARIO);
            $erros[] = $a['relativo'] . ': a promoção falhou';
            return $falhar($erros, $avisos, $reverteu);
        }
        $promovidos[] = $a;
    }

    // 7. Confirmar no destino e só então fechar o diário.
    foreach ($alvos as $a) {
        if (!is_file($a['destino']) || hash_file('sha256', $a['destino']) !== $a['sha']) {
            $reverteu = jsc_reverter_promovidos($promovidos, $erros);
            @unlink(JSC_PUB_DIARIO);
            $erros[] = $a['relativo'] . ': o ficheiro no destino não é igual ao que foi validado';
            return $falhar($erros, $avisos, $reverteu);
        }
    }
    @unlink(JSC_PUB_DIARIO);
    jsc_limpar_pasta(JSC_PUB_NOVO);

    $ficheiros = [];
    foreach ($alvos as $a) $ficheiros[] = $a['relativo'];
    return ['ok' => true, 'erros' => [], 'avisos' => $avisos,
            'ficheiros' => $ficheiros, 'revertido' => false, 'gerado' => $gerado];
}

// Volta atrás os ficheiros já promovidos nesta transação.
function jsc_reverter_promovidos(array $promovidos, array &$erros) {
    $ok = true;
    foreach ($promovidos as $a) {
        if ($a['original'] === null) { @unlink($a['destino']); continue; }
        if (!jsc_restaurar(JSC_PUB_ANT . '/' . jsc_nome_plano($a['relativo']), $a['destino'])) {
            $erros[] = $a['relativo'] . ': NÃO foi possível restaurar a versão anterior';
            $ok = false;
        }
    }
    return $ok;
}

// Voltar à última publicação válida, a pedido.
function jsc_reverter() {
    $erros = [];
    $feitos = [];
    foreach (jsc_alvos_permitidos() as $rel) {
        $backup = JSC_PUB_ANT . '/' . jsc_nome_plano($rel);
        if (!is_file($backup)) continue;
        if (jsc_restaurar($backup, JSC_RAIZ . '/' . $rel)) $feitos[] = $rel;
        else $erros[] = $rel . ': não foi possível restaurar';
    }
    if (!$feitos && !$erros) $erros[] = 'não há backup de uma publicação anterior';
    return ['ok' => !$erros, 'erros' => $erros, 'avisos' => [], 'ficheiros' => $feitos, 'revertido' => (bool)$feitos];
}
