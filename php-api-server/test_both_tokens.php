<?php
// Test both tokens to see which one works

echo "=== Testing Both GoLogin API Tokens ===\n\n";

$tokens = [
    'OLD_TOKEN (from .env)' => 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTZlZWM3YTNhN2I0YjZjOTVhMWJiYTQiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2OTZlZjVkZDUyZDU2NDE2MGMwYWRhNmQifQ.JUy6OGhCQNvArC-P8Q3B4FKdeltqeBxYKtodN9JSn5w',
    'NEW_TOKEN (just created)' => 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTZlZWM3YTNhN2I0YjZjOTVhMWJiYTQiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2OTg0MTZmMTBjMjk1YzkxZDk4OTVkY2UifQ.ddJn0OTqHf_NWZH7_Yu6xsHHvWkRfGnlnLfSjDyCeHY'
];

foreach ($tokens as $name => $token) {
    echo "Testing: $name\n";
    echo "Token: " . substr($token, 0, 30) . "...\n";
    
    // Test /folders endpoint
    $ch = curl_init('https://api.gologin.com/folders');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    echo "  /folders → HTTP $httpCode\n";
    
    if ($httpCode == 200) {
        echo "  ✓ SUCCESS!\n";
        $data = json_decode($response, true);
        echo "  Found " . count($data) . " folders\n";
    } elseif ($httpCode == 401) {
        echo "  ❌ UNAUTHORIZED - Token expired or invalid\n";
    } elseif ($httpCode == 500) {
        echo "  ❌ SERVER ERROR\n";
        echo "  Response: $response\n";
    } else {
        echo "  ❌ Error\n";
        echo "  Response: " . substr($response, 0, 200) . "\n";
    }
    
    echo "\n";
}

echo "=== Additional Diagnostics ===\n\n";

// Check if the issue is with specific endpoints
echo "Testing different endpoints with OLD token:\n";
$oldToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTZlZWM3YTNhN2I0YjZjOTVhMWJiYTQiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2OTZlZjVkZDUyZDU2NDE2MGMwYWRhNmQifQ.JUy6OGhCQNvArC-P8Q3B4FKdeltqeBxYKtodN9JSn5w';

$endpoints = [
    '/browser/v2?page=1',
    '/folders',
    '/workspaces',
];

foreach ($endpoints as $endpoint) {
    $ch = curl_init('https://api.gologin.com' . $endpoint);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $oldToken,
        'Content-Type: application/json'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    echo "  $endpoint → HTTP $httpCode";
    if ($httpCode == 200) {
        echo " ✓\n";
    } else {
        echo " ❌ (" . substr($response, 0, 50) . ")\n";
    }
}

echo "\n=== Test Complete ===\n";
