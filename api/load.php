<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache');
require_once __DIR__ . '/config.php';

if (file_exists(DATA_FILE)) {
    readfile(DATA_FILE);
} else {
    echo '{}';
}
