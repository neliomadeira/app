<?php
// =====================================================
// SANITIZAÇÃO DE HTML — Juventude Sport Campinense
// =====================================================
// Os textos de Privacidade e Termos são escritos com formatação no
// painel e inseridos nas páginas como HTML. Sem filtro, quem tenha acesso
// ao painel pode pôr <script> no site público — e o painel é usado por
// várias pessoas com perfis diferentes.
//
// Aqui não se escapa tudo: isso transformaria o texto formatado em texto
// corrido. Deixa-se passar apenas o que serve para formatar, e nada mais.
// A filtragem acontece no servidor, antes de gravar, para não depender do
// que o browser enviou.
// =====================================================

// Elementos que podem ficar. Tudo o resto é desembrulhado: o elemento
// desaparece e o texto lá dentro fica.
const JSC_ELEMENTOS = [
    'p', 'br', 'strong', 'em', 'b', 'i',
    'ul', 'ol', 'li',
    'h2', 'h3', 'h4',
    'blockquote', 'a',
];

// Elementos removidos com o conteúdo — desembrulhar um <script> deixaria
// o código como texto, e num <style> deixaria CSS solto na página.
const JSC_ELEMENTOS_FORA = [
    'script', 'style', 'iframe', 'object', 'embed', 'applet',
    'form', 'input', 'button', 'select', 'option', 'textarea',
    'link', 'meta', 'base', 'svg', 'math', 'template', 'noscript',
];

// Atributos permitidos, por elemento. Nenhum outro passa — nem style,
// nem onclick, nem data-seja-o-que-for.
const JSC_ATRIBUTOS = [
    'a' => ['href', 'title', 'target', 'rel'],
];

// Esquemas aceites em href. javascript:, data:, vbscript: e afins ficam de
// fora; um endereço relativo ou uma âncora também servem.
function jsc_href_seguro($valor) {
    $v = trim((string)$valor);
    if ($v === '') return null;
    // Remove caracteres de controlo que servem para disfarçar o esquema,
    // por exemplo "java\tscript:".
    $limpo = preg_replace('/[\x00-\x20]+/', '', $v);
    if ($limpo === null) return null;
    if (preg_match('#^[a-z0-9.+-]*script\s*:#i', $limpo)) return null;
    if (preg_match('#^(javascript|vbscript|data|blob|file|about)\s*:#i', $limpo)) return null;
    if (preg_match('#^(https?|mailto|tel)\s*:#i', $limpo)) return $v;   // esquema aceite
    if (preg_match('#^[a-z][a-z0-9.+-]*:#i', $limpo)) return null;      // qualquer outro esquema
    return $v;                                                          // relativo ou âncora
}

function jsc_sanitizar_html($html) {
    $html = (string)$html;
    if (trim($html) === '') return '';

    $doc = new DOMDocument('1.0', 'UTF-8');
    $anterior = libxml_use_internal_errors(true);
    $doc->loadHTML(
        '<!DOCTYPE html><html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body>'
        . $html . '</body></html>',
        LIBXML_NOERROR | LIBXML_NOWARNING
    );
    libxml_clear_errors();
    libxml_use_internal_errors($anterior);

    $corpo = $doc->getElementsByTagName('body')->item(0);
    if (!$corpo) return '';

    jsc_limpar_no($corpo);

    $saida = '';
    foreach ($corpo->childNodes as $filho) {
        $saida .= $doc->saveHTML($filho);
    }
    return trim($saida);
}

function jsc_limpar_no(DOMNode $no) {
    // De trás para a frente: a lista é viva e remover altera os índices.
    for ($i = $no->childNodes->length - 1; $i >= 0; $i--) {
        $filho = $no->childNodes->item($i);

        if ($filho->nodeType === XML_COMMENT_NODE) {
            $no->removeChild($filho);
            continue;
        }
        if ($filho->nodeType === XML_TEXT_NODE) {
            continue;   // texto fica sempre; é escapado na serialização
        }
        if ($filho->nodeType !== XML_ELEMENT_NODE) {
            $no->removeChild($filho);
            continue;
        }

        $nome = strtolower($filho->nodeName);

        if (in_array($nome, JSC_ELEMENTOS_FORA, true)) {
            $no->removeChild($filho);
            continue;
        }

        // Primeiro limpa lá dentro, depois decide o que fazer com este.
        jsc_limpar_no($filho);

        if (!in_array($nome, JSC_ELEMENTOS, true)) {
            // Não é permitido, mas o texto lá dentro é: desembrulha-se.
            while ($filho->firstChild) {
                $no->insertBefore($filho->firstChild, $filho);
            }
            $no->removeChild($filho);
            continue;
        }

        jsc_limpar_atributos($filho, $nome);
    }
}

function jsc_limpar_atributos(DOMElement $el, $nome) {
    $permitidos = isset(JSC_ATRIBUTOS[$nome]) ? JSC_ATRIBUTOS[$nome] : [];

    for ($i = $el->attributes->length - 1; $i >= 0; $i--) {
        $attr = $el->attributes->item($i);
        if (!in_array(strtolower($attr->nodeName), $permitidos, true)) {
            $el->removeAttribute($attr->nodeName);
        }
    }

    if ($nome !== 'a') return;

    if ($el->hasAttribute('href')) {
        $href = jsc_href_seguro($el->getAttribute('href'));
        if ($href === null) $el->removeAttribute('href');
        else                $el->setAttribute('href', $href);
    }

    // target só pode ser _blank; e nesse caso o rel é obrigatório, senão a
    // página aberta ganha acesso à que a abriu.
    if ($el->hasAttribute('target')) {
        if (strtolower($el->getAttribute('target')) !== '_blank') {
            $el->removeAttribute('target');
            $el->removeAttribute('rel');
        } else {
            $el->setAttribute('rel', 'noopener noreferrer');
        }
    } elseif ($el->hasAttribute('rel')) {
        $el->removeAttribute('rel');
    }
}
