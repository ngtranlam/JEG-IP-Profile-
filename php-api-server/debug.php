<?php
// Debug script to check environment variables and database connection
echo "<h2>Environment Variables Debug</h2>";

// Load .env manually
if (file_exists(__DIR__ . '/.env')) {
    echo "✅ .env file exists<br>";
    $lines = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0 || empty(trim($line))) {
            continue;
        }
        if (strpos($line, '=') !== false) {
            list($name, $value) = explode('=', $line, 2);
            $_ENV[trim($name)] = trim($value);
            echo "Loaded: " . trim($name) . " = " . (trim($name) === 'DB_PASSWORD' ? '***' : trim($value)) . "<br>";
        }
    }
} else {
    echo "❌ .env file not found<br>";
}

echo "<h2>Database Connection Test</h2>";

$host = $_ENV['DB_HOST'] ?? 'localhost';
$dbname = $_ENV['DB_NAME'] ?? '';
$username = $_ENV['DB_USERNAME'] ?? '';
$password = $_ENV['DB_PASSWORD'] ?? '';

echo "Host: $host<br>";
echo "Database: $dbname<br>";
echo "Username: $username<br>";
echo "Password: " . (empty($password) ? 'EMPTY' : 'SET') . "<br><br>";

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "✅ Database connection successful!<br>";
    
    // Test query
    $stmt = $pdo->query("SELECT 1 as test");
    $result = $stmt->fetch();
    echo "✅ Database query test: " . $result['test'] . "<br>";
    
} catch(PDOException $e) {
    echo "❌ Database connection failed: " . $e->getMessage() . "<br>";
}

echo "<h2>PHP Extensions</h2>";
echo "PDO: " . (extension_loaded('pdo') ? '✅ Loaded' : '❌ Not loaded') . "<br>";
echo "PDO MySQL: " . (extension_loaded('pdo_mysql') ? '✅ Loaded' : '❌ Not loaded') . "<br>";
?>
