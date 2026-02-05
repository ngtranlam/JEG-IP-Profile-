<?php
// Direct test without Dotenv - manually parse .env file
echo "=== Direct GoLogin API Test ===\n\n";

// Manually read .env file
echo "1. Reading .env file...\n";
$envFile = __DIR__ . '/.env';
if (!file_exists($envFile)) {
    echo "❌ .env file not found\n";
    exit(1);
}

$envContent = file_get_contents($envFile);
$lines = explode("\n", $envContent);
$env = [];

foreach ($lines as $line) {
    $line = trim($line);
    if (empty($line) || $line[0] === '#') continue;
    
    $parts = explode('=', $line, 2);
    if (count($parts) === 2) {
        $key = trim($parts[0]);
        $value = trim($parts[1]);
        $env[$key] = $value;
        $_ENV[$key] = $value;
    }
}

echo "✓ Loaded " . count($env) . " environment variables\n";

// Check for API token
if (!isset($env['GOLOGIN_API_TOKEN'])) {
    echo "❌ GOLOGIN_API_TOKEN not found in .env\n";
    exit(1);
}

$apiToken = $env['GOLOGIN_API_TOKEN'];
echo "✓ API Token: " . substr($apiToken, 0, 20) . "...\n\n";

// Test GoLogin API directly with cURL
echo "2. Testing GoLogin API connection...\n";

// Test 1: List folders
echo "   Testing /folders endpoint...\n";
$ch = curl_init('https://api.gologin.com/folders');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $apiToken,
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    echo "   ❌ cURL Error: $curlError\n";
} else {
    echo "   HTTP Code: $httpCode\n";
    if ($httpCode == 200) {
        $data = json_decode($response, true);
        if (is_array($data)) {
            echo "   ✓ Success! Found " . count($data) . " folders\n";
            if (count($data) > 0) {
                echo "   First folder: " . json_encode($data[0]) . "\n";
            }
        } else {
            echo "   ✓ Response received but not array format\n";
            echo "   Response: " . substr($response, 0, 200) . "\n";
        }
    } else {
        echo "   ❌ HTTP Error $httpCode\n";
        echo "   Response: " . substr($response, 0, 300) . "\n";
    }
}

// Test 2: List profiles
echo "\n   Testing /browser/v2 endpoint...\n";
$ch = curl_init('https://api.gologin.com/browser/v2?page=1');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $apiToken,
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    echo "   ❌ cURL Error: $curlError\n";
} else {
    echo "   HTTP Code: $httpCode\n";
    if ($httpCode == 200) {
        $data = json_decode($response, true);
        if (isset($data['profiles'])) {
            echo "   ✓ Success! Found " . count($data['profiles']) . " profiles\n";
        } else {
            echo "   ✓ Response received\n";
            echo "   Keys: " . implode(', ', array_keys($data)) . "\n";
        }
    } else {
        echo "   ❌ HTTP Error $httpCode\n";
        echo "   Response: " . substr($response, 0, 300) . "\n";
    }
}

echo "\n=== Test Complete ===\n";
