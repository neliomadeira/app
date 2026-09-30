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
// Validação partilhada pelos dois blocos dos patrocinadores. O que tem de
// valer nas duas páginas vale aqui, uma vez só.
//
// $contentor  o id que o JavaScript procura quando tem de redesenhar
// $cartao     a classe de cada cartão nessa página
function jsc_validar_patrocinadores($meio, array $conteudo, $contentor, $cartao) {
    $erros = [];
    $lista     = jsc_patrocinadores($conteudo);
    $esperados = count($lista);

    // O [ "] a seguir à classe exclui os sp-card__body e companhia.
    $obtidos = preg_match_all('/<(?:a|div) class="' . preg_quote($cartao, '/') . '[ "]/', $meio);
    if ($obtidos !== $esperados) {
        $erros[] = "gerou $obtidos cartões, esperava $esperados";
    }
    if (strpos($meio, 'id="' . $contentor . '"') === false) {
        $erros[] = 'o bloco gerado não tem o contentor id="' . $contentor . '"';
    }
    if (strpos($meio, 'data-itens="' . $esperados . '"') === false) {
        $erros[] = 'o data-itens não corresponde ao número de patrocinadores gerados';
    }
    if ($esperados === 0 && strpos($meio, 'jsc-vazio') === false
        && strpos($meio, 'sp-empty') === false) {
        $erros[] = 'sem patrocinadores, o bloco tem de manter o estado vazio';
    }

    // Deixou de existir divisão por níveis. O que se proíbe é a *estrutura* do
    // nível, não a palavra: uma empresa pode chamar-se "Bronze, Lda." e o nome
    // dela é conteúdo legítimo. O que não pode voltar é uma classe de nível,
    // um cabeçalho de nível, ou o tier a sair para o HTML — o tier fica nos
    // dados só por compatibilidade histórica e não tem efeito na publicação.
    foreach (['--ouro', '--prata', '--bronze', 'sponsors-tier', 'sp-tier',
              'tier-label', 'tier-dot', 'data-tier', 'tier="'] as $proibido) {
        if (stripos($meio, $proibido) !== false) {
            $erros[] = "o bloco de patrocinadores não pode conter \"$proibido\"";
        }
    }

    // O travessão que o painel gravava num sector em branco não é conteúdo.
    if (preg_match('/>\s*[-—–]\s*</', $meio)) {
        $erros[] = 'o cartão não pode mostrar um travessão como se fosse conteúdo';
    }

    // Uma ligação por patrocinador com website, e nenhum cartão que seja um
    // <a> sem href: um <a> sem href não recebe foco nem é anunciado como
    // ligação.
    $comUrl = 0;
    foreach ($lista as $p) { if ($p['url'] !== '') $comUrl++; }
    $externas = preg_match_all('/<a[^>]+href="https?:\/\//i', $meio);
    if ($externas !== $comUrl) {
        $erros[] = "gerou $externas ligações externas, esperava $comUrl";
    }
    if (preg_match('/<a class="(?:sponsor-card|sp-card)[^"]*"\s*>/', $meio)) {
        $erros[] = 'nenhum cartão pode ser um <a> sem href';
    }

    // Todo o logótipo tem texto alternativo. A verificação olha para a
    // etiqueta inteira: o alt pode vir antes ou depois do class.
    if (preg_match_all('/<img\b[^>]*>/', $meio, $imgs)) {
        foreach ($imgs[0] as $img) {
            if (strpos($img, 'sponsor-card__img') === false
                && strpos($img, 'sp-card__logo-img') === false) continue;
            if (!preg_match('/\salt="[^"]+"/', $img)) {
                $erros[] = 'todo o logótipo tem de ter um alt não vazio';
                break;
            }
        }
    }
    // Campo vazio não produz elemento vazio.
    if (preg_match('/<(span|h3)[^>]*>\s*<\/\1>/', $meio)) {
        $erros[] = 'o bloco gerado não pode ter elementos vazios';
    }

    return $erros;
}

// Validação partilhada pelas três zonas de galeria e vídeo. O que tem de valer
// nas três vale aqui, uma vez só.
// $itens  quantos o data-itens deve declarar. Na página inicial a grelha
//         mostra uma prévia mas conta a lista completa: é por esse número que
//         o JavaScript sabe se o bloco continua a servir.
function jsc_validar_media($meio, $cartao, array $lista, $contentor, $itens = null) {
    $erros = [];
    $esperados = count($lista);
    if ($itens === null) $itens = $esperados;

    $obtidos = preg_match_all('/<(?:a|div) class="' . preg_quote($cartao, '/') . '[ "]/', $meio);
    if ($obtidos !== $esperados) {
        $erros[] = "gerou $obtidos cartões, esperava $esperados";
    }
    if ($contentor !== '' && $esperados > 0
        && strpos($meio, 'id="' . $contentor . '"') === false) {
        $erros[] = 'o bloco gerado não tem o contentor id="' . $contentor . '"';
    }
    if ($esperados > 0 && strpos($meio, 'data-itens="' . $itens . '"') === false) {
        $erros[] = 'o data-itens não corresponde ao número de itens gerados';
    }

    // As cinco legendas fictícias da página inicial não podem voltar, nem aqui
    // nem em sítio nenhum.
    foreach (['Treino Sub-17', 'Jogo Sub-13', 'Celebração', 'Treino Sub-9',
              'Campeão Distrital'] as $proibido) {
        if (strpos($meio, $proibido) !== false) {
            $erros[] = "o bloco não pode conter a legenda fictícia \"$proibido\"";
        }
    }
    // Nem os esqueletos de carregamento permanentes.
    if (strpos($meio, 'class="skeleton') !== false) {
        $erros[] = 'o bloco não pode conter esqueletos de carregamento';
    }
    // Campo vazio não produz elemento vazio.
    if (preg_match('/<(span|p|h3)[^>]*>\s*<\/\1>/', $meio)) {
        $erros[] = 'o bloco gerado não pode ter elementos vazios';
    }
    // Nenhum campo pessoal: estas listas não os têm e nunca devem ter.
    foreach (['dataNascimento', 'nascimento', 'telefone', 'email', 'encarregado'] as $proibido) {
        if (stripos($meio, $proibido) !== false) {
            $erros[] = "o bloco de media não pode conter \"$proibido\"";
        }
    }
    return $erros;
}

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

        'agenda' => [
            'ficheiro' => 'index.html',
            'modelo'   => 'agenda-inicio.php',
            'inicio'   => '<!-- JSC:agenda:inicio -->',
            'fim'      => '<!-- JSC:agenda:fim -->',
            'dados'    => function (array $conteudo) {
                return [
                    'eventos' => jsc_agenda_proximos($conteudo, null, jsc_agenda_previa()),
                    'desde'   => jsc_hoje(),
                ];
            },
            'validar'  => function ($meio, array $conteudo) {
                $erros = [];
                $esperados = count(jsc_agenda_proximos($conteudo, null, jsc_agenda_previa()));
                $obtidos   = substr_count($meio, '<div class="agenda-card">');
                if ($obtidos !== $esperados) {
                    $erros[] = "gerou $obtidos cartões, esperava $esperados";
                }
                if (strpos($meio, 'id="agendaPublicGrid"') === false) {
                    $erros[] = 'o bloco gerado não tem o contentor id="agendaPublicGrid"';
                }
                if ($esperados === 0 && strpos($meio, 'jsc-vazio') === false) {
                    $erros[] = 'sem eventos, o bloco tem de manter a mensagem de lista vazia';
                }
                if (strpos($meio, 'data-desde="' . jsc_hoje() . '"') === false) {
                    $erros[] = 'o data-desde não é o dia de hoje';
                }
                return $erros;
            },
        ],

        'agenda-pagina' => [
            'ficheiro' => 'agenda.html',
            'modelo'   => 'agenda-pagina.php',
            'inicio'   => '<!-- JSC:agenda-pagina:inicio -->',
            'fim'      => '<!-- JSC:agenda-pagina:fim -->',
            'dados'    => function (array $conteudo) {
                return [
                    'eventos' => jsc_agenda_proximos($conteudo),
                    'desde'   => jsc_hoje(),
                ];
            },
            'validar'  => function ($meio, array $conteudo) {
                $erros = [];
                $lista = jsc_agenda_proximos($conteudo);
                $esperados = count($lista);
                $obtidos = substr_count($meio, '<div class="agenda-pub-item"');
                if ($obtidos !== $esperados) {
                    $erros[] = "gerou $obtidos eventos, esperava $esperados";
                }
                if (strpos($meio, 'id="agendaList"') === false) {
                    $erros[] = 'o bloco gerado não tem o contentor id="agendaList"';
                }
                if ($esperados === 0 && strpos($meio, 'agenda-pub-empty') === false) {
                    $erros[] = 'sem eventos, o bloco tem de manter a mensagem de lista vazia';
                }
                // Um botão .ics por evento, e todos com a classe que o tira
                // da página quando não há JavaScript.
                $botoes = substr_count($meio, 'class="agenda-ics-btn jsc-so-com-js"');
                if ($botoes !== $esperados) {
                    $erros[] = "gerou $botoes botões de calendário, esperava $esperados";
                }
                if (strpos($meio, 'data-desde="' . jsc_hoje() . '"') === false) {
                    $erros[] = 'o data-desde não é o dia de hoje';
                }
                return $erros;
            },
        ],

        'seniores-info' => [
            'ficheiro' => 'equipa-principal.html',
            'modelo'   => 'seniores-info.php',
            'inicio'   => '<!-- JSC:seniores-info:inicio -->',
            'fim'      => '<!-- JSC:seniores-info:fim -->',
            'dados'    => function (array $conteudo) {
                return ['itens' => jsc_seniores_info($conteudo)];
            },
            'validar'  => function ($meio, array $conteudo) {
                $erros = [];
                $esperados = count(jsc_seniores_info($conteudo));
                $obtidos = substr_count($meio, '<div class="senior-info__item">');
                if ($obtidos !== $esperados) {
                    $erros[] = "gerou $obtidos campos, esperava $esperados";
                }
                if (strpos($meio, 'id="seniorInfoBar"') === false) {
                    $erros[] = 'o bloco gerado não tem o contentor id="seniorInfoBar"';
                }
                // Com os quatro campos vazios não há barra: fica escondida,
                // em vez de ficar uma caixa vazia na página.
                $escondida = strpos($meio, 'id="seniorInfoBar"') !== false
                          && strpos($meio, 'data-itens="0"') !== false;
                if ($esperados === 0 && !$escondida) {
                    $erros[] = 'sem campos preenchidos, a barra tem de ficar escondida';
                }
                return $erros;
            },
        ],

        'seniores-plantel' => [
            'ficheiro' => 'equipa-principal.html',
            'modelo'   => 'seniores-plantel.php',
            'inicio'   => '<!-- JSC:seniores-plantel:inicio -->',
            'fim'      => '<!-- JSC:seniores-plantel:fim -->',
            'dados'    => function (array $conteudo) {
                return ['grupos' => jsc_seniores_plantel($conteudo)];
            },
            'validar'  => function ($meio, array $conteudo) {
                $erros = [];
                $grupos = jsc_seniores_plantel($conteudo);
                $jogadores = 0;
                foreach ($grupos as $g) $jogadores += count($g['jogadores']);

                $obtidosGrupos = substr_count($meio, '<div class="squad-group">');
                if ($obtidosGrupos !== count($grupos)) {
                    $erros[] = "gerou $obtidosGrupos grupos de posição, esperava " . count($grupos);
                }
                $obtidosCartoes = substr_count($meio, '<div class="player-card">');
                if ($obtidosCartoes !== $jogadores) {
                    $erros[] = "gerou $obtidosCartoes cartões de jogador, esperava $jogadores";
                }
                if (strpos($meio, 'id="seniorPlantel"') === false) {
                    $erros[] = 'o bloco gerado não tem o contentor id="seniorPlantel"';
                }
                if ($jogadores === 0 && strpos($meio, 'id="plantelVazio"') === false) {
                    $erros[] = 'sem plantel, o bloco tem de manter a mensagem de plantel a atualizar';
                }
                if ($jogadores > 0 && strpos($meio, 'id="plantelVazio"') !== false) {
                    $erros[] = 'com plantel, a mensagem de plantel a atualizar não pode ficar';
                }
                // Nenhum dado pessoal além dos quatro que já eram públicos.
                foreach (['dataNascimento', 'data-nascimento', 'nascimento', 'idade',
                          'telefone', 'email'] as $proibido) {
                    if (stripos($meio, $proibido) !== false) {
                        $erros[] = "o cartão de jogador não pode conter \"$proibido\"";
                    }
                }
                return $erros;
            },
        ],

        'seniores-posts' => [
            'ficheiro' => 'equipa-principal.html',
            'modelo'   => 'seniores-posts.php',
            'inicio'   => '<!-- JSC:seniores-posts:inicio -->',
            'fim'      => '<!-- JSC:seniores-posts:fim -->',
            'dados'    => function (array $conteudo) {
                return [
                    'posts'  => jsc_seniores_posts($conteudo),
                    'total'  => jsc_seniores_total_posts($conteudo),
                    'previa' => jsc_seniores_previa(),
                ];
            },
            'validar'  => function ($meio, array $conteudo) {
                $erros = [];
                $esperados = count(jsc_seniores_posts($conteudo));
                $obtidos = substr_count($meio, '<article class="senior-post-card');
                if ($obtidos !== $esperados) {
                    $erros[] = "gerou $obtidos publicações, esperava $esperados";
                }
                foreach (['seniorPostsGrid', 'seniorPostsEmpty', 'btnVerTodosPosts'] as $id) {
                    if (strpos($meio, 'id="' . $id . '"') === false) {
                        $erros[] = 'falta o contentor id="' . $id . '"';
                    }
                }
                // Uma ligação a sério por publicação: é o que a torna
                // navegável sem JavaScript e alcançável com o teclado.
                $ligacoes = substr_count($meio, '<a class="senior-post-card__more" href="noticias.html?id=');
                if ($ligacoes !== $esperados) {
                    $erros[] = "gerou $ligacoes ligações \"Ler mais\", esperava $esperados";
                }
                $vazioEscondido = strpos($meio, 'id="seniorPostsEmpty" hidden') !== false;
                if ($esperados === 0 && $vazioEscondido) {
                    $erros[] = 'sem publicações, o estado vazio tem de ficar visível';
                }
                if ($esperados > 0 && !$vazioEscondido) {
                    $erros[] = 'com publicações, o estado vazio tem de ficar escondido';
                }
                return $erros;
            },
        ],

        'noticias-pagina' => [
            'ficheiro' => 'noticias.html',
            'modelo'   => 'noticias-pagina.php',
            'inicio'   => '<!-- JSC:noticias-pagina:inicio -->',
            'fim'      => '<!-- JSC:noticias-pagina:fim -->',
            'dados'    => function (array $conteudo) {
                $lista = jsc_noticias_pagina($conteudo);
                return [
                    'noticias'   => $lista,
                    'destaque'   => jsc_noticias_destaque($lista),
                    'categorias' => jsc_noticias_categorias($lista),
                    'previa'     => jsc_noticias_previa(),
                    // O endereço público vem do <link rel="canonical"> da
                    // própria página, não de um valor fixo no código.
                    'base'       => jsc_url_base(JSC_RAIZ . '/noticias.html'),
                ];
            },
            'validar'  => function ($meio, array $conteudo) {
                $erros = [];
                $lista = jsc_noticias_pagina($conteudo);
                $esperados = count($lista);

                $obtidos = substr_count($meio, '<article class="news-card news-page__card');
                if ($obtidos !== $esperados) {
                    $erros[] = "gerou $obtidos cartões, esperava $esperados";
                }

                foreach (['notFeatured', 'notFilters', 'notGrid', 'notEmpty', 'notMoreWrap'] as $id) {
                    if (strpos($meio, 'id="' . $id . '"') === false) {
                        $erros[] = 'falta o contentor id="' . $id . '"';
                    }
                }

                // Uma ligação a sério por cartão, mais a do destaque. É o que
                // torna a lista navegável sem JavaScript e com o teclado.
                $temDestaque = jsc_noticias_destaque($lista) !== null;
                $ligacoes = substr_count($meio, '<a class="news-card__link"');
                $esperadas = $esperados + ($temDestaque ? 1 : 0);
                if ($ligacoes !== $esperadas) {
                    $erros[] = "gerou $ligacoes ligações \"Ler mais\", esperava $esperadas";
                }

                // Os cartões além da prévia levam a classe que o CSS esconde
                // com JavaScript e o <noscript> mostra sem ele.
                $extras = max(0, $esperados - jsc_noticias_previa());
                $obtidosExtras = substr_count($meio, 'news-page__card--extra');
                if ($obtidosExtras !== $extras) {
                    $erros[] = "marcou $obtidosExtras cartões como extra, esperava $extras";
                }

                $vazioEscondido = strpos($meio, 'id="notEmpty" hidden') !== false;
                if ($esperados === 0 && $vazioEscondido) {
                    $erros[] = 'sem notícias, o estado vazio tem de ficar visível';
                }
                if ($esperados > 0 && !$vazioEscondido) {
                    $erros[] = 'com notícias, o estado vazio tem de ficar escondido';
                }

                if (strpos($meio, 'data-itens="' . $esperados . '"') === false) {
                    $erros[] = 'o data-itens não corresponde ao número de notícias geradas';
                }

                return $erros;
            },
        ],

        'escaloes' => [
            'ficheiro' => 'formacao.html',
            'modelo'   => 'escaloes.php',
            'inicio'   => '<!-- JSC:escaloes:inicio -->',
            'fim'      => '<!-- JSC:escaloes:fim -->',
            'dados'    => function (array $conteudo) {
                return ['escaloes' => jsc_escaloes($conteudo)];
            },
            'validar'  => function ($meio, array $conteudo) {
                $erros = [];
                $escaloes  = jsc_escaloes($conteudo);
                $esperados = count($escaloes);

                // O [ "] a seguir a category-card exclui os category-card__age
                // e category-card__badge que vivem dentro de cada cartão.
                $obtidos = preg_match_all('/<div class="category-card[ "]/', $meio);
                if ($obtidos !== $esperados) {
                    $erros[] = "gerou $obtidos cartões, esperava $esperados";
                }
                if (strpos($meio, 'id="categoriesGrid"') === false) {
                    $erros[] = 'o bloco gerado não tem o contentor id="categoriesGrid"';
                }
                if ($esperados === 0 && strpos($meio, 'jsc-vazio') === false) {
                    $erros[] = 'sem escalões, o bloco tem de manter a mensagem de lista vazia';
                }
                if (strpos($meio, 'data-itens="' . $esperados . '"') === false) {
                    $erros[] = 'o data-itens não corresponde ao número de escalões gerados';
                }

                // Uma ligação por cartão, e todas para a página do escalão.
                $ligacoes = substr_count($meio, '<a href="escalao.html?escalao=');
                if ($ligacoes !== $esperados) {
                    $erros[] = "gerou $ligacoes ligações para escalões, esperava $esperados";
                }

                // Uma lista vazia não se escreve: sem itens não há <ul>.
                $comItens = 0;
                foreach ($escaloes as $e) { if ($e['itens']) $comItens++; }
                $listas = substr_count($meio, '<ul class="category-card__list">');
                if ($listas !== $comItens) {
                    $erros[] = "gerou $listas listas, esperava $comItens (sem itens não há <ul>)";
                }

                // O número de atletas só aparece acima de zero. Um "0 atletas"
                // não diz que o escalão está vazio, diz que ninguém preencheu
                // o campo.
                if (preg_match('/(^|[^\d])0 atletas inscritos/', $meio)) {
                    $erros[] = 'o cartão não pode mostrar "0 atletas inscritos"';
                }

                // Rede de segurança, não expectativa: este bloco lê apenas o
                // db_escaloes e nunca chega perto de um atleta. Se algum dia
                // chegar, a publicação para aqui.
                foreach (['dataNascimento', 'data-nascimento', 'nascimento', 'idade',
                          'telefone', 'email', 'encarregado'] as $proibido) {
                    if (stripos($meio, $proibido) !== false) {
                        $erros[] = "o cartão de escalão não pode conter \"$proibido\"";
                    }
                }

                return $erros;
            },
        ],

        // Os dois blocos dos patrocinadores partilham a mesma função de
        // conteúdo e o mesmo validador: só o modelo difere.
        'patrocinadores' => [
            'ficheiro' => 'index.html',
            'modelo'   => 'patrocinadores-inicio.php',
            'inicio'   => '<!-- JSC:patrocinadores:inicio -->',
            'fim'      => '<!-- JSC:patrocinadores:fim -->',
            'dados'    => function (array $conteudo) {
                return ['patrocinadores' => jsc_patrocinadores($conteudo)];
            },
            'validar'  => function ($meio, array $conteudo) {
                return jsc_validar_patrocinadores($meio, $conteudo, 'sponsorsGrid', 'sponsor-card');
            },
        ],

        'patrocinadores-pagina' => [
            'ficheiro' => 'patrocinadores.html',
            'modelo'   => 'patrocinadores-pagina.php',
            'inicio'   => '<!-- JSC:patrocinadores-pagina:inicio -->',
            'fim'      => '<!-- JSC:patrocinadores-pagina:fim -->',
            'dados'    => function (array $conteudo) {
                return ['patrocinadores' => jsc_patrocinadores($conteudo)];
            },
            'validar'  => function ($meio, array $conteudo) {
                $erros = jsc_validar_patrocinadores($meio, $conteudo, 'sponsorsContent', 'sp-card');
                // O convite final aparece sempre, com ou sem patrocinadores:
                // era ele que desaparecia com a página quando não havia
                // JavaScript.
                if (strpos($meio, 'class="sp-cta"') === false) {
                    $erros[] = 'o bloco gerado tem de manter o convite final (sp-cta)';
                }
                // Uma grelha só. Mais do que uma significa que voltou a haver
                // divisão por níveis.
                if (substr_count($meio, '<div class="sp-grid">') > 1) {
                    $erros[] = 'só pode existir uma grelha de patrocinadores';
                }
                return $erros;
            },
        ],

        'modalidades' => [
            'ficheiro' => 'index.html',
            'modelo'   => 'modalidades.php',
            'inicio'   => '<!-- JSC:modalidades:inicio -->',
            'fim'      => '<!-- JSC:modalidades:fim -->',
            'dados'    => function (array $conteudo) {
                return ['modalidades' => jsc_modalidades($conteudo)];
            },
            'validar'  => function ($meio, array $conteudo) {
                $erros = [];
                $lista     = jsc_modalidades($conteudo);
                $esperados = count($lista);

                $obtidos = substr_count($meio, '<div class="modality-card">');
                if ($obtidos !== $esperados) {
                    $erros[] = "gerou $obtidos cartões, esperava $esperados";
                }
                if (strpos($meio, 'id="modalidadesGrid"') === false) {
                    $erros[] = 'o bloco gerado não tem o contentor id="modalidadesGrid"';
                }
                if ($esperados === 0 && strpos($meio, 'jsc-vazio') === false) {
                    $erros[] = 'sem modalidades, o bloco tem de manter o estado vazio';
                }
                if (strpos($meio, 'data-itens="' . $esperados . '"') === false) {
                    $erros[] = 'o data-itens não corresponde ao número de modalidades geradas';
                }

                // Uma ligação por cartão, e todas para a página da modalidade.
                $ligacoes = substr_count($meio, '<a href="modalidade.html?id=');
                if ($ligacoes !== $esperados) {
                    $erros[] = "gerou $ligacoes ligações para modalidades, esperava $esperados";
                }

                // A caixa de informação só existe quando tem itens: vazia,
                // desenha um traço e 14px de espaço por nada.
                $comItens = 0;
                foreach ($lista as $m) { if ($m['itens']) $comItens++; }
                $caixas = substr_count($meio, '<div class="modality-card__info">');
                if ($caixas !== $comItens) {
                    $erros[] = "gerou $caixas caixas de informação, esperava $comItens (sem itens não há caixa)";
                }
                if (preg_match('/<div class="modality-card__info">\s*<\/div>/', $meio)) {
                    $erros[] = 'a caixa de informação não pode ser escrita vazia';
                }

                // O ícone é decoração e tem de o dizer.
                $icones = substr_count($meio, 'class="modality-card__icon" aria-hidden="true"');
                if ($icones !== $esperados) {
                    $erros[] = "marcou $icones ícones como decorativos, esperava $esperados";
                }

                // Campo vazio não produz elemento vazio.
                if (preg_match('/<(h3|p|span)[^>]*>\s*<\/\1>/', $meio)) {
                    $erros[] = 'o bloco gerado não pode ter elementos vazios';
                }

                // Rede de segurança, não expectativa: este bloco lê o
                // db_modalidades e nunca chega perto de um contacto. O
                // responsável é um nome, e só.
                foreach (['telefone', 'email', 'contacto', 'dataNascimento'] as $proibido) {
                    if (stripos($meio, $proibido) !== false) {
                        $erros[] = "o cartão de modalidade não pode conter \"$proibido\"";
                    }
                }

                return $erros;
            },
        ],

        'galeria' => [
            'ficheiro' => 'index.html',
            'modelo'   => 'galeria-inicio.php',
            'inicio'   => '<!-- JSC:galeria:inicio -->',
            'fim'      => '<!-- JSC:galeria:fim -->',
            'dados'    => function (array $conteudo) {
                return [
                    'fotos'  => jsc_galeria($conteudo),
                    'previa' => jsc_galeria_previa(),
                ];
            },
            'validar'  => function ($meio, array $conteudo) {
                $fotos = jsc_galeria($conteudo);
                $previa = jsc_galeria_previa();
                $mostradas = array_slice($fotos, 0, $previa);
                // Sem fotografias a secção inteira desaparece: nada de
                // cabeçalho, subtítulo, grelha ou botão.
                if (!$fotos) {
                    $erros = [];
                    // Sem fotografias o bloco só pode ter o comentário que
                    // explica a ausência: nada que o visitante veja.
                    $visivel = trim(preg_replace('/<!--[\s\S]*?-->/', '', $meio));
                    if ($visivel !== '') {
                        $erros[] = 'sem fotografias a secção da galeria tem de desaparecer por inteiro';
                    }
                    if (strpos($meio, 'id="galeria"') !== false) {
                        $erros[] = 'sem fotografias não pode existir a secção da galeria';
                    }
                    return $erros;
                }
                $erros = jsc_validar_media($meio, 'gallery__item--img', $mostradas,
                                           'galleryGrid', count($fotos));
                if (strpos($meio, 'id="galeria"') === false) {
                    $erros[] = 'com fotografias a secção tem de existir';
                }
                if (count($fotos) > $previa && strpos($meio, 'id="galleryMore"') === false) {
                    $erros[] = 'com mais fotografias do que a prévia tem de haver o botão "Ver mais"';
                }
                if (count($fotos) <= $previa && strpos($meio, 'id="galleryMore"') !== false) {
                    $erros[] = 'sem fotografias a mais não pode haver botão "Ver mais"';
                }
                return $erros;
            },
        ],

        'galeria-pagina' => [
            'ficheiro' => 'galeria.html',
            'modelo'   => 'galeria-pagina.php',
            'inicio'   => '<!-- JSC:galeria-pagina:inicio -->',
            'fim'      => '<!-- JSC:galeria-pagina:fim -->',
            'dados'    => function (array $conteudo) {
                return ['fotos' => jsc_galeria($conteudo)];
            },
            'validar'  => function ($meio, array $conteudo) {
                $fotos = jsc_galeria($conteudo);
                $erros = jsc_validar_media($meio, 'galeria-item', $fotos, 'galeriaGrid');
                $vazioEscondido = strpos($meio, 'id="galeriaEmpty" hidden') !== false;
                if (!$fotos && $vazioEscondido) {
                    $erros[] = 'sem fotografias o estado vazio tem de ficar visível';
                }
                if ($fotos && !$vazioEscondido) {
                    $erros[] = 'com fotografias o estado vazio tem de ficar escondido';
                }
                // A fotografia sem endereço fica com o cartão de categoria.
                $semUrl = 0;
                foreach ($fotos as $f) { if ($f['url'] === '') $semUrl++; }
                $cartoes = substr_count($meio, 'galeria-placeholder galeria-placeholder--');
                if ($cartoes !== $semUrl) {
                    $erros[] = "gerou $cartoes cartões de categoria, esperava $semUrl";
                }
                return $erros;
            },
        ],

        'videos' => [
            'ficheiro' => 'videos.html',
            'modelo'   => 'videos.php',
            'inicio'   => '<!-- JSC:videos:inicio -->',
            'fim'      => '<!-- JSC:videos:fim -->',
            'dados'    => function (array $conteudo) {
                return ['videos' => jsc_videos($conteudo)];
            },
            'validar'  => function ($meio, array $conteudo) {
                $videos = jsc_videos($conteudo);
                $erros = jsc_validar_media($meio, 'video-card', $videos, 'videosGrid');
                $vazioEscondido = strpos($meio, 'id="videosEmpty" hidden') !== false;
                if (!$videos && $vazioEscondido) {
                    $erros[] = 'sem vídeos o estado vazio tem de ficar visível';
                }
                if ($videos && !$vazioEscondido) {
                    $erros[] = 'com vídeos o estado vazio tem de ficar escondido';
                }
                // Cada cartão é uma ligação a sério para o YouTube, construída
                // do id validado. Nenhum <iframe> vive dentro desta região: o
                // do modal fica fora.
                $ligacoes = substr_count($meio, 'href="https://www.youtube.com/watch?v=');
                if ($ligacoes !== count($videos)) {
                    $erros[] = "gerou $ligacoes ligações para o YouTube, esperava " . count($videos);
                }
                if (stripos($meio, '<iframe') !== false) {
                    $erros[] = 'a região dos vídeos não pode conter um <iframe>';
                }
                // Toda a miniatura vem do id validado e tem texto alternativo.
                $minis = substr_count($meio, 'https://img.youtube.com/vi/');
                if ($minis !== count($videos)) {
                    $erros[] = "gerou $minis miniaturas, esperava " . count($videos);
                }
                if (preg_match_all('/<img\b[^>]*class="video-card__img"[^>]*>/', $meio, $imgs)) {
                    foreach ($imgs[0] as $img) {
                        if (!preg_match('/\salt="[^"]+"/', $img)) {
                            $erros[] = 'toda a miniatura tem de ter um alt não vazio';
                            break;
                        }
                    }
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
    // Um ficheiro com mais do que um bloco aparece uma vez só: senão o
    // reverter restaurava-o duas vezes.
    return array_values(array_unique($lista));
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
// Um ficheiro pode ter mais do que uma região gerada: a página inicial tem
// as notícias e a agenda. Localizar todas de uma vez, e recusar antes de
// gerar o que quer que seja, é o que garante que um bloco nunca escreve por
// cima de outro.
//
// Devolve as regiões ordenadas pela posição no ficheiro, cada uma com:
//   abre   onde começa a marca de início
//   meio   onde começa o conteúdo gerado (logo depois dessa marca)
//   fecha  onde começa a marca de fim
//   fim    onde acaba a marca de fim
// As marcas contam como HTML manual: ficam de fora do que é gerado.
function jsc_regioes($html, array $blocos, &$erro) {
    // (0) Configuração: duas marcas não podem ser iguais nem uma ser parte
    //     da outra, senão as contagens de baixo mentiam.
    $marcas = [];
    foreach ($blocos as $nome => $b) {
        $marcas[$nome . ' (início)'] = $b['inicio'];
        $marcas[$nome . ' (fim)']    = $b['fim'];
    }
    foreach ($marcas as $ka => $a) {
        foreach ($marcas as $kb => $bb) {
            if ($ka === $kb) continue;
            if (strpos($a, $bb) !== false) {
                $erro = "a marca de $ka contém a marca de $kb: não é possível contá-las";
                return false;
            }
        }
    }

    // (1) Cada marca aparece exatamente uma vez, e na ordem certa.
    $regioes = [];
    foreach ($blocos as $nome => $b) {
        $ni = substr_count($html, $b['inicio']);
        $nf = substr_count($html, $b['fim']);
        if ($ni !== 1) { $erro = "$nome: a marca de início aparece $ni vez(es), tem de aparecer exatamente uma"; return false; }
        if ($nf !== 1) { $erro = "$nome: a marca de fim aparece $nf vez(es), tem de aparecer exatamente uma"; return false; }
        $abre  = strpos($html, $b['inicio']);
        $meio  = $abre + strlen($b['inicio']);
        $fecha = strpos($html, $b['fim']);
        if ($fecha < $meio) { $erro = "$nome: as marcas estão fora de ordem"; return false; }
        $regioes[] = [
            'nome' => $nome, 'bloco' => $b,
            'abre' => $abre, 'meio' => $meio,
            'fecha' => $fecha, 'fim' => $fecha + strlen($b['fim']),
            // A indentação da linha onde está a marca de fim. Como essa
            // indentação faz parte do miolo, tem de ser reposta no fim do
            // que se gera — senão a marca de fecho muda de coluna, e cada
            // ficheiro tem a sua (o index.html usa seis espaços, a
            // agenda.html quatro).
            'indent' => jsc_indentacao($html, $fecha),
        ];
    }

    usort($regioes, function ($x, $y) { return $x['abre'] - $y['abre']; });

    // (2) Sem sobreposições nem encaixes: cada região acaba antes de a
    //     seguinte começar.
    for ($i = 1; $i < count($regioes); $i++) {
        if ($regioes[$i]['abre'] < $regioes[$i - 1]['fim']) {
            $erro = 'as marcas de ' . $regioes[$i - 1]['nome'] . ' e de ' . $regioes[$i]['nome']
                  . ' sobrepõem-se ou estão encaixadas uma na outra';
            return false;
        }
    }

    return $regioes;
}

// A indentação da linha onde começa a posição dada, se for só espaços.
function jsc_indentacao($html, $pos) {
    $nl = strrpos(substr($html, 0, $pos), "\n");
    $inicio = ($nl === false) ? 0 : $nl + 1;
    $prefixo = substr($html, $inicio, $pos - $inicio);
    return preg_match('/^[ \t]*$/', $prefixo) ? $prefixo : '';
}

// Monta o ficheiro numa única passagem sobre os bytes originais: para cada
// região copia o que está antes (marca de início incluída), insere o miolo
// novo e salta para a marca de fim. Nada é substituído no sítio, por isso
// não há posições a invalidar. Com uma região só devolve, byte a byte,
// prefixo . miolo . sufixo.
function jsc_montar($html, array $regioes, array $meios) {
    $saida  = '';
    $cursor = 0;
    foreach ($regioes as $r) {
        $saida .= substr($html, $cursor, $r['meio'] - $cursor);
        $saida .= isset($meios[$r['nome']]) ? $meios[$r['nome']] : '';
        $cursor = $r['fecha'];
    }
    return $saida . substr($html, $cursor);
}

// O que fica fora de todas as regiões — o HTML escrito à mão. Cada miolo é
// trocado por um separador, para que dois ficheiros com miolos diferentes mas
// exterior igual dêem o mesmo hash.
function jsc_fora_das_regioes($html, array $regioes) {
    $separadores = [];
    foreach ($regioes as $r) $separadores[$r['nome']] = "\0";
    return jsc_montar($html, $regioes, $separadores);
}

// ---------------------------------------------------------------------
// 3. Gerar o bloco
// ---------------------------------------------------------------------
function jsc_gerar_bloco($nome, array $b, array $conteudo, $gerado, &$erro, $indent = '') {
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

    // A marca de fim fica onde estava: o miolo acaba com a indentação da
    // linha dela.
    return "\n" . rtrim($saida, "\n") . "\n" . $indent;
}

// ---------------------------------------------------------------------
// 4. Validar
// ---------------------------------------------------------------------
function jsc_validar_html(array $alvo, array $conteudo) {
    $erros  = [];
    $novo   = $alvo['bytes'];
    $orig   = $alvo['original'];
    $rel    = $alvo['relativo'];
    $blocos = $alvo['blocos'];

    // (a) Ler outra vez as marcas, agora no resultado, e comparar o que
    //     está fora de todas elas com o original, por hash. É esta a
    //     garantia de que o HTML manual não foi tocado — e cobre um
    //     ficheiro com uma região ou com várias, do mesmo modo.
    $erro = '';
    $novoRegioes = jsc_regioes($novo, $blocos, $erro);
    if (!$novoRegioes) {
        $erros[] = "$rel: o ficheiro gerado não passa na leitura das marcas ($erro)";
        return $erros;
    }
    $origRegioes = $alvo['regioes'];
    $foraOrig = jsc_fora_das_regioes($orig, $origRegioes);
    if (hash('sha256', jsc_fora_das_regioes($novo, $novoRegioes)) !== hash('sha256', $foraOrig)) {
        $erros[] = "$rel: o HTML fora das marcas mudou";
    }
    if (count($novoRegioes) !== count($origRegioes)) {
        $erros[] = "$rel: o ficheiro gerado tem " . count($novoRegioes)
                 . " regiões e o original tinha " . count($origRegioes);
        return $erros;
    }

    // Cada região é validada por si: um erro num bloco não passa por estar
    // ao lado de outro que está bem.
    foreach ($novoRegioes as $r) {
        $nome = $r['nome'];
        $meio = substr($novo, $r['meio'], $r['fecha'] - $r['meio']);

        // (b) Validação própria do bloco.
        foreach (call_user_func($r['bloco']['validar'], $meio, $conteudo) as $e) {
            $erros[] = "$rel [$nome]: $e";
        }

        // (c) Etiquetas equilibradas no bloco gerado. Apanha uma geração
        //     truncada, que o parser mais tolerante ainda aceitaria.
        foreach (['article', 'div', 'p', 'h2', 'h3', 'time', 'a', 'span', 'button'] as $tag) {
            $abre  = preg_match_all('/<' . $tag . '(\s|>)/i', $meio);
            $fecha = preg_match_all('/<\/' . $tag . '\s*>/i', $meio);
            if ($abre !== $fecha) {
                $erros[] = "$rel [$nome]: <$tag> abre $abre vez(es) e fecha $fecha no bloco gerado";
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
                $erros[] = "$rel [$nome]: HTML inválido no bloco gerado — " . trim($e->message);
            }
        }
        libxml_clear_errors();
        libxml_use_internal_errors($anterior);
    }

    // (e) O ficheiro novo tem de continuar a ter o HTML manual todo.
    $minimo = (int)(strlen($foraOrig) * 0.9);
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

    // Os blocos são agrupados por ficheiro: cada ficheiro é lido UMA vez, e
    // todos os seus blocos são aplicados sobre a mesma versão em memória.
    // Sem isto, dois blocos no mesmo ficheiro produziriam cada um a página
    // inteira com só o seu bloco novo, e o último a ser promovido apagava o
    // trabalho do primeiro.
    $porFicheiro = [];
    foreach (jsc_blocos() as $nome => $b) {
        $porFicheiro[$b['ficheiro']][$nome] = $b;
    }

    foreach ($porFicheiro as $relativo => $blocos) {
        $destino = JSC_RAIZ . '/' . $relativo;
        if (!is_file($destino)) { $erros[] = $relativo . ': não existe'; continue; }
        $orig = @file_get_contents($destino);
        if ($orig === false) { $erros[] = $relativo . ': não foi possível ler'; continue; }

        // Todas as marcas do ficheiro são localizadas e validadas antes de se
        // gerar o que quer que seja.
        $erro = '';
        $regioes = jsc_regioes($orig, $blocos, $erro);
        if (!$regioes) { $erros[] = $relativo . ': ' . $erro; continue; }

        $meios  = [];
        $falhou = false;
        foreach ($regioes as $r) {
            $meio = jsc_gerar_bloco($r['nome'], $r['bloco'], $conteudo, $gerado, $erro, $r['indent']);
            if ($meio === null) {
                $erros[] = $relativo . ' [' . $r['nome'] . ']: ' . $erro;
                $falhou = true;
                break;
            }
            $meios[$r['nome']] = $meio;
        }
        if ($falhou) continue;

        // Uma só versão final por ficheiro.
        $alvos[] = [
            'tipo' => 'html', 'relativo' => $relativo, 'destino' => $destino,
            'blocos' => $blocos, 'regioes' => $regioes, 'original' => $orig,
            'bytes' => jsc_montar($orig, $regioes, $meios),
        ];
    }

    if ($jsonNovo !== null) {
        $alvos[] = [
            'tipo' => 'json', 'relativo' => 'data/db.json',
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
