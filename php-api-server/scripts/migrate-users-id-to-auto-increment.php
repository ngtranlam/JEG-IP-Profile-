<?php
/**
 * Migration script to fix users table ID column
 * Changes from VARCHAR(36) to INT AUTO_INCREMENT
 */

require_once __DIR__ . '/../config/config.php';

try {
    $conn = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "Connected to database successfully\n\n";
    
    // Step 1: Check current structure
    echo "Step 1: Checking current table structure...\n";
    $stmt = $conn->query("DESCRIBE users");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($columns as $col) {
        if ($col['Field'] === 'id') {
            echo "Current ID column: Type={$col['Type']}, Key={$col['Key']}, Extra={$col['Extra']}\n";
        }
    }
    echo "\n";
    
    // Step 2: Check for UUID format IDs
    echo "Step 2: Checking for UUID format IDs...\n";
    $stmt = $conn->query("SELECT id FROM users WHERE id LIKE '%-%'");
    $uuidUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (count($uuidUsers) > 0) {
        echo "Found " . count($uuidUsers) . " users with UUID IDs:\n";
        foreach ($uuidUsers as $user) {
            echo "  - {$user['id']}\n";
        }
        echo "These users will be deleted. Make sure to recreate them after migration.\n";
        
        // Delete UUID users
        $conn->exec("DELETE FROM users WHERE id LIKE '%-%'");
        echo "Deleted UUID users.\n\n";
    } else {
        echo "No UUID users found.\n\n";
    }
    
    // Step 3: Get max ID
    echo "Step 3: Getting max ID...\n";
    $stmt = $conn->query("SELECT MAX(CAST(id AS UNSIGNED)) as max_id FROM users");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $maxId = $result['max_id'] ?? 0;
    echo "Max ID: $maxId\n\n";
    
    // Step 4: Alter table structure
    echo "Step 4: Altering table structure to INT AUTO_INCREMENT...\n";
    $conn->exec("ALTER TABLE users MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT");
    echo "Table structure altered successfully.\n\n";
    
    // Step 5: Set AUTO_INCREMENT value
    $nextId = $maxId + 1;
    echo "Step 5: Setting AUTO_INCREMENT to $nextId...\n";
    $conn->exec("ALTER TABLE users AUTO_INCREMENT = $nextId");
    echo "AUTO_INCREMENT set successfully.\n\n";
    
    // Step 6: Verify changes
    echo "Step 6: Verifying changes...\n";
    $stmt = $conn->query("DESCRIBE users");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($columns as $col) {
        if ($col['Field'] === 'id') {
            echo "New ID column: Type={$col['Type']}, Key={$col['Key']}, Extra={$col['Extra']}\n";
        }
    }
    echo "\n";
    
    echo "Step 7: Showing current users...\n";
    $stmt = $conn->query("SELECT id, userName, fullName FROM users ORDER BY id DESC LIMIT 5");
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($users as $user) {
        echo "  ID: {$user['id']}, Username: {$user['userName']}, Name: {$user['fullName']}\n";
    }
    echo "\n";
    
    echo "✅ Migration completed successfully!\n";
    echo "Next AUTO_INCREMENT ID will be: $nextId\n";
    
} catch (PDOException $e) {
    echo "❌ Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
?>
