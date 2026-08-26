<?php
require_once 'vendor/autoload.php';

use Kreait\Firebase\Factory;

// Database credentials
$host = 'localhost';
$dbname = 'jeg_profiles';
$username = 'jeg_user';
$password = 'V0XiWD2AnXP1ycPhqE43kw==';

// Admin details
$adminUserName = 'lamdev';
$adminPassword = 'Admin@123'; // Temporary password
$adminFullName = 'Lâm DEV';
$adminEmail = 'nguyentranlam1211@gmail.com';
$adminPhone = '';
$adminAddress = '';
$adminRoles = '1'; // Admin

try {
    // Connect to database
    echo "Connecting to database...\n";
    $conn = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "✓ Database connected\n\n";
    
    // Check if user exists
    $checkSql = "SELECT id FROM users WHERE userName = :userName";
    $checkStmt = $conn->prepare($checkSql);
    $checkStmt->bindParam(':userName', $adminUserName);
    $checkStmt->execute();
    
    $hashedPassword = password_hash($adminPassword, PASSWORD_BCRYPT);
    
    if ($existing = $checkStmt->fetch()) {
        echo "User '$adminUserName' exists. Updating...\n";
        
        $updateSql = "UPDATE users SET 
                        password = :password,
                        fullName = :fullName,
                        email = :email,
                        phone = :phone,
                        address = :address,
                        roles = :roles,
                        status = '1',
                        requirePasswordChange = 1
                      WHERE userName = :userName";
        
        $updateStmt = $conn->prepare($updateSql);
        $updateStmt->bindParam(':password', $hashedPassword);
        $updateStmt->bindParam(':fullName', $adminFullName);
        $updateStmt->bindParam(':email', $adminEmail);
        $updateStmt->bindParam(':phone', $adminPhone);
        $updateStmt->bindParam(':address', $adminAddress);
        $updateStmt->bindParam(':roles', $adminRoles);
        $updateStmt->bindParam(':userName', $adminUserName);
        $updateStmt->execute();
        
        echo "✓ User updated in database\n";
    } else {
        echo "Creating new user '$adminUserName'...\n";
        
        $insertSql = "INSERT INTO users (userName, password, fullName, email, phone, address, roles, status, requirePasswordChange, created_at) 
                      VALUES (:userName, :password, :fullName, :email, :phone, :address, :roles, '1', 1, NOW())";
        
        $insertStmt = $conn->prepare($insertSql);
        $insertStmt->bindParam(':userName', $adminUserName);
        $insertStmt->bindParam(':password', $hashedPassword);
        $insertStmt->bindParam(':fullName', $adminFullName);
        $insertStmt->bindParam(':email', $adminEmail);
        $insertStmt->bindParam(':phone', $adminPhone);
        $insertStmt->bindParam(':address', $adminAddress);
        $insertStmt->bindParam(':roles', $adminRoles);
        $insertStmt->execute();
        
        echo "✓ User created in database\n";
    }
    
    // Firebase
    echo "\nInitializing Firebase...\n";
    $factory = (new Factory)->withServiceAccount(__DIR__ . '/serviceAccountKey.json');
    $auth = $factory->createAuth();
    echo "✓ Firebase initialized\n";
    
    // Check if Firebase user exists
    try {
        $fbUser = $auth->getUserByEmail($adminEmail);
        echo "Firebase user exists. Updating...\n";
        
        $auth->updateUser($fbUser->uid, [
            'email' => $adminEmail,
            'emailVerified' => true,
            'password' => $adminPassword,
            'displayName' => $adminFullName,
            'disabled' => false,
        ]);
        
        echo "✓ Firebase user updated\n";
        echo "  UID: " . $fbUser->uid . "\n";
        
    } catch (Exception $e) {
        echo "Creating new Firebase user...\n";
        
        $fbUser = $auth->createUser([
            'email' => $adminEmail,
            'emailVerified' => true,
            'password' => $adminPassword,
            'displayName' => $adminFullName,
            'disabled' => false,
        ]);
        
        echo "✓ Firebase user created\n";
        echo "  UID: " . $fbUser->uid . "\n";
    }
    
    echo "\n" . str_repeat("=", 50) . "\n";
    echo "ADMIN ACCOUNT READY!\n";
    echo str_repeat("=", 50) . "\n";
    echo "Username: $adminUserName\n";
    echo "Email: $adminEmail\n";
    echo "Temporary Password: $adminPassword\n";
    echo "Role: Admin\n";
    echo "\nNOTE: You will be required to change password on first login.\n";
    echo str_repeat("=", 50) . "\n";
    
} catch (Exception $e) {
    echo "\n✗ ERROR: " . $e->getMessage() . "\n";
    if (isset($e)) {
        echo "\nStack trace:\n" . $e->getTraceAsString() . "\n";
    }
    exit(1);
}
