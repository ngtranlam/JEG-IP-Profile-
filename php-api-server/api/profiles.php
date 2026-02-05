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

require_once __DIR__ . '/../services/ProfileService.php';
require_once __DIR__ . '/../config/config.php';

try {
    $profileService = new ProfileService();
    $method = $_SERVER['REQUEST_METHOD'];
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $pathParts = explode('/', trim($path, '/'));
    
    // Extract profile ID if present
    $profileId = null;
    if (count($pathParts) >= 3 && $pathParts[2] !== '') {
        $profileId = $pathParts[2];
    }
    
    switch ($method) {
        case 'GET':
            if ($profileId) {
                // Get single profile
                $profile = $profileService->getProfile($profileId);
                if (!$profile) {
                    http_response_code(404);
                    echo json_encode(['error' => 'Profile not found']);
                    exit();
                }
                echo json_encode(['success' => true, 'data' => $profile]);
            } else {
                // List all profiles
                $profiles = $profileService->listProfiles();
                echo json_encode(['success' => true, 'data' => $profiles]);
            }
            break;
            
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$input) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid JSON input']);
                exit();
            }
            
            if (empty($input['name'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Profile name is required']);
                exit();
            }
            
            $profile = $profileService->createProfile($input);
            http_response_code(201);
            echo json_encode(['success' => true, 'data' => $profile]);
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
            
            $profile = $profileService->updateProfile($profileId, $input);
            echo json_encode(['success' => true, 'data' => $profile]);
            break;
            
        case 'DELETE':
            if (!$profileId) {
                http_response_code(400);
                echo json_encode(['error' => 'Profile ID is required']);
                exit();
            }
            
            $profileService->deleteProfile($profileId);
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
