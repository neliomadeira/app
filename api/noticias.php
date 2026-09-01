<?php
// Notícias — leitura pública e gestão pelo painel.
// A base de dados é a fonte de verdade: o painel escreve aqui e o site
// lê daqui, em vez de cada browser guardar a sua cópia no localStorage.
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/sessao.php';

function resposta($dados, $code = 200) {
    http_response_code($code);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = jsc_db();
if (!$pdo) resposta(['ok' => false, 'error' => 'bd nao configurada'], 503);

// Converte uma linha da tabela para a forma que o site já usa, para os
// ecrãs existentes não precisarem de saber que a origem mudou.
function para_json(array $r) {
    return [
        'id'          => (int)$r['id'],
        'titulo'      => $r['titulo'],
        'categoria'   => $r['categoria'],
        'data'        => $r['data'],
        'resumo'      => $r['resumo'] ?? '',
        'imagem'      => $r['imagem'] ?? '',
        'imagemPos'   => $r['imagem_pos'],
        'imagemSize'  => $r['imagem_size'],
        'focalPos'    => $r['focal_pos'],
        'publicada'   => (bool)$r['publicada'],
        'scheduledAt' => $r['agendada_para'] ? str_replace(' ', 'T', substr($r['agendada_para'], 0, 16)) : '',
        'destaque'    => (bool)$r['destaque'],
        'criadoEm'    => $r['criado_em'] ?? null,
    ];
}

// ---------- LEITURA ----------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $todas = isset($_GET['todas']) && $_GET['todas'] === '1';

    if ($todas) {
        // Vista do painel: inclui rascunhos e agendadas por sair.
        jsc_exigir_admin();
        $sql = 'SELECT * FROM jsc_noticias ORDER BY data DESC, id DESC';
        $rows = $pdo->query($sql)->fetchAll();
    } else {
        // Vista pública: publicadas, mais as agendadas cuja hora já passou.
        // A decisão é do servidor — antes dependia do relógio do visitante.
        header('Cache-Control: public, max-age=60');
        $sql = 'SELECT * FROM jsc_noticias
                 WHERE publicada = 1
                    OR (agendada_para IS NOT NULL AND agendada_para <= NOW())
                 ORDER BY data DESC, id DESC';
        $rows = $pdo->query($sql)->fetchAll();
    }

    resposta(['ok' => true, 'noticias' => array_map('para_json', $rows)]);
}

// ---------- ESCRITA ----------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') resposta(['ok' => false, 'error' => 'method not allowed'], 405);

jsc_exigir_admin();

$corpo = json_decode(file_get_contents('php://input'), true);
if (!is_array($corpo)) resposta(['ok' => false, 'error' => 'json invalido'], 400);
$acao = $corpo['acao'] ?? '';

if ($acao === 'guardar') {
    $n = $corpo['noticia'] ?? [];
    $titulo = trim($n['titulo'] ?? '');
    if ($titulo === '') resposta(['ok' => false, 'error' => 'o título é obrigatório'], 400);

    $data = $n['data'] ?? '';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $data)) $data = date('Y-m-d');

    $agendada = trim($n['scheduledAt'] ?? '');
    // datetime-local chega como 2026-09-01T14:30
    $agendada = $agendada !== '' ? str_replace('T', ' ', substr($agendada, 0, 16)) . ':00' : null;
    if ($agendada !== null && !preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $agendada)) $agendada = null;

    $campos = [
        'titulo'        => mb_substr($titulo, 0, 255),
        'categoria'     => mb_substr($n['categoria'] ?? 'Clube', 0, 50),
        'data'          => $data,
        'resumo'        => $n['resumo'] ?? '',
        'imagem'        => mb_substr($n['imagem'] ?? '', 0, 500),
        'imagem_pos'    => mb_substr($n['imagemPos'] ?? 'top', 0, 20),
        'imagem_size'   => mb_substr($n['imagemSize'] ?? 'cover', 0, 20),
        'focal_pos'     => mb_substr($n['focalPos'] ?? 'center', 0, 20),
        'publicada'     => !empty($n['publicada']) ? 1 : 0,
        'agendada_para' => $agendada,
        'destaque'      => !empty($n['destaque']) ? 1 : 0,
    ];

    $id = isset($n['id']) && is_numeric($n['id']) ? (int)$n['id'] : 0;
    // Só actualiza se a notícia existir mesmo. Ids antigos vindos de
    // Date.now() não colidem com os novos, mas mais vale confirmar.
    $existe = false;
    if ($id) {
        $q = $pdo->prepare('SELECT 1 FROM jsc_noticias WHERE id = ?');
        $q->execute([$id]);
        $existe = (bool)$q->fetchColumn();
    }

    if ($existe) {
        $sets = implode(', ', array_map(fn($c) => "$c = ?", array_keys($campos)));
        $stmt = $pdo->prepare("UPDATE jsc_noticias SET $sets WHERE id = ?");
        $stmt->execute([...array_values($campos), $id]);
    } else {
        $cols = array_keys($campos);
        $marc = implode(', ', array_fill(0, count($cols), '?'));
        if ($id) { $cols[] = 'id'; $campos['id'] = $id; $marc .= ', ?'; }
        $stmt = $pdo->prepare('INSERT INTO jsc_noticias (' . implode(', ', $cols) . ") VALUES ($marc)");
        $stmt->execute(array_values($campos));
        $id = $id ?: (int)$pdo->lastInsertId();
    }

    $q = $pdo->prepare('SELECT * FROM jsc_noticias WHERE id = ?');
    $q->execute([$id]);
    resposta(['ok' => true, 'noticia' => para_json($q->fetch())]);
}

if ($acao === 'apagar') {
    $id = (int)($corpo['id'] ?? 0);
    if (!$id) resposta(['ok' => false, 'error' => 'id invalido'], 400);
    $pdo->prepare('DELETE FROM jsc_noticias WHERE id = ?')->execute([$id]);
    resposta(['ok' => true]);
}

// Interruptores rápidos da lista, sem abrir a notícia
if ($acao === 'alternar') {
    $id    = (int)($corpo['id'] ?? 0);
    $campo = $corpo['campo'] ?? '';
    if (!$id || !in_array($campo, ['publicada', 'destaque'], true)) {
        resposta(['ok' => false, 'error' => 'pedido invalido'], 400);
    }
    $valor = !empty($corpo['valor']) ? 1 : 0;
    // Publicar à mão limpa o agendamento: já não faz sentido esperar.
    $extra = ($campo === 'publicada' && $valor) ? ', agendada_para = NULL' : '';
    $pdo->prepare("UPDATE jsc_noticias SET $campo = ?$extra WHERE id = ?")->execute([$valor, $id]);
    resposta(['ok' => true]);
}

// Importação em bloco — usada uma vez para trazer o que está no browser
if ($acao === 'importar') {
    $lista = $corpo['noticias'] ?? [];
    if (!is_array($lista)) resposta(['ok' => false, 'error' => 'lista invalida'], 400);
    $novas = 0; $existentes = 0;
    foreach ($lista as $n) {
        if (empty($n['titulo'])) continue;
        $id = isset($n['id']) && is_numeric($n['id']) ? (int)$n['id'] : 0;
        if ($id) {
            $q = $pdo->prepare('SELECT 1 FROM jsc_noticias WHERE id = ?');
            $q->execute([$id]);
            if ($q->fetchColumn()) { $existentes++; continue; }   // nunca sobrepõe
        }
        $agendada = trim($n['scheduledAt'] ?? '');
        $agendada = $agendada !== '' ? str_replace('T', ' ', substr($agendada, 0, 16)) . ':00' : null;
        $stmt = $pdo->prepare(
            'INSERT INTO jsc_noticias
             (id, titulo, categoria, data, resumo, imagem, imagem_pos, imagem_size, focal_pos, publicada, agendada_para, destaque)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
        );
        $stmt->execute([
            $id ?: null,
            mb_substr($n['titulo'], 0, 255),
            mb_substr($n['categoria'] ?? 'Clube', 0, 50),
            preg_match('/^\d{4}-\d{2}-\d{2}$/', $n['data'] ?? '') ? $n['data'] : date('Y-m-d'),
            $n['resumo'] ?? '',
            mb_substr($n['imagem'] ?? '', 0, 500),
            mb_substr($n['imagemPos'] ?? 'top', 0, 20),
            mb_substr($n['imagemSize'] ?? 'cover', 0, 20),
            mb_substr($n['focalPos'] ?? 'center', 0, 20),
            !empty($n['publicada']) ? 1 : 0,
            $agendada,
            !empty($n['destaque']) ? 1 : 0,
        ]);
        $novas++;
    }
    resposta(['ok' => true, 'importadas' => $novas, 'ignoradas' => $existentes]);
}

resposta(['ok' => false, 'error' => 'acao invalida'], 400);
