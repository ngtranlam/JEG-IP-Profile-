<?php
$host = 'localhost';
$db = 'jeg_profiles';
$user = 'jeg_user';
$pass = 'V0XiWD2AnXP1ycPhqE43kw==';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $stmt = $pdo->query("SELECT id, userName, fullName, email, created_at FROM users ORDER BY id DESC LIMIT 5");
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Recent users:\n";
    echo "=============\n";
    foreach ($users as $user) {
        echo "ID: " . $user['id'] . "\n";
        echo "Username: " . $user['userName'] . "\n";
        echo "Full Name: " . $user['fullName'] . "\n";
        echo "Email: " . ($user['email'] ?: 'N/A') . "\n";
        echo "Created: " . $user['created_at'] . "\n";
        echo "---\n";
    }
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
