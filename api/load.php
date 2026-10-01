<?php
// =====================================================
// CONTEÚDO PÚBLICO — leitura para o browser
// =====================================================
// É daqui que o js/sync.js traz o conteúdo publicado para o localStorage de
// quem visita o site. Endereço público, sem sessão: tem de ser, porque é a
// melhoria progressiva de todas as páginas.
//
// O que mudou: antes era um readfile(DATA_FILE) — o data/db.json inteiro,
// byte a byte, a quem pedisse. As páginas nunca mostraram o que não está
// publicado, mas o endpoint entregava tudo: notícias por publicar, a data de
// nascimento e o encarregado de educação dos atletas, e o segredo do mail.php.
//
// Passa a entregar a PROJEÇÃO PÚBLICA — jsc_conteudo_publico(), em
// api/conteudo.php, que é também onde vivem os filtros que o E1 e o E2 usam.
// Allowlist: uma chave nova no painel não sai daqui sem ser declarada lá.
//
// Só lê. Não grava, não toca em sessões, não toca em permissões.
// =====================================================

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache');
require_once __DIR__ . '/conteudo.php';

if (!is_file(DATA_FILE)) {
    echo '{}';
    exit;
}

$publico = jsc_conteudo_publico(jsc_conteudo_do_ficheiro());
$json = json_encode($publico, JSON_UNESCAPED_UNICODE);

// Um json_encode que falhe (conteúdo mal formado, profundidade excessiva) não
// pode devolver "false" como corpo: o browser receberia um JSON inválido e o
// js/sync.js engoliria a excepção sem o visitante saber. Devolve-se o estado
// vazio, que as páginas sabem tratar.
echo $json === false ? '{}' : $json;
