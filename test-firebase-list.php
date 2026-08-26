<?php
require_once 'vendor/autoload.php';

use Kreait\Firebase\Factory;

try {
    $serviceAccountPath = __DIR__ . '/serviceAccountKey.json';
    
    echo "Loading Firebase SDK...\n";
    $factory = (new Factory)->withServiceAccount($serviceAccountPath);
    $auth = $factory->createAuth();
    
    echo "Firebase Auth initialized successfully!\n\n";
    
    // Try to list users
    echo "Listing first 10 users:\n";
    echo "======================\n";
    
    $users = $auth->listUsers($maxResults = 10);
    
    $count = 0;
    foreach ($users as $user) {
        $count++;
        echo "$count. UID: " . $user->uid . "\n";
        echo "   Email: " . ($user->email ?? 'N/A') . "\n";
        echo "   Display Name: " . ($user->displayName ?? 'N/A') . "\n";
        echo "   Disabled: " . ($user->disabled ? 'Yes' : 'No') . "\n";
        echo "\n";
    }
    
    echo "Total users listed: $count\n";
    
    if ($count === 0) {
        echo "\nNo users found in Firebase!\n";
    }
    
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}
