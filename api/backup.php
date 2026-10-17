<?php
// =====================================================================
// CÓPIAS DE SEGURANÇA DO CONTEÚDO — Juventude Sport Campinense
// =====================================================================
// O que o site tem hoje chama-se backup mas não é um arquivo:
//
//   • data/publicacao/anterior/ guarda UMA geração, e a publicação
//     seguinte escreve-lhe por cima (api/geracao.php). É o rollback de uma
//     transação, não um histórico;
//   • o "Exportar tudo (JSON)" do painel corre no browser, lê o
//     localStorage DESSE browser e deixa um ficheiro na pasta Downloads.
//
// Falta o que isto faz: versões datadas do conteúdo publicado, com a
// impressão digital de cada uma, verificáveis mais tarde, e um ensaio de
// recuperação que não toca no site.
//
// LIMITES DESTA FASE, de propósito:
//   • só linha de comandos. Não há endpoint, nada responde pela web e o
//     painel não sabe que isto existe;
//   • NÃO restaura. O --ensaio-recuperacao escreve numa pasta à parte e
//     recusa-se a escrever dentro do projeto;
//   • não toca na publicação, no api/save.php nem no api/submit.php;
//   • não lê nem escreve inscrições nem mensagens.
//
// O QUE AQUI SE GUARDA TEM DADOS PESSOAIS. O data/db.json não é o conteúdo
// público: cada atleta leva lá dataNascimento, encarregado e telefone
// (admin/js/admin.js), e a projeção pública só deixa passar
// ['id','nome','numero','posicao','escalao','estado','foto']
// (api/conteudo.php). Uma cópia do db.json é uma cópia de dados pessoais de
// menores — nunca numa pasta servida pela web, nunca no Git.
//
// USO
//   php api/backup.php --onde
//   php api/backup.php --conteudo --iniciar
//   php api/backup.php --conteudo
//   php api/backup.php --listar
//   php api/backup.php --verificar [--profundo]
//   php api/backup.php --ensaio-recuperacao --ultimo --para /tmp/ensaio
//
//   --origem F        ficheiro a copiar (por omissão data/db.json)
//   --destino D       pasta de backups (por omissão: ver --onde)
//   --iniciar         autoriza criar a pasta de backups se não existir
//   --sem-compressao  guarda o JSON tal e qual, sem gzip
//   --margem-bytes N  disco livre exigido além do ficheiro (omissão 1 MiB)
//   --por NOME        quem pediu, para ficar no manifesto
//
// Saída: 0 tudo bem · 1 integridade falhada · 2 erro de uso ou ficheiro
// ilegível · 3 falta --iniciar · 4 sem espaço · 5 falha de escrita.
// =====================================================================

// É este ficheiro o que está a correr, ou foi incluído por outro? A pergunta
// decide as duas guardas: pedido pela web directamente, não responde; corrido
// na linha de comandos, corre. Incluído como biblioteca, não faz nem uma coisa
// nem outra — é o que a Fase 2 precisará, e não se ganha nada em fechá-lo
// agora de uma forma que obrigue a reabri-lo depois.
$jsc_bk_directo = isset($_SERVER['SCRIPT_FILENAME'])
    && @realpath((string)$_SERVER['SCRIPT_FILENAME']) === __FILE__;

// Pela web não há nada para aqui fazer nesta fase: não há endpoint, e este
// ficheiro pedido por URL não responde. (Em condições normais o Apache
// executa-o como PHP e esta linha é que decide; se o handler de PHP falhar,
// o <FilesMatch> da raiz não cobre .php — por isso a protecção que vale é a
// pasta de backups estar fora da raiz web, não este ficheiro.)
if (PHP_SAPI !== 'cli' && $jsc_bk_directo) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo "nada aqui\n";
    exit;
}

require_once __DIR__ . '/config.php';   // dá o DATA_FILE; não liga a nada

define('JSC_BK_RAIZ', dirname(__DIR__));

// Margem de disco: escrever até ao último byte livre é como não ter espaço.
// Um disco cheio não estraga só o backup — o jsc_escrever_verificado() da
// geração passa a falhar e a PUBLICAÇÃO aborta (api/geracao.php). O backup
// nunca pode ser a causa de o clube não conseguir publicar.
define('JSC_BK_MARGEM', 1048576);

// Tecto de memória: o ficheiro é lido inteiro, e comprimi-lo tem as duas
// versões em memória ao mesmo tempo. Com o memory_limit de 128M do
// alojamento sobra muito para um db.json de alguns MB, mas um ficheiro
// absurdo tem de dar uma mensagem em vez de um fatal error sem explicação.
define('JSC_BK_FRACAO_MEMORIA', 8);

// ---------------------------------------------------------------------
// A POLÍTICA DE RETENÇÃO
// ---------------------------------------------------------------------
// ESTA LINHA É O QUE IMPEDE QUALQUER ELIMINAÇÃO.
//
// Enquanto for false, o --limpar mostra o que faria e mais nada: o --aplicar
// recusa-se, e nenhuma execução deste ficheiro apaga uma cópia. Mudá-la exige
// abrir o ficheiro e escrever 'true' à mão, com a política de retenção de
// dados pessoais aprovada e documentada (ver tools/README.md).
//
// É deliberado que seja uma constante e não uma opção da linha de comandos:
// um engano num cron não pode ligar as eliminações.
define('JSC_BK_POLITICA_APROVADA', false);

// Os escalões. Pela ordem: todas as cópias das últimas 48 horas, a mais antiga
// de cada um dos últimos 14 dias, de cada uma das últimas 8 semanas, e de cada
// um dos últimos 12 meses.
//
// A mais ANTIGA de cada período, não a mais recente: numa recuperação
// procura-se o estado antes de algo ter corrido mal, e a primeira cópia do dia
// é a que está mais longe do erro.
//
// O horizonte de 12 meses não é uma restrição de disco — a 2,9 MB por cópia,
// todo o conjunto cabe em pouco mais de 100 MB num alojamento com 188 GB
// livres. É a política de dados pessoais: o data/db.json leva data de
// nascimento, encarregado e telefone de cada atleta, e cópias disso guardadas
// para sempre são uma responsabilidade que cresce sozinha.
//
// Cada valor pode ser mudado na linha de comandos, para se ver o efeito antes
// de mexer aqui: --recentes-horas, --recentes-minimo, --dias, --semanas,
// --meses, --protegidas-meses, --maximo.
function jsc_bk_politica() {
    return [
        'recentes_horas'   => 48,
        'recentes_minimo'  => 10,
        'dias'             => 14,
        'semanas'          => 8,
        'meses'            => 12,
        'protegidas_meses' => 12,
        'maximo'           => 5,
    ];
}

// As etiquetas, e quais são protegidas.
//
// Uma cópia 'manual' foi pedida por uma pessoa, e uma 'pre-publicacao' é o
// estado que alguém quis guardar antes de mexer no site: nenhuma das duas cai
// por escalão dentro do período de protecção. A 'cron' e a 'anterior' são
// automáticas e entram nos escalões normais.
//
// Entradas antigas, sem etiqueta nenhuma, contam como 'cron' — é o que eram.
define('JSC_BK_ETIQUETAS', 'cron|manual|pre-publicacao|anterior');

function jsc_bk_etiqueta_valida($e) {
    return in_array((string)$e, explode('|', JSC_BK_ETIQUETAS), true);
}

function jsc_bk_protegidas() {
    return ['manual', 'pre-publicacao'];
}

// Todas as etiquetas de uma entrada, com as antigas a contarem como 'cron'.
function jsc_bk_etiquetas_de(array $e) {
    $fora = [];
    if (isset($e['etiquetas']) && is_array($e['etiquetas'])) {
        foreach ($e['etiquetas'] as $x) if (jsc_bk_etiqueta_valida($x)) $fora[] = (string)$x;
    }
    if (isset($e['etiqueta']) && jsc_bk_etiqueta_valida($e['etiqueta'])) $fora[] = (string)$e['etiqueta'];
    if (!$fora) $fora[] = 'cron';
    $fora = array_values(array_unique($fora));
    sort($fora);
    return $fora;
}

// A etiqueta a mostrar, quando uma entrada tem várias: a protegida ganha.
function jsc_bk_etiqueta_forte(array $etiquetas) {
    foreach (['pre-publicacao', 'manual', 'anterior', 'cron'] as $p) {
        if (in_array($p, $etiquetas, true)) return $p;
    }
    return 'cron';
}

function jsc_bk_tem_protegida(array $etiquetas) {
    return (bool)array_intersect($etiquetas, jsc_bk_protegidas());
}

// A segunda origem: o estado que a publicação substituiu.
//
// A publicação guarda a versão anterior do data/db.json em
// data/publicacao/anterior/data__db.json antes de promover a nova
// (api/geracao.php). Ler esse ficheiro recupera o estado que precedeu a última
// publicação, mesmo que nenhuma execução do backup tenha acontecido entre as
// duas.
//
// SÓ LEITURA, e isto não é um detalhe: essa pasta é a área de uma transação, e
// o jsc_reparar_transacao() da geração depende do que lá está. Escrever,
// renomear ou apagar ali partiria o rollback de uma publicação interrompida.
// Esta função devolve um caminho; nada neste ficheiro escreve nessa pasta.
function jsc_bk_anterior() {
    return JSC_BK_RAIZ . '/data/publicacao/anterior/data__db.json';
}

// ---------------------------------------------------------------------
// Onde é que os backups vivem
// ---------------------------------------------------------------------
// Primeira escolha: FORA da raiz web. É a única protecção que não depende
// do .htaccess — e nesta sessão ficou medido que, com o PHP servido por
// PHP-FPM através de proxy, o .htaccess nem é lido para os .php. Um dia em
// que o handler falhe, um .json numa pasta pública é servido como texto.
//
// Segunda escolha, se o alojamento não deixar escrever fora (open_basedir):
// data/backups/, que já tem quatro camadas a negá-lo — o data/.htaccess, o
// .htaccess próprio que o --iniciar escreve, o Options -Indexes e o
// <FilesMatch "\.(env|json|log|sql|bak|sh|bat|md)$"> da raiz.
function jsc_bk_onde($explicito = null) {
    if ($explicito !== null && $explicito !== '') {
        return ['caminho' => rtrim($explicito, '/'), 'porque' => 'indicada com --destino'];
    }
    $env = getenv('JSC_BACKUP_DIR');
    if (is_string($env) && $env !== '') {
        return ['caminho' => rtrim($env, '/'), 'porque' => 'indicada em JSC_BACKUP_DIR'];
    }
    $fora = dirname(JSC_BK_RAIZ) . '/jsc-backups';
    $paiFora = dirname($fora);
    if (is_dir($fora) || (is_dir($paiFora) && is_writable($paiFora))) {
        return ['caminho' => $fora, 'porque' => 'fora da raiz web (primeira escolha)'];
    }
    return ['caminho' => JSC_BK_RAIZ . '/data/backups',
            'porque'  => 'dentro da raiz web: não foi possível escrever em ' . $paiFora
                       . ' — protegida por .htaccess, que é a segunda escolha'];
}

// O .htaccess que o --iniciar deixa na pasta. Vale onde o PHP venha por
// módulo ou handler; onde venha por proxy não é lido, e é por isso que a
// primeira escolha é estar fora da raiz web.
function jsc_bk_htaccess() {
    return "# Cópias de segurança: conteúdo do clube, com dados pessoais de menores\n"
         . "# lá dentro (ver o cabeçalho do api/backup.php). Nada disto pode ser\n"
         . "# servido pela web.\n"
         . "#\n"
         . "# As duas sintaxes de propósito, como em data/.htaccess: a de cima é do\n"
         . "# Apache 2.4, a de baixo do 2.2. Num servidor que não anuncie o\n"
         . "# mod_authz_core, o bloco de cima é ignorado e sem o de baixo a pasta\n"
         . "# ficava legível.\n"
         . "<IfModule mod_authz_core.c>\n"
         . "  Require all denied\n"
         . "</IfModule>\n"
         . "<IfModule !mod_authz_core.c>\n"
         . "  Order allow,deny\n"
         . "  Deny from all\n"
         . "</IfModule>\n"
         . "Options -Indexes\n";
}

function jsc_bk_gitignore() {
    return "# Nada desta pasta vai para o Git: são cópias do conteúdo publicado, com\n"
         . "# dados pessoais lá dentro. Nem o manifesto, que nomeia as áreas e as\n"
         . "# contagens.\n"
         . "*\n";
}

// ---------------------------------------------------------------------
// Escrever sem deixar ficheiros a meio
// ---------------------------------------------------------------------
// Escreve ao lado, confirma o que ficou em disco pela impressão digital e só
// então promove com rename(). Nunca se escreve por cima do destino: se algo
// falhar, o que estava continua inteiro.
//
// Não reutiliza o jsc_escrever_verificado() da geração de propósito: esse
// relê o ficheiro inteiro para memória para comparar, e aqui os ficheiros
// podem ser bem maiores. O hash_file() lê em blocos.
function jsc_bk_escrever($caminho, $bytes, &$erro) {
    $tmp = $caminho . '.tmp';
    $n = @file_put_contents($tmp, $bytes);
    if ($n === false || $n !== strlen($bytes)) {
        @unlink($tmp);
        $erro = 'não foi possível escrever ' . basename($tmp)
              . ' (' . ($n === false ? 'erro' : $n . ' de ' . strlen($bytes) . ' bytes')
              . ') — espaço em disco ou permissões';
        return false;
    }
    @chmod($tmp, 0600);
    if (hash_file('sha256', $tmp) !== hash('sha256', $bytes)) {
        @unlink($tmp);
        $erro = basename($caminho) . ': o que ficou em disco não é igual ao que foi escrito';
        return false;
    }
    if (!@rename($tmp, $caminho)) {
        @unlink($tmp);
        $erro = basename($caminho) . ': não foi possível promover o ficheiro temporário';
        return false;
    }
    return true;
}

// ---------------------------------------------------------------------
// O manifesto, debaixo de flock
// ---------------------------------------------------------------------
// Mesma forma que o registo de donos dos logótipos (api/logo.php): abrir com
// 'c+', trancar, ler, decidir, truncar e escrever, tudo dentro da tranca.
//
// Uma diferença importante: ali, um registo ilegível é tratado como vazio e
// recomeça. Aqui NÃO. O manifesto é o índice de todas as cópias; escrever por
// cima de um manifesto que não se consegue ler apagaria a memória de tudo o
// que lá está. Um manifesto ilegível pára a operação.
function jsc_bk_com_manifesto($dir, $decidir, &$erro) {
    $caminho = $dir . '/manifesto.json';
    $fh = @fopen($caminho, 'c+');
    if (!$fh) { $erro = 'não foi possível abrir o manifesto'; return null; }
    @chmod($caminho, 0600);
    if (!flock($fh, LOCK_EX)) {
        fclose($fh);
        $erro = 'não foi possível trancar o manifesto (outra cópia a correr?)';
        return null;
    }
    $cru = '';
    while (!feof($fh)) {
        $parte = fread($fh, 65536);
        if ($parte === false) break;
        $cru .= $parte;
    }
    if (trim($cru) === '') {
        $m = ['versao' => 1, 'criado_em' => date('c'), 'entradas' => []];
    } else {
        $m = json_decode($cru, true);
        if (!is_array($m) || !isset($m['entradas']) || !is_array($m['entradas'])) {
            flock($fh, LOCK_UN);
            fclose($fh);
            $erro = 'o manifesto existe mas não é legível (' . strlen($cru) . ' bytes). '
                  . 'NADA foi alterado: um manifesto ilegível não se substitui, '
                  . 'porque é o índice de todas as cópias. Guarde-o à parte e examine-o.';
            return null;
        }
    }

    $r = $decidir($m);

    if (!empty($r['gravar']) && isset($r['manifesto'])) {
        $bytes = json_encode($r['manifesto'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($bytes === false) {
            flock($fh, LOCK_UN); fclose($fh);
            $erro = 'não foi possível converter o manifesto para JSON';
            return null;
        }
        rewind($fh);
        if (!ftruncate($fh, 0) || fwrite($fh, $bytes) !== strlen($bytes) || !fflush($fh)) {
            flock($fh, LOCK_UN); fclose($fh);
            $erro = 'não foi possível gravar o manifesto (espaço em disco ou permissões)';
            return null;
        }
    }
    flock($fh, LOCK_UN);
    fclose($fh);
    return $r;
}

// Só para ler, sem tranca de escrita.
function jsc_bk_manifesto_ler($dir, &$erro) {
    $caminho = $dir . '/manifesto.json';
    if (!is_file($caminho)) { $erro = 'não há manifesto em ' . $dir; return null; }
    $cru = @file_get_contents($caminho);
    if ($cru === false) { $erro = 'não foi possível ler o manifesto'; return null; }
    $m = json_decode($cru, true);
    if (!is_array($m) || !isset($m['entradas']) || !is_array($m['entradas'])) {
        $erro = 'o manifesto não é legível (' . strlen($cru) . ' bytes)';
        return null;
    }
    return $m;
}

// ---------------------------------------------------------------------
// As contagens por área
// ---------------------------------------------------------------------
// É isto, e só isto, que o manifesto guarda sobre o conteúdo: quantos
// registos tinha cada área. Serve para escolher a versão certa meses depois
// sem a abrir, e é o que apanha um ficheiro truncado — 3 notícias onde
// estavam 40.
//
// Nenhum VALOR entra aqui. Nem um nome, nem um telefone, nem uma data de
// nascimento: o manifesto fica ao lado das cópias, e um índice que
// transcrevesse dados pessoais era mais uma cópia deles.
function jsc_bk_areas($conteudo) {
    $areas = [];
    if (!is_array($conteudo)) return $areas;
    foreach ($conteudo as $k => $v) {
        $chave = (string)$k;
        if (is_array($v))       $areas[$chave] = count($v);
        elseif (is_string($v))  $areas[$chave] = strlen($v);
        elseif ($v === null)    $areas[$chave] = 0;
        else                    $areas[$chave] = 1;
    }
    ksort($areas);
    return $areas;
}

function jsc_bk_ultima_entrada(array $m, $tipo = 'conteudo') {
    $ultima = null;
    foreach ($m['entradas'] as $e) {
        if (!is_array($e) || (isset($e['tipo']) && $e['tipo'] !== $tipo)) continue;
        if ($ultima === null) { $ultima = $e; continue; }
        $a = isset($e['criado_em']) ? (string)$e['criado_em'] : '';
        $b = isset($ultima['criado_em']) ? (string)$ultima['criado_em'] : '';
        if (strcmp($a, $b) > 0) $ultima = $e;
    }
    return $ultima;
}

// ---------------------------------------------------------------------
// Criar a pasta
// ---------------------------------------------------------------------
// Só com --iniciar. Sem isso, uma execução por engano no sítio errado
// semeava pastas de backups por onde passasse, e ninguém sabia onde estavam
// as cópias a sério.
function jsc_bk_iniciar($dir, &$erro) {
    foreach ([$dir, $dir . '/conteudo'] as $d) {
        if (!is_dir($d) && !@mkdir($d, 0700, true)) {
            $erro = 'não foi possível criar ' . $d;
            return false;
        }
        @chmod($d, 0700);
    }
    // O .htaccess e o .gitignore são escritos sempre, mesmo fora da raiz web:
    // custam nada e a pasta pode ser movida para dentro dela um dia.
    foreach ([['.htaccess', jsc_bk_htaccess()], ['.gitignore', jsc_bk_gitignore()]] as $f) {
        $caminho = $dir . '/' . $f[0];
        if (!is_file($caminho) || (string)@file_get_contents($caminho) !== $f[1]) {
            $e = '';
            if (!jsc_bk_escrever($caminho, $f[1], $e)) { $erro = $f[0] . ': ' . $e; return false; }
        }
        // Estes dois ficam legíveis, ao contrário das cópias: um .htaccess que
        // o Apache não consegue ler não nega nada por si — o que acontece é o
        // Apache responder 403 à pasta inteira por não o conseguir abrir, o
        // que calha bem mas não é a regra a funcionar. A pasta a 0700 é que é
        // a defesa que não depende de nada; isto é a camada de cima.
        @chmod($caminho, 0644);
    }
    return true;
}

// ---------------------------------------------------------------------
// Uma cópia do conteúdo
// ---------------------------------------------------------------------
function jsc_bk_conteudo(array $op) {
    $dir     = $op['dir'];
    $origem  = $op['origem'];
    $margem  = $op['margem'];
    $comprimir = $op['comprimir'];
    $por     = $op['por'];
    $etiqueta = isset($op['etiqueta']) && jsc_bk_etiqueta_valida($op['etiqueta'])
        ? (string)$op['etiqueta'] : 'cron';

    if (!is_file($origem)) {
        return ['ok' => false, 'codigo' => 2,
                'erro' => 'não existe ' . $origem . ' — não há conteúdo para copiar'];
    }
    $tamanho = (int)@filesize($origem);

    // Tecto de memória antes de ler. Um fatal error por memória esgotada não
    // diz o que aconteceu; isto diz.
    $limite = jsc_bk_memoria_limite();
    if ($limite > 0 && $tamanho > intdiv($limite, JSC_BK_FRACAO_MEMORIA)) {
        return ['ok' => false, 'codigo' => 2,
                'erro' => 'o ' . basename($origem) . ' tem ' . $tamanho . ' bytes e o memory_limit '
                        . 'desta execução é ' . $limite . ': a cópia é lida inteira para memória e '
                        . 'não cabe com folga. Aumente o memory_limit ou use --sem-compressao '
                        . 'num PHP com mais memória.'];
    }

    $cru = @file_get_contents($origem);
    if ($cru === false) {
        return ['ok' => false, 'codigo' => 2, 'erro' => 'não foi possível ler ' . $origem];
    }
    $conteudo = json_decode($cru, true);
    if (!is_array($conteudo)) {
        return ['ok' => false, 'codigo' => 2,
                'erro' => $origem . ' não é JSON válido (' . strlen($cru) . ' bytes). Nada foi '
                        . 'copiado: guardar um ficheiro ilegível como se fosse um backup é pior '
                        . 'do que não ter backup, porque esconde a perda.'];
    }

    $shaConteudo = hash('sha256', $cru);
    $areas = jsc_bk_areas($conteudo);

    // Já existe esta versão? Então não se escreve nada. É isto que torna uma
    // execução de hora a hora barata em disco: só nasce ficheiro quando o
    // conteúdo mudou de facto.
    $erro = '';
    $m = jsc_bk_manifesto_ler($dir, $erro);
    if ($m === null && is_file($dir . '/manifesto.json')) {
        return ['ok' => false, 'codigo' => 2, 'erro' => $erro];
    }
    if (is_array($m)) {
        // Contra QUALQUER entrada com o mesmo conteúdo, não só contra a mais
        // recente. Media-se contra a mais recente, e com duas origens isso
        // partia-se: o estado anterior à publicação quase nunca é o mais
        // recente, e nascia um ficheiro novo com os mesmos bytes a cada
        // execução do cron. Medido na sonda: três ficheiros onde devia haver
        // dois, e a crescer de hora a hora.
        //
        // O preço, dito por inteiro: um conteúdo que REGRESSA — publica-se A,
        // depois B, depois A outra vez — não cria uma entrada nova. Fica a que
        // existe, com o visto_em actualizado, e a linha do tempo lê-se pelo
        // par criado_em/visto_em. Para um arquivo de cópias é o que se quer:
        // os bytes estão lá uma vez, e um site que alternasse entre dois
        // estados não enchia o disco.
        $jaExiste = null;
        foreach ($m['entradas'] as $e) {
            if (!is_array($e) || (isset($e['tipo']) && $e['tipo'] !== 'conteudo')) continue;
            if (isset($e['sha256_conteudo']) && $e['sha256_conteudo'] === $shaConteudo) { $jaExiste = $e; break; }
        }
        if ($jaExiste && isset($jaExiste['ficheiro'])) {
            // Conteúdo igual ao da última cópia: não nasce ficheiro novo. Mas a
            // ETIQUETA não se perde.
            //
            // Sem isto, pedir uma cópia 'manual' de um conteúdo que o cron já
            // tinha guardado respondia «sem alterações» e a cópia ficava
            // 'cron' — ou seja, a pessoa pediu uma cópia protegida, o painel
            // disse que estava feita, e a retenção podia apagá-la por escalão.
            // A desduplicação poupa bytes; não pode poupar protecção.
            //
            // Em vez de duplicar o ficheiro, a etiqueta é acrescentada à
            // entrada que já existe: o conteúdo é o mesmo, e passa a estar
            // protegido pela razão por que foi pedido.
            $promovida = false;
            $r = jsc_bk_com_manifesto($dir, function ($man) use ($shaConteudo, $etiqueta, &$promovida) {
                foreach ($man['entradas'] as $i => $e) {
                    if (!isset($e['sha256_conteudo']) || $e['sha256_conteudo'] !== $shaConteudo) continue;
                    $man['entradas'][$i]['visto_em'] = date('c');
                    $tinha = jsc_bk_etiquetas_de($e);
                    if (!in_array($etiqueta, $tinha, true)) {
                        $tinha[] = $etiqueta;
                        sort($tinha);
                        $promovida = true;
                    }
                    $man['entradas'][$i]['etiquetas'] = $tinha;
                    $man['entradas'][$i]['etiqueta']  = jsc_bk_etiqueta_forte($tinha);
                }
                return ['gravar' => true, 'manifesto' => $man];
            }, $erro);
            $avisos = $r === null ? ['não foi possível actualizar o manifesto: ' . $erro] : [];
            return ['ok' => true, 'codigo' => 0, 'inalterado' => true,
                    'ficheiro' => (string)$jaExiste['ficheiro'],
                    'etiqueta' => $etiqueta,
                    'promovida' => $promovida && $r !== null,
                    'avisos' => $avisos,
                    'areas' => $areas];
        }
    }

    // Comprimir, se houver zlib. Não há ext/zip neste alojamento (medido),
    // mas o gzencode é do zlib, que é outra coisa. Sem ele, guarda-se o JSON
    // tal e qual — um backup sem compressão é um backup; sem backup é nada.
    $bytes = $cru;
    $compressao = 'nenhuma';
    if ($comprimir && function_exists('gzencode')) {
        $z = @gzencode($cru, 6);
        if (is_string($z) && $z !== '' && strlen($z) < strlen($cru)) {
            $bytes = $z;
            $compressao = 'gzip';
        }
    }

    $nome = jsc_bk_nome_livre($dir . '/conteudo', 'db-' . gmdate('Ymd\THis\Z'),
                              '.json' . ($compressao === 'gzip' ? '.gz' : ''));
    $caminho = $dir . '/conteudo/' . $nome;

    // Espaço em disco ANTES de escrever, com margem. Ver JSC_BK_MARGEM.
    $livre = @disk_free_space($dir);
    if ($livre !== false && $livre < strlen($bytes) + $margem) {
        return ['ok' => false, 'codigo' => 4,
                'erro' => 'sem espaço: a cópia precisa de ' . strlen($bytes) . ' bytes mais '
                        . $margem . ' de margem, e há ' . (int)$livre . ' livres em ' . $dir
                        . '. Nada foi escrito.'];
    }

    if (!jsc_bk_escrever($caminho, $bytes, $erro)) {
        return ['ok' => false, 'codigo' => 5, 'erro' => $erro . ' — nada foi registado'];
    }

    $entrada = [
        'tipo'            => 'conteudo',
        'ficheiro'        => 'conteudo/' . $nome,
        'criado_em'       => date('c'),
        'visto_em'        => date('c'),
        'origem'          => jsc_bk_relativo($origem),
        'compressao'      => $compressao,
        'bytes_conteudo'  => strlen($cru),
        'bytes_ficheiro'  => strlen($bytes),
        'sha256_conteudo' => $shaConteudo,
        'sha256_ficheiro' => hash('sha256', $bytes),
        'areas'           => $areas,
        'por'             => $por,
        'etiqueta'        => $etiqueta,
        'etiquetas'       => [$etiqueta],
    ];

    // A tranca protege a INTEGRIDADE do manifesto, não a unicidade da cópia:
    // duas execuções ao mesmo tempo podem escrever duas cópias iguais, cada
    // uma devidamente registada. Isso não perde nada e o --verificar aceita-as.
    // Perder metade de um manifesto é que seria irreparável, e é isso que a
    // tranca impede.
    $r = jsc_bk_com_manifesto($dir, function ($man) use ($entrada) {
        $man['entradas'][] = $entrada;
        return ['gravar' => true, 'manifesto' => $man];
    }, $erro);

    // O ficheiro existe mas o manifesto não o conhece: isso é um órfão, e um
    // órfão é pior do que a ausência da cópia — aparece na pasta, parece um
    // backup e não tem impressão digital com que o comparar. Desfaz-se.
    if ($r === null) {
        @unlink($caminho);
        return ['ok' => false, 'codigo' => 5,
                'erro' => 'a cópia foi escrita mas o manifesto não aceitou o registo (' . $erro
                        . '). O ficheiro foi removido para não ficar um órfão.'];
    }

    return ['ok' => true, 'codigo' => 0, 'inalterado' => false, 'ficheiro' => 'conteudo/' . $nome,
            'entrada' => $entrada, 'avisos' => [], 'areas' => $areas];
}

function jsc_bk_nome_livre($dir, $base, $sufixo) {
    $nome = $base . $sufixo;
    $n = 2;
    while (is_file($dir . '/' . $nome) && $n < 1000) {
        $nome = $base . '-' . $n . $sufixo;
        $n++;
    }
    return $nome;
}

function jsc_bk_relativo($caminho) {
    $r = @realpath($caminho);
    if ($r && strpos($r, JSC_BK_RAIZ . '/') === 0) return substr($r, strlen(JSC_BK_RAIZ) + 1);
    return $caminho;
}

function jsc_bk_memoria_limite() {
    $v = trim((string)ini_get('memory_limit'));
    if ($v === '' || $v === '-1') return 0;
    $u = strtolower(substr($v, -1));
    $n = (int)$v;
    if ($u === 'g') return $n * 1073741824;
    if ($u === 'm') return $n * 1048576;
    if ($u === 'k') return $n * 1024;
    return $n;
}

function jsc_bk_descomprimir($bytes, $compressao) {
    if ($compressao !== 'gzip') return $bytes;
    if (!function_exists('gzdecode')) return null;
    $d = @gzdecode($bytes);
    return is_string($d) ? $d : null;
}

// ---------------------------------------------------------------------
// Verificar
// ---------------------------------------------------------------------
// Nos dois sentidos: cada entrada do manifesto tem o seu ficheiro intacto, e
// cada ficheiro da pasta está no manifesto. O segundo sentido é o que apanha
// um órfão deixado por uma execução interrompida a meio.
function jsc_bk_verificar($dir, $profundo) {
    $achados = [];
    $nota = function ($nivel, $assunto, $detalhe) use (&$achados) {
        $achados[] = ['nivel' => $nivel, 'assunto' => $assunto, 'detalhe' => $detalhe];
    };
    $erro = '';
    $m = jsc_bk_manifesto_ler($dir, $erro);
    if ($m === null) return ['codigo' => 2, 'achados' => [['nivel' => 'ERRO', 'assunto' => 'manifesto', 'detalhe' => $erro]]];

    $conhecidos = [];
    foreach ($m['entradas'] as $e) {
        if (!is_array($e) || !isset($e['ficheiro'])) {
            $nota('ERRO', 'entrada sem ficheiro', json_encode($e));
            continue;
        }
        $rel = (string)$e['ficheiro'];
        $conhecidos[$rel] = true;
        $caminho = $dir . '/' . $rel;
        if (!is_file($caminho)) { $nota('ERRO', $rel, 'está no manifesto e NÃO está em disco'); continue; }
        $sha = hash_file('sha256', $caminho);
        if (isset($e['sha256_ficheiro']) && $sha !== $e['sha256_ficheiro']) {
            $nota('ERRO', $rel, 'o ficheiro mudou desde que foi gravado: sha256 em disco '
                . substr((string)$sha, 0, 16) . '…, no manifesto '
                . substr((string)$e['sha256_ficheiro'], 0, 16) . '…');
            continue;
        }
        if (isset($e['bytes_ficheiro']) && (int)@filesize($caminho) !== (int)$e['bytes_ficheiro']) {
            $nota('ERRO', $rel, 'o tamanho não corresponde ao registado');
            continue;
        }
        if (!$profundo) { $nota('OK', $rel, 'intacto (' . (int)$e['bytes_ficheiro'] . ' bytes)'); continue; }

        // Fundo: abrir, descomprimir, confirmar o conteúdo e as contagens.
        $bytes = @file_get_contents($caminho);
        $cru = $bytes === false ? null : jsc_bk_descomprimir($bytes, isset($e['compressao']) ? $e['compressao'] : 'nenhuma');
        if ($cru === null) { $nota('ERRO', $rel, 'não foi possível descomprimir'); continue; }
        if (isset($e['sha256_conteudo']) && hash('sha256', $cru) !== $e['sha256_conteudo']) {
            $nota('ERRO', $rel, 'o CONTEÚDO não corresponde ao registado, apesar de o ficheiro estar intacto');
            continue;
        }
        $dados = json_decode($cru, true);
        if (!is_array($dados)) { $nota('ERRO', $rel, 'o conteúdo não é JSON válido'); continue; }
        $areas = jsc_bk_areas($dados);
        $esperado = isset($e['areas']) && is_array($e['areas']) ? $e['areas'] : null;
        if ($esperado !== null && $areas !== $esperado) {
            $dif = [];
            foreach ($esperado as $a => $n) {
                $agora = isset($areas[$a]) ? $areas[$a] : '(ausente)';
                if ($agora !== $n) $dif[] = $a . ': ' . $n . ' -> ' . $agora;
            }
            foreach ($areas as $a => $n) if (!array_key_exists($a, $esperado)) $dif[] = $a . ': nova (' . $n . ')';
            $nota('ERRO', $rel, 'as contagens por área mudaram: ' . implode(', ', $dif));
            continue;
        }
        $nota('OK', $rel, 'intacto e legível, ' . count($areas) . ' áreas com as contagens registadas');
    }

    $pasta = $dir . '/conteudo';
    if (is_dir($pasta)) {
        foreach (scandir($pasta) as $f) {
            if ($f === '.' || $f === '..' || $f === '.htaccess' || $f === '.gitignore') continue;
            if (substr($f, -4) === '.tmp') {
                $nota('ERRO', 'conteudo/' . $f, 'ficheiro temporário deixado para trás por uma execução interrompida');
                continue;
            }
            if (!isset($conhecidos['conteudo/' . $f])) {
                $nota('ERRO', 'conteudo/' . $f, 'está em disco e NÃO está no manifesto (órfão)');
            }
        }
    }

    // A invariante que a retenção precisa: existe pelo menos uma cópia boa.
    // Só se afirma em modo profundo — o raso compara impressões digitais e não
    // abre o conteúdo, e não chega para chamar uma cópia de válida.
    if ($profundo) {
        $boas = 0;
        foreach ($achados as $a) {
            if ($a['nivel'] === 'OK' && strpos((string)$a['assunto'], 'conteudo/') === 0) $boas++;
        }
        if ($conhecidos && !$boas) {
            $nota('ERRO', 'cópia válida', 'NENHUMA das ' . count($conhecidos)
                . ' cópias do manifesto passa a verificação: não há de onde recuperar');
        } elseif ($boas) {
            $nota('OK', 'cópia válida', $boas . ' de ' . count($conhecidos) . ' passam a verificação');
        }
    }

    $erros = 0;
    foreach ($achados as $a) if ($a['nivel'] === 'ERRO') $erros++;
    return ['codigo' => $erros ? 1 : 0, 'achados' => $achados, 'erros' => $erros];
}

// ---------------------------------------------------------------------
// Ensaio de recuperação
// ---------------------------------------------------------------------
// Prova que uma cópia serve para recuperar, sem recuperar nada: escreve o
// conteúdo numa pasta à parte e compara tudo o que o manifesto prometeu.
//
// NÃO RESTAURA. Nesta fase não existe restauro nenhum, e esta função
// recusa-se a escrever dentro da árvore do projeto — é a diferença entre um
// ensaio e um acidente.
function jsc_bk_ensaio($dir, $alvo, $para) {
    $erro = '';
    $m = jsc_bk_manifesto_ler($dir, $erro);
    if ($m === null) return ['codigo' => 2, 'erro' => $erro];

    $entrada = null;
    if ($alvo === '--ultimo') $entrada = jsc_bk_ultima_entrada($m, 'conteudo');
    else foreach ($m['entradas'] as $e) {
        if (isset($e['ficheiro']) && ($e['ficheiro'] === $alvo || basename((string)$e['ficheiro']) === $alvo)) $entrada = $e;
    }
    if (!$entrada) return ['codigo' => 2, 'erro' => 'não há no manifesto nenhuma cópia que corresponda a ' . $alvo];

    // A recusa. O destino não pode ser dentro do projeto nem dentro da pasta
    // de backups: o ensaio existe para NÃO tocar em nenhum dos dois.
    $paiReal = @realpath(dirname($para));
    if ($paiReal === false) return ['codigo' => 2, 'erro' => 'a pasta onde --para aponta não existe: ' . dirname($para)];
    $dentroDoProjeto = $paiReal === JSC_BK_RAIZ || strpos($paiReal . '/', JSC_BK_RAIZ . '/') === 0;
    $dirReal = @realpath($dir);
    $dentroDosBackups = $dirReal && ($paiReal === $dirReal || strpos($paiReal . '/', $dirReal . '/') === 0);
    if ($dentroDoProjeto || $dentroDosBackups) {
        return ['codigo' => 2,
                'erro' => 'recuso-me a ensaiar para ' . $para . ': está dentro de '
                        . ($dentroDoProjeto ? JSC_BK_RAIZ . ' (o projeto)' : $dirReal . ' (os backups)')
                        . '. O ensaio escreve numa pasta à parte, nunca em cima do site nem das '
                        . 'cópias. Esta fase não tem restauro: ver o cabeçalho do api/backup.php.'];
    }

    $caminho = $dir . '/' . $entrada['ficheiro'];
    if (!is_file($caminho)) return ['codigo' => 1, 'erro' => 'a cópia não está em disco: ' . $entrada['ficheiro']];
    $bytes = @file_get_contents($caminho);
    if ($bytes === false) return ['codigo' => 1, 'erro' => 'não foi possível ler ' . $entrada['ficheiro']];

    $passos = [];
    $falhas = [];
    $marcar = function ($nome, $ok, $detalhe) use (&$passos, &$falhas) {
        $passos[] = ['passo' => $nome, 'ok' => (bool)$ok, 'detalhe' => $detalhe];
        if (!$ok) $falhas[] = $nome;
    };

    $shaFich = hash('sha256', $bytes);
    $marcar('impressão digital do ficheiro', $shaFich === ($entrada['sha256_ficheiro'] ?? null), substr($shaFich, 0, 16) . '…');
    $cru = jsc_bk_descomprimir($bytes, isset($entrada['compressao']) ? $entrada['compressao'] : 'nenhuma');
    $marcar('descompressão', $cru !== null, isset($entrada['compressao']) ? (string)$entrada['compressao'] : 'nenhuma');
    if ($cru === null) return ['codigo' => 1, 'passos' => $passos, 'falhas' => $falhas, 'entrada' => $entrada];

    $marcar('impressão digital do conteúdo', hash('sha256', $cru) === ($entrada['sha256_conteudo'] ?? null),
            strlen($cru) . ' bytes');
    $dados = json_decode($cru, true);
    $marcar('JSON legível', is_array($dados), is_array($dados) ? count($dados) . ' chaves' : 'não');
    $areas = is_array($dados) ? jsc_bk_areas($dados) : [];
    $esperado = isset($entrada['areas']) && is_array($entrada['areas']) ? $entrada['areas'] : null;
    $marcar('contagens por área', $esperado !== null && $areas === $esperado, count($areas) . ' áreas');

    if (!is_dir($para) && !@mkdir($para, 0700, true)) {
        return ['codigo' => 5, 'erro' => 'não foi possível criar a pasta do ensaio: ' . $para,
                'passos' => $passos, 'falhas' => $falhas];
    }
    @chmod($para, 0700);
    $erroEscrita = '';
    $destino = rtrim($para, '/') . '/db.json';
    $ok = jsc_bk_escrever($destino, $cru, $erroEscrita);
    $marcar('escrita na pasta do ensaio', $ok, $ok ? $destino : $erroEscrita);
    if ($ok) {
        $relatorio = [
            'ensaio_em'  => date('c'),
            'copia'      => $entrada['ficheiro'],
            'criada_em'  => isset($entrada['criado_em']) ? $entrada['criado_em'] : null,
            'areas'      => $areas,
            'passos'     => $passos,
            'aviso'      => 'Ensaio. Este db.json NÃO foi instalado em sítio nenhum. '
                          . 'Contém dados pessoais: apague a pasta quando acabar.',
        ];
        $e2 = '';
        jsc_bk_escrever(rtrim($para, '/') . '/ensaio.json',
            json_encode($relatorio, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), $e2);
    }

    return ['codigo' => $falhas ? 1 : 0, 'passos' => $passos, 'falhas' => $falhas,
            'entrada' => $entrada, 'areas' => $areas, 'destino' => $destino];
}

// ---------------------------------------------------------------------
// Retenção: quem fica, quem é candidata
// ---------------------------------------------------------------------
// Função pura: recebe as entradas, o instante de referência, a política e o
// conjunto das que NÃO passam a verificação, e devolve a decisão. Não lê o
// disco, não escreve nada, não olha para o relógio — o $agora vem de fora.
// É assim que se consegue testá-la com datas concretas, incluindo as
// fronteiras entre dias, semanas e meses.
//
// Tudo em UTC, como os nomes dos ficheiros. O fuso do servidor e o do cron não
// entram na conta.
function jsc_bk_retencao(array $entradas, $agora, array $pol, array $invalidas = []) {
    $lista = [];
    $guardar = [];      // ficheiro => motivo
    foreach ($entradas as $e) {
        if (!is_array($e) || !isset($e['ficheiro'])) continue;
        if (isset($e['tipo']) && $e['tipo'] !== 'conteudo') continue;
        $rel = (string)$e['ficheiro'];
        $t = isset($e['criado_em']) ? strtotime((string)$e['criado_em']) : false;
        if ($t === false) {
            // Sem data não se decide nada sobre ela. Fica, sempre.
            $guardar[$rel] = 'sem data legível: nunca é candidata';
            continue;
        }
        $lista[] = ['ficheiro' => $rel, 'quando' => $t, 'etiquetas' => jsc_bk_etiquetas_de($e)];
    }
    usort($lista, function ($a, $b) { return $b['quando'] - $a['quando']; });

    $valida = function ($rel) use ($invalidas) { return !in_array($rel, $invalidas, true); };

    // ---- O que bloqueia a limpeza inteira ----------------------------
    $bloqueio = null;
    $maisRecenteValida = null;
    foreach ($lista as $x) { if ($valida($x['ficheiro'])) { $maisRecenteValida = $x; break; } }
    if ($lista && $maisRecenteValida === null) {
        $bloqueio = 'nenhuma das cópias passa a verificação: não se apaga nada sem ter uma boa';
    } elseif ($lista && !$valida($lista[0]['ficheiro'])) {
        // A mais recente de todas está má. Pode estar a acontecer algo agora, e
        // não é hora de limpar o histórico.
        $bloqueio = 'a cópia mais recente não passa a verificação: limpar agora seria apagar '
                  . 'histórico enquanto o presente está em dúvida';
    }

    // ---- Os escalões -------------------------------------------------
    $dia  = function ($t) { return gmdate('Y-m-d', $t); };
    $sem  = function ($t) { return gmdate('o-\WW', $t); };
    $mes  = function ($t) { return gmdate('Y-m', $t); };

    $diasOk = [];
    for ($i = 0; $i < (int)$pol['dias']; $i++) $diasOk[$dia($agora - $i * 86400)] = true;
    $semanasOk = [];
    for ($i = 0; $i < (int)$pol['semanas']; $i++) $semanasOk[$sem($agora - $i * 604800)] = true;
    $mesesOk = [];
    $primeiro = strtotime(gmdate('Y-m-01\T00:00:00\Z', $agora));
    for ($i = 0; $i < (int)$pol['meses']; $i++) {
        $mesesOk[gmdate('Y-m', strtotime('-' . $i . ' months', $primeiro))] = true;
    }
    $protegidasOk = [];
    for ($i = 0; $i < (int)$pol['protegidas_meses']; $i++) {
        $protegidasOk[gmdate('Y-m', strtotime('-' . $i . ' months', $primeiro))] = true;
    }

    // A mais ANTIGA de cada período, que é a que está mais longe do erro.
    $primeiraDe = function ($chave, $permitidos) use ($lista) {
        $fora = [];
        foreach ($lista as $x) {
            $k = $chave($x['quando']);
            if (!isset($permitidos[$k])) continue;
            if (!isset($fora[$k]) || $x['quando'] < $fora[$k]['quando']) $fora[$k] = $x;
        }
        return $fora;
    };

    $marcar = function ($rel, $motivo) use (&$guardar) {
        if (!isset($guardar[$rel])) $guardar[$rel] = $motivo;
    };

    // Pela ordem de importância: o primeiro motivo é o que fica escrito.
    if ($maisRecenteValida) $marcar($maisRecenteValida['ficheiro'], 'a mais recente que passa a verificação');
    $limiteRecente = $agora - (int)$pol['recentes_horas'] * 3600;
    foreach ($lista as $i => $x) {
        if ($x['quando'] >= $limiteRecente) {
            $marcar($x['ficheiro'], 'recente (últimas ' . (int)$pol['recentes_horas'] . 'h)');
        }
        if ($i < (int)$pol['recentes_minimo']) {
            $marcar($x['ficheiro'], 'uma das ' . (int)$pol['recentes_minimo'] . ' mais recentes');
        }
        if (jsc_bk_tem_protegida($x['etiquetas']) && isset($protegidasOk[$mes($x['quando'])])) {
            $marcar($x['ficheiro'], 'protegida: ' . jsc_bk_etiqueta_forte($x['etiquetas']));
        }
    }
    foreach ($primeiraDe($dia, $diasOk) as $k => $x)     $marcar($x['ficheiro'], 'diária (' . $k . ')');
    foreach ($primeiraDe($sem, $semanasOk) as $k => $x)  $marcar($x['ficheiro'], 'semanal (' . $k . ')');
    foreach ($primeiraDe($mes, $mesesOk) as $k => $x)    $marcar($x['ficheiro'], 'mensal (' . $k . ')');

    // ---- As candidatas ----------------------------------------------
    $candidatas = [];
    $retidas    = [];   // o que não fica no conjunto mas também não se apaga
    foreach ($lista as $x) {
        if (isset($guardar[$x['ficheiro']])) continue;
        if (!$valida($x['ficheiro'])) {
            $retidas[$x['ficheiro']] = 'não passa a verificação: uma cópia suspeita é prova, '
                                     . 'apaga-se à mão depois de se olhar para ela';
            continue;
        }
        $candidatas[] = $x;
    }
    usort($candidatas, function ($a, $b) { return $a['quando'] - $b['quando']; });   // as mais antigas primeiro
    $excedente = max(0, count($candidatas) - (int)$pol['maximo']);
    $candidatas = array_slice($candidatas, 0, (int)$pol['maximo']);
    if ($bloqueio !== null) { $excedente = 0; $candidatas = []; }

    return [
        'guardar'    => $guardar,
        'candidatas' => array_map(function ($x) {
            return ['ficheiro' => $x['ficheiro'], 'quando' => gmdate('c', $x['quando']),
                    'etiqueta' => jsc_bk_etiqueta_forte($x['etiquetas'])];
        }, $candidatas),
        'retidas'    => $retidas,
        'excedente'  => $excedente,
        'bloqueio'   => $bloqueio,
        'total'      => count($lista),
    ];
}

// As que não passam a verificação, pelo nome do ficheiro.
function jsc_bk_invalidas(array $verificacao) {
    $fora = [];
    foreach ($verificacao['achados'] as $a) {
        if ($a['nivel'] === 'ERRO' && strpos((string)$a['assunto'], 'conteudo/') === 0) {
            $fora[] = (string)$a['assunto'];
        }
    }
    return array_values(array_unique($fora));
}

// ---------------------------------------------------------------------
// Limpar: por omissão mostra, nunca apaga
// ---------------------------------------------------------------------
function jsc_bk_limpar($dir, array $pol, $aplicar) {
    $erro = '';
    $m = jsc_bk_manifesto_ler($dir, $erro);
    if ($m === null) return ['codigo' => 2, 'erro' => $erro];

    // A decisão depende da verificação PROFUNDA: uma cópia que não se consegue
    // abrir não conta como boa, e não se apaga nada por causa dela.
    $ver = jsc_bk_verificar($dir, true);
    if ($ver['codigo'] === 2) return ['codigo' => 2, 'erro' => 'a verificação não correu'];
    $invalidas = jsc_bk_invalidas($ver);

    $d = jsc_bk_retencao($m['entradas'], time(), $pol, $invalidas);
    $d['invalidas'] = $invalidas;
    $d['aplicado']  = [];
    $d['politicaAprovada'] = JSC_BK_POLITICA_APROVADA;

    if (!$aplicar) { $d['codigo'] = $d['bloqueio'] === null ? 0 : 1; return $d; }

    if (!JSC_BK_POLITICA_APROVADA) {
        $d['codigo'] = 2;
        $d['erro'] = 'o --aplicar está desligado nesta versão: a política de retenção ainda não '
                   . 'foi aprovada. Nada foi apagado. Ver JSC_BK_POLITICA_APROVADA no topo deste '
                   . 'ficheiro e a política em tools/README.md.';
        return $d;
    }
    if ($d['bloqueio'] !== null) {
        $d['codigo'] = 1;
        $d['erro'] = 'limpeza bloqueada: ' . $d['bloqueio'] . '. Nada foi apagado.';
        return $d;
    }

    // Remover: o ficheiro e a entrada, dentro da mesma tranca. Se a entrada não
    // sair do manifesto, o ficheiro não é tocado — um manifesto que aponte para
    // um ficheiro que já não existe é pior do que uma cópia a mais.
    foreach ($d['candidatas'] as $c) {
        $rel = $c['ficheiro'];
        $saiu = jsc_bk_com_manifesto($dir, function ($man) use ($rel) {
            $novas = [];
            foreach ($man['entradas'] as $e) {
                if (is_array($e) && isset($e['ficheiro']) && $e['ficheiro'] === $rel) continue;
                $novas[] = $e;
            }
            $man['entradas'] = $novas;
            return ['gravar' => true, 'manifesto' => $man];
        }, $erro);
        if ($saiu === null) { $d['aplicado'][] = $rel . ': NÃO (o manifesto não aceitou: ' . $erro . ')'; continue; }
        $apagou = @unlink($dir . '/' . $rel);
        $d['aplicado'][] = $rel . ': ' . ($apagou ? 'apagada' : 'a entrada saiu mas o ficheiro ficou');
    }
    $d['codigo'] = 0;
    return $d;
}

// ---------------------------------------------------------------------
// Relatório: o estado em poucas linhas
// ---------------------------------------------------------------------
function jsc_bk_relatorio($dir, array $pol) {
    $erro = '';
    $m = jsc_bk_manifesto_ler($dir, $erro);
    if ($m === null) return ['codigo' => 2, 'erro' => $erro];
    $n = 0; $bytes = 0; $maisAntiga = null; $maisRecente = null;
    $porEtiqueta = [];
    foreach ($m['entradas'] as $e) {
        if (!is_array($e) || !isset($e['ficheiro'])) continue;
        $n++;
        $bytes += isset($e['bytes_ficheiro']) ? (int)$e['bytes_ficheiro'] : 0;
        $q = isset($e['criado_em']) ? strtotime((string)$e['criado_em']) : false;
        if ($q !== false) {
            if ($maisAntiga === null || $q < $maisAntiga) $maisAntiga = $q;
            if ($maisRecente === null || $q > $maisRecente) $maisRecente = $q;
        }
        $et = jsc_bk_etiqueta_forte(jsc_bk_etiquetas_de($e));
        $porEtiqueta[$et] = (isset($porEtiqueta[$et]) ? $porEtiqueta[$et] : 0) + 1;
    }
    ksort($porEtiqueta);
    return ['codigo' => 0, 'n' => $n, 'bytes' => $bytes,
            'maisAntiga' => $maisAntiga === null ? null : gmdate('c', $maisAntiga),
            'maisRecente' => $maisRecente === null ? null : gmdate('c', $maisRecente),
            'porEtiqueta' => $porEtiqueta,
            'livre' => (int)@disk_free_space($dir),
            'politica' => $pol, 'politicaAprovada' => JSC_BK_POLITICA_APROVADA];
}

// ---------------------------------------------------------------------
// Apagar a pasta de um ensaio
// ---------------------------------------------------------------------
// Um ensaio deixa em disco um db.json com dados pessoais. Num ensaio mensal
// feito por cron, isso acumula-se: por isso existe o --limpar-depois.
//
// Remove SÓ o que o ensaio escreve — db.json e ensaio.json —, e só uma
// subpasta de profundidade. Qualquer outro ficheiro é deixado e nomeado: esta
// função não é um apagador recursivo, de propósito.
function jsc_bk_apagar_ensaio($raizDoEnsaio) {
    $nossos = ['db.json', 'ensaio.json'];
    $sobrou = [];
    $limparPasta = function ($pasta) use ($nossos, &$sobrou) {
        if (!is_dir($pasta)) return;
        foreach (scandir($pasta) as $f) {
            if ($f === '.' || $f === '..') continue;
            $c = $pasta . '/' . $f;
            if (is_file($c) && in_array($f, $nossos, true)) { @unlink($c); continue; }
            $sobrou[] = $c;
        }
        if (!$sobrou) @rmdir($pasta);
    };
    foreach (is_dir($raizDoEnsaio) ? scandir($raizDoEnsaio) : [] as $f) {
        if ($f === '.' || $f === '..') continue;
        $c = $raizDoEnsaio . '/' . $f;
        if (is_dir($c)) $limparPasta($c);
        elseif (is_file($c) && in_array($f, $nossos, true)) @unlink($c);
        else $sobrou[] = $c;
    }
    if (!$sobrou) @rmdir($raizDoEnsaio);
    return $sobrou;
}

// As cópias a ensaiar quando se pede --serie: uma por escalão, em vez de só a
// última. Uma mensal de há nove meses não pode passar nove meses sem ninguém
// saber se ainda abre.
function jsc_bk_serie_para_ensaio(array $entradas, $agora, array $pol) {
    $d = jsc_bk_retencao($entradas, $agora, $pol, []);
    $escolhidas = [];
    $jaTem = [];
    foreach ($d['guardar'] as $rel => $motivo) {
        $prefixo = null;
        foreach (['a mais recente', 'diária', 'semanal', 'mensal', 'protegida'] as $px) {
            if (strpos($motivo, $px) === 0) { $prefixo = $px; break; }
        }
        if ($prefixo === null || isset($jaTem[$prefixo])) continue;
        $jaTem[$prefixo] = true;
        $escolhidas[] = ['ficheiro' => $rel, 'motivo' => $motivo];
    }
    return $escolhidas;
}

// ---------------------------------------------------------------------
// Linha de comandos
// ---------------------------------------------------------------------
function jsc_bk_arg($argv, $nome, $omissao = null) {
    $i = array_search($nome, $argv, true);
    if ($i === false) return $omissao;
    return isset($argv[$i + 1]) ? $argv[$i + 1] : $omissao;
}

function jsc_bk_tem($argv, $nome) {
    return in_array($nome, $argv, true);
}

function jsc_bk_ajuda() {
    echo "Cópias de segurança do conteúdo — Juventude Sport Campinense\n\n";
    echo "  php api/backup.php --onde\n";
    echo "  php api/backup.php --conteudo [--iniciar]\n";
    echo "  php api/backup.php --listar\n";
    echo "  php api/backup.php --verificar [--profundo]\n";
    echo "  php api/backup.php --relatorio\n";
    echo "  php api/backup.php --limpar                 (mostra; NÃO apaga)\n";
    echo "  php api/backup.php --ensaio-recuperacao --ultimo --para <pasta fora do projeto>\n";
    echo "  php api/backup.php --ensaio-recuperacao --serie --para <pasta> [--limpar-depois]\n\n";
    echo "  --origem F  --destino D  --sem-compressao  --margem-bytes N  --por NOME\n";
    echo "  --etiqueta cron|manual|pre-publicacao       (omissão: cron)\n";
    echo "  --sem-anterior                              não recolhe o estado pré-publicação\n";
    echo "  --recentes-horas N --recentes-minimo N --dias N --semanas N --meses N\n";
    echo "  --protegidas-meses N --maximo N             escalões da retenção, só para ver\n\n";
    echo "Não restaura nada e não tem endpoint: só linha de comandos.\n";
    echo "NÃO APAGA: o --limpar mostra o que faria. Ver JSC_BK_POLITICA_APROVADA.\n";
    echo "O que guarda tem dados pessoais — ver o cabeçalho do ficheiro.\n";
    return 2;
}

function jsc_bk_principal($argv) {
    $onde = jsc_bk_onde(jsc_bk_arg($argv, '--destino'));
    $dir  = $onde['caminho'];

    if (jsc_bk_tem($argv, '--onde')) {
        echo "pasta de backups: " . $dir . "\n";
        echo "porque ..........: " . $onde['porque'] . "\n";
        echo "existe ..........: " . (is_dir($dir) ? 'sim' : 'não (precisa de --iniciar)') . "\n";
        if (is_dir($dir)) {
            $livre = @disk_free_space($dir);
            echo "disco livre .....: " . ($livre === false ? '(desconhecido)' : (int)$livre . ' bytes') . "\n";
        }
        echo "origem por omissão: " . DATA_FILE . (is_file(DATA_FILE) ? '' : ' (não existe)') . "\n";
        return 0;
    }

    $precisaDaPasta = jsc_bk_tem($argv, '--conteudo') || jsc_bk_tem($argv, '--verificar')
                   || jsc_bk_tem($argv, '--listar') || jsc_bk_tem($argv, '--ensaio-recuperacao')
                   || jsc_bk_tem($argv, '--limpar') || jsc_bk_tem($argv, '--relatorio');
    if (!$precisaDaPasta) return jsc_bk_ajuda();

    if (!is_dir($dir)) {
        if (!jsc_bk_tem($argv, '--iniciar')) {
            fwrite(STDERR, "a pasta de backups não existe: " . $dir . "\n"
                . "porque esta: " . $onde['porque'] . "\n"
                . "Para a criar, repita o comando com --iniciar. Sem isso nada é criado, "
                . "para uma execução no sítio errado não semear pastas de backups por aí.\n");
            return 3;
        }
        $erro = '';
        if (!jsc_bk_iniciar($dir, $erro)) { fwrite(STDERR, "erro: $erro\n"); return 5; }
        echo "pasta criada: " . $dir . " (0700, com .htaccess e .gitignore)\n";
    } elseif (jsc_bk_tem($argv, '--iniciar')) {
        $erro = '';
        if (!jsc_bk_iniciar($dir, $erro)) { fwrite(STDERR, "erro: $erro\n"); return 5; }
    }

    // ---- --conteudo --------------------------------------------------
    if (jsc_bk_tem($argv, '--conteudo')) {
        $etiqueta = (string)jsc_bk_arg($argv, '--etiqueta', 'cron');
        if (!jsc_bk_etiqueta_valida($etiqueta)) {
            fwrite(STDERR, "erro: etiqueta inválida '" . $etiqueta . "'. Válidas: "
                . JSC_BK_ETIQUETAS . "\n");
            return 2;
        }
        $comum = [
            'dir'       => $dir,
            'margem'    => (int)jsc_bk_arg($argv, '--margem-bytes', JSC_BK_MARGEM),
            'comprimir' => !jsc_bk_tem($argv, '--sem-compressao'),
            'por'       => (string)jsc_bk_arg($argv, '--por', 'cli'),
        ];

        // Duas origens, por esta ordem: o estado actual e o estado que a
        // publicação substituiu. A segunda é lida da área da transação da
        // geração, nunca escrita — ver jsc_bk_anterior().
        //
        // Nota, que o Bloco C tem de resolver: isto recupera um estado
        // pré-publicação DEPOIS do facto. Não é o mesmo que guardar o estado
        // antes de o substituir: se três publicações acontecerem entre duas
        // execuções, o estado do meio não está em sítio nenhum.
        $trabalhos = [['origem' => (string)jsc_bk_arg($argv, '--origem', DATA_FILE),
                       'etiqueta' => $etiqueta, 'nome' => 'estado actual']];
        if (!jsc_bk_tem($argv, '--sem-anterior') && jsc_bk_arg($argv, '--origem') === null
            && is_file(jsc_bk_anterior())) {
            $trabalhos[] = ['origem' => jsc_bk_anterior(), 'etiqueta' => 'anterior',
                            'nome' => 'estado anterior à última publicação'];
        }

        $saida = 0;
        foreach ($trabalhos as $t) {
            $r = jsc_bk_conteudo($comum + ['origem' => $t['origem'], 'etiqueta' => $t['etiqueta']]);
            if (!$r['ok']) {
                fwrite(STDERR, "erro (" . $t['nome'] . "): " . $r['erro'] . "\n");
                $saida = max($saida, (int)$r['codigo']);
                continue;
            }
            foreach ($r['avisos'] as $a) fwrite(STDERR, "aviso: $a\n");
            if (!empty($r['inalterado'])) {
                echo $t['nome'] . ": sem alterações (" . $r['ficheiro'] . ")";
                echo !empty($r['promovida'])
                    ? " — etiqueta '" . $r['etiqueta'] . "' acrescentada à cópia que já existia.\n"
                    : ".\n";
                continue;
            }
            $e = $r['entrada'];
            echo $t['nome'] . ": " . $e['ficheiro'] . " [" . $e['etiqueta'] . "]\n";
            echo "  conteúdo ..: " . $e['bytes_conteudo'] . " bytes, sha256 " . substr($e['sha256_conteudo'], 0, 16) . "…\n";
            echo "  ficheiro ..: " . $e['bytes_ficheiro'] . " bytes (" . $e['compressao'] . ")\n";
            echo "  áreas .....: " . count($e['areas']) . " (" . jsc_bk_resumo_areas($e['areas']) . ")\n";
        }
        return $saida;
    }

    // ---- --relatorio -------------------------------------------------
    if (jsc_bk_tem($argv, '--relatorio')) {
        $pol = jsc_bk_politica_do_argv($argv);
        $r = jsc_bk_relatorio($dir, $pol);
        if ($r['codigo'] !== 0) { fwrite(STDERR, "erro: " . $r['erro'] . "\n"); return (int)$r['codigo']; }
        echo "=== cópias de segurança: " . $dir . " ===\n";
        echo "cópias ..........: " . $r['n'] . "\n";
        echo "espaço ocupado ..: " . $r['bytes'] . " bytes\n";
        echo "mais antiga .....: " . ($r['maisAntiga'] ?: '(nenhuma)') . "\n";
        echo "mais recente ....: " . ($r['maisRecente'] ?: '(nenhuma)') . "\n";
        $et = [];
        foreach ($r['porEtiqueta'] as $k => $v) $et[] = $k . '=' . $v;
        echo "por etiqueta ....: " . ($et ? implode(' ', $et) : '(nenhuma)') . "\n";
        echo "disco livre .....: " . $r['livre'] . " bytes\n";
        echo "retenção ........: " . $pol['recentes_horas'] . "h, " . $pol['dias'] . " dias, "
           . $pol['semanas'] . " semanas, " . $pol['meses'] . " meses; protegidas "
           . $pol['protegidas_meses'] . " meses; máximo " . $pol['maximo'] . " por execução\n";
        echo "eliminações .....: " . ($r['politicaAprovada'] ? 'LIGADAS' : 'DESLIGADAS (política não aprovada)') . "\n";
        return 0;
    }

    // ---- --limpar ----------------------------------------------------
    if (jsc_bk_tem($argv, '--limpar')) {
        $pol = jsc_bk_politica_do_argv($argv);
        $aplicar = jsc_bk_tem($argv, '--aplicar');
        $d = jsc_bk_limpar($dir, $pol, $aplicar);
        if (isset($d['erro']) && !isset($d['guardar'])) {
            fwrite(STDERR, "erro: " . $d['erro'] . "\n");
            return (int)$d['codigo'];
        }
        echo "=== retenção: " . $d['total'] . " cópia(s) no manifesto ===\n";
        echo ($aplicar ? "modo: APLICAR\n" : "modo: simulação (não apaga nada)\n") . "\n";
        echo "FICAM (" . count($d['guardar']) . "):\n";
        foreach ($d['guardar'] as $rel => $motivo) echo "  " . $rel . " — " . $motivo . "\n";
        if ($d['retidas']) {
            echo "\nNÃO SE APAGAM, apesar de estarem fora dos escalões (" . count($d['retidas']) . "):\n";
            foreach ($d['retidas'] as $rel => $motivo) echo "  " . $rel . " — " . $motivo . "\n";
        }
        echo "\nCANDIDATAS A APAGAR (" . count($d['candidatas']) . ")";
        echo $d['excedente'] ? ", e " . $d['excedente'] . " adiada(s) pelo máximo de "
             . $pol['maximo'] . " por execução:\n" : ":\n";
        foreach ($d['candidatas'] as $c) {
            echo "  " . $c['ficheiro'] . " — " . $c['quando'] . " [" . $c['etiqueta'] . "]\n";
        }
        if (!$d['candidatas']) echo "  (nenhuma)\n";
        if ($d['bloqueio'] !== null) {
            fwrite(STDERR, "\nBLOQUEADO: " . $d['bloqueio'] . "\nNada seria apagado.\n");
        }
        if ($d['aplicado']) {
            echo "\nAPLICADO:\n";
            foreach ($d['aplicado'] as $l) echo "  " . $l . "\n";
        }
        if (isset($d['erro'])) { fwrite(STDERR, "\n" . $d['erro'] . "\n"); }
        if (!$aplicar) {
            echo "\nNada foi apagado: isto é uma simulação. ";
            echo JSC_BK_POLITICA_APROVADA
                ? "Com --aplicar, apagaria as candidatas acima.\n"
                : "As eliminações estão desligadas nesta versão.\n";
        }
        return (int)$d['codigo'];
    }

    // ---- --listar ----------------------------------------------------
    if (jsc_bk_tem($argv, '--listar')) {
        $erro = '';
        $m = jsc_bk_manifesto_ler($dir, $erro);
        if ($m === null) { fwrite(STDERR, "erro: $erro\n"); return 2; }
        $n = 0;
        foreach ($m['entradas'] as $e) {
            if (!is_array($e) || !isset($e['ficheiro'])) continue;
            $n++;
            echo str_pad((string)$e['criado_em'], 26) . ' '
               . str_pad((string)$e['bytes_ficheiro'], 9, ' ', STR_PAD_LEFT) . ' B  '
               . substr((string)$e['sha256_conteudo'], 0, 12) . '…  '
               . $e['ficheiro'] . "\n";
        }
        echo $n . " cópia(s) em " . $dir . "\n";
        return 0;
    }

    // ---- --verificar -------------------------------------------------
    if (jsc_bk_tem($argv, '--verificar')) {
        $r = jsc_bk_verificar($dir, jsc_bk_tem($argv, '--profundo'));
        foreach ($r['achados'] as $a) {
            $linha = str_pad($a['nivel'], 6) . $a['assunto'] . ' — ' . $a['detalhe'];
            if ($a['nivel'] === 'ERRO') fwrite(STDERR, $linha . "\n"); else echo $linha . "\n";
        }
        if ($r['codigo'] === 0) {
            echo "\nSEM PROBLEMAS: todas as cópias conferem com o manifesto"
               . (jsc_bk_tem($argv, '--profundo') ? ', conteúdo e contagens incluídos.' : '.') . "\n";
        } else {
            fwrite(STDERR, "\n" . (isset($r['erros']) ? $r['erros'] : '?') . " problema(s). "
                . "Uma cópia que não confere não serve para recuperar: trate-a como perdida "
                . "e confirme que há outra boa antes de apagar o que quer que seja.\n");
        }
        return (int)$r['codigo'];
    }

    // ---- --ensaio-recuperacao ----------------------------------------
    $para = jsc_bk_arg($argv, '--para');
    if (!$para) { fwrite(STDERR, "erro: falta --para <pasta>, fora do projeto\n"); return 2; }

    // --serie: uma cópia de cada escalão, não só a última.
    if (jsc_bk_tem($argv, '--serie')) {
        $erroS = '';
        $m = jsc_bk_manifesto_ler($dir, $erroS);
        if ($m === null) { fwrite(STDERR, "erro: $erroS\n"); return 2; }
        $serie = jsc_bk_serie_para_ensaio($m['entradas'], time(), jsc_bk_politica_do_argv($argv));
        if (!$serie) { fwrite(STDERR, "erro: não há cópias para ensaiar\n"); return 2; }
        // Cada ensaio vai para uma subpasta, e o jsc_bk_ensaio() exige que a
        // pasta acima exista — é a verificação que o impede de escrever em
        // sítios que não foram criados de propósito.
        if (!is_dir($para) && !@mkdir($para, 0700, true)) {
            fwrite(STDERR, "erro: não foi possível criar " . $para . "\n");
            return 5;
        }
        @chmod($para, 0700);
        $falhas = 0;
        foreach ($serie as $x) {
            $sub = rtrim($para, '/') . '/' . preg_replace('/[^A-Za-z0-9._-]/', '_', basename($x['ficheiro']));
            $r = jsc_bk_ensaio($dir, basename($x['ficheiro']), $sub);
            if (isset($r['erro'])) {
                fwrite(STDERR, "  FALHA " . $x['ficheiro'] . " (" . $x['motivo'] . "): " . $r['erro'] . "\n");
                $falhas++;
                continue;
            }
            echo ($r['codigo'] === 0 ? "  ok   " : "  FALHA ") . $x['ficheiro']
               . " — " . $x['motivo'] . "\n";
            if ($r['codigo'] !== 0) { $falhas++; fwrite(STDERR, "    passos: " . implode(', ', $r['falhas']) . "\n"); }
        }
        if (jsc_bk_tem($argv, '--limpar-depois')) {
            $sobrou = jsc_bk_apagar_ensaio(rtrim($para, '/'));
            echo "\nPasta do ensaio removida" . ($sobrou ? ", excepto: " . implode(', ', $sobrou) : '')
               . ".\n";
        } else {
            echo "\nA pasta " . $para . " tem dados pessoais: apague-a quando acabar "
               . "(ou use --limpar-depois).\n";
        }
        echo $falhas ? "\n" . $falhas . " ensaio(s) falharam.\n" : "\nTodos os ensaios passaram.\n";
        return $falhas ? 1 : 0;
    }

    $alvo = jsc_bk_tem($argv, '--ultimo') ? '--ultimo' : jsc_bk_arg($argv, '--entrada');
    if (!$alvo)  { fwrite(STDERR, "erro: diga qual a cópia, com --ultimo, --entrada <ficheiro> ou --serie\n"); return 2; }
    $r = jsc_bk_ensaio($dir, $alvo, $para);
    if (isset($r['erro'])) { fwrite(STDERR, "erro: " . $r['erro'] . "\n"); return (int)$r['codigo']; }
    foreach ($r['passos'] as $p) {
        echo ($p['ok'] ? '  ok   ' : '  FALHA ') . $p['passo'] . ' — ' . $p['detalhe'] . "\n";
    }
    if ($r['codigo'] === 0) {
        echo "\nENSAIO BEM SUCEDIDO: " . $r['entrada']['ficheiro'] . " serve para recuperar.\n";
        echo "Escrito em " . $r['destino'] . " — o site NÃO foi tocado.\n";
        if (jsc_bk_tem($argv, '--limpar-depois')) {
            $sobrou = jsc_bk_apagar_ensaio(rtrim($para, '/'));
            echo "Pasta do ensaio removida" . ($sobrou ? ", excepto: " . implode(', ', $sobrou) : '') . ".\n";
        } else {
            echo "Essa pasta tem dados pessoais: apague-a quando acabar (ou use --limpar-depois).\n";
        }
    } else {
        fwrite(STDERR, "\nENSAIO FALHOU em: " . implode(', ', $r['falhas']) . "\n");
    }
    return (int)$r['codigo'];
}

// A política, com o que a linha de comandos mandar por cima. Serve para ver o
// efeito de outros números antes de os escrever no jsc_bk_politica().
function jsc_bk_politica_do_argv($argv) {
    $pol = jsc_bk_politica();
    $mapa = ['--recentes-horas' => 'recentes_horas', '--recentes-minimo' => 'recentes_minimo',
             '--dias' => 'dias', '--semanas' => 'semanas', '--meses' => 'meses',
             '--protegidas-meses' => 'protegidas_meses', '--maximo' => 'maximo'];
    foreach ($mapa as $flag => $chave) {
        $v = jsc_bk_arg($argv, $flag);
        if ($v !== null && is_numeric($v) && (int)$v >= 0) $pol[$chave] = (int)$v;
    }
    return $pol;
}

function jsc_bk_resumo_areas(array $areas) {
    $partes = [];
    foreach (['noticias', 'atletas', 'jogos', 'galeria'] as $a) {
        if (isset($areas[$a])) $partes[] = $a . ' ' . $areas[$a];
    }
    return $partes ? implode(', ', $partes) : (count($areas) . ' chaves');
}

// Corrido na linha de comandos, é um comando. Incluído por outro ficheiro, é
// só uma biblioteca de funções e não faz nada por si.
if (PHP_SAPI === 'cli' && $jsc_bk_directo) {
    exit(jsc_bk_principal($argv));
}
