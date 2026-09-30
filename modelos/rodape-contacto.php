<?php
// =====================================================
// MODELO — CONTACTOS DO RODAPÉ
// =====================================================
// Escreve o bloco entre as marcas
//   <!-- JSC:rodape-contacto:inicio -->  e  <!-- JSC:rodape-contacto:fim -->
// do rodapé: as três linhas de dentro do .footer__contact. O <h2>Contacto</h2>
// fica fora da região, porque é rótulo e não dado.
//
// Fonte única: siteConfig.contactAddress / contactPhone / contactEmail. Estavam
// escritos no HTML de 17 páginas como valor inicial, e um campo esvaziado no
// painel deixava o valor antigo à vista, sem nada a indicar porquê.
//
// A morada leva um <br> entre a rua e o código postal — é assim que o painel a
// guarda. Vai por HTML, filtrado, e não por texto: o rodapé usava textContent e
// mostrava a etiqueta "<br />" como texto visível nas 17 páginas.
//
// Campo vazio não produz linha. Não há valor por omissão.
//
// Recebe:
//   $contactos  ['morada' => …, 'telefone' => …, 'email' => …]
//   $gerado     data/hora da publicação que gerou este bloco
// =====================================================

if (!defined('JSC_GERACAO')) {
    if (PHP_SAPI !== 'cli') http_response_code(403);
    exit;
}

if (!isset($contactos) || !is_array($contactos)) $contactos = [];
$gerado   = isset($gerado) ? (string)$gerado : '';
$morada   = isset($contactos['morada'])   ? $contactos['morada']   : '';
$telefone = isset($contactos['telefone']) ? $contactos['telefone'] : '';
$email    = isset($contactos['email'])    ? $contactos['email']    : '';

// O mesmo filtro estreito que o api/save.php aplica antes de gravar. Aqui é a
// segunda linha: um valor que tenha entrado por outro caminho não passa.
if (!function_exists('jsc_sanitizar_inline')) require_once __DIR__ . '/../api/sanitizar.php';
?>
<?php if ($morada === '' && $telefone === '' && $email === ''): ?>
        <!-- Sem contactos guardados no painel não se escreve nenhuma linha, e
             não se recupera o valor que aqui estava escrito à mão. -->
<?php else: ?>
<?php   if ($morada !== ''): ?>
        <p class="js-morada" data-gerado="<?= jsc_esc($gerado) ?>"><?= jsc_sanitizar_inline($morada) ?></p>
<?php   endif; ?>
<?php   if ($telefone !== ''): ?>
        <p class="js-telefone"><?= jsc_esc($telefone) ?></p>
<?php   endif; ?>
<?php   if ($email !== ''): ?>
        <p id="footerEmail" class="js-email"><?= jsc_esc($email) ?></p>
<?php   endif; ?>
<?php endif; ?>
