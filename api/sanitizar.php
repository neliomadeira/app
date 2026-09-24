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

// =====================================================
// ALLOWLIST DAS NOTÍCIAS
// =====================================================
// O corpo das notícias é escrito num editor de texto formatado e vai para
// a página como HTML. A allowlist dos textos legais é curta demais para
// aqui: o editor produz <div style="text-align">, <font face size color>,
// <span style> nas legendas e <img style> com float — aplicar-lhe aquela
// lista destruiria a formatação das notícias já escritas.
//
// Esta lista foi tirada do HTML que o editor produz de facto, conduzido no
// browser: div, b, i, u, font, ul, ol, li, h2, p, br, img, span, mais o
// que vier colado de outro site (a, table).
//
// O que muda em relação aos textos legais: aceita-se mais formatação, mas
// o atributo style deixa de passar como está — cada propriedade é
// verificada, e nenhuma que permita sobrepor-se à página ou carregar algo
// de fora é aceite.

const JSC_NOTICIA_ELEMENTOS = [
    'p', 'br', 'div', 'span',
    'b', 'i', 'u', 'strong', 'em', 's', 'strike', 'sub', 'sup', 'small', 'mark',
    'ul', 'ol', 'li',
    'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'hr', 'pre', 'code',
    'a', 'img', 'font',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption',
];

const JSC_NOTICIA_ATRIBUTOS = [
    'a'    => ['href', 'title', 'target', 'rel', 'style'],
    'img'  => ['src', 'alt', 'title', 'loading', 'width', 'height', 'style'],
    'font' => ['face', 'size', 'color'],
    'td'   => ['colspan', 'rowspan', 'style'],
    'th'   => ['colspan', 'rowspan', 'style'],
    '*'    => ['style'],
];

// Propriedades CSS aceites. É uma lista do que pode entrar, não do que
// fica de fora: uma propriedade nova só passa se for acrescentada aqui.
//
// position não entra de propósito — é o que permite tapar a página com um
// ecrã falso por cima. z-index e float juntos também não chegam para isso
// sem position.
const JSC_NOTICIA_CSS = [
    'color', 'background-color', 'text-align', 'text-decoration', 'text-transform',
    'font-family', 'font-size', 'font-style', 'font-weight', 'line-height',
    'letter-spacing', 'white-space', 'vertical-align',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border', 'border-radius', 'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-color', 'border-style', 'border-width', 'border-collapse',
    'width', 'height', 'max-width', 'max-height', 'min-width',
    'float', 'clear', 'display', 'list-style', 'list-style-type',
];

// Esquemas aceites em <img src>. data: só para imagens de bitmap — o
// editor guarda as imagens carregadas assim. data:image/svg+xml fica de
// fora: um SVG pode trazer script lá dentro.
function jsc_src_imagem_segura($valor) {
    $v = trim((string)$valor);
    if ($v === '') return null;
    $limpo = preg_replace('/[\x00-\x20]+/', '', $v);
    if ($limpo === null) return null;
    if (preg_match('#^data:image/(png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/=\s]+$#i', $v)) return $v;
    if (preg_match('#^data:#i', $limpo)) return null;
    if (preg_match('#^https?://#i', $limpo)) return $v;
    if (preg_match('#^[a-z][a-z0-9.+-]*:#i', $limpo)) return null;
    return $v;   // relativo
}

function jsc_css_seguro($declaracoes) {
    $saida = [];
    foreach (explode(';', (string)$declaracoes) as $decl) {
        if (strpos($decl, ':') === false) continue;
        list($prop, $valor) = explode(':', $decl, 2);
        $prop  = strtolower(trim($prop));
        $valor = trim($valor);
        if ($prop === '' || $valor === '') continue;
        if (!in_array($prop, JSC_NOTICIA_CSS, true)) continue;
        // Nada que carregue algo de fora, execute, ou traga outro bloco.
        if (preg_match('/url\s*\(|expression\s*\(|javascript\s*:|@import|behavior\s*:|-moz-binding|\\\\|<|>|\/\*/i', $valor)) continue;
        $saida[] = $prop . ': ' . $valor;
    }
    return implode('; ', $saida);
}

function jsc_sanitizar_noticia($html) {
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
    jsc_limpar_noticia($corpo);

    $saida = '';
    foreach ($corpo->childNodes as $filho) $saida .= $doc->saveHTML($filho);
    return trim($saida);
}

function jsc_limpar_noticia(DOMNode $no) {
    for ($i = $no->childNodes->length - 1; $i >= 0; $i--) {
        $filho = $no->childNodes->item($i);

        if ($filho->nodeType === XML_COMMENT_NODE) { $no->removeChild($filho); continue; }
        if ($filho->nodeType === XML_TEXT_NODE)    { continue; }
        if ($filho->nodeType !== XML_ELEMENT_NODE) { $no->removeChild($filho); continue; }

        $nome = strtolower($filho->nodeName);
        if (in_array($nome, JSC_ELEMENTOS_FORA, true)) { $no->removeChild($filho); continue; }

        jsc_limpar_noticia($filho);

        if (!in_array($nome, JSC_NOTICIA_ELEMENTOS, true)) {
            while ($filho->firstChild) $no->insertBefore($filho->firstChild, $filho);
            $no->removeChild($filho);
            continue;
        }
        jsc_limpar_atributos_noticia($filho, $nome);
    }
}

function jsc_limpar_atributos_noticia(DOMElement $el, $nome) {
    $permitidos = array_merge(
        JSC_NOTICIA_ATRIBUTOS['*'],
        isset(JSC_NOTICIA_ATRIBUTOS[$nome]) ? JSC_NOTICIA_ATRIBUTOS[$nome] : []
    );

    for ($i = $el->attributes->length - 1; $i >= 0; $i--) {
        $attr = $el->attributes->item($i);
        if (!in_array(strtolower($attr->nodeName), $permitidos, true)) {
            $el->removeAttribute($attr->nodeName);
        }
    }

    if ($el->hasAttribute('style')) {
        $css = jsc_css_seguro($el->getAttribute('style'));
        if ($css === '') $el->removeAttribute('style');
        else             $el->setAttribute('style', $css);
    }

    if ($nome === 'img') {
        $src = $el->hasAttribute('src') ? jsc_src_imagem_segura($el->getAttribute('src')) : null;
        if ($src === null) { $el->parentNode->removeChild($el); return; }
        $el->setAttribute('src', $src);
        if (!$el->hasAttribute('loading')) $el->setAttribute('loading', 'lazy');
    }

    if ($nome === 'a') {
        if ($el->hasAttribute('href')) {
            $href = jsc_href_seguro($el->getAttribute('href'));
            if ($href === null) $el->removeAttribute('href');
            else                $el->setAttribute('href', $href);
        }
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
}
