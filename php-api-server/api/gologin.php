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

require_once __DIR__ . '/../config/gologin.php';
require_once __DIR__ . '/../config/config.php';

try {
    $gologinAPI = new GoLoginAPI();
    $method = $_SERVER['REQUEST_METHOD'];
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $pathParts = explode('/', trim($path, '/'));
    
    // Extract profile ID and action if present
    // URL format: /api/gologin/{action|profileId}/{action}
    $profileId = null;
    $action = null;
    
    if (count($pathParts) >= 3 && $pathParts[2] !== '') {
        // Check if pathParts[2] is a special action (folders, tags, proxy-locations)
        if (in_array($pathParts[2], ['folders', 'tags', 'proxy-locations', 'test-connection'])) {
            $action = $pathParts[2];
        } else {
            // It's a profile ID
            $profileId = $pathParts[2];
            if (count($pathParts) >= 4) {
                $action = $pathParts[3];
            }
        }
    }
    
    switch ($method) {
        case 'GET':
            if ($action === 'cookies') {
                // Get profile cookies
                if (!$profileId) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Profile ID is required']);
                    exit();
                }
                try {
                    $cookies = $gologinAPI->getProfileCookies($profileId);
                    echo json_encode(['success' => true, 'data' => $cookies]);
                } catch (Exception $e) {
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
                }
            } elseif ($action === 'folders') {
                // List folders
                try {
                    $folders = $gologinAPI->listFolders();
                    echo json_encode(['success' => true, 'data' => $folders]);
                } catch (Exception $e) {
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
                }
            } elseif ($action === 'tags') {
                // List tags
                try {
                    $tags = $gologinAPI->getTags();
                    echo json_encode(['success' => true, 'data' => $tags]);
                } catch (Exception $e) {
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
                }
            } elseif ($action === 'proxy-locations') {
                // Get proxy locations
                try {
                    $locations = $gologinAPI->getProxyLocations();
                    echo json_encode(['success' => true, 'data' => $locations]);
                } catch (Exception $e) {
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
                }
            } elseif ($profileId) {
                // Get single profile
                try {
                    $profile = $gologinAPI->getProfile($profileId);
                    echo json_encode(['success' => true, 'data' => $profile]);
                } catch (Exception $e) {
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
                }
            } else {
                // List profiles with optional parameters
                $page = $_GET['page'] ?? 1;
                $search = $_GET['search'] ?? null;
                $folder = $_GET['folder'] ?? null;
                
                try {
                    $profiles = $gologinAPI->listProfiles($page, $search, $folder);
                    echo json_encode(['success' => true, 'data' => $profiles]);
                } catch (Exception $e) {
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
                }
            }
            break;
            
        case 'POST':
            if ($profileId && $action) {
                // Handle profile actions
                switch ($action) {
                    case 'launch':
                        $input = json_decode(file_get_contents('php://input'), true);
                        $options = $input ?? [];
                        $result = $gologinAPI->launchProfile($profileId, $options);
                        echo json_encode(['success' => true, 'data' => $result]);
                        break;
                        
                    case 'stop':
                        $result = $gologinAPI->stopProfile($profileId);
                        echo json_encode(['success' => true, 'data' => $result]);
                        break;
                        
                    case 'set-proxy':
                        $input = json_decode(file_get_contents('php://input'), true);
                        if (!$input) {
                            http_response_code(400);
                            echo json_encode(['error' => 'Invalid JSON input']);
                            exit();
                        }
                        $result = $gologinAPI->setProfileProxy($profileId, $input);
                        echo json_encode(['success' => true, 'data' => $result]);
                        break;
                        
                    case 'remove-proxy':
                        $result = $gologinAPI->removeProfileProxy($profileId);
                        echo json_encode(['success' => true, 'data' => $result]);
                        break;
                        
                    case 'cookies':
                        $input = json_decode(file_get_contents('php://input'), true);
                        
                        // Check if this is a remove cookies request
                        $cleanCookies = isset($_GET['cleanCookies']) && $_GET['cleanCookies'] === 'true';
                        
                        if ($cleanCookies) {
                            // Remove cookies - body must be empty array
                            $result = $gologinAPI->removeProfileCookies($profileId);
                            echo json_encode(['success' => true, 'message' => 'Cookies removed successfully']);
                        } else {
                            // Import cookies
                            if (!$input || !is_array($input)) {
                                http_response_code(400);
                                echo json_encode(['error' => 'Cookies array is required']);
                                exit();
                            }
                            $result = $gologinAPI->importProfileCookies($profileId, $input);
                            echo json_encode(['success' => true, 'data' => $result]);
                        }
                        break;
                        
                    default:
                        http_response_code(400);
                        echo json_encode(['error' => 'Invalid action']);
                        break;
                }
            } elseif ($action === 'quick') {
                // Create quick profile
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!$input || empty($input['os']) || empty($input['name'])) {
                    http_response_code(400);
                    echo json_encode(['error' => 'OS and name are required for quick profile']);
                    exit();
                }
                
                $profile = $gologinAPI->createQuickProfile(
                    $input['os'], 
                    $input['name'], 
                    $input['osSpec'] ?? null
                );
                http_response_code(201);
                echo json_encode(['success' => true, 'data' => $profile]);
            } elseif ($action === 'folders') {
                // Create folder
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!$input || empty($input['name'])) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Folder name is required']);
                    exit();
                }
                
                try {
                    $folder = $gologinAPI->createFolder($input['name']);
                    http_response_code(201);
                    echo json_encode(['success' => true, 'data' => $folder]);
                } catch (Exception $e) {
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
                }
            } elseif ($action === 'test-connection') {
                // Test GoLogin API connection
                $result = $gologinAPI->testConnection();
                echo json_encode(['success' => true, 'data' => $result]);
            } else {
                // Create custom profile
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!$input) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Invalid JSON input']);
                    exit();
                }
                
                $profile = $gologinAPI->createProfile($input);
                http_response_code(201);
                echo json_encode(['success' => true, 'data' => $profile]);
            }
            break;
            
        case 'PUT':
            if (!$profileId) {
                http_response_code(400);
                echo json_encode(['error' => 'Profile ID is required']);
                exit();
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$input) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid JSON input']);
                exit();
            }
            
            $profile = $gologinAPI->updateProfile($profileId, $input);
            echo json_encode(['success' => true, 'data' => $profile]);
            break;
            
        case 'DELETE':
            if (!$profileId) {
                http_response_code(400);
                echo json_encode(['error' => 'Profile ID is required']);
                exit();
            }
            
            $gologinAPI->deleteProfile($profileId);
            echo json_encode(['success' => true, 'message' => 'Profile deleted successfully']);
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
