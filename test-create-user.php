<?php
require_once 'vendor/autoload.php';

// Load .env
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

require_once 'config/database.php';
require_once 'services/UserService.php';

$database = new Database();
$db = $database->getConnection();
$userService = new UserService($db);

try {
    $userId = $userService->createUser('testuser123', 'Test@123', 'Test User', 'testuser@test.com', '', '', '3');
    echo 'User created successfully with ID: ' . $userId . PHP_EOL;
} catch (Exception $e) {
    echo 'Error: ' . $e->getMessage() . PHP_EOL;
}
