<?php
require_once 'vendor/autoload.php';
require_once 'config/database.php';

use Kreait\Firebase\Factory;

// Database connection
$database = new Database();
$conn = $database->getConnection();

// Admin details
$userName = 'lamdev';
$password = 'Admin@123'; // Temporary password - will be forced to change on first login
$fullName = 'Lâm DEV';
$email = 'nguyentranlam1211@gmail.com';
$phone = '';
$address = '';
$roles = '1'; // Admin role

try {
    // Check if username exists
    $checkSql = "SELECT id FROM users WHERE userName = :userName";
    $checkStmt = $conn->prepare($checkSql);
    $checkStmt->bindParam(':userName', $userName);
    $checkStmt->execute();
    
    if ($checkStmt->fetch()) {
        echo "✗ Username '$userName' already exists!\n";
        echo "Updating existing user...\n";
        
        // Update existing user
        $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
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
        $updateStmt->bindParam(':fullName', $fullName);
        $updateStmt->bindParam(':email', $email);
        $updateStmt->bindParam(':phone', $phone);
        $updateStmt->bindParam(':address', $address);
        $updateStmt->bindParam(':roles', $roles);
        $updateStmt->bindParam(':userName', $userName);
        
        if ($updateStmt->execute()) {
            echo "✓ User updated in database\n";
        } else {
            throw new Exception("Failed to update user in database");
        }
    } else {
        // Create new user
        $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
        
        $sql = "INSERT INTO users (userName, password, fullName, email, phone, address, roles, status, requirePasswordChange, created_at) 
                VALUES (:userName, :password, :fullName, :email, :phone, :address, :roles, '1', 1, NOW())";
        
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':userName', $userName);
        $stmt->bindParam(':password', $hashedPassword);
        $stmt->bindParam(':fullName', $fullName);
        $stmt->bindParam(':email', $email);
        $stmt->bindParam(':phone', $phone);
        $stmt->bindParam(':address', $address);
        $stmt->bindParam(':roles', $roles);
        
        if ($stmt->execute()) {
            echo "✓ User created in database\n";
        } else {
            throw new Exception("Failed to create user in database");
        }
    }
    
    // Initialize Firebase
    $serviceAccountPath = __DIR__ . '/serviceAccountKey.json';
    if (!file_exists($serviceAccountPath)) {
        throw new Exception("Service account key not found!");
    }
    
    echo "\nInitializing Firebase...\n";
    $factory = (new Factory)->withServiceAccount($serviceAccountPath);
    $auth = $factory->createAuth();
    
    // Check if Firebase user exists
    try {
        $existingUser = $auth->getUserByEmail($email);
        echo "✓ Firebase user already exists: " . $existingUser->uid . "\n";
        echo "  Updating Firebase user...\n";
        
        // Update Firebase user
        $auth->updateUser($existingUser->uid, [
            'email' => $email,
            'emailVerified' => true,
            'password' => $password,
            'displayName' => $fullName,
            'disabled' => false,
        ]);
        
        echo "✓ Firebase user updated successfully\n";
        
    } catch (Exception $e) {
        // User doesn't exist, create new
        echo "Creating new Firebase user...\n";
        
        $userProperties = [
            'email' => $email,
            'emailVerified' => true,
            'password' => $password,
            'displayName' => $fullName,
            'disabled' => false,
        ];
        
        $createdUser = $auth->createUser($userProperties);
        echo "✓ Firebase user created successfully\n";
        echo "  UID: " . $createdUser->uid . "\n";
    }
    
    echo "\n=== Admin account ready! ===\n";
    echo "Username: $userName\n";
    echo "Email: $email\n";
    echo "Temporary Password: $password\n";
    echo "Role: Admin\n";
    echo "\nNOTE: You will be required to change password on first login.\n";
    
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}
