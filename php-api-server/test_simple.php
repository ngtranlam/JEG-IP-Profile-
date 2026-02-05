<?php
// Simple test - just check if PHP works and can read .env
echo "PHP is working!\n";
echo "PHP Version: " . phpversion() . "\n";
echo "Current directory: " . __DIR__ . "\n\n";

// Check .env file
if (file_exists(__DIR__ . '/.env')) {
    echo "✓ .env file exists\n";
    $envContent = file_get_contents(__DIR__ . '/.env');
    $lines = explode("\n", $envContent);
    echo "✓ .env has " . count($lines) . " lines\n";
    
    // Check for GOLOGIN_API_TOKEN
    foreach ($lines as $line) {
        if (strpos($line, 'GOLOGIN_API_TOKEN') === 0) {
            echo "✓ GOLOGIN_API_TOKEN found in .env\n";
            break;
        }
    }
} else {
    echo "❌ .env file not found\n";
}

// Check vendor directory
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    echo "✓ vendor/autoload.php exists\n";
} else {
    echo "❌ vendor/autoload.php not found - run 'composer install'\n";
}

// Try a simple cURL test to GoLogin API
echo "\nTesting direct cURL to GoLogin API...\n";
$ch = curl_init('https://api.gologin.com/browser/v2?page=1');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTZlZWM3YTNhN2I0YjZjOTVhMWJiYTQiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2OTZlZjVkZDUyZDU2NDE2MGMwYWRhNmQifQ.JUy6OGhCQNvArC-P8Q3B4FKdeltqeBxYKtodN9JSn5w'
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    echo "❌ cURL error: $error\n";
} else {
    echo "✓ HTTP Response Code: $httpCode\n";
    if ($httpCode == 200) {
        echo "✓ GoLogin API is reachable!\n";
        $data = json_decode($response, true);
        if (isset($data['profiles'])) {
            echo "✓ Got profiles data\n";
        }
    } else {
        echo "❌ HTTP error: $httpCode\n";
        echo "Response: " . substr($response, 0, 200) . "\n";
    }
}

echo "\nTest completed!\n";
