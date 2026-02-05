<?php
// Final test with User-Agent fix
echo "=== Testing GoLogin API with User-Agent Fix ===\n\n";

$token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTZlZWM3YTNhN2I0YjZjOTVhMWJiYTQiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2OTZlZjVkZDUyZDU2NDE2MGMwYWRhNmQifQ.JUy6OGhCQNvArC-P8Q3B4FKdeltqeBxYKtodN9JSn5w';

echo "Testing /folders endpoint...\n";

$ch = curl_init('https://api.gologin.com/folders');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_2_0);
curl_setopt($ch, CURLOPT_USERAGENT, 'curl/7.61.1'); // THE FIX!
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $token,
    'Content-Type: application/json',
    'Accept: */*'
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: $httpCode\n";

if ($httpCode == 200) {
    echo "\n🎉 SUCCESS! User-Agent fix works!\n\n";
    $data = json_decode($response, true);
    if (is_array($data)) {
        echo "✓ Found " . count($data) . " folders\n";
        foreach ($data as $folder) {
            echo "  - " . $folder['name'] . " (ID: " . $folder['id'] . ")\n";
        }
    }
    echo "\n=== PROBLEM SOLVED! ===\n";
} else {
    echo "\n❌ Still failing with HTTP $httpCode\n";
    echo "Response: " . substr($response, 0, 300) . "\n";
}
