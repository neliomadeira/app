<?php
// Patrocinadores — leitura pública e gestão pelo painel.
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/sessao.php';

const JSC_TIERS = ['Ouro', 'Prata', 'Bronze'];

function resposta($dados, $code = 200) {
    http_response_code($code);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = jsc_db();
if (!$pdo) resposta(['ok' => false, 'error' => 'bd nao configurada'], 503);

function para_json(array $r) {
    return [
        'id'      => (int)$r['id'],
        'nome'    => $r['nome'],
        'sector'  => $r['sector'] ?? '',
        'tier'    => $r['tier'],
        'website' => $r['website'] ?? '',
        'logo'    => $r['logo'] ?? '',
        'ordem'   => (int)$r['ordem'],
        'ativo'   => (bool)$r['ativo'],
        'desde'   => $r['desde'] ?? '',
    ];
}

// A ordenação é feita aqui, e não no browser: FIELD() põe os escalões pela
// ordem certa (Ouro, Prata, Bronze) e dentro de cada um manda a coluna
// ordem, com o nome a desempatar.
const ORDENACAO = "ORDER BY FIELD(tier,'Ouro','Prata','Bronze'), ordem ASC, nome ASC";

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['todos']) && $_GET['todos'] === '1') {
        jsc_exigir_admin();
        $rows = $pdo->query('SELECT * FROM jsc_patrocinadores ' . ORDENACAO)->fetchAll();
    } else {
        header('Cache-Control: public, max-age=300');
        $rows = $pdo->query('SELECT * FROM jsc_patrocinadores WHERE ativo = 1 ' . ORDENACAO)->fetchAll();
    }
    resposta(['ok' => true, 'patrocinadores' => array_map('para_json', $rows)]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') resposta(['ok' => false, 'error' => 'method not allowed'], 405);

jsc_exigir_admin();

$corpo = json_decode(file_get_contents('php://input'), true);
if (!is_array($corpo)) resposta(['ok' => false, 'error' => 'json invalido'], 400);
$acao = $corpo['acao'] ?? '';

if ($acao === 'guardar') {
    $p    = $corpo['patrocinador'] ?? [];
    $nome = trim($p['nome'] ?? '');
    if ($nome === '') resposta(['ok' => false, 'error' => 'o nome é obrigatório'], 400);

    $tier = $p['tier'] ?? 'Bronze';
    if (!in_array($tier, JSC_TIERS, true)) $tier = 'Bronze';

    // Sem ordem indicada, entra no fim do seu escalão.
    if (isset($p['ordem']) && is_numeric($p['ordem'])) {
        $ordem = (int)$p['ordem'];
    } else {
        $q = $pdo->prepare('SELECT COALESCE(MAX(ordem), 0) + 1 FROM jsc_patrocinadores WHERE tier = ?');
        $q->execute([$tier]);
        $ordem = (int)$q->fetchColumn();
    }

    $campos = [
        'nome'    => mb_substr($nome, 0, 150),
        'sector'  => mb_substr($p['sector'] ?? '', 0, 100),
        'tier'    => $tier,
        'website' => mb_substr($p['website'] ?? '', 0, 500),
        'logo'    => mb_substr($p['logo'] ?? '', 0, 500),
        'ordem'   => $ordem,
        'ativo'   => !empty($p['ativo']) ? 1 : 0,
        'desde'   => mb_substr((string)($p['desde'] ?? ''), 0, 10),
    ];

    $id = isset($p['id']) && is_numeric($p['id']) ? (int)$p['id'] : 0;
    $existe = false;
    if ($id) {
        $q = $pdo->prepare('SELECT 1 FROM jsc_patrocinadores WHERE id = ?');
        $q->execute([$id]);
        $existe = (bool)$q->fetchColumn();
    }

    if ($existe) {
        $sets = implode(', ', array_map(fn($c) => "$c = ?", array_keys($campos)));
        $pdo->prepare("UPDATE jsc_patrocinadores SET $sets WHERE id = ?")
            ->execute([...array_values($campos), $id]);
    } else {
        $cols = array_keys($campos);
        $marc = implode(', ', array_fill(0, count($cols), '?'));
        if ($id) { $cols[] = 'id'; $campos['id'] = $id; $marc .= ', ?'; }
        $pdo->prepare('INSERT INTO jsc_patrocinadores (' . implode(', ', $cols) . ") VALUES ($marc)")
            ->execute(array_values($campos));
        $id = $id ?: (int)$pdo->lastInsertId();
    }

    $q = $pdo->prepare('SELECT * FROM jsc_patrocinadores WHERE id = ?');
    $q->execute([$id]);
    resposta(['ok' => true, 'patrocinador' => para_json($q->fetch())]);
}

if ($acao === 'apagar') {
    $id = (int)($corpo['id'] ?? 0);
    if (!$id) resposta(['ok' => false, 'error' => 'id invalido'], 400);
    $pdo->prepare('DELETE FROM jsc_patrocinadores WHERE id = ?')->execute([$id]);
    resposta(['ok' => true]);
}

if ($acao === 'alternar') {
    $id = (int)($corpo['id'] ?? 0);
    if (!$id) resposta(['ok' => false, 'error' => 'id invalido'], 400);
    $pdo->prepare('UPDATE jsc_patrocinadores SET ativo = ? WHERE id = ?')
        ->execute([!empty($corpo['valor']) ? 1 : 0, $id]);
    resposta(['ok' => true]);
}

// Trocar de lugar com o vizinho dentro do mesmo escalão.
if ($acao === 'mover') {
    $id     = (int)($corpo['id'] ?? 0);
    $sentido = $corpo['sentido'] ?? '';
    if (!$id || !in_array($sentido, ['cima', 'baixo'], true)) {
        resposta(['ok' => false, 'error' => 'pedido invalido'], 400);
    }

    $q = $pdo->prepare('SELECT id, tier, ordem FROM jsc_patrocinadores WHERE id = ?');
    $q->execute([$id]);
    $atual = $q->fetch();
    if (!$atual) resposta(['ok' => false, 'error' => 'nao encontrado'], 404);

    // O vizinho é o mais próximo na direcção pedida; nome desempata para
    // que a troca funcione mesmo quando várias linhas partilham a ordem.
    $cmp = $sentido === 'cima' ? '<' : '>';
    $dir = $sentido === 'cima' ? 'DESC' : 'ASC';
    $v = $pdo->prepare(
        "SELECT id, ordem FROM jsc_patrocinadores
          WHERE tier = ? AND (ordem $cmp ? OR (ordem = ? AND id $cmp ?))
       ORDER BY ordem $dir, id $dir LIMIT 1"
    );
    $v->execute([$atual['tier'], $atual['ordem'], $atual['ordem'], $id]);
    $vizinho = $v->fetch();
    if (!$vizinho) resposta(['ok' => true, 'movido' => false]);   // já está no topo/fundo

    // Ordens iguais não se trocam sozinhas: dá-se um valor distinto.
    $novaAtual   = (int)$vizinho['ordem'];
    $novaVizinho = (int)$atual['ordem'];
    if ($novaAtual === $novaVizinho) {
        $novaAtual   = $sentido === 'cima' ? $novaAtual - 1 : $novaAtual + 1;
    }
    $up = $pdo->prepare('UPDATE jsc_patrocinadores SET ordem = ? WHERE id = ?');
    $up->execute([$novaAtual, $id]);
    $up->execute([$novaVizinho, $vizinho['id']]);
    resposta(['ok' => true, 'movido' => true]);
}

if ($acao === 'importar') {
    $lista = $corpo['patrocinadores'] ?? [];
    if (!is_array($lista)) resposta(['ok' => false, 'error' => 'lista invalida'], 400);
    $novos = 0; $existentes = 0; $n = 0;
    foreach ($lista as $p) {
        if (empty($p['nome'])) continue;
        $id = isset($p['id']) && is_numeric($p['id']) ? (int)$p['id'] : 0;
        if ($id) {
            $q = $pdo->prepare('SELECT 1 FROM jsc_patrocinadores WHERE id = ?');
            $q->execute([$id]);
            if ($q->fetchColumn()) { $existentes++; continue; }
        }
        $tier = in_array($p['tier'] ?? '', JSC_TIERS, true) ? $p['tier'] : 'Bronze';
        $pdo->prepare(
            'INSERT INTO jsc_patrocinadores (id, nome, sector, tier, website, logo, ordem, ativo, desde)
             VALUES (?,?,?,?,?,?,?,?,?)'
        )->execute([
            $id ?: null,
            mb_substr($p['nome'], 0, 150),
            mb_substr($p['sector'] ?? '', 0, 100),
            $tier,
            mb_substr($p['website'] ?? '', 0, 500),
            mb_substr($p['logo'] ?? '', 0, 500),
            isset($p['ordem']) && is_numeric($p['ordem']) ? (int)$p['ordem'] : ++$n,
            array_key_exists('ativo', $p) ? (!empty($p['ativo']) ? 1 : 0) : 1,
            mb_substr((string)($p['desde'] ?? ''), 0, 10),
        ]);
        $novos++;
    }
    resposta(['ok' => true, 'importados' => $novos, 'ignorados' => $existentes]);
}

resposta(['ok' => false, 'error' => 'acao invalida'], 400);
