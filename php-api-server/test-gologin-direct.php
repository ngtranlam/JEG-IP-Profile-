<?php
// Test GoLogin API trực tiếp
require_once __DIR__ . '/config/config.php';

echo "<h2>GoLogin API Direct Test</h2>";

$token = $_ENV['GOLOGIN_API_TOKEN'] ?? '';
echo "Token: " . (empty($token) ? "❌ EMPTY" : "✅ SET (" . substr($token, 0, 20) . "...)") . "<br><br>";

if (empty($token)) {
    die("❌ GoLogin API token not found in .env file");
}

// Test 1: Basic connection
echo "<h3>1. Test Basic Connection</h3>";
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://api.gologin.com/browser/v2?page=1');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $token,
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

echo "HTTP Code: $httpCode<br>";
echo "cURL Error: " . ($error ? $error : "None") . "<br>";
echo "Response: <pre>" . htmlspecialchars($response) . "</pre><br>";

// Test 2: List folders
echo "<h3>2. Test List Folders</h3>";
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://api.gologin.com/browser/folders');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $token,
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: $httpCode<br>";
echo "Response: <pre>" . htmlspecialchars($response) . "</pre><br>";

// Test 3: Test different auth header format
echo "<h3>3. Test Alternative Auth Format</h3>";
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://api.gologin.com/browser/v2?page=1');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: ' . $token,  // Without "Bearer"
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: $httpCode<br>";
echo "Response: <pre>" . htmlspecialchars($response) . "</pre><br>";
?>
