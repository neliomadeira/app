<?php
// =====================================================
// LOGÓTIPOS DE EQUIPAS — receber um ficheiro do painel
// =====================================================
// O único endpoint do projeto que grava ficheiros. Escreve apenas dentro de
// uploads/logos/, e sempre com um nome que ele próprio gera.
//
// Porque existe: o db_logos tinha 18 escudos, todos endereços do zerozero.pt.
// Um site de terceiros que mude de caminhos, de política de referer ou que
// simplesmente desapareça leva com ele os escudos da classificação pública. E
// não há como o servidor os copiar sozinho: neste alojamento o curl não está
// instalado e o allow_url_fopen está Off, pelo que o PHP não descarrega nada
// de fora. Converter um endereço externo em ficheiro nosso é por isso um acto
// manual — descarregar e carregar aqui.
//
// O que este endpoint NÃO faz: não toca em jogos, classificações, no
// db_logos, no data/db.json, no sync nem na publicação. Recebe um ficheiro,
// valida-o, grava-o, e devolve o caminho. Quem escreve no db_logos é o painel,
// com esse caminho.
// =====================================================

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/sessao.php';

function jsc_logo_saida($dados, $codigo = 200) {
    http_response_code($codigo);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

// ---- Autorização, igual à dos outros endpoints do painel -------------
// O cabeçalho primeiro: um formulário noutro site não o consegue enviar sem
// passar por uma verificação prévia do browser, e sem ele nem se chega a
// olhar para o ficheiro.
jsc_exigir_pedido_do_painel();

// A capacidade é a mesma área que já governa o db_logos na publicação:
// 'configuracoes' inclui 'logos' (ver jsc_areas() em api/sessao.php). Assim
// quem pode publicar um mapa de logótipos é exactamente quem pode carregar
// um escudo, e não se inventa uma permissão nova.
jsc_exigir('configuracoes');
$perfil = jsc_perfil_do_utilizador();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsc_logo_saida(['ok' => false, 'error' => 'method not allowed'], 405);
}

// ---- O corpo chegou inteiro? -----------------------------------------
// Acima do post_max_size o PHP descarta o corpo e tanto o $_POST como o
// $_FILES chegam vazios, enquanto o CONTENT_LENGTH continua a anunciar o
// tamanho enviado. Sem isto, a resposta era "sem ficheiro" e ninguém
// percebia porquê. Mesma verificação que o api/save.php faz.
$anunciado = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
if ($anunciado > 0 && !$_POST && !$_FILES) {
    jsc_logo_saida([
        'ok'     => false,
        'error'  => 'o ficheiro enviado foi recusado pelo servidor antes de chegar aqui: '
                  . 'excede o post_max_size, que neste alojamento esta em '
                  . (string)ini_get('post_max_size'),
        'limite' => (string)ini_get('post_max_size'),
    ], 413);
}

// ---- Limites ---------------------------------------------------------
// Um escudo de equipa é uma imagem pequena. Os limites são generosos para o
// que é, e apertados para o que a pasta é: conteúdo persistente servido a
// todos os visitantes.
define('JSC_LOGO_MAX_BYTES', 512 * 1024);
define('JSC_LOGO_MAX_LADO',  1024);
define('JSC_LOGO_MIN_LADO',  16);

// Extensão do cliente → tipo que o getimagesize() tem de confirmar. É por
// este mapa que "a extensão e o tipo real têm de coincidir": um .png que
// seja JPEG é recusado, e um .jpg que seja PNG também.
$JSC_LOGO_TIPOS = [
    'png'  => IMAGETYPE_PNG,
    'jpg'  => IMAGETYPE_JPEG,
    'jpeg' => IMAGETYPE_JPEG,
    'webp' => IMAGETYPE_WEBP,
];
// Tipo real → extensão com que se grava. Nunca se usa a extensão do cliente
// para escrever: usa-se a que corresponde ao que a imagem é de facto.
$JSC_LOGO_EXTENSAO = [
    IMAGETYPE_PNG  => 'png',
    IMAGETYPE_JPEG => 'jpg',
    IMAGETYPE_WEBP => 'webp',
];

// ---- O nome do ficheiro é nosso --------------------------------------
// Slug determinístico a partir do nome da equipa: minúsculas, acentos
// reduzidos, tudo o que não seja letra ou número vira hífen. O nome que o
// cliente dá ao ficheiro é ignorado por completo — não é lido, não é
// guardado, não aparece na resposta.
//
// A tabela de acentos é escrita à mão de propósito: o iconv//TRANSLIT
// depende da locale do sistema e devolve resultados diferentes de máquina
// para máquina, o que daria nomes de ficheiro diferentes para a mesma
// equipa.
function jsc_logo_slug($nome) {
    $s = trim((string)$nome);
    if ($s === '') return '';
    $de = ['á','à','â','ã','ä','é','è','ê','ë','í','ì','î','ï','ó','ò','ô','õ','ö',
           'ú','ù','û','ü','ç','ñ','ý',
           'Á','À','Â','Ã','Ä','É','È','Ê','Ë','Í','Ì','Î','Ï','Ó','Ò','Ô','Õ','Ö',
           'Ú','Ù','Û','Ü','Ç','Ñ','Ý'];
    $para = ['a','a','a','a','a','e','e','e','e','i','i','i','i','o','o','o','o','o',
             'u','u','u','u','c','n','y',
             'a','a','a','a','a','e','e','e','e','i','i','i','i','o','o','o','o','o',
             'u','u','u','u','c','n','y'];
    $s = str_replace($de, $para, $s);
    $s = strtolower($s);
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    $s = trim((string)$s, '-');
    if (strlen($s) > 60) $s = trim(substr($s, 0, 60), '-');
    return $s;
}

$equipa = isset($_POST['equipa']) ? (string)$_POST['equipa'] : '';
$slug   = jsc_logo_slug($equipa);
if ($slug === '') {
    jsc_logo_saida(['ok' => false, 'error' => 'falta o nome da equipa, ou nao tem letras nem numeros'], 400);
}

// ---- O ficheiro ------------------------------------------------------
if (!isset($_FILES['ficheiro']) || !is_array($_FILES['ficheiro'])) {
    jsc_logo_saida(['ok' => false, 'error' => 'sem ficheiro'], 400);
}
$f = $_FILES['ficheiro'];

if (!isset($f['error']) || $f['error'] !== UPLOAD_ERR_OK) {
    $porque = [
        UPLOAD_ERR_INI_SIZE   => 'o ficheiro excede o upload_max_filesize do servidor',
        UPLOAD_ERR_FORM_SIZE  => 'o ficheiro excede o limite do formulario',
        UPLOAD_ERR_PARTIAL    => 'o envio ficou a meio',
        UPLOAD_ERR_NO_FILE    => 'nao foi enviado nenhum ficheiro',
        UPLOAD_ERR_NO_TMP_DIR => 'o servidor nao tem pasta temporaria',
        UPLOAD_ERR_CANT_WRITE => 'o servidor nao conseguiu escrever o ficheiro temporario',
        UPLOAD_ERR_EXTENSION  => 'uma extensao do PHP interrompeu o envio',
    ];
    $e = isset($f['error']) ? (int)$f['error'] : -1;
    jsc_logo_saida([
        'ok'    => false,
        'error' => isset($porque[$e]) ? $porque[$e] : 'erro no envio do ficheiro',
        'codigo_upload' => $e,
    ], 400);
}

// Só um ficheiro que o PHP reconheça como enviado por POST é aceite: sem
// isto, um caminho qualquer em tmp_name seria lido como se tivesse sido
// carregado.
if (!isset($f['tmp_name']) || !is_uploaded_file($f['tmp_name'])) {
    jsc_logo_saida(['ok' => false, 'error' => 'ficheiro temporario invalido'], 400);
}

$bytes = isset($f['size']) ? (int)$f['size'] : 0;
if ($bytes <= 0) {
    jsc_logo_saida(['ok' => false, 'error' => 'ficheiro vazio'], 400);
}
if ($bytes > JSC_LOGO_MAX_BYTES) {
    jsc_logo_saida([
        'ok'    => false,
        'error' => 'o escudo tem ' . $bytes . ' bytes e o limite sao '
                 . JSC_LOGO_MAX_BYTES . ' (512 KB)',
    ], 413);
}

// ---- Extensão declarada vs tipo real ---------------------------------
// A extensão serve só para ser confrontada com a realidade. Tira-se do nome
// que o cliente mandou, em minúsculas, e exige-se que o tipo que o
// getimagesize() encontrar seja o que ela promete.
$nomeCliente = isset($f['name']) ? (string)$f['name'] : '';
$ext = strtolower((string)pathinfo($nomeCliente, PATHINFO_EXTENSION));
if (!isset($JSC_LOGO_TIPOS[$ext])) {
    jsc_logo_saida([
        'ok'    => false,
        'error' => 'extensao nao aceite: so PNG, JPEG e WebP. O SVG fica de fora de '
                 . 'proposito, porque um SVG servido do nosso dominio pode executar script.',
        'aceitas' => array_keys($JSC_LOGO_TIPOS),
    ], 415);
}

// O getimagesize() é do núcleo do PHP e não depende da extensão GD nem da
// fileinfo — que neste alojamento não está instalada. Lê o cabeçalho do
// ficheiro e diz o que ele é de facto.
$info = @getimagesize($f['tmp_name']);
if (!is_array($info) || !isset($info[2])) {
    jsc_logo_saida(['ok' => false, 'error' => 'o ficheiro nao e uma imagem que o servidor reconheca'], 415);
}
$tipoReal = (int)$info[2];
if (!isset($JSC_LOGO_EXTENSAO[$tipoReal])) {
    jsc_logo_saida([
        'ok'    => false,
        'error' => 'a imagem e de um formato nao aceite (tipo ' . $tipoReal . '): so PNG, JPEG e WebP',
    ], 415);
}
if ($tipoReal !== $JSC_LOGO_TIPOS[$ext]) {
    jsc_logo_saida([
        'ok'    => false,
        'error' => 'a extensao .' . $ext . ' nao corresponde ao conteudo do ficheiro',
        'declarado' => $ext,
        'real'      => $JSC_LOGO_EXTENSAO[$tipoReal],
    ], 415);
}

$largura = isset($info[0]) ? (int)$info[0] : 0;
$altura  = isset($info[1]) ? (int)$info[1] : 0;
if ($largura < JSC_LOGO_MIN_LADO || $altura < JSC_LOGO_MIN_LADO) {
    jsc_logo_saida([
        'ok'    => false,
        'error' => 'a imagem e demasiado pequena (' . $largura . 'x' . $altura
                 . '): minimo ' . JSC_LOGO_MIN_LADO . ' pixeis de lado',
    ], 422);
}
if ($largura > JSC_LOGO_MAX_LADO || $altura > JSC_LOGO_MAX_LADO) {
    jsc_logo_saida([
        'ok'    => false,
        'error' => 'a imagem e demasiado grande (' . $largura . 'x' . $altura
                 . '): maximo ' . JSC_LOGO_MAX_LADO . ' pixeis de lado',
    ], 422);
}

// ---- Gravar, e só dentro de uploads/logos/ ---------------------------
$pasta = __DIR__ . '/../uploads/logos';
if (!is_dir($pasta) && !@mkdir($pasta, 0755, true)) {
    jsc_logo_saida(['ok' => false, 'error' => 'nao foi possivel criar a pasta uploads/logos/'], 500);
}

$extFinal = $JSC_LOGO_EXTENSAO[$tipoReal];
$ficheiro = $pasta . '/' . $slug . '.' . $extFinal;

// Defesa em profundidade: o slug já não pode conter barras nem pontos, mas
// confirma-se que o destino fica mesmo dentro da pasta. Se um dia o slug
// mudar, isto continua a travar.
$raizReal = realpath($pasta);
$destinoReal = realpath(dirname($ficheiro));
if ($raizReal === false || $destinoReal === false || $destinoReal !== $raizReal) {
    jsc_logo_saida(['ok' => false, 'error' => 'destino fora de uploads/logos/'], 400);
}

if (!@move_uploaded_file($f['tmp_name'], $ficheiro)) {
    jsc_logo_saida(['ok' => false, 'error' => 'nao foi possivel gravar o ficheiro'], 500);
}
@chmod($ficheiro, 0644);

// Um escudo que já lá estivesse noutro formato não é apagado aqui: apagar
// ficheiros numa pasta persistente é uma decisão à parte, e não é esta
// operação que a toma. Devolvem-se os nomes, para o painel poder avisar.
$restos = [];
foreach (array_unique(array_values($JSC_LOGO_EXTENSAO)) as $outra) {
    if ($outra === $extFinal) continue;
    if (is_file($pasta . '/' . $slug . '.' . $outra)) {
        $restos[] = 'uploads/logos/' . $slug . '.' . $outra;
    }
}

jsc_logo_saida([
    'ok'       => true,
    // A chave com que o painel deve escrever no db_logos: a mesma forma que
    // a colagem das classificações usa, o nome em minúsculas.
    'chave'    => strtolower(trim($equipa)),
    'caminho'  => 'uploads/logos/' . $slug . '.' . $extFinal,
    'slug'     => $slug,
    'formato'  => $extFinal,
    'bytes'    => $bytes,
    'largura'  => $largura,
    'altura'   => $altura,
    'porQuem'  => isset($perfil['nome']) ? $perfil['nome'] : null,
    'restos'   => $restos,
]);
