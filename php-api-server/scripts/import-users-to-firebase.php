<?php
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/database.php';

use Kreait\Firebase\Factory;

// Load environment variables
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        
        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);
        
        if (!array_key_exists($name, $_ENV)) {
            $_ENV[$name] = $value;
            putenv("$name=$value");
        }
    }
}

echo "=== Firebase User Import Script ===\n\n";

// Initialize Firebase Admin SDK
$serviceAccountPath = __DIR__ . '/../serviceAccountKey.json';

if (!file_exists($serviceAccountPath)) {
    die("Error: Service account key file not found at: $serviceAccountPath\n");
}

echo "Initializing Firebase Admin SDK...\n";
$factory = (new Factory)->withServiceAccount($serviceAccountPath);
$auth = $factory->createAuth();

echo "Firebase initialized successfully.\n\n";

// Connect to database
echo "Connecting to database...\n";
$db = new Database();
$conn = $db->getConnection();

if (!$conn) {
    die("Error: Could not connect to database.\n");
}

echo "Database connected successfully.\n\n";

// Fetch all users from database
echo "Fetching users from database...\n";
$sql = "SELECT id, userName, fullName, email, phone, address, roles, status FROM users ORDER BY id";
$stmt = $conn->prepare($sql);
$stmt->execute();
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Found " . count($users) . " users in database.\n\n";

// Statistics
$stats = [
    'total' => count($users),
    'created' => 0,
    'exists' => 0,
    'failed' => 0,
    'skipped' => 0
];

echo "Starting import process...\n";
echo str_repeat("-", 80) . "\n\n";

foreach ($users as $user) {
    $userName = $user['userName'];
    $email = $user['email'];
    
    // Generate email if not exists (Firebase requires email)
    if (empty($email)) {
        $email = strtolower($userName) . '@jeg.local';
    }
    
    // Generate default password: userName + "jeg@123"
    $defaultPassword = $userName . 'jeg@123';
    
    echo "[" . ($stats['created'] + $stats['exists'] + $stats['failed'] + $stats['skipped'] + 1) . "/" . $stats['total'] . "] ";
    echo "Processing: $userName ($email)... ";
    
    try {
        // Check if user already exists in Firebase
        try {
            $existingUser = $auth->getUserByEmail($email);
            echo "✓ Already exists (UID: {$existingUser->uid})\n";
            $stats['exists']++;
            continue;
        } catch (\Kreait\Firebase\Exception\Auth\UserNotFound $e) {
            // User doesn't exist, proceed to create
        }
        
        // Create user in Firebase
        $userProperties = [
            'email' => $email,
            'emailVerified' => false,
            'password' => $defaultPassword,
            'displayName' => $user['fullName'],
            'disabled' => $user['status'] !== '1', // Disable if status is not active
        ];
        
        // Add phone number if exists
        if (!empty($user['phone'])) {
            // Firebase requires phone number in E.164 format (+[country code][number])
            // For Vietnamese numbers, add +84 prefix if not already present
            $phone = $user['phone'];
            if (strpos($phone, '+') !== 0) {
                // Remove leading 0 if exists and add +84
                $phone = '+84' . ltrim($phone, '0');
            }
            
            // Validate phone format (basic check)
            if (preg_match('/^\+\d{10,15}$/', $phone)) {
                $userProperties['phoneNumber'] = $phone;
            }
        }
        
        $createdUser = $auth->createUser($userProperties);
        
        echo "✓ Created (UID: {$createdUser->uid}, Email: $email, Password: $defaultPassword)\n";
        $stats['created']++;
        
    } catch (\Kreait\Firebase\Exception\Auth\EmailExists $e) {
        echo "⚠ Email already exists\n";
        $stats['exists']++;
    } catch (\Kreait\Firebase\Exception\Auth\InvalidPhoneNumber $e) {
        echo "⚠ Invalid phone number, creating without phone... ";
        
        // Retry without phone number
        try {
            $userPropertiesNoPhone = [
                'email' => $email,
                'emailVerified' => false,
                'password' => $defaultPassword,
                'displayName' => $user['fullName'],
                'disabled' => $user['status'] !== '1'
            ];
            
            $createdUser = $auth->createUser($userPropertiesNoPhone);
            
            echo "✓ Created without phone (UID: {$createdUser->uid}, Email: $email)\n";
            $stats['created']++;
        } catch (Exception $e2) {
            echo "✗ Failed: " . $e2->getMessage() . "\n";
            $stats['failed']++;
        }
    } catch (Exception $e) {
        echo "✗ Failed: " . $e->getMessage() . "\n";
        $stats['failed']++;
    }
}

echo "\n" . str_repeat("-", 80) . "\n";
echo "\n=== Import Summary ===\n";
echo "Total users:     " . $stats['total'] . "\n";
echo "Created:         " . $stats['created'] . " ✓\n";
echo "Already exists:  " . $stats['exists'] . " ⚠\n";
echo "Failed:          " . $stats['failed'] . " ✗\n";
echo "Skipped:         " . $stats['skipped'] . "\n";
echo "\n";

if ($stats['created'] > 0) {
    echo "✓ Successfully imported {$stats['created']} users to Firebase Auth.\n";
    echo "\nDefault password format: [userName]jeg@123\n";
    echo "Example: For user 'Lamdev', password is 'Lamdevjeg@123'\n";
    echo "\nUsers will be required to change their password on first login.\n";
}

if ($stats['failed'] > 0) {
    echo "\n⚠ Warning: {$stats['failed']} users failed to import. Please check the errors above.\n";
}

echo "\n=== Import Complete ===\n";
