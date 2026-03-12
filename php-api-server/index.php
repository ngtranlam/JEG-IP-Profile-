<?php
require_once __DIR__ . '/config/config.php';

// Simple router
$request = $_SERVER['REQUEST_URI'];
$path = parse_url($request, PHP_URL_PATH);
$pathParts = explode('/', trim($path, '/'));

// Remove empty parts
$pathParts = array_filter($pathParts);
$pathParts = array_values($pathParts);

// API routing
if (count($pathParts) >= 1 && $pathParts[0] === 'api') {
    if (count($pathParts) >= 2) {
        $endpoint = $pathParts[1];
        
        switch ($endpoint) {
            case 'profiles':
                require_once __DIR__ . '/api/profiles.php';
                break;
                
            case 'proxies':
                require_once __DIR__ . '/api/proxies.php';
                break;
                
            case 'gologin': 
                require_once __DIR__ . '/api/gologin.php';
                break;
                
            case 'auth':
                require_once __DIR__ . '/api/auth.php'; 
                break;
                
            case 'local_data':
                require_once __DIR__ . '/api/local_data.php';
                break;

            case 'teams':
                require_once __DIR__ . '/api/teams.php';
                break;
                
            default:
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Endpoint not found']);
                break;
        }
    } else {
        // API info
        header('Content-Type: application/json');
        echo json_encode([
            'name' => 'Chrome Profile Tool API',
            'version' => '1.0.0',
            'endpoints' => [
                '/api/profiles' => 'Profile management',
                '/api/proxies' => 'Proxy management', 
                '/api/gologin' => 'GoLogin API proxy',
                '/api/auth' => 'Authentication'
            ]
        ]);
    }
} else {
    // Default response
    header('Content-Type: application/json');
    echo json_encode([
        'message' => 'Chrome Profile Tool API Server',
        'status' => 'running',
        'version' => '1.0.0'
    ]);
}
?>
