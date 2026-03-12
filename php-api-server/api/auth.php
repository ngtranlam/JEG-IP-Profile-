<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../services/UserService.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../config/config.php';

try {
    $userService = new UserService();
    $method = $_SERVER['REQUEST_METHOD'];
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $pathParts = explode('/', trim($path, '/'));
    
    // Extract action from path
    // URL format: /api/auth/{action}
    $action = null;
    if (count($pathParts) >= 3 && $pathParts[2] !== '') {
        $action = $pathParts[2];
    }
    
    switch ($method) {
        case 'POST':
            if ($action === 'login') {
                // Login
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!$input || empty($input['userName']) || empty($input['password'])) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Username and password are required']);
                    exit();
                }
                
                $result = $userService->login($input['userName'], $input['password']);
                echo json_encode(['success' => true, 'data' => $result]);
                
            } elseif ($action === 'logout') {
                // Logout
                $headers = getallheaders();
                $token = null;
                
                if (isset($headers['Authorization'])) {
                    $token = str_replace('Bearer ', '', $headers['Authorization']);
                }
                
                if (!$token) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Token is required']);
                    exit();
                }
                
                $userService->logout($token);
                echo json_encode(['success' => true, 'message' => 'Logged out successfully']);
                
            } elseif ($action === 'validate') {
                // Validate token
                $headers = getallheaders();
                $token = null;
                
                if (isset($headers['Authorization'])) {
                    $token = str_replace('Bearer ', '', $headers['Authorization']);
                }
                
                if (!$token) {
                    http_response_code(401);
                    echo json_encode(['error' => 'Token is required']);
                    exit();
                }
                
                $user = $userService->validateToken($token);
                
                if (!$user) {
                    http_response_code(401);
                    echo json_encode(['error' => 'Invalid or expired token']);
                    exit();
                }
                
                // Add role information to user data
                $user['roleName'] = $userService->getRoleName($user);
                $user['isAdmin'] = $userService->isAdmin($user);
                $user['isLeader'] = $userService->isLeader($user);
                $user['isSeller'] = $userService->isSeller($user);
                
                echo json_encode(['success' => true, 'data' => $user]);
                
            } elseif ($action === 'permissions') { 
                // Get user permissions
                $authMiddleware = new AuthMiddleware();
                $user = $authMiddleware->handleRequest();
                
                $permissions = [
                    'isAdmin' => $userService->isAdmin($user),
                    'isLeader' => $userService->isLeader($user),
                    'isSeller' => $userService->isSeller($user),
                    'roleName' => $userService->getRoleName($user),
                    'canViewAllFolders' => $userService->isAdmin($user),
                    'canViewAllProfiles' => $userService->isAdmin($user),
                    'canManageUsers' => $userService->isAdmin($user),
                    'canCreateProfile' => $userService->hasPermission($user, 'create_profile'),
                    'canEditProfile' => $userService->hasPermission($user, 'edit_profile'),
                    'canDeleteProfile' => $userService->hasPermission($user, 'delete_profile'),
                    'canUseProfile' => $userService->hasPermission($user, 'use_profile')
                ];
                
                echo json_encode(['success' => true, 'data' => $permissions]);
                
            } elseif ($action === 'change_password') {
                // Change password
                $authMiddleware = new AuthMiddleware();
                $user = $authMiddleware->handleRequest();
                
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!$input || empty($input['oldPassword']) || empty($input['newPassword'])) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Old password and new password are required']);
                    exit();
                }
                
                $userService->changePassword($user['id'], $input['oldPassword'], $input['newPassword']);
                echo json_encode(['success' => true, 'message' => 'Password changed successfully']);
                
            } elseif ($action === 'firebase-login') {
                // Login with Firebase ID token
                $headers = getallheaders();
                $firebaseToken = null;
                
                if (isset($headers['Authorization'])) {
                    $firebaseToken = str_replace('Bearer ', '', $headers['Authorization']);
                }
                
                if (!$firebaseToken) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Firebase token is required']);
                    exit();
                }
                
                $result = $userService->loginWithFirebaseToken($firebaseToken);
                echo json_encode(['success' => true, 'data' => $result]);
                
            } elseif ($action === 'force-change-password') {
                // Force change password (first login with default password)
                $headers = getallheaders();
                $firebaseToken = null;
                
                if (isset($headers['Authorization'])) {
                    $firebaseToken = str_replace('Bearer ', '', $headers['Authorization']);
                }
                
                if (!$firebaseToken) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Firebase token is required']);
                    exit();
                }
                
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!$input || empty($input['newPassword'])) {
                    http_response_code(400);
                    echo json_encode(['error' => 'New password is required']);
                    exit();
                }
                
                $userService->forceChangePassword($firebaseToken, $input['newPassword']);
                echo json_encode(['success' => true, 'message' => 'Password changed successfully']);
                
            } elseif ($action === 'enable-2fa') {
                // Enable 2FA
                $headers = getallheaders();
                $firebaseToken = null;
                
                if (isset($headers['Authorization'])) {
                    $authHeader = $headers['Authorization'];
                    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
                        $firebaseToken = $matches[1];
                    }
                }
                
                if (!$firebaseToken) {
                    http_response_code(401);
                    echo json_encode(['error' => 'Unauthorized']);
                    exit();
                }
                
                $userService->enable2FA($firebaseToken);
                echo json_encode(['success' => true, 'message' => '2FA enabled successfully']);
                
            } elseif ($action === 'disable-2fa') {
                // Disable 2FA
                $headers = getallheaders();
                $firebaseToken = null;
                
                if (isset($headers['Authorization'])) {
                    $authHeader = $headers['Authorization'];
                    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
                        $firebaseToken = $matches[1];
                    }
                }
                
                if (!$firebaseToken) {
                    http_response_code(401);
                    echo json_encode(['error' => 'Unauthorized']);
                    exit();
                }
                
                $userService->disable2FA($firebaseToken);
                echo json_encode(['success' => true, 'message' => '2FA disabled successfully']);
                
            } else {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid action']);
            }
            break;
            
        case 'GET':
            // Get user by userName
            if (count($pathParts) >= 4 && $pathParts[2] === 'user') {
                $userName = $pathParts[3];
                $user = $userService->getUserByUserName($userName);
                
                if (!$user) {
                    http_response_code(404);
                    echo json_encode(['error' => 'User not found']);
                    exit();
                }
                
                echo json_encode(['success' => true, 'data' => $user]);
            } else {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid request']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            break;
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
