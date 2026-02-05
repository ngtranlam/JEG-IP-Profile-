<?php
// Simple test for HTTP/2 fix - no dependencies
echo "=== Testing HTTP/2 Fix for GoLogin API ===\n\n";

$token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTZlZWM3YTNhN2I0YjZjOTVhMWJiYTQiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2OTZlZjVkZDUyZDU2NDE2MGMwYWRhNmQifQ.JUy6OGhCQNvArC-P8Q3B4FKdeltqeBxYKtodN9JSn5w';

echo "Testing /folders endpoint with HTTP/2...\n";

$ch = curl_init('https://api.gologin.com/folders');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);

// Enable HTTP/2 (THIS IS THE FIX!)
curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_2_0);

curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $token,
    'Content-Type: application/json',
    'Accept: */*'
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$httpVersion = curl_getinfo($ch, CURLINFO_HTTP_VERSION);
curl_close($ch);

echo "HTTP Code: $httpCode\n";
echo "HTTP Version: ";
switch($httpVersion) {
    case CURL_HTTP_VERSION_1_0:
        echo "HTTP/1.0\n";
        break;
    case CURL_HTTP_VERSION_1_1:
        echo "HTTP/1.1\n";
        break;
    case CURL_HTTP_VERSION_2_0:
    case CURL_HTTP_VERSION_2:
        echo "HTTP/2\n";
        break;
    default:
        echo "Unknown ($httpVersion)\n";
}

if ($httpCode == 200) {
    echo "\n✓ SUCCESS! HTTP/2 fix works!\n";
    $data = json_decode($response, true);
    if (is_array($data)) {
        echo "✓ Found " . count($data) . " folders\n";
        if (count($data) > 0) {
            echo "✓ First folder: " . $data[0]['name'] . "\n";
        }
    }
    echo "\n=== FIX CONFIRMED! ===\n";
} else {
    echo "\n❌ Still failing with HTTP $httpCode\n";
    echo "Response: " . substr($response, 0, 200) . "\n";
}
