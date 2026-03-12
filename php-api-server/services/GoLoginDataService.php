<?php
require_once __DIR__ . '/../config/database.php';

class GoLoginDataService {
    private $db;
    private $conn;

    public function __construct() {
        $this->db = new Database();
        $this->conn = $this->db->getConnection();
    }

    /**
     * Get all folders from database with seller filtering
     */
    public function getFolders($userId = null, $userRole = null) {
        // Admin can see all folders
        if ($userRole === '1') {
            $sql = "SELECT f.folder_id, f.name, f.seller_id, f.created_at, f.updated_at, f.synced_at,
                    u.userName as seller_name,
                    (SELECT COUNT(*) FROM gologin_profile_folders WHERE folder_id = f.folder_id) as profilesCount
                    FROM gologin_folders f
                    LEFT JOIN users u ON f.seller_id = u.id
                    ORDER BY f.created_at DESC";
            
            $stmt = $this->conn->prepare($sql);
            $stmt->execute();
        } elseif ($userRole === '2') {
            // Leader can see own folders + all folders of team members (via seller_id)
            $sql = "SELECT DISTINCT f.folder_id, f.name, f.seller_id, f.created_at, f.updated_at, f.synced_at,
                    u.userName as seller_name,
                    (SELECT COUNT(*) FROM gologin_profile_folders WHERE folder_id = f.folder_id) as profilesCount
                    FROM gologin_folders f
                    LEFT JOIN users u ON f.seller_id = u.id
                    WHERE f.seller_id = :user_id
                    OR f.seller_id IN (
                        SELECT tm.user_id FROM team_members tm
                        INNER JOIN teams t ON tm.team_id = t.id
                        WHERE t.leader_id = :leader_id
                    )
                    ORDER BY f.created_at DESC";
            
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(':user_id', $userId);
            $stmt->bindParam(':leader_id', $userId);
            $stmt->execute();
        } else {
            // Seller can only see folders assigned to them
            $sql = "SELECT f.folder_id, f.name, f.seller_id, f.created_at, f.updated_at, f.synced_at,
                    u.userName as seller_name,
                    (SELECT COUNT(*) FROM gologin_profile_folders WHERE folder_id = f.folder_id) as profilesCount
                    FROM gologin_folders f
                    LEFT JOIN users u ON f.seller_id = u.id
                    WHERE f.seller_id = :user_id
                    ORDER BY f.created_at DESC";
            
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(':user_id', $userId);
            $stmt->execute();
        }
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Get folder by ID
     */
    public function getFolderById($folderId) {
        $sql = "SELECT folder_id, name, created_at, updated_at, synced_at,
                (SELECT COUNT(*) FROM gologin_profile_folders WHERE folder_id = gologin_folders.folder_id) as profilesCount
                FROM gologin_folders
                WHERE folder_id = :folder_id";
        
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':folder_id', $folderId);
        $stmt->execute();
        
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Get all profiles from database with pagination
     */
    public function getProfiles($page = 1, $limit = 50, $search = null, $folderId = null, $userId = null, $userRole = null) {
        $offset = ($page - 1) * $limit;
        
        // Debug logging
        error_log("GoLoginDataService.getProfiles called with: page=$page, limit=$limit, search=" . ($search ?: 'null') . ", folderId=" . ($folderId ?: 'null') . ", userId=" . ($userId ?: 'null') . ", userRole=" . ($userRole ?: 'null'));
        
        // Build WHERE clause
        $whereConditions = [];
        $params = [];
        
        if ($search) {
            $whereConditions[] = "p.name LIKE :search";
            $params[':search'] = "%{$search}%";
        }
        
        if ($folderId) {
            $whereConditions[] = "EXISTS (
                SELECT 1 FROM gologin_profile_folders pf
                WHERE pf.profile_id = p.profile_id
                AND pf.folder_id = :folder_id
            )";
            $params[':folder_id'] = $folderId;
            error_log("Adding folder filter using junction table: folder_id = '$folderId'");
        }
        
        // Role-based filtering
        if ($userRole === '2' && $userId) {
            // Leader can see profiles in own folders + all folders of team members (via seller_id)
            $whereConditions[] = "EXISTS (
                SELECT 1 FROM gologin_profile_folders pf
                INNER JOIN gologin_folders f ON pf.folder_id = f.folder_id
                WHERE pf.profile_id = p.profile_id
                AND (
                    f.seller_id = :user_id
                    OR f.seller_id IN (
                        SELECT tm.user_id FROM team_members tm
                        INNER JOIN teams t ON tm.team_id = t.id
                        WHERE t.leader_id = :leader_id
                    )
                )
            )";
            $params[':user_id'] = $userId;
            $params[':leader_id'] = $userId;
            error_log("Adding leader filter: userId = $userId");
        } elseif ($userRole === '3' && $userId) {
            // Seller can only see profiles in folders assigned to them
            // Use junction table to support many-to-many relationship
            $whereConditions[] = "EXISTS (
                SELECT 1 FROM gologin_profile_folders pf
                INNER JOIN gologin_folders f ON pf.folder_id = f.folder_id
                WHERE pf.profile_id = p.profile_id
                AND f.seller_id = :user_id
            )";
            $params[':user_id'] = $userId;
            error_log("Adding seller filter using junction table: seller_id = $userId");
        }
        
        $whereClause = !empty($whereConditions) ? 'WHERE ' . implode(' AND ', $whereConditions) : '';
        
        // Get total count
        $countSql = "SELECT COUNT(*) as total FROM gologin_profiles p {$whereClause}";
        error_log("Count SQL: $countSql");
        error_log("Params: " . json_encode($params));
        
        $countStmt = $this->conn->prepare($countSql);
        foreach ($params as $key => $value) {
            $countStmt->bindValue($key, $value);
        }
        $countStmt->execute();
        $total = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        error_log("Total profiles found: $total");
        
        // Get profiles with all folder names
        $sql = "SELECT p.*, 
                GROUP_CONCAT(DISTINCT f.name ORDER BY f.name SEPARATOR ', ') as folder_names
                FROM gologin_profiles p
                LEFT JOIN gologin_profile_folders pf ON p.profile_id = pf.profile_id
                LEFT JOIN gologin_folders f ON pf.folder_id = f.folder_id
                {$whereClause}
                GROUP BY p.profile_id
                ORDER BY p.last_activity DESC, p.name ASC
                LIMIT :limit OFFSET :offset";
        
        error_log("Query SQL: $sql");
        
        $stmt = $this->conn->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
        $stmt->execute();
        
        $profiles = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        error_log("Profiles returned: " . count($profiles));
        if (count($profiles) > 0) {
            error_log("First profile folder_id: " . ($profiles[0]['folder_id'] ?? 'null'));
        }
        
        return [
            'profiles' => $profiles,
            'total' => (int)$total,
            'page' => (int)$page,
            'limit' => (int)$limit,
            'totalPages' => ceil($total / $limit)
        ];
    }

    /**
     * Get profile by ID
     */
    public function getProfileById($profileId) {
        $sql = "SELECT p.*, f.name as folder_name
                FROM gologin_profiles p
                LEFT JOIN gologin_folders f ON p.folder_id = f.folder_id
                WHERE p.profile_id = :profile_id";
        
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':profile_id', $profileId);
        $stmt->execute();
        
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Get profiles by folder ID
     */
    public function getProfilesByFolder($folderId) {
        $sql = "SELECT p.* FROM gologin_profiles p
                INNER JOIN gologin_profile_folders pf ON p.profile_id = pf.profile_id
                WHERE pf.folder_id = :folder_id
                ORDER BY p.name ASC";
        
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':folder_id', $folderId);
        $stmt->execute();
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Get dashboard statistics
     */
    public function getDashboardStats($userId = null, $userRole = null) {
        // Total profiles
        if ($userRole === '1') {
            // Admin sees all profiles
            $totalSql = "SELECT COUNT(*) as total FROM gologin_profiles";
            $totalStmt = $this->conn->prepare($totalSql);
        } else {
            // Seller sees only profiles in folders assigned to them
            $totalSql = "SELECT COUNT(DISTINCT p.profile_id) as total 
                        FROM gologin_profiles p
                        INNER JOIN gologin_folders f ON p.folder_id = f.folder_id
                        WHERE f.seller_id = :user_id";
            $totalStmt = $this->conn->prepare($totalSql);
            $totalStmt->bindParam(':user_id', $userId);
        }
        $totalStmt->execute();
        $totalProfiles = $totalStmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Running profiles - count profiles where status might indicate running
        // Since we don't have a reliable status field, we'll return 0 for now
        $runningProfiles = 0;
        
        return [
            'total_profiles' => (int)$totalProfiles,
            'running_profiles' => (int)$runningProfiles,
            'available_profiles' => (int)($totalProfiles - $runningProfiles)
        ];
    }

    /**
     * Check if user has permission to access profile
     */
    public function hasProfilePermission($userId, $profileId, $permissionType = 'view') {
        $sql = "SELECT COUNT(*) as count
                FROM gologin_profile_permissions perm
                INNER JOIN gologin_profiles p ON (perm.profile_id = p.profile_id OR perm.folder_id = p.folder_id)
                WHERE perm.user_id = :user_id 
                AND p.profile_id = :profile_id
                AND perm.permission_type = :permission_type";
        
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':user_id', $userId);
        $stmt->bindParam(':profile_id', $profileId);
        $stmt->bindParam(':permission_type', $permissionType);
        $stmt->execute();
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result['count'] > 0;
    }

    /**
     * Check if user has permission to access folder
     */
    public function hasFolderPermission($userId, $folderId, $permissionType = 'view') {
        $sql = "SELECT COUNT(*) as count
                FROM gologin_profile_permissions 
                WHERE user_id = :user_id 
                AND folder_id = :folder_id
                AND permission_type = :permission_type";
        
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':user_id', $userId);
        $stmt->bindParam(':folder_id', $folderId);
        $stmt->bindParam(':permission_type', $permissionType);
        $stmt->execute();
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result['count'] > 0;
    }

    /**
     * Grant permission to user for folder or profile
     */
    public function grantPermission($userId, $folderId = null, $profileId = null, $permissionType = 'view') {
        $sql = "INSERT INTO gologin_profile_permissions (user_id, folder_id, profile_id, permission_type)
                VALUES (:user_id, :folder_id, :profile_id, :permission_type)
                ON DUPLICATE KEY UPDATE permission_type = :permission_type";
        
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':user_id', $userId);
        $stmt->bindParam(':folder_id', $folderId);
        $stmt->bindParam(':profile_id', $profileId);
        $stmt->bindParam(':permission_type', $permissionType);
        
        return $stmt->execute();
    }

    /**
     * Revoke permission from user
     */
    public function revokePermission($userId, $folderId = null, $profileId = null) {
        $sql = "DELETE FROM gologin_profile_permissions
                WHERE user_id = :user_id";
        
        if ($folderId) {
            $sql .= " AND folder_id = :folder_id";
        }
        if ($profileId) {
            $sql .= " AND profile_id = :profile_id";
        }
        
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':user_id', $userId);
        if ($folderId) {
            $stmt->bindParam(':folder_id', $folderId);
        }
        if ($profileId) {
            $stmt->bindParam(':profile_id', $profileId);
        }
        
        return $stmt->execute();
    }

    /**
     * Create profile in GoLogin and sync to database
     */
    public function createProfileWithSync($profileData, $folderName = null) {
        require_once __DIR__ . '/../config/gologin.php';
        $gologinAPI = new GoLoginAPI();
        
        // Create in GoLogin first
        $createdProfile = $gologinAPI->createProfile($profileData);
        
        // If folder is specified, add profile to folder
        if ($folderName && isset($createdProfile['id'])) {
            try {
                $gologinAPI->addProfilesToFolder($folderName, $createdProfile['id']);
                error_log("Added profile {$createdProfile['id']} to folder: $folderName");
            } catch (Exception $e) {
                error_log("Failed to add profile to folder: " . $e->getMessage());
            }
        }
        
        // Sync to database
        require_once __DIR__ . '/GoLoginSyncService.php';
        $syncService = new GoLoginSyncService();
        $syncService->syncProfiles();
        
        return $createdProfile;
    }

    /**
     * Update profile notes in database only (local field, not synced to GoLogin)
     */
    public function updateProfileNotes($profileId, $notes) {
        $sql = "UPDATE gologin_profiles SET notes = :notes, updated_at = NOW() WHERE profile_id = :profile_id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':notes', $notes);
        $stmt->bindParam(':profile_id', $profileId);
        $stmt->execute();
        
        return ['success' => true, 'profile_id' => $profileId, 'notes' => $notes];
    }

    /**
     * Update profile in GoLogin and sync to database
     */
    public function updateProfileWithSync($profileId, $profileData) {
        require_once __DIR__ . '/../config/gologin.php';
        $gologinAPI = new GoLoginAPI();
        
        // Get current profile data from GoLogin
        $currentProfile = $gologinAPI->getProfile($profileId);
        
        // Merge new data with existing profile (preserving required fields)
        $mergedData = array_merge($currentProfile, $profileData);
        
        // Update in GoLogin with merged data
        $updatedProfile = $gologinAPI->updateProfile($profileId, $mergedData);
        
        // Sync to database
        require_once __DIR__ . '/GoLoginSyncService.php';
        $syncService = new GoLoginSyncService();
        $syncService->syncProfiles();
        
        return $updatedProfile;
    }

    /**
     * Delete profile from GoLogin and database
     */
    public function deleteProfileWithSync($profileId) {
        require_once __DIR__ . '/../config/gologin.php';
        $gologinAPI = new GoLoginAPI();
        
        // Delete from GoLogin first
        $gologinAPI->deleteProfile($profileId);
        
        // Delete from database
        $sql = "DELETE FROM gologin_profiles WHERE profile_id = :profile_id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':profile_id', $profileId);
        $stmt->execute();
        
        // Also delete permissions
        $sql = "DELETE FROM gologin_profile_permissions WHERE profile_id = :profile_id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':profile_id', $profileId);
        $stmt->execute();
        
        return true;
    }

    /**
     * Create folder in GoLogin and sync to database
     */
    public function createFolderWithSync($name) {
        require_once __DIR__ . '/../config/gologin.php';
        $gologinAPI = new GoLoginAPI();
        
        // Create in GoLogin first
        $createdFolder = $gologinAPI->createFolder($name);
        
        // Sync to database
        require_once __DIR__ . '/GoLoginSyncService.php';
        $syncService = new GoLoginSyncService();
        $syncService->syncFolders();
        
        return $createdFolder;
    }

    /**
     * Set proxy for profile in GoLogin and sync to database
     */
    public function setProxyWithSync($profileId, $proxyData) {
        require_once __DIR__ . '/../config/gologin.php';
        $gologinAPI = new GoLoginAPI();
        
        // Set proxy in GoLogin first
        $gologinAPI->setProxy($profileId, $proxyData);
        
        // Sync to database
        require_once __DIR__ . '/GoLoginSyncService.php';
        $syncService = new GoLoginSyncService();
        $syncService->syncProfiles();
        
        return true;
    }

    /**
     * Assign seller to folder
     */
    public function assignSellerToFolder($folderId, $sellerId) {
        $sql = "UPDATE gologin_folders SET seller_id = :seller_id WHERE folder_id = :folder_id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':seller_id', $sellerId);
        $stmt->bindParam(':folder_id', $folderId);
        return $stmt->execute();
    }

    /**
     * Remove seller from folder
     */
    public function removeSellerFromFolder($folderId) {
        $sql = "UPDATE gologin_folders SET seller_id = NULL WHERE folder_id = :folder_id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':folder_id', $folderId);
        return $stmt->execute();
    }

    /**
     * Get folders for a specific profile
     */
    public function getProfileFolders($profileId) {
        $sql = "SELECT f.folder_id, f.name
                FROM gologin_folders f
                INNER JOIN gologin_profile_folders pf ON f.folder_id = pf.folder_id
                WHERE pf.profile_id = :profile_id
                ORDER BY f.name ASC";
        
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':profile_id', $profileId);
        $stmt->execute();
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Add profile to folders (many-to-many)
     */
    public function addProfileToFolders($profileId, $folderIds) {
        if (!is_array($folderIds)) {
            $folderIds = [$folderIds];
        }

        $sql = "INSERT IGNORE INTO gologin_profile_folders (profile_id, folder_id) VALUES (:profile_id, :folder_id)";
        $stmt = $this->conn->prepare($sql);

        foreach ($folderIds as $folderId) {
            $stmt->bindParam(':profile_id', $profileId);
            $stmt->bindParam(':folder_id', $folderId);
            $stmt->execute();
        }

        return true;
    }

    /**
     * Remove profile from folders
     */
    public function removeProfileFromFolders($profileId, $folderIds) {
        if (!is_array($folderIds)) {
            $folderIds = [$folderIds];
        }

        $placeholders = implode(',', array_fill(0, count($folderIds), '?'));
        $sql = "DELETE FROM gologin_profile_folders WHERE profile_id = ? AND folder_id IN ($placeholders)";
        
        $stmt = $this->conn->prepare($sql);
        $params = array_merge([$profileId], $folderIds);
        $stmt->execute($params);

        return true;
    }

    /**
     * Set profile folders (replace all existing)
     */
    public function setProfileFolders($profileId, $folderIds) {
        // Start transaction
        $this->conn->beginTransaction();

        try {
            // Remove all existing folder associations
            $sql = "DELETE FROM gologin_profile_folders WHERE profile_id = :profile_id";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(':profile_id', $profileId);
            $stmt->execute();

            // Add new folder associations
            if (!empty($folderIds)) {
                $this->addProfileToFolders($profileId, $folderIds);
            }

            $this->conn->commit();
            return true;
        } catch (Exception $e) {
            $this->conn->rollBack();
            throw $e;
        }
    }

    /**
     * Update folder name
     * This updates both GoLogin API and local database
     */
    public function updateFolder($folderId, $newName) {
        // First, get the current folder name from database
        $getSql = "SELECT name FROM gologin_folders WHERE folder_id = :folder_id";
        $getStmt = $this->conn->prepare($getSql);
        $getStmt->bindParam(':folder_id', $folderId);
        $getStmt->execute();
        $folder = $getStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$folder) {
            throw new Exception("Folder not found");
        }
        
        $oldName = $folder['name'];
        
        // Update on GoLogin API first (using old name to identify folder)
        try {
            require_once __DIR__ . '/../config/gologin.php';
            $goLoginAPI = new GoLoginAPI();
            $goLoginAPI->updateFolder($oldName, $newName);
        } catch (Exception $e) {
            throw new Exception("Failed to update folder on GoLogin: " . $e->getMessage());
        }
        
        // Update local database
        $sql = "UPDATE gologin_folders SET name = :name, updated_at = NOW() WHERE folder_id = :folder_id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':name', $newName);
        $stmt->bindParam(':folder_id', $folderId);
        
        if (!$stmt->execute()) {
            throw new Exception("Failed to update folder in database");
        }
        
        return true;
    }

    /**
     * Delete folder
     * This deletes from both GoLogin API and local database
     */
    public function deleteFolder($folderId) {
        // First, get the folder name from database
        $getSql = "SELECT name FROM gologin_folders WHERE folder_id = :folder_id";
        $getStmt = $this->conn->prepare($getSql);
        $getStmt->bindParam(':folder_id', $folderId);
        $getStmt->execute();
        $folder = $getStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$folder) {
            throw new Exception("Folder not found");
        }
        
        $folderName = $folder['name'];
        
        // Delete from GoLogin API first (using folder name)
        try {
            require_once __DIR__ . '/../config/gologin.php';
            $goLoginAPI = new GoLoginAPI();
            $goLoginAPI->deleteFolder($folderName);
        } catch (Exception $e) {
            throw new Exception("Failed to delete folder from GoLogin: " . $e->getMessage());
        }
        
        // Delete from local database
        $sql = "DELETE FROM gologin_folders WHERE folder_id = :folder_id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':folder_id', $folderId);
        
        if (!$stmt->execute()) {
            throw new Exception("Failed to delete folder from database");
        }
        
        return true;
    }

    /**
     * Get all sellers (users with role='3')
     */
    public function getAllSellers() {
        $sql = "SELECT id, userName, fullName, email, roles, status 
                FROM users 
                WHERE (roles = '2' OR roles = '3') AND status = '1'
                ORDER BY userName ASC";
        
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Create folder with seller assignment
     */
    public function createFolderWithSellerSync($name, $sellerId = null) {
        require_once __DIR__ . '/../config/gologin.php';
        $gologinAPI = new GoLoginAPI();
        
        // Create in GoLogin first
        $createdFolder = $gologinAPI->createFolder($name);
        
        // Sync to database
        require_once __DIR__ . '/GoLoginSyncService.php';
        $syncService = new GoLoginSyncService();
        $syncService->syncFolders();
        
        // Assign seller if provided
        if ($sellerId && isset($createdFolder['id'])) {
            $this->assignSellerToFolder($createdFolder['id'], $sellerId);
        }
        
        return $createdFolder;
    }
}
?>
