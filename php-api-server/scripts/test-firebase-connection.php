<?php
require_once __DIR__ . '/../vendor/autoload.php';

use Kreait\Firebase\Factory;

echo "=== Firebase Connection Test ===\n\n";

// Initialize Firebase Admin SDK
$serviceAccountPath = __DIR__ . '/../serviceAccountKey.json';

if (!file_exists($serviceAccountPath)) {
    die("Error: Service account key file not found at: $serviceAccountPath\n");
}

echo "Service account key found: ✓\n";
echo "Initializing Firebase Admin SDK...\n";

try {
    $factory = (new Factory)->withServiceAccount($serviceAccountPath);
    $auth = $factory->createAuth();
    
    echo "Firebase initialized successfully: ✓\n\n";
    
    // Test: Create a test user
    echo "Testing Firebase Auth operations...\n";
    
    $testEmail = 'test-' . time() . '@jeg.local';
    $testPassword = 'TestPassword123!';
    
    echo "Creating test user ($testEmail)... ";
    
    $userProperties = [
        'email' => $testEmail,
        'password' => $testPassword,
        'displayName' => 'Test User',
        'emailVerified' => false
    ];
    
    $createdUser = $auth->createUser($userProperties);
    echo "✓ (UID: {$createdUser->uid})\n";
    
    // Set custom claims
    echo "Setting custom claims... ";
    $auth->setCustomUserClaims($createdUser->uid, [
        'dbUserId' => '999',
        'userName' => 'testuser',
        'roles' => '3',
        'requirePasswordChange' => true
    ]);
    echo "✓\n";
    
    // Retrieve user
    echo "Retrieving user... ";
    $retrievedUser = $auth->getUser($createdUser->uid);
    echo "✓\n";
    
    // Delete test user
    echo "Cleaning up (deleting test user)... ";
    $auth->deleteUser($createdUser->uid);
    echo "✓\n";
    
    echo "\n=== All tests passed! ===\n";
    echo "Firebase Admin SDK is working correctly.\n";
    echo "You can now run the import script on your production server.\n";
    
} catch (Exception $e) {
    echo "\n✗ Error: " . $e->getMessage() . "\n";
    echo "\nStack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}
