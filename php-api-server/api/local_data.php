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

require_once __DIR__ . '/../services/GoLoginDataService.php';
require_once __DIR__ . '/../services/GoLoginSyncService.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../services/UserService.php';

try {
    $dataService = new GoLoginDataService();
    $syncService = new GoLoginSyncService();
    $authMiddleware = new AuthMiddleware();
    $userService = new UserService();
    
    $method = $_SERVER['REQUEST_METHOD'];
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $pathParts = explode('/', trim($path, '/'));
    
    // Extract action from path
    // URL format: /api/local_data/{action}
    $action = null;
    if (count($pathParts) >= 3 && $pathParts[2] !== '') {
        $action = $pathParts[2];
    }
    
    // Authenticate user
    $token = $authMiddleware->getAuthToken();
    $user = $authMiddleware->authenticate($token);
    
    switch ($method) {
        case 'GET':
            if ($action === 'folders') {
                // Get folders from database
                $folders = $dataService->getFolders($user['id'], $user['roles']);
                echo json_encode(['success' => true, 'data' => $folders]);
                
            } elseif ($action === 'profiles') {
                // Get all profiles with pagination
                $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
                $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
                $search = isset($_GET['search']) ? $_GET['search'] : null;
                $folderId = isset($_GET['folder']) ? $_GET['folder'] : null;
                
                // Debug logging
                error_log("GET profiles - page: $page, limit: $limit, search: " . ($search ?: 'null') . ", folder: " . ($folderId ?: 'null'));
                error_log("User ID: {$user['id']}, Role: {$user['roles']}");
                
                $result = $dataService->getProfiles($page, $limit, $search, $folderId, $user['id'], $user['roles']);
                
                error_log("Profiles returned: " . count($result['profiles']) . " out of {$result['total']} total");
                
                echo json_encode(['success' => true, 'data' => $result]);
                
            } elseif ($action === 'profile' && isset($pathParts[3])) {
                // Get single profile by ID
                $profileId = $pathParts[3];
                
                // Check permission for non-admin users
                if ($user['roles'] !== '1') {
                    if (!$dataService->hasProfilePermission($user['id'], $profileId, 'view')) {
                        http_response_code(403);
                        echo json_encode(['success' => false, 'error' => 'Access denied']);
                        exit();
                    }
                }
                
                $profile = $dataService->getProfileById($profileId);
                if ($profile) {
                    echo json_encode(['success' => true, 'data' => $profile]);
                } else {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'Profile not found']);
                }
                
            } elseif ($action === 'folder' && isset($pathParts[3])) {
                // Get single folder by ID
                $folderId = $pathParts[3];
                
                // Check permission for non-admin users
                if ($user['roles'] !== '1') {
                    if (!$dataService->hasFolderPermission($user['id'], $folderId, 'view')) {
                        http_response_code(403);
                        echo json_encode(['success' => false, 'error' => 'Access denied']);
                        exit();
                    }
                }
                
                $folder = $dataService->getFolderById($folderId);
                if ($folder) {
                    echo json_encode(['success' => true, 'data' => $folder]);
                } else {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'Folder not found']);
                }
                
            } elseif ($action === 'stats') {
                // Get dashboard statistics
                $stats = $dataService->getDashboardStats($user['id'], $user['roles']);
                echo json_encode(['success' => true, 'data' => $stats]);
                
            } elseif ($action === 'sync_status') {
                // Get last sync status
                $status = $syncService->getLastSyncStatus();
                echo json_encode(['success' => true, 'data' => $status]);
                
            } elseif ($action === 'test_connection') {
                // Test database connection
                echo json_encode(['success' => true, 'message' => 'Database connection OK']);
                
            } elseif ($action === 'sellers') {
                // Get all sellers (Admin only)
                if ($user['roles'] !== '1') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Only Admin can access sellers list']);
                    exit();
                }
                
                $sellers = $dataService->getAllSellers();
                echo json_encode(['success' => true, 'data' => $sellers]);
                
            } elseif ($action === 'users') {
                // Get all users (Admin only)
                if ($user['roles'] !== '1') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Only Admin can access users list']);
                    exit();
                }
                
                $users = $userService->listUsers();
                echo json_encode(['success' => true, 'data' => $users]);
                
            } elseif ($action === 'user') {
                // Get single user (Admin only)
                if ($user['roles'] !== '1') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Only Admin can access user details']);
                    exit();
                }
                
                $userId = $_GET['id'] ?? null;
                if (!$userId) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'User ID required']);
                    exit();
                }
                
                $userData = $userService->getUser($userId);
                echo json_encode(['success' => true, 'data' => $userData]);
                
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Endpoint not found']);
            }
            break;
            
        case 'POST':
            // Parse input JSON once for all POST actions
            $input = json_decode(file_get_contents('php://input'), true);
            
            if ($action === 'sync') {
                // Trigger manual sync - Allow all authenticated users
                // Sellers need this to sync their assigned folders/profiles
                $syncType = $input['type'] ?? 'full'; // full, folders, profiles
                
                if ($syncType === 'folders') {
                    $count = $syncService->syncFolders();
                    echo json_encode(['success' => true, 'message' => "Synced {$count} folders"]);
                } elseif ($syncType === 'profiles') {
                    $count = $syncService->syncProfiles();
                    echo json_encode(['success' => true, 'message' => "Synced {$count} profiles"]);
                } else {
                    $result = $syncService->syncAll();
                    echo json_encode(['success' => true, 'data' => $result]);
                }
                
            } elseif ($action === 'grant_permission') {
                // Grant permission to user - Admin only
                if ($user['roles'] !== '1') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Admin access required']);
                    exit();
                }
                
                $input = json_decode(file_get_contents('php://input'), true);
                $targetUserId = $input['user_id'] ?? null;
                $folderId = $input['folder_id'] ?? null;
                $profileId = $input['profile_id'] ?? null;
                $permissionType = $input['permission_type'] ?? 'view';
                
                if (!$targetUserId) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'user_id is required']);
                    exit();
                }
                
                $dataService->grantPermission($targetUserId, $folderId, $profileId, $permissionType);
                echo json_encode(['success' => true, 'message' => 'Permission granted']);
                
            } elseif ($action === 'revoke_permission') {
                // Revoke permission from user - Admin only
                if ($user['roles'] !== '1') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Admin access required']);
                    exit();
                }
                
                $input = json_decode(file_get_contents('php://input'), true);
                $targetUserId = $input['user_id'] ?? null;
                $folderId = $input['folder_id'] ?? null;
                $profileId = $input['profile_id'] ?? null;
                
                if (!$targetUserId) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'user_id is required']);
                    exit();
                }
                
                $dataService->revokePermission($targetUserId, $folderId, $profileId);
                echo json_encode(['success' => true, 'message' => 'Permission revoked']);
                
            } elseif ($action === 'create_profile') {
                // Create profile with bi-directional sync
                $profileData = $input['profileData'] ?? null;
                $folderName = $input['folderName'] ?? null;
                
                if (!$profileData) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Profile data required']);
                    exit();
                }
                
                // Pass folder name to add profile to folder after creation
                $result = $dataService->createProfileWithSync($profileData, $folderName);
                echo json_encode(['success' => true, 'data' => $result]);
                
            } elseif ($action === 'update_profile') {
                // Update profile with bi-directional sync
                $profileId = $input['profileId'] ?? null;
                $profileData = $input['profileData'] ?? null;
                
                if (!$profileId || !$profileData) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Profile ID and data required']);
                    exit();
                }
                
                $result = $dataService->updateProfileWithSync($profileId, $profileData);
                echo json_encode(['success' => true, 'data' => $result]);
                
            } elseif ($action === 'delete_profile') {
                // Delete profile with bi-directional sync
                $profileId = $input['profileId'] ?? null;
                
                if (!$profileId) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Profile ID required']);
                    exit();
                }
                
                $dataService->deleteProfileWithSync($profileId);
                echo json_encode(['success' => true, 'message' => 'Profile deleted']);
                
            } elseif ($action === 'create_folder') {
                // Create folder with bi-directional sync and seller assignment
                error_log("CREATE_FOLDER action matched!");
                
                if ($user['roles'] !== '1') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Only Admin can create folders']);
                    exit();
                }
                
                $name = $input['name'] ?? null;
                $sellerId = $input['sellerId'] ?? null;
                
                error_log("Folder name: " . $name . ", Seller ID: " . $sellerId);
                
                if (!$name) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Folder name required']);
                    exit();
                }
                
                $result = $dataService->createFolderWithSellerSync($name, $sellerId);
                echo json_encode(['success' => true, 'data' => $result]);
                
            } elseif ($action === 'set_proxy') {
                // Set proxy with bi-directional sync
                $profileId = $input['profileId'] ?? null;
                $proxyData = $input['proxyData'] ?? null;
                
                if (!$profileId || !$proxyData) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Profile ID and proxy data required']);
                    exit();
                }
                
                $dataService->setProxyWithSync($profileId, $proxyData);
                echo json_encode(['success' => true, 'message' => 'Proxy set']);
                
            } elseif ($action === 'assign_seller') {
                // Assign seller to folder (Admin only)
                if ($user['roles'] !== '1') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Only Admin can assign sellers']);
                    exit();
                }
                
                $folderId = $input['folderId'] ?? null;
                $sellerId = $input['sellerId'] ?? null;
                
                if (!$folderId || !$sellerId) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Folder ID and Seller ID required']);
                    exit();
                }
                
                $dataService->assignSellerToFolder($folderId, $sellerId);
                echo json_encode(['success' => true, 'message' => 'Seller assigned to folder']);
                
            } elseif ($action === 'remove_seller') {
                // Remove seller from folder (Admin only)
                if ($user['roles'] !== '1') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Only Admin can remove sellers']);
                    exit();
                }
                
                $folderId = $input['folderId'] ?? null;
                
                if (!$folderId) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Folder ID required']);
                    exit();
                }
                
                $dataService->removeSellerFromFolder($folderId);
                echo json_encode(['success' => true, 'message' => 'Seller removed from folder']);
                
            } elseif ($action === 'update_folder') {
                // Update folder (Admin only)
                if ($user['roles'] !== '1') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Only Admin can update folders']);
                    exit();
                }
                
                $folderId = $input['folderId'] ?? null;
                $name = $input['name'] ?? null;
                
                if (!$folderId || !$name) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Folder ID and name required']);
                    exit();
                }
                
                $dataService->updateFolder($folderId, $name);
                echo json_encode(['success' => true, 'message' => 'Folder updated successfully']);
                
            } elseif ($action === 'delete_folder') {
                // Delete folder (Admin only)
                if ($user['roles'] !== '1') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Only Admin can delete folders']);
                    exit();
                }
                
                $folderId = $input['folderId'] ?? null;
                
                if (!$folderId) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Folder ID required']);
                    exit();
                }
                
                $dataService->deleteFolder($folderId);
                echo json_encode(['success' => true, 'message' => 'Folder deleted successfully']);
                
            } elseif ($action === 'create_user') {
                // Create user (Admin only)
                if ($user['roles'] !== '1') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Only Admin can create users']);
                    exit();
                }
                
                $userName = $input['userName'] ?? null;
                $password = $input['password'] ?? null;
                $fullName = $input['fullName'] ?? null;
                $email = $input['email'] ?? '';
                $phone = $input['phone'] ?? '';
                $address = $input['address'] ?? '';
                $roles = $input['roles'] ?? '3'; // Default to Seller
                
                if (!$userName || !$password || !$fullName) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Username, password, and full name are required']);
                    exit();
                }
                
                $userId = $userService->createUser($userName, $password, $fullName, $email, $phone, $address, $roles);
                echo json_encode(['success' => true, 'data' => ['id' => $userId], 'message' => 'User created successfully']);
                
            } elseif ($action === 'update_user') {
                // Update user (Admin only)
                if ($user['roles'] !== '1') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Only Admin can update users']);
                    exit();
                }
                
                $userId = $input['id'] ?? null;
                $userName = $input['userName'] ?? null;
                $fullName = $input['fullName'] ?? null;
                $email = $input['email'] ?? '';
                $phone = $input['phone'] ?? '';
                $address = $input['address'] ?? '';
                $roles = $input['roles'] ?? '3';
                $password = $input['password'] ?? null; // Optional
                
                if (!$userId || !$userName || !$fullName) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'User ID, username, and full name are required']);
                    exit();
                }
                
                $userService->updateUser($userId, $userName, $fullName, $email, $phone, $address, $roles, $password);
                echo json_encode(['success' => true, 'message' => 'User updated successfully']);
                
            } elseif ($action === 'delete_user') {
                // Delete user (Admin only)
                if ($user['roles'] !== '1') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Only Admin can delete users']);
                    exit();
                }
                
                $userId = $input['id'] ?? null;
                
                if (!$userId) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'User ID required']);
                    exit();
                }
                
                // Prevent deleting yourself
                if ($userId == $user['id']) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Cannot delete yourself']);
                    exit();
                }
                
                $userService->deleteUser($userId);
                echo json_encode(['success' => true, 'message' => 'User deleted successfully']);
                
            } elseif ($action === 'toggle_user_status') {
                // Toggle user status (Admin only)
                if ($user['roles'] !== '1') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Admin access required']);
                    exit();
                }
                
                $userId = $input['userId'] ?? null;
                if (!$userId) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'userId is required']);
                    exit();
                }
                
                $userService->toggleUserStatus($userId);
                echo json_encode(['success' => true, 'message' => 'User status toggled']);
                
            } elseif ($action === 'assign_profile_folders') {
                // Assign profile to folders (Admin and Leader)
                if ($user['roles'] !== '1' && $user['roles'] !== '2') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Admin access required']);
                    exit();
                }
                
                $profileId = $input['profileId'] ?? null;
                $folderIds = $input['folderIds'] ?? [];
                
                if (!$profileId || !is_array($folderIds) || empty($folderIds)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'profileId and folderIds array are required']);
                    exit();
                }
                
                // Sync with GoLogin API first
                require_once __DIR__ . '/../config/gologin.php';
                $gologinAPI = new GoLoginAPI();
                
                foreach ($folderIds as $folderId) {
                    $folder = $dataService->getFolderById($folderId);
                    if ($folder) {
                        $gologinAPI->addProfilesToFolder($folder['name'], [$profileId]);
                    }
                }
                
                // Update local database
                $dataService->addProfileToFolders($profileId, $folderIds);
                echo json_encode(['success' => true, 'message' => 'Profile assigned to folders']);
                
            } elseif ($action === 'remove_profile_folders') {
                // Remove profile from folders (Admin and Leader)
                if ($user['roles'] !== '1' && $user['roles'] !== '2') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Admin access required']);
                    exit();
                }
                
                $profileId = $input['profileId'] ?? null;
                $folderIds = $input['folderIds'] ?? [];
                
                if (!$profileId || !is_array($folderIds) || empty($folderIds)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'profileId and folderIds array are required']);
                    exit();
                }
                
                // Sync with GoLogin API first
                require_once __DIR__ . '/../config/gologin.php';
                $gologinAPI = new GoLoginAPI();
                
                foreach ($folderIds as $folderId) {
                    $folder = $dataService->getFolderById($folderId);
                    if ($folder) {
                        $gologinAPI->removeProfilesFromFolder($folder['name'], [$profileId]);
                    }
                }
                
                // Update local database
                $dataService->removeProfileFromFolders($profileId, $folderIds);
                echo json_encode(['success' => true, 'message' => 'Profile removed from folders']);
                
            } elseif ($action === 'set_profile_folders') {
                // Set profile folders (replace all existing) - Admin and Leader
                if ($user['roles'] !== '1' && $user['roles'] !== '2') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Admin access required']);
                    exit();
                }
                
                $profileId = $input['profileId'] ?? null;
                $folderIds = $input['folderIds'] ?? [];
                
                if (!$profileId || !is_array($folderIds)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'profileId and folderIds array are required']);
                    exit();
                }
                
                // Get current folders
                $currentFolders = $dataService->getProfileFolders($profileId);
                $currentFolderIds = array_column($currentFolders, 'folder_id');
                
                // Determine folders to add and remove
                $foldersToAdd = array_diff($folderIds, $currentFolderIds);
                $foldersToRemove = array_diff($currentFolderIds, $folderIds);
                
                // Sync with GoLogin API
                require_once __DIR__ . '/../config/gologin.php';
                $gologinAPI = new GoLoginAPI();
                
                // Remove from old folders
                foreach ($foldersToRemove as $folderId) {
                    $folder = $dataService->getFolderById($folderId);
                    if ($folder) {
                        $gologinAPI->removeProfilesFromFolder($folder['name'], [$profileId]);
                    }
                }
                
                // Add to new folders
                foreach ($foldersToAdd as $folderId) {
                    $folder = $dataService->getFolderById($folderId);
                    if ($folder) {
                        $gologinAPI->addProfilesToFolder($folder['name'], [$profileId]);
                    }
                }
                
                // Update local database
                $dataService->setProfileFolders($profileId, $folderIds);
                echo json_encode(['success' => true, 'message' => 'Profile folders updated']);
                
            } elseif ($action === 'get_profile_folders') {
                // Get folders for a specific profile
                $profileId = $input['profileId'] ?? null;
                
                if (!$profileId) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'profileId is required']);
                    exit();
                }
                
                $folders = $dataService->getProfileFolders($profileId);
                echo json_encode(['success' => true, 'data' => $folders]);
                
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
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
