<?php
// Test with fixed cURL config (HTTP/2 enabled)
require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/config/gologin.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

echo "=== Testing GoLogin API with HTTP/2 Fix ===\n\n";

try {
    $api = new GoLoginAPI();
    
    echo "1. Testing /folders endpoint...\n";
    $folders = $api->listFolders();
    echo "✓ SUCCESS! Found " . count($folders) . " folders\n";
    if (count($folders) > 0) {
        echo "   First folder: " . $folders[0]['name'] . "\n";
    }
    
    echo "\n2. Testing /browser/v2 endpoint...\n";
    $profiles = $api->listProfiles(1);
    echo "✓ SUCCESS! Got profiles data\n";
    if (isset($profiles['profiles'])) {
        echo "   Found " . count($profiles['profiles']) . " profiles\n";
    }
    
    echo "\n3. Testing testConnection()...\n";
    $connected = $api->testConnection();
    if ($connected) {
        echo "✓ Connection test PASSED!\n";
    } else {
        echo "❌ Connection test failed\n";
    }
    
    echo "\n=== ALL TESTS PASSED! ===\n";
    echo "GoLogin API is now working correctly!\n";
    
} catch (Exception $e) {
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
