<?php
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/gologin.php';

header('Content-Type: application/json');

try {
    $gologinAPI = new GoLoginAPI();
    $folders = $gologinAPI->listFolders();
    
    echo json_encode([
        'success' => true,
        'data' => $folders,
        'type' => gettype($folders)
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}
?>
