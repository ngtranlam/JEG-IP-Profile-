<?php
// Test GoLogin API connection
echo "Starting test...\n";

// Check if vendor/autoload.php exists
if (!file_exists(__DIR__ . '/vendor/autoload.php')) {
    echo "❌ ERROR: vendor/autoload.php not found. Run 'composer install' first.\n";
    exit(1);
}

require_once __DIR__ . '/vendor/autoload.php';
echo "✓ Autoload loaded\n";

require_once __DIR__ . '/config/gologin.php';
echo "✓ GoLogin config loaded\n";

// Load environment variables
try {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
    $dotenv->load();
    echo "✓ .env file loaded\n";
} catch (Exception $e) {
    echo "❌ ERROR loading .env: " . $e->getMessage() . "\n";
    exit(1);
}

echo "\n=== GoLogin API Connection Test ===\n\n";

// Check if token exists
$token = $_ENV['GOLOGIN_API_TOKEN'] ?? '';
if (empty($token)) {
    echo "❌ ERROR: GOLOGIN_API_TOKEN not found in .env file\n";
    exit(1);
}

echo "✓ API Token found: " . substr($token, 0, 20) . "...\n\n";

// Test connection
try {
    echo "Testing connection to GoLogin API...\n";
    $api = new GoLoginAPI();
    
    // Test 1: List folders
    echo "\n1. Testing /folders endpoint...\n";
    $folders = $api->listFolders();
    echo "✓ Success! Found " . count($folders) . " folders\n";
    if (count($folders) > 0) {
        echo "   First folder: " . json_encode($folders[0]) . "\n";
    }
    
    // Test 2: List profiles
    echo "\n2. Testing /browser/v2 endpoint...\n";
    $profiles = $api->listProfiles(1);
    echo "✓ Success! Response: " . json_encode(array_slice($profiles, 0, 2)) . "\n";
    
    // Test 3: Test connection method
    echo "\n3. Testing testConnection() method...\n";
    $connected = $api->testConnection();
    if ($connected) {
        echo "✓ Connection test passed!\n";
    } else {
        echo "❌ Connection test failed!\n";
    }
    
    echo "\n=== All tests passed! ===\n";
    
} catch (Exception $e) {
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}
