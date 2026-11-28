<?php
// Endpoint do admin: listar e gerir inscrições/mensagens guardadas na
// base de dados. Exige sessão com a capacidade 'inscricoes'.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/sessao.php';

// Inscrições e mensagens são dados pessoais, de menores incluídos. Só
// com sessão e só com a capacidade 'inscricoes' — o perfil de Comunicação
// tem acesso a conteúdos mas não a estes dados.
//
// O token deixou de ser aceite: era um segredo partilhado, igual para
// toda a gente, sem forma de saber quem o usou nem de o revogar a um só.
if (!jsc_pode('inscricoes')) {
    http_response_code(jsc_tem_sessao() ? 403 : 401);
    echo json_encode(['ok' => false, 'error' => jsc_tem_sessao() ? 'sem permissao' : 'sem sessao']);
    exit;
}

$pdo = jsc_db();
if (!$pdo) {
    echo '{"ok":false,"error":"bd nao configurada"}';
    exit;
}

$tipo = isset($_GET['tipo']) ? $_GET['tipo'] : '';
if (!in_array($tipo, ['inscricao', 'contacto'], true)) {
    http_response_code(400);
    echo '{"ok":false,"error":"tipo invalido"}';
    exit;
}
$tabela = jsc_tabela($tipo);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = $pdo->query("SELECT id, dados, estado, criado_em FROM $tabela ORDER BY id DESC LIMIT 500")->fetchAll();
    $out = [];
    foreach ($rows as $r) {
        $d = json_decode($r['dados'], true) ?: [];
        $d['id']     = (int)$r['id'];
        $d['estado'] = $r['estado'];
        $out[] = $d;
    }
    echo json_encode(['ok' => true, 'registos' => $out], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $acao = isset($body['acao']) ? $body['acao'] : '';
    $id   = isset($body['id']) && is_numeric($body['id']) ? (int)$body['id'] : 0;
    // ---- criar uma inscrição à mão -------------------------------------
    // Para as que chegam por telefone ou ao balcão, que até aqui não tinham
    // por onde entrar: o único caminho para a jsc_inscricoes era o
    // api/submit.php, que é o formulário público.
    //
    // Não se reaproveita o submit.php de propósito. Uma inscrição submetida
    // pelo formulário traz o consentimento de quem a submeteu — aceitou os
    // termos. Uma escrita pelo clube não traz nada disso, e são dados
    // pessoais de um menor. Aqui há sessão, e por isso o SERVIDOR pode
    // carimbar quem a introduziu, em vez de acreditar no que o cliente diga.
    //
    // Vem antes da verificação do id porque uma criação não tem id: quem o
    // gera é este endpoint, como no submit.php e pela mesma razão — um id
    // vindo do cliente permitia escrever por cima de uma inscrição que já
    // existisse.
    if ($acao === 'criar') {
        if ($tipo !== 'inscricao') {
            http_response_code(400);
            echo '{"ok":false,"error":"so inscricoes podem ser criadas aqui"}';
            exit;
        }
        $dados = isset($body['dados']) && is_array($body['dados']) ? $body['dados'] : null;
        if (!$dados) {
            http_response_code(400);
            echo '{"ok":false,"error":"faltam os dados"}';
            exit;
        }
        // Os mesmos seis que o formulário público exige, menos os termos, que
        // aqui são a declaração de consentimento, logo a seguir.
        foreach (['nome', 'dataNasc', 'telefone', 'codigoPostal', 'rua'] as $campo) {
            if (!isset($dados[$campo]) || trim((string)$dados[$campo]) === '') {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'falta o campo obrigatorio: ' . $campo]);
                exit;
            }
        }
        // O consentimento é exigido aqui, e não só na interface: uma caixa que
        // só o painel verifica não é uma garantia, é um lembrete.
        if (empty($dados['consentimento'])) {
            http_response_code(400);
            echo '{"ok":false,"error":"falta a declaracao de consentimento do encarregado"}';
            exit;
        }

        // O que o servidor carimba, e o cliente não escolhe.
        unset($dados['id']);
        $eu = jsc_utilizador();
        $dados['origem']         = 'painel';
        $dados['introduzidoPor'] = $eu ? $eu['utilizador'] : '';
        $dados['introduzidoEm']  = date('c');
        $dados['estado']         = 'Pendente';

        $json = json_encode($dados, JSON_UNESCAPED_UNICODE);
        if ($json === false || strlen($json) > 65536) {
            http_response_code(400);
            echo '{"ok":false,"error":"dados invalidos ou demasiado grandes"}';
            exit;
        }

        try {
            // Mesma geração de id do api/submit.php: milissegundos mais um
            // sufixo aleatório, e cinco tentativas em caso de colisão.
            $stmt = $pdo->prepare("INSERT INTO $tabela (id, dados, estado) VALUES (?, ?, ?)");
            for ($tentativa = 0; $tentativa < 5; $tentativa++) {
                $novoId = (int)(microtime(true) * 1000) * 1000 + random_int(0, 999);
                try {
                    $stmt->execute([$novoId, $json, 'Pendente']);
                    echo json_encode(['ok' => true, 'id' => $novoId]);
                    exit;
                } catch (PDOException $e) {
                    if ($e->getCode() !== '23000') throw $e;
                }
            }
            http_response_code(500);
            echo '{"ok":false,"error":"nao foi possivel gerar um identificador livre"}';
        } catch (Exception $e) {
            http_response_code(500);
            echo '{"ok":false,"error":"erro ao guardar"}';
        }
        exit;
    }

    if (!$id) { http_response_code(400); echo '{"ok":false,"error":"id invalido"}'; exit; }

    try {
        // O rowCount() dizia-se a si mesmo e a mais ninguém. Um DELETE que
        // não encontre a linha tem sucesso com zero linhas afectadas, e o
        // endpoint respondia {"ok":true} igual ao caso em que apagou — pelo
        // que o painel anunciava "Inscrição eliminada" sem ter eliminado
        // nada. O estado final é o mesmo (não está lá), por isso o ok
        // continua a ser true: dizer que falhou faria o painel manter na
        // lista um registo que não existe. O que muda é passar a dizer
        // QUANTAS linhas mexeu, e quem chama decide o que diz à pessoa.
        if ($acao === 'estado' && isset($body['estado'])) {
            $stmt = $pdo->prepare("UPDATE $tabela SET estado = ? WHERE id = ?");
            $stmt->execute([substr($body['estado'], 0, 20), $id]);
            echo json_encode(['ok' => true, 'alteradas' => $stmt->rowCount()]);
        } elseif ($acao === 'apagar') {
            $stmt = $pdo->prepare("DELETE FROM $tabela WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['ok' => true, 'apagadas' => $stmt->rowCount()]);
        } else {
            http_response_code(400);
            echo '{"ok":false,"error":"acao invalida"}';
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo '{"ok":false,"error":"erro na operacao"}';
    }
    exit;
}

http_response_code(405);
echo '{"ok":false,"error":"method not allowed"}';
