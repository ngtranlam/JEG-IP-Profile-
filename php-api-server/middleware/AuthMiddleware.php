<?php
require_once __DIR__ . '/../services/UserService.php';

class AuthMiddleware {
    private $userService;

    public function __construct() {
        $this->userService = new UserService();
    }

    public function authenticate($token) {
        if (!$token) {
            throw new Exception("Authentication token required");
        }

        $user = $this->userService->validateToken($token);
        if (!$user) {
            throw new Exception("Invalid or expired token");
        }

        return $user;
    }

    public function requirePermission($token, $permission) {
        $user = $this->authenticate($token);
        
        if (!$this->userService->hasPermission($user, $permission)) {
            throw new Exception("Insufficient permissions: " . $permission);
        }

        return $user;
    }

    public function requireAdmin($token) {
        $user = $this->authenticate($token);
        
        if (!$this->userService->isAdmin($user)) {
            throw new Exception("Admin access required");
        }

        return $user;
    }

    public function requireSeller($token) {
        $user = $this->authenticate($token);
        
        if (!$this->userService->isSeller($user)) {
            throw new Exception("Seller access required");
        }

        return $user;
    }

    public function requireAdminOrSeller($token) {
        $user = $this->authenticate($token);
        
        if (!$this->userService->isAdmin($user) && !$this->userService->isSeller($user)) {
            throw new Exception("Admin or Seller access required");
        }

        return $user;
    }

    public function getAuthToken() {
        // Check Authorization header
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            $authHeader = $headers['Authorization'];
            if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
                return $matches[1];
            }
        }

        // Check POST data
        if (isset($_POST['token'])) {
            return $_POST['token'];
        }

        // Check GET parameter
        if (isset($_GET['token'])) {
            return $_GET['token'];
        }

        return null;
    }

    public function handleRequest($requiredPermission = null, $requireAdmin = false, $requireSeller = false) {
        try {
            $token = $this->getAuthToken();
            
            if ($requireAdmin) {
                return $this->requireAdmin($token);
            }
            
            if ($requireSeller) {
                return $this->requireSeller($token);
            }
            
            if ($requiredPermission) {
                return $this->requirePermission($token, $requiredPermission);
            }
            
            return $this->authenticate($token);
            
        } catch (Exception $e) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'error' => $e->getMessage()
            ]);
            exit;
        }
    }
}
?>
