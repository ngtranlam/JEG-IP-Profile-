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

require_once __DIR__ . '/../services/ProxyService.php';
require_once __DIR__ . '/../config/config.php';

try {
    $proxyService = new ProxyService();
    $method = $_SERVER['REQUEST_METHOD'];
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $pathParts = explode('/', trim($path, '/'));
    
    // Extract proxy ID and action if present
    // URL format: /api/proxies/{action|proxyId}/{action}
    $proxyId = null;
    $action = null;
    
    if (count($pathParts) >= 3 && $pathParts[2] !== '') {
        // Check if pathParts[2] is a special action (test-config, validate, rotate-ip)
        if (in_array($pathParts[2], ['test-config', 'validate', 'rotate-ip'])) {
            $action = $pathParts[2];
        } else {
            // It's a proxy ID
            $proxyId = $pathParts[2];
            if (count($pathParts) >= 4) {
                $action = $pathParts[3];
            }
        }
    }
    
    switch ($method) {
        case 'GET':
            if ($proxyId) {
                // Get single proxy
                $proxy = $proxyService->getProxy($proxyId);
                if (!$proxy) {
                    http_response_code(404);
                    echo json_encode(['error' => 'Proxy not found']);
                    exit();
                }
                echo json_encode(['success' => true, 'data' => $proxy]);
            } else {
                // List all proxies
                $proxies = $proxyService->listProxies();
                echo json_encode(['success' => true, 'data' => $proxies]);
            }
            break;
            
        case 'POST':
            if ($action === 'test-config') {
                // Test proxy config (no proxy ID needed)
                $input = json_decode(file_get_contents('php://input'), true);
                if (!$input) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Invalid JSON input']);
                    exit();
                }
                $result = $proxyService->testProxyConfig($input);
                echo json_encode(['success' => true, 'data' => $result]);
            } elseif ($proxyId && $action) {
                // Handle proxy actions that need proxy ID
                switch ($action) {
                    case 'validate':
                        $result = $proxyService->validateProxy($proxyId);
                        echo json_encode(['success' => true, 'data' => $result]);
                        break;
                        
                    case 'rotate-ip':
                        $result = $proxyService->rotateIP($proxyId);
                        echo json_encode(['success' => true, 'data' => $result]);
                        break;
                        
                    default:
                        http_response_code(400);
                        echo json_encode(['error' => 'Invalid action']);
                        break;
                }
            } else {
                // Create new proxy
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!$input) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Invalid JSON input']);
                    exit();
                }
                
                $requiredFields = ['name', 'type', 'host', 'port'];
                foreach ($requiredFields as $field) {
                    if (empty($input[$field])) {
                        http_response_code(400);
                        echo json_encode(['error' => "$field is required"]);
                        exit();
                    }
                }
                
                $proxy = $proxyService->createProxy($input);
                http_response_code(201);
                echo json_encode(['success' => true, 'data' => $proxy]);
            }
            break;
            
        case 'PUT':
            if (!$proxyId) {
                http_response_code(400);
                echo json_encode(['error' => 'Proxy ID is required']);
                exit();
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$input) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid JSON input']);
                exit();
            }
            
            $proxy = $proxyService->updateProxy($proxyId, $input);
            echo json_encode(['success' => true, 'data' => $proxy]);
            break;
            
        case 'DELETE':
            if (!$proxyId) {
                http_response_code(400);
                echo json_encode(['error' => 'Proxy ID is required']);
                exit();
            }
            
            $proxyService->deleteProxy($proxyId);
            echo json_encode(['success' => true, 'message' => 'Proxy deleted successfully']);
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
