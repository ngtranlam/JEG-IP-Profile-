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

require_once __DIR__ . '/../services/TeamService.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

try {
    $teamService = new TeamService();
    $authMiddleware = new AuthMiddleware();

    $method = $_SERVER['REQUEST_METHOD'];
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $pathParts = explode('/', trim($path, '/'));

    // URL format: /api/teams/{teamId?}/{action?}/{param?}
    $teamId = isset($pathParts[2]) && is_numeric($pathParts[2]) ? (int)$pathParts[2] : null;
    $action = isset($pathParts[3]) ? $pathParts[3] : null;
    $actionParam = isset($pathParts[4]) ? $pathParts[4] : null;
    $subAction = isset($pathParts[5]) ? $pathParts[5] : null;

    // Authenticate user
    $token = $authMiddleware->getAuthToken();
    $user = $authMiddleware->authenticate($token);

    // Role-based access control
    $isAdmin = $user['roles'] === '1';
    $isLeader = $user['roles'] === '2';
    $isSeller = $user['roles'] === '3';

    switch ($method) {
        case 'GET':
            // Sellers can only view their own team (GET requests)
            // Admin and Leader have full access
            if (!$teamId) {
                // GET /api/teams - List all teams
                $teams = $teamService->getTeams($user);
                echo json_encode(['success' => true, 'data' => $teams]);

            } elseif ($action === 'members' && !$actionParam) {
                // GET /api/teams/{id}/members - Get team members
                $members = $teamService->getMembers($teamId);
                echo json_encode(['success' => true, 'data' => $members]);

            } elseif ($action === 'members' && $actionParam && $subAction === 'folders') {
                // GET /api/teams/{id}/members/{userId}/folders - Get member folders
                $folders = $teamService->getMemberFolders($teamId, (int)$actionParam);
                echo json_encode(['success' => true, 'data' => $folders]);

            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Endpoint not found']);
            }
            break;

        case 'POST':
            // Only Admin and Leader can create/modify teams
            if (!$isAdmin && !$isLeader) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Access denied. Admin or Leader role required.']);
                exit();
            }

            $input = json_decode(file_get_contents('php://input'), true);

            if (!$teamId) {
                // POST /api/teams - Create team (Admin only)
                if ($user['roles'] !== '1') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Only admin can create teams']);
                    exit();
                }

                if (empty($input['name'])) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Team name is required']);
                    exit();
                }

                $team = $teamService->createTeam(
                    $input['name'],
                    isset($input['leaderId']) ? (int)$input['leaderId'] : null
                );
                echo json_encode(['success' => true, 'data' => $team]);

            } elseif ($action === 'members') {
                // POST /api/teams/{id}/members - Add member
                if (empty($input['userId'])) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'userId is required']);
                    exit();
                }

                $teamService->addMember($teamId, (int)$input['userId'], $user);
                echo json_encode(['success' => true, 'message' => 'Member added successfully']);

            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Endpoint not found']);
            }
            break;

        case 'PUT':
            // Only Admin and Leader can modify teams
            if (!$isAdmin && !$isLeader) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Access denied. Admin or Leader role required.']);
                exit();
            }

            $input = json_decode(file_get_contents('php://input'), true);

            if ($teamId && !$action) {
                // PUT /api/teams/{id} - Update team
                $teamService->updateTeam($teamId, $input ?? [], $user);
                echo json_encode(['success' => true, 'message' => 'Team updated successfully']);

            } elseif ($teamId && $action === 'members' && $actionParam && $subAction === 'folders') {
                // PUT /api/teams/{id}/members/{userId}/folders - Set member folders
                $folderIds = isset($input['folderIds']) ? $input['folderIds'] : [];
                $teamService->setMemberFolders($teamId, (int)$actionParam, $folderIds, $user);
                echo json_encode(['success' => true, 'message' => 'Folder permissions updated']);

            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Endpoint not found']);
            }
            break;

        case 'DELETE':
            // Only Admin and Leader can delete teams/members
            if (!$isAdmin && !$isLeader) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Access denied. Admin or Leader role required.']);
                exit();
            }

            if ($teamId && $action === 'members' && $actionParam) {
                // DELETE /api/teams/{id}/members/{userId} - Remove member
                $teamService->removeMember($teamId, (int)$actionParam, $user);
                echo json_encode(['success' => true, 'message' => 'Member removed successfully']);

            } elseif ($teamId && !$action) {
                // DELETE /api/teams/{id} - Delete team (Admin only)
                if ($user['roles'] !== '1') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Only admin can delete teams']);
                    exit();
                }

                $teamService->deleteTeam($teamId);
                echo json_encode(['success' => true, 'message' => 'Team deleted successfully']);

            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Endpoint not found']);
            }
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
            break;
    }

} catch (Exception $e) {
    error_log("Teams API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
