<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../vendor/autoload.php';

use Kreait\Firebase\Factory;

class UserService {
    private $db;
    private $conn;
    private $firebaseAuth;

    public function __construct() {
        $this->db = new Database();
        $this->conn = $this->db->getConnection();
        
        // Initialize Firebase Admin SDK
        $serviceAccountPath = __DIR__ . '/../serviceAccountKey.json';
        if (file_exists($serviceAccountPath)) {
            $factory = (new Factory)->withServiceAccount($serviceAccountPath);
            $this->firebaseAuth = $factory->createAuth();
        }
    }

    public function login($userName, $password) {
        // Find user by userName (don't filter by status yet)
        $sql = "SELECT * FROM users WHERE userName = :userName";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':userName', $userName);
        $stmt->execute();
        
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            throw new Exception("Invalid username or password");
        }
        
        // Verify password (bcrypt hash from Laravel)
        if (!password_verify($password, $user['password'])) {
            throw new Exception("Invalid username or password");
        }
        
        // Check if account is locked (status = '0')
        if ($user['status'] !== '1') {
            throw new Exception("Your account has been locked. Please contact Admin for support.");
        }
        
        // Generate session token
        $token = $this->generateToken();
        $expiresAt = date('Y-m-d H:i:s', strtotime('+7 days'));
        
        // Store session in database
        $this->createSession($user['id'], $token, $expiresAt);
        
        // Return user info and token
        return [
            'user' => [
                'id' => $user['id'],
                'userName' => $user['userName'],
                'fullName' => $user['fullName'],
                'email' => $user['email'],
                'phone' => $user['phone'],
                'address' => $user['address'],
                'roles' => $user['roles']
            ],
            'token' => $token,
            'expiresAt' => $expiresAt
        ];
    }

    public function validateToken($token) {
        $sql = "SELECT s.*, u.* FROM sessions s 
                JOIN users u ON s.user_id = u.id 
                WHERE s.token = :token AND s.expires_at > NOW() AND u.status = '1'";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':token', $token);
        $stmt->execute();
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$result) {
            return null;
        }
        
        return [
            'id' => $result['id'],
            'userName' => $result['userName'],
            'fullName' => $result['fullName'],
            'email' => $result['email'],
            'phone' => $result['phone'],
            'address' => $result['address'],
            'roles' => $result['roles'],
            'requirePasswordChange' => $result['requirePasswordChange'] == 1,
            'is2FAEnabled' => isset($result['is2FAEnabled']) ? $result['is2FAEnabled'] == 1 : false
        ];
    }

    public function logout($token) {
        $sql = "DELETE FROM sessions WHERE token = :token";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':token', $token);
        return $stmt->execute();
    }

    private function createSession($userId, $token, $expiresAt) {
        $sql = "INSERT INTO sessions (user_id, token, expires_at, created_at) 
                VALUES (:user_id, :token, :expires_at, NOW())";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':user_id', $userId);
        $stmt->bindParam(':token', $token);
        $stmt->bindParam(':expires_at', $expiresAt);
        return $stmt->execute();
    }

    private function generateToken() {
        return bin2hex(random_bytes(32));
    }

    private function generateUUID() {
        // Generate UUID v4
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40); // set version to 0100
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80); // set bits 6-7 to 10
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    public function getUser($id) {
        $sql = "SELECT id, userName, fullName, email, phone, address, roles, status 
                FROM users WHERE id = :id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function listUsers() {
        $sql = "SELECT id, userName, fullName, email, phone, address, roles, status, created_at 
                FROM users ORDER BY created_at DESC";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Role-based access control methods
    public function isAdmin($user) {
        return isset($user['roles']) && $user['roles'] === '1';
    }

    public function isSeller($user) {
        return isset($user['roles']) && $user['roles'] === '3';
    }

    public function hasPermission($user, $permission) {
        if ($this->isAdmin($user)) {
            return true; // Admin has all permissions
        }

        if ($this->isSeller($user)) {
            $sellerPermissions = [
                'view_own_profiles', 
                'create_profile',
                'edit_profile',
                'delete_profile',
                'use_profile'
            ];
            return in_array($permission, $sellerPermissions);
        }

        return false; // Default: no permissions
    }

    public function getRoleName($user) {
        if ($this->isAdmin($user)) {
            return 'Admin';
        }
        if ($this->isSeller($user)) {
            return 'Seller';
        }
        return 'Unknown';
    }

    public function canAccessFolder($user, $folderId = null) {
        if ($this->isAdmin($user)) {
            return true; // Admin can access all folders
        }

        if ($this->isSeller($user)) {
            // Seller cannot access folders - only Admin can manage folders
            return false;
        }

        return false;
    }

    public function canAccessProfile($user, $profileId = null) {
        if ($this->isAdmin($user)) {
            return true; // Admin can access all profiles
        }

        if ($this->isSeller($user)) {
            // TODO: Check if profile belongs to seller's assigned folders
            // This will be implemented when we add profile-folder relationships
            return true; // For now, allow access
        }

        return false;
    }

    public function validateUserAccess($token, $requiredPermission = null) {
        $user = $this->validateToken($token);
        if (!$user) {
            throw new Exception("Invalid or expired token");
        }

        if ($requiredPermission && !$this->hasPermission($user, $requiredPermission)) {
            throw new Exception("Insufficient permissions");
        }

        return $user;
    }

    /**
     * Create new user (Admin only)
     */
    public function createUser($userName, $password, $fullName, $email, $phone, $address, $roles) {
        // Check if username already exists
        $checkSql = "SELECT id FROM users WHERE userName = :userName";
        $checkStmt = $this->conn->prepare($checkSql);
        $checkStmt->bindParam(':userName', $userName);
        $checkStmt->execute();
        
        if ($checkStmt->fetch()) {
            throw new Exception("Username already exists");
        }

        // Hash password
        $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
        
        // Step 1: Create user in database with requirePasswordChange flag
        // Let database auto-generate ID (auto-increment)
        $sql = "INSERT INTO users (userName, password, fullName, email, phone, address, roles, status, requirePasswordChange, created_at) 
                VALUES (:userName, :password, :fullName, :email, :phone, :address, :roles, '1', 1, NOW())";
        
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':userName', $userName);
        $stmt->bindParam(':password', $hashedPassword);
        $stmt->bindParam(':fullName', $fullName);
        $stmt->bindParam(':email', $email);
        $stmt->bindParam(':phone', $phone);
        $stmt->bindParam(':address', $address);
        $stmt->bindParam(':roles', $roles);
        
        if (!$stmt->execute()) {
            throw new Exception("Failed to create user in database");
        }
        
        // Get the auto-generated ID
        $userId = $this->conn->lastInsertId();
        
        // Step 2: Create user in Firebase Auth
        if ($this->firebaseAuth) {
            try {
                // Use email if provided, otherwise create fake email
                $firebaseEmail = !empty($email) ? $email : $userName . '@jeg.local';
                
                $userProperties = [
                    'email' => $firebaseEmail,
                    'emailVerified' => true, // Auto-verify email to allow 2FA enrollment
                    'password' => $password,
                    'displayName' => $fullName,
                    'disabled' => false,
                ];
                
                $createdUser = $this->firebaseAuth->createUser($userProperties);
                error_log("Created Firebase user: " . $createdUser->uid . " for userName: " . $userName);
                
            } catch (Exception $e) {
                // Log error but don't fail the whole operation
                error_log("Warning: Failed to create Firebase user for " . $userName . ": " . $e->getMessage());
                // Note: User can still login with database credentials, but won't have Firebase auth
            }
        }
        
        return $userId;
    }

    /**
     * Update user (Admin only)
     */
    public function updateUser($id, $userName, $fullName, $email, $phone, $address, $roles, $password = null) {
        // Check if username is taken by another user
        $checkSql = "SELECT id FROM users WHERE userName = :userName AND id != :id";
        $checkStmt = $this->conn->prepare($checkSql);
        $checkStmt->bindParam(':userName', $userName);
        $checkStmt->bindParam(':id', $id);
        $checkStmt->execute();
        
        if ($checkStmt->fetch()) {
            throw new Exception("Username already exists");
        }

        if ($password) {
            // Update with new password
            $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
            $sql = "UPDATE users 
                    SET userName = :userName, password = :password, fullName = :fullName, 
                        email = :email, phone = :phone, address = :address, roles = :roles
                    WHERE id = :id";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(':password', $hashedPassword);
        } else {
            // Update without changing password
            $sql = "UPDATE users 
                    SET userName = :userName, fullName = :fullName, email = :email, 
                        phone = :phone, address = :address, roles = :roles
                    WHERE id = :id";
            $stmt = $this->conn->prepare($sql);
        }
        
        $stmt->bindParam(':id', $id);
        $stmt->bindParam(':userName', $userName);
        $stmt->bindParam(':fullName', $fullName);
        $stmt->bindParam(':email', $email);
        $stmt->bindParam(':phone', $phone);
        $stmt->bindParam(':address', $address);
        $stmt->bindParam(':roles', $roles);
        
        return $stmt->execute();
    }

    /**
     * Delete user (Admin only)
     */
    public function deleteUser($id) {
        // Step 1: Get user info before deleting
        $sql = "SELECT userName, email FROM users WHERE id = :id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            throw new Exception("User not found");
        }
        
        // Step 2: Delete user from Firebase Auth
        if ($this->firebaseAuth) {
            try {
                // Find Firebase user by email
                $firebaseEmail = !empty($user['email']) ? $user['email'] : $user['userName'] . '@jeg.local';
                
                // Get Firebase user by email
                $firebaseUser = $this->firebaseAuth->getUserByEmail($firebaseEmail);
                
                // Delete from Firebase
                $this->firebaseAuth->deleteUser($firebaseUser->uid);
                error_log("Deleted Firebase user: " . $firebaseUser->uid . " for userName: " . $user['userName']);
                
            } catch (Exception $e) {
                // Log warning but continue with database deletion
                error_log("Warning: Failed to delete Firebase user for " . $user['userName'] . ": " . $e->getMessage());
            }
        }
        
        // Step 3: Delete user from database
        $sql = "DELETE FROM users WHERE id = :id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':id', $id);
        
        return $stmt->execute();
    }

    /**
     * Toggle user status (Admin only)
     */
    public function toggleUserStatus($id) {
        $sql = "UPDATE users SET status = IF(status = '1', '0', '1') WHERE id = :id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':id', $id);
        
        return $stmt->execute();
    }

    /**
     * Change password for current user
     */
    public function changePassword($userId, $oldPassword, $newPassword) {
        // Get current user
        $sql = "SELECT * FROM users WHERE id = :id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':id', $userId);
        $stmt->execute();
        
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            throw new Exception("User not found");
        }
        
        // Verify old password
        if (!password_verify($oldPassword, $user['password'])) {
            throw new Exception("Current password is incorrect");
        }
        
        // Hash new password
        $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);
        
        // Update password in database
        $updateSql = "UPDATE users SET password = :password WHERE id = :id";
        $updateStmt = $this->conn->prepare($updateSql);
        $updateStmt->bindParam(':password', $hashedPassword);
        $updateStmt->bindParam(':id', $userId);
        
        if (!$updateStmt->execute()) {
            throw new Exception("Failed to update password");
        }
        
        // Clear requirePasswordChange flag in database
        $updateFlagSql = "UPDATE users SET requirePasswordChange = 0 WHERE id = :id";
        $updateFlagStmt = $this->conn->prepare($updateFlagSql);
        $updateFlagStmt->bindParam(':id', $userId);
        $updateFlagStmt->execute();
        
        return true;
    }

    public function getUserByUserName($userName) {
        $sql = "SELECT id, userName, fullName, email, phone, address, roles, status FROM users WHERE userName = :userName";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':userName', $userName);
        $stmt->execute();
        
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        return $user ?: null;
    }

    public function loginWithFirebaseToken($firebaseToken) {
        if (!$this->firebaseAuth) {
            throw new Exception("Firebase Auth not initialized");
        }

        try {
            // Verify Firebase ID token with clock tolerance (leeway) to handle clock skew
            $verifiedIdToken = $this->firebaseAuth->verifyIdToken($firebaseToken, $checkIfRevoked = false, $leewayInSeconds = 300);
            $uid = $verifiedIdToken->claims()->get('sub');
            $email = $verifiedIdToken->claims()->get('email');
            
            if (!$email) {
                throw new Exception("Firebase token missing email");
            }
            
            // Get user from database by email
            $sql = "SELECT * FROM users WHERE email = :email";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(':email', $email);
            $stmt->execute();
            
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // If not found by email, try with fake email pattern
            if (!$user) {
                // Extract userName from fake email (e.g., lamdev@jeg.local -> lamdev)
                if (strpos($email, '@jeg.local') !== false) {
                    $userName = str_replace('@jeg.local', '', $email);
                    $sql = "SELECT * FROM users WHERE LOWER(userName) = LOWER(:userName)";
                    $stmt = $this->conn->prepare($sql);
                    $stmt->bindParam(':userName', $userName);
                    $stmt->execute();
                    $user = $stmt->fetch(PDO::FETCH_ASSOC);
                }
            }
            
            if (!$user) {
                throw new Exception("User not found in database");
            }
            
            // Check if account is locked
            if ($user['status'] !== '1') {
                throw new Exception("Your account has been locked. Please contact Admin for support.");
            }
            
            // Generate session token
            $token = $this->generateToken();
            $expiresAt = date('Y-m-d H:i:s', strtotime('+7 days'));
            
            // Store session in database
            $this->createSession($user['id'], $token, $expiresAt);
            
            // Return user info and token
            return [
                'user' => [
                    'id' => $user['id'],
                    'userName' => $user['userName'],
                    'fullName' => $user['fullName'],
                    'email' => $user['email'],
                    'phone' => $user['phone'],
                    'address' => $user['address'],
                    'roles' => $user['roles'],
                    'roleName' => $this->getRoleName($user),
                    'isAdmin' => $this->isAdmin($user),
                    'isSeller' => $this->isSeller($user),
                    'requirePasswordChange' => $user['requirePasswordChange'] == 1
                ],
                'token' => $token,
                'expiresAt' => $expiresAt
            ];
            
        } catch (\Kreait\Firebase\Exception\Auth\FailedToVerifyToken $e) {
            throw new Exception("Invalid Firebase token: " . $e->getMessage());
        }
    }

    public function forceChangePassword($firebaseToken, $newPassword) {
        if (!$this->firebaseAuth) {
            throw new Exception("Firebase Auth not initialized");
        }

        try {
            // Verify Firebase ID token with clock tolerance
            $verifiedIdToken = $this->firebaseAuth->verifyIdToken($firebaseToken, $checkIfRevoked = false, $leewayInSeconds = 300);
            $uid = $verifiedIdToken->claims()->get('sub');
            $email = $verifiedIdToken->claims()->get('email');
            
            if (!$email) {
                throw new Exception("Firebase token missing email");
            }
            
            // Get user from database by email
            $sql = "SELECT * FROM users WHERE email = :email";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(':email', $email);
            $stmt->execute();
            
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // If not found by email, try with fake email pattern
            if (!$user) {
                if (strpos($email, '@jeg.local') !== false) {
                    $userName = str_replace('@jeg.local', '', $email);
                    $sql = "SELECT * FROM users WHERE LOWER(userName) = LOWER(:userName)";
                    $stmt = $this->conn->prepare($sql);
                    $stmt->bindParam(':userName', $userName);
                    $stmt->execute();
                    $user = $stmt->fetch(PDO::FETCH_ASSOC);
                }
            }
            
            if (!$user) {
                throw new Exception("User not found in database");
            }
            
            // Note: No need to verify old password because:
            // 1. This is first login with default password
            // 2. Firebase already verified and changed the password
            // 3. We just sync the new password to database
            
            // Hash new password
            $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);
            
            // Update password in database
            $updateSql = "UPDATE users SET password = :password WHERE id = :id";
            $updateStmt = $this->conn->prepare($updateSql);
            $updateStmt->bindParam(':password', $hashedPassword);
            $updateStmt->bindParam(':id', $user['id']);
            
            if (!$updateStmt->execute()) {
                throw new Exception("Failed to update password");
            }
            
            // Clear requirePasswordChange flag in database
            $updateFlagSql = "UPDATE users SET requirePasswordChange = 0 WHERE id = :id";
            $updateFlagStmt = $this->conn->prepare($updateFlagSql);
            $updateFlagStmt->bindParam(':id', $user['id']);
            $updateFlagStmt->execute();
            
            return true;
            
        } catch (\Kreait\Firebase\Exception\Auth\FailedToVerifyToken $e) {
            throw new Exception("Invalid Firebase token: " . $e->getMessage());
        }
    }

    /**
     * Enable 2FA for user
     */
    public function enable2FA($firebaseToken) {
        try {
            $verifiedIdToken = $this->firebaseAuth->verifyIdToken($firebaseToken);
            $uid = $verifiedIdToken->claims()->get('sub');
            
            // Get user from Firebase
            $firebaseUser = $this->firebaseAuth->getUser($uid);
            $email = $firebaseUser->email;
            
            // Find user in database by email
            $sql = "SELECT id FROM users WHERE email = :email";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(':email', $email);
            $stmt->execute();
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$user) {
                throw new Exception("User not found in database");
            }
            
            // Update is2FAEnabled flag
            $updateSql = "UPDATE users SET is2FAEnabled = 1 WHERE id = :id";
            $updateStmt = $this->conn->prepare($updateSql);
            $updateStmt->bindParam(':id', $user['id']);
            
            if (!$updateStmt->execute()) {
                throw new Exception("Failed to enable 2FA");
            }
            
            return true;
            
        } catch (\Kreait\Firebase\Exception\Auth\FailedToVerifyToken $e) {
            throw new Exception("Invalid Firebase token: " . $e->getMessage());
        }
    }

    /**
     * Disable 2FA for user
     */
    public function disable2FA($firebaseToken) {
        try {
            $verifiedIdToken = $this->firebaseAuth->verifyIdToken($firebaseToken);
            $uid = $verifiedIdToken->claims()->get('sub');
            
            // Get user from Firebase
            $firebaseUser = $this->firebaseAuth->getUser($uid);
            $email = $firebaseUser->email;
            
            // Find user in database by email
            $sql = "SELECT id FROM users WHERE email = :email";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(':email', $email);
            $stmt->execute();
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$user) {
                throw new Exception("User not found in database");
            }
            
            // Update is2FAEnabled flag
            $updateSql = "UPDATE users SET is2FAEnabled = 0 WHERE id = :id";
            $updateStmt = $this->conn->prepare($updateSql);
            $updateStmt->bindParam(':id', $user['id']);
            
            if (!$updateStmt->execute()) {
                throw new Exception("Failed to disable 2FA");
            }
            
            return true;
            
        } catch (\Kreait\Firebase\Exception\Auth\FailedToVerifyToken $e) {
            throw new Exception("Invalid Firebase token: " . $e->getMessage());
        }
    }
}
?>
