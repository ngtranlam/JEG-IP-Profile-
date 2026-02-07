<?php
/**
 * Script to verify email for all Firebase users
 * This allows users to enable 2FA
 */

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/config.php';

use Kreait\Firebase\Factory;

try {
    // Initialize Firebase
    $factory = (new Factory)->withServiceAccount(__DIR__ . '/../config/firebase-service-account.json');
    $auth = $factory->createAuth();
    
    echo "Fetching all users...\n";
    $users = $auth->listUsers();
    
    $count = 0;
    foreach ($users as $user) {
        if (!$user->emailVerified) {
            echo "Verifying email for: {$user->email}\n";
            
            try {
                $auth->updateUser($user->uid, [
                    'emailVerified' => true
                ]);
                $count++;
                echo "  ✓ Verified\n";
            } catch (Exception $e) {
                echo "  ✗ Failed: {$e->getMessage()}\n";
            }
        } else {
            echo "Already verified: {$user->email}\n";
        }
    }
    
    echo "\n✓ Done! Verified {$count} users.\n";
    
} catch (Exception $e) {
    echo "Error: {$e->getMessage()}\n";
    exit(1);
}
