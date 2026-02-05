<?php
require_once __DIR__ . '/../config/database.php';

class UserService {
    private $db;
    private $conn;

    public function __construct() {
        $this->db = new Database();
        $this->conn = $this->db->getConnection();
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
            'roles' => $result['roles']
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

        // Generate UUID for user id
        $userId = $this->generateUUID();

        // Hash password
        $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
        
        $sql = "INSERT INTO users (id, userName, password, fullName, email, phone, address, roles, status, created_at) 
                VALUES (:id, :userName, :password, :fullName, :email, :phone, :address, :roles, '1', NOW())";
        
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':id', $userId);
        $stmt->bindParam(':userName', $userName);
        $stmt->bindParam(':password', $hashedPassword);
        $stmt->bindParam(':fullName', $fullName);
        $stmt->bindParam(':email', $email);
        $stmt->bindParam(':phone', $phone);
        $stmt->bindParam(':address', $address);
        $stmt->bindParam(':roles', $roles);
        
        if ($stmt->execute()) {
            return $userId;
        }
        
        throw new Exception("Failed to create user");
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
        // Don't allow deleting yourself or the last admin
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
        $sql = "SELECT password FROM users WHERE id = :id";
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
        
        // Update password
        $updateSql = "UPDATE users SET password = :password WHERE id = :id";
        $updateStmt = $this->conn->prepare($updateSql);
        $updateStmt->bindParam(':password', $hashedPassword);
        $updateStmt->bindParam(':id', $userId);
        
        if (!$updateStmt->execute()) {
            throw new Exception("Failed to update password");
        }
        
        return true;
    }
}
?>
