<?php
require_once 'vendor/autoload.php';

use Kreait\Firebase\Factory;

try {
    $serviceAccountPath = __DIR__ . '/serviceAccountKey.json';
    
    if (!file_exists($serviceAccountPath)) {
        die("Service account key not found!\n");
    }
    
    echo "Loading Firebase SDK...\n";
    $factory = (new Factory)->withServiceAccount($serviceAccountPath);
    $auth = $factory->createAuth();
    
    echo "Firebase Auth initialized successfully!\n";
    
    // Try to create a test user
    $testEmail = 'firebasetest' . time() . '@jeg.local';
    $testPassword = 'Test@123456';
    
    echo "Creating test user: $testEmail\n";
    
    $userProperties = [
        'email' => $testEmail,
        'emailVerified' => true,
        'password' => $testPassword,
        'displayName' => 'Firebase Test User',
        'disabled' => false,
    ];
    
    $createdUser = $auth->createUser($userProperties);
    echo "✓ User created successfully!\n";
    echo "  UID: " . $createdUser->uid . "\n";
    echo "  Email: " . $createdUser->email . "\n";
    
    // Clean up - delete the test user
    echo "\nCleaning up test user...\n";
    $auth->deleteUser($createdUser->uid);
    echo "✓ Test user deleted\n";
    
    echo "\n=== Firebase connection is working! ===\n";
    
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}
