<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../services/DesignToolService.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

// Allow large POST bodies for image data
ini_set('post_max_size', '50M');
ini_set('upload_max_filesize', '50M');
ini_set('memory_limit', '512M');
ini_set('max_execution_time', '600');

try {
    $designToolService = new DesignToolService();
    $authMiddleware = new AuthMiddleware();
    
    $method = $_SERVER['REQUEST_METHOD'];
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $pathParts = explode('/', trim($path, '/'));
    
    // URL format: /api/design_tool/{action}
    $action = null;
    if (count($pathParts) >= 3 && $pathParts[2] !== '') {
        $action = $pathParts[2];
    }
    
    // Authenticate user for all design tool requests
    $token = $authMiddleware->getAuthToken();
    $user = $authMiddleware->authenticate($token);
    
    // Read JSON body
    $rawBody = file_get_contents('php://input');
    $body = json_decode($rawBody, true);
    
    switch ($method) {
        case 'GET':
            if ($action === 'config') {
                // Return current configuration
                $config = $designToolService->getConfig();
                echo json_encode(['success' => true, 'data' => $config]);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Unknown GET action: ' . $action]);
            }
            break;
            
        case 'POST':
            if ($action === 'gemini') {
                // Proxy to Gemini API (via Vertex AI)
                $imageBase64 = $body['imageBase64'] ?? null;
                $designType = $body['designType'] ?? 'print';
                $customPrompt = $body['customPrompt'] ?? null;
                $aiModel = $body['aiModel'] ?? null;
                
                if (!$imageBase64) {
                    throw new Exception('imageBase64 is required');
                }
                
                // Set AI model if provided (e.g. gemini-2.5-flash-image or gemini-3-pro-image-preview)
                if ($aiModel) {
                    $designToolService->setVertexModel($aiModel);
                }
                
                $result = $designToolService->callGeminiApi($imageBase64, $designType, $customPrompt);
                echo json_encode($result);
                
            } elseif ($action === 'photoroom') {
                // Proxy to PhotoRoom API
                $imageBase64 = $body['imageBase64'] ?? null;
                
                if (!$imageBase64) {
                    throw new Exception('imageBase64 is required');
                }
                
                $result = $designToolService->callPhotoroomApi($imageBase64);
                echo json_encode($result);
                
            } elseif ($action === 'upscale_start') {
                // Start Upscayl task
                $imageBase64 = $body['imageBase64'] ?? null;
                $scale = $body['scale'] ?? 4;
                $model = $body['model'] ?? 'upscayl-standard';
                $enhanceFace = !empty($body['enhanceFace']);
                
                if (!$imageBase64) {
                    throw new Exception('imageBase64 is required');
                }
                
                $result = $designToolService->startUpscaylTask($imageBase64, $scale, $model, $enhanceFace);
                echo json_encode($result);
                
            } elseif ($action === 'upscale_status') {
                // Check Upscayl task status
                $taskId = $body['taskId'] ?? null;
                
                if (!$taskId) {
                    throw new Exception('taskId is required');
                }
                
                $result = $designToolService->getUpscaylStatus($taskId);
                echo json_encode($result);
                
            } elseif ($action === 'upscale_download') {
                // Download Upscayl result
                $downloadUrl = $body['downloadUrl'] ?? null;
                
                if (!$downloadUrl) {
                    throw new Exception('downloadUrl is required');
                }
                
                $result = $designToolService->downloadUpscaylResult($downloadUrl);
                echo json_encode($result);
                
            } elseif ($action === 'video_generate_script') {
                // Generate video script from image using Gemini
                $imageBase64 = $body['imageBase64'] ?? null;
                $duration = $body['duration'] ?? '10';
                $animation = $body['animation'] ?? 'zoom';

                if (!$imageBase64) {
                    throw new Exception('imageBase64 is required');
                }

                $result = $designToolService->generateVideoScript($imageBase64, $duration, $animation);
                echo json_encode($result);

            } elseif ($action === 'video_start') {
                // Start Kling video generation task (single or dual image)
                $imageBase64 = $body['imageBase64'] ?? null;
                $secondImageBase64 = $body['secondImageBase64'] ?? null;
                $prompt = $body['prompt'] ?? '';
                $aiModel = $body['aiModel'] ?? 'kling-v2-1-std';
                $duration = $body['duration'] ?? '10';
                $dualMode = !empty($body['dualMode']);

                if (!$imageBase64) {
                    throw new Exception('imageBase64 is required');
                }

                if ($dualMode) {
                    if (!$secondImageBase64) {
                        throw new Exception('secondImageBase64 is required for dual mode');
                    }
                    $result = $designToolService->createDualImageVideoTask($imageBase64, $secondImageBase64, $prompt, $aiModel, $duration);
                } else {
                    $result = $designToolService->createVideoTask($imageBase64, $prompt, $aiModel, $duration);
                }
                echo json_encode($result);

            } elseif ($action === 'video_status') {
                // Check video generation task status
                $taskId = $body['taskId'] ?? null;
                $isMotionControl = !empty($body['isMotionControl']);

                if (!$taskId) {
                    throw new Exception('taskId is required');
                }

                $result = $designToolService->queryVideoTaskStatus($taskId, $isMotionControl);
                echo json_encode($result);

            } elseif ($action === 'video_download') {
                // Download generated video
                $videoUrl = $body['videoUrl'] ?? null;

                if (!$videoUrl) {
                    throw new Exception('videoUrl is required');
                }

                $result = $designToolService->downloadVideoResult($videoUrl);
                echo json_encode($result);

            } elseif ($action === 'motion_start') {
                // Start motion control video generation task
                $referenceImageBase64 = $body['referenceImageBase64'] ?? null;
                $videoUrl = $body['videoUrl'] ?? null;
                $prompt = $body['prompt'] ?? '';
                $mode = $body['mode'] ?? 'std';
                $keepOriginalSound = $body['keepOriginalSound'] ?? 'no';

                if (!$referenceImageBase64) {
                    throw new Exception('referenceImageBase64 is required');
                }
                if (!$videoUrl) {
                    throw new Exception('videoUrl is required');
                }

                $result = $designToolService->createMotionControlTask($referenceImageBase64, $videoUrl, $prompt, $mode, $keepOriginalSound);
                echo json_encode($result);

            } elseif ($action === 'mockup_generate') {
                // Generate mockup image via Gemini
                $imageBase64 = $body['imageBase64'] ?? null;
                
                if (!$imageBase64) {
                    throw new Exception('imageBase64 is required');
                }
                
                $result = $designToolService->generateMockup($body);
                echo json_encode($result);
                
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Unknown POST action: ' . $action]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
            break;
    }
    
} catch (Exception $e) {
    error_log("Design Tool API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
