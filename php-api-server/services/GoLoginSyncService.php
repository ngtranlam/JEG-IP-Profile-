<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/gologin.php';

class GoLoginSyncService {
    private $db;
    private $conn;
    private $gologinAPI;

    public function __construct() {
        $this->db = new Database();
        $this->conn = $this->db->getConnection();
        $this->gologinAPI = new GoLoginAPI();
    }

    /**
     * Sync all data from GoLogin API (folders and profiles)
     */
    public function syncAll() {
        $logId = $this->startSyncLog('full');
        
        try {
            $foldersCount = $this->syncFolders();
            $profilesCount = $this->syncProfiles();
            
            $this->completeSyncLog($logId, 'completed', $foldersCount, $profilesCount);
            
            return [
                'success' => true,
                'folders_synced' => $foldersCount,
                'profiles_synced' => $profilesCount
            ];
        } catch (Exception $e) {
            $this->completeSyncLog($logId, 'failed', 0, 0, $e->getMessage());
            throw $e;
        }
    }

    /**
     * Sync folders from GoLogin API
     */
    public function syncFolders() {
        try {
            $folders = $this->fetchGoLoginFolders();
            $count = 0;

            // Get list of folder IDs from GoLogin
            $gologinFolderIds = [];
            foreach ($folders as $folder) {
                $this->upsertFolder($folder);
                $gologinFolderIds[] = $folder['id'];
                $count++;
            }

            // Delete folders from DB that no longer exist on GoLogin
            $this->deleteRemovedFolders($gologinFolderIds);

            return $count;
        } catch (Exception $e) {
            error_log("Error syncing folders: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Sync profiles from GoLogin API
     */
    public function syncProfiles() {
        try {
            $profiles = $this->fetchGoLoginProfiles();
            $count = 0;

            // Get list of profile IDs from GoLogin
            $gologinProfileIds = [];
            foreach ($profiles as $profile) {
                $this->upsertProfile($profile);
                $gologinProfileIds[] = $profile['id'];
                $count++;
            }

            // Delete profiles from DB that no longer exist on GoLogin
            $this->deleteRemovedProfiles($gologinProfileIds);

            return $count;
        } catch (Exception $e) {
            error_log("Error syncing profiles: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Fetch folders from GoLogin API
     */
    private function fetchGoLoginFolders() {
        try {
            $folders = $this->gologinAPI->listFolders();
            return is_array($folders) ? $folders : [];
        } catch (Exception $e) {
            error_log("Error fetching folders: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Fetch profiles from GoLogin API
     */
    private function fetchGoLoginProfiles() {
        $allProfiles = [];
        $page = 1;
        $profilesPerPage = 30; // GoLogin API returns 30 profiles per page

        try {
            do {
                error_log("Fetching profiles page: $page");
                $response = $this->gologinAPI->listProfiles($page);
                
                if (isset($response['profiles']) && is_array($response['profiles'])) {
                    $profilesInPage = count($response['profiles']);
                    $allProfiles = array_merge($allProfiles, $response['profiles']);
                    error_log("Fetched $profilesInPage profiles from page $page. Total so far: " . count($allProfiles));
                    
                    // Check if we have fetched all profiles
                    // If current page has less than 30 profiles, it's the last page
                    if ($profilesInPage < $profilesPerPage) {
                        error_log("Last page reached (page $page has only $profilesInPage profiles)");
                        break;
                    }
                    
                    // Also check against total count if available
                    if (isset($response['allProfilesCount'])) {
                        $totalCount = $response['allProfilesCount'];
                        error_log("Total profiles count from API: $totalCount");
                        if (count($allProfiles) >= $totalCount) {
                            error_log("All profiles fetched: " . count($allProfiles) . " >= $totalCount");
                            break;
                        }
                    }
                    
                    $page++;
                } else {
                    error_log("No profiles array in response for page $page");
                    break;
                }
            } while (true);
            
            error_log("Total profiles fetched: " . count($allProfiles));
        } catch (Exception $e) {
            error_log("Error fetching profiles: " . $e->getMessage());
        }

        return $allProfiles;
    }

    /**
     * Convert ISO datetime to MySQL format
     */
    private function convertDateTime($isoDate) {
        if (empty($isoDate)) {
            return null;
        }
        
        try {
            $date = new DateTime($isoDate);
            return $date->format('Y-m-d H:i:s');
        } catch (Exception $e) {
            return null;
        }
    }

    /**
     * Insert or update folder in database
     */
    private function upsertFolder($folder) {
        $sql = "INSERT INTO gologin_folders (folder_id, name, created_at, updated_at, synced_at)
                VALUES (:folder_id, :name, :created_at, :updated_at, NOW())
                ON DUPLICATE KEY UPDATE
                    name = :name,
                    updated_at = :updated_at,
                    synced_at = NOW()";
        
        $stmt = $this->conn->prepare($sql);
        
        $folderId = $folder['id'] ?? $folder['_id'] ?? '';
        $name = $folder['name'] ?? 'Unnamed Folder';
        $createdAt = $this->convertDateTime($folder['createdAt'] ?? null) ?? date('Y-m-d H:i:s');
        $updatedAt = $this->convertDateTime($folder['updatedAt'] ?? null) ?? date('Y-m-d H:i:s');
        
        $stmt->bindParam(':folder_id', $folderId);
        $stmt->bindParam(':name', $name);
        $stmt->bindParam(':created_at', $createdAt);
        $stmt->bindParam(':updated_at', $updatedAt);
        
        return $stmt->execute();
    }

    /**
     * Insert or update profile in database
     */
    private function upsertProfile($profile) {
        $sql = "INSERT INTO gologin_profiles (
                    profile_id, name, folder_id, browser_type, os, user_agent,
                    screen_width, screen_height, proxy_enabled, proxy_type,
                    proxy_host, proxy_port, proxy_username, status, can_be_running,
                    last_activity, notes, raw_data, created_at, updated_at, synced_at
                ) VALUES (
                    :profile_id, :name, :folder_id, :browser_type, :os, :user_agent,
                    :screen_width, :screen_height, :proxy_enabled, :proxy_type,
                    :proxy_host, :proxy_port, :proxy_username, :status, :can_be_running,
                    :last_activity, :notes, :raw_data, :created_at, :updated_at, NOW()
                ) ON DUPLICATE KEY UPDATE
                    name = :name,
                    folder_id = :folder_id,
                    browser_type = :browser_type,
                    os = :os,
                    user_agent = :user_agent,
                    screen_width = :screen_width,
                    screen_height = :screen_height,
                    proxy_enabled = :proxy_enabled,
                    proxy_type = :proxy_type,
                    proxy_host = :proxy_host,
                    proxy_port = :proxy_port,
                    proxy_username = :proxy_username,
                    status = :status,
                    can_be_running = :can_be_running,
                    last_activity = :last_activity,
                    notes = :notes,
                    raw_data = :raw_data,
                    updated_at = :updated_at,
                    synced_at = NOW()";
        
        $stmt = $this->conn->prepare($sql);
        
        // Extract profile data
        $profileId = $profile['id'] ?? $profile['_id'] ?? '';
        $name = $profile['name'] ?? 'Unnamed Profile';
        
        // GoLogin API returns 'folders' as an array of folder names
        // We need to lookup the folder_id from database using the folder name
        $folderId = null;
        $allFolderIds = [];
        
        if (isset($profile['folders']) && is_array($profile['folders']) && count($profile['folders']) > 0) {
            // Get primary folder (first one) for backward compatibility
            $folderName = $profile['folders'][0];
            
            // Lookup folder_id from database by name
            $folderSql = "SELECT folder_id FROM gologin_folders WHERE name = :name LIMIT 1";
            $folderStmt = $this->conn->prepare($folderSql);
            $folderStmt->bindParam(':name', $folderName);
            $folderStmt->execute();
            $folderResult = $folderStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($folderResult) {
                $folderId = $folderResult['folder_id'];
                error_log("Mapped folder '$folderName' to folder_id: $folderId");
            } else {
                error_log("Warning: Folder '$folderName' not found in database for profile $profileId");
            }
            
            // Get ALL folder IDs for junction table sync
            foreach ($profile['folders'] as $folderName) {
                $folderStmt->bindParam(':name', $folderName);
                $folderStmt->execute();
                $folderResult = $folderStmt->fetch(PDO::FETCH_ASSOC);
                
                if ($folderResult) {
                    $allFolderIds[] = $folderResult['folder_id'];
                }
            }
        }
        
        error_log("Syncing profile: $profileId - $name, folder_id: " . ($folderId ?? 'null') . ", total folders: " . count($allFolderIds));
        
        $browserType = $profile['browserType'] ?? null;
        $os = $profile['os'] ?? null;
        $userAgent = $profile['navigator']['userAgent'] ?? null;
        $screenWidth = $profile['navigator']['resolution']['width'] ?? null;
        $screenHeight = $profile['navigator']['resolution']['height'] ?? null;
        
        // Proxy settings
        $proxyEnabled = isset($profile['proxy']['mode']) && $profile['proxy']['mode'] !== 'none' ? 1 : 0;
        $proxyType = $profile['proxy']['mode'] ?? null;
        $proxyHost = $profile['proxy']['host'] ?? null;
        $proxyPort = $profile['proxy']['port'] ?? null;
        $proxyUsername = $profile['proxy']['username'] ?? null;
        
        // Status
        $status = 'active';
        $canBeRunning = isset($profile['canBeRunning']) ? ($profile['canBeRunning'] ? 1 : 0) : 1;
        $lastActivity = $this->convertDateTime($profile['lastActivity'] ?? null);
        $notes = $profile['notes'] ?? null;
        
        // Store full JSON data
        $rawData = json_encode($profile);
        
        $createdAt = $this->convertDateTime($profile['createdAt'] ?? null) ?? date('Y-m-d H:i:s');
        $updatedAt = $this->convertDateTime($profile['updatedAt'] ?? null) ?? date('Y-m-d H:i:s');
        
        // Bind parameters
        $stmt->bindParam(':profile_id', $profileId);
        $stmt->bindParam(':name', $name);
        $stmt->bindParam(':folder_id', $folderId);
        $stmt->bindParam(':browser_type', $browserType);
        $stmt->bindParam(':os', $os);
        $stmt->bindParam(':user_agent', $userAgent);
        $stmt->bindParam(':screen_width', $screenWidth);
        $stmt->bindParam(':screen_height', $screenHeight);
        $stmt->bindParam(':proxy_enabled', $proxyEnabled);
        $stmt->bindParam(':proxy_type', $proxyType);
        $stmt->bindParam(':proxy_host', $proxyHost);
        $stmt->bindParam(':proxy_port', $proxyPort);
        $stmt->bindParam(':proxy_username', $proxyUsername);
        $stmt->bindParam(':status', $status);
        $stmt->bindParam(':can_be_running', $canBeRunning);
        $stmt->bindParam(':last_activity', $lastActivity);
        $stmt->bindParam(':notes', $notes);
        $stmt->bindParam(':raw_data', $rawData);
        $stmt->bindParam(':created_at', $createdAt);
        $stmt->bindParam(':updated_at', $updatedAt);
        
        $stmt->execute();
        
        error_log("Profile synced: $profileId");
        
        // Sync profile-folder relationships to junction table
        if (!empty($allFolderIds)) {
            $this->syncProfileFolders($profileId, $allFolderIds);
        }
    }
    
    /**
     * Sync profile folders to junction table
     */
    private function syncProfileFolders($profileId, $folderIds) {
        try {
            // First, remove all existing folder associations for this profile
            $deleteSql = "DELETE FROM gologin_profile_folders WHERE profile_id = :profile_id";
            $deleteStmt = $this->conn->prepare($deleteSql);
            $deleteStmt->bindParam(':profile_id', $profileId);
            $deleteStmt->execute();
            
            // Then, insert new folder associations
            $insertSql = "INSERT IGNORE INTO gologin_profile_folders (profile_id, folder_id) VALUES (:profile_id, :folder_id)";
            $insertStmt = $this->conn->prepare($insertSql);
            
            foreach ($folderIds as $folderId) {
                $insertStmt->bindParam(':profile_id', $profileId);
                $insertStmt->bindParam(':folder_id', $folderId);
                $insertStmt->execute();
            }
            
            error_log("Synced " . count($folderIds) . " folder(s) for profile $profileId to junction table");
        } catch (Exception $e) {
            error_log("Error syncing profile folders to junction table: " . $e->getMessage());
        }
    }

    /**
     * Start sync log entry
     */
    private function startSyncLog($syncType) {
        $sql = "INSERT INTO gologin_sync_log (sync_type, status, started_at)
                VALUES (:sync_type, 'started', NOW())";
        
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':sync_type', $syncType);
        $stmt->execute();
        
        return $this->conn->lastInsertId();
    }

    /**
     * Delete profiles from DB that no longer exist on GoLogin
     */
    private function deleteRemovedProfiles($gologinProfileIds) {
        try {
            if (empty($gologinProfileIds)) {
                // If no profiles from GoLogin, don't delete anything (safety check)
                return 0;
            }

            // Build placeholders for IN clause
            $placeholders = implode(',', array_fill(0, count($gologinProfileIds), '?'));
            
            // Delete profiles that are NOT in the GoLogin list
            $sql = "DELETE FROM gologin_profiles 
                    WHERE profile_id NOT IN ($placeholders)";
            
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($gologinProfileIds);
            
            $deletedCount = $stmt->rowCount();
            if ($deletedCount > 0) {
                error_log("Deleted $deletedCount profiles that no longer exist on GoLogin");
            }
            
            return $deletedCount;
        } catch (Exception $e) {
            error_log("Error deleting removed profiles: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Delete folders from DB that no longer exist on GoLogin
     */
    private function deleteRemovedFolders($gologinFolderIds) {
        try {
            if (empty($gologinFolderIds)) {
                // If no folders from GoLogin, don't delete anything (safety check)
                return 0;
            }

            // Build placeholders for IN clause
            $placeholders = implode(',', array_fill(0, count($gologinFolderIds), '?'));
            
            // Delete folders that are NOT in the GoLogin list
            $sql = "DELETE FROM gologin_folders 
                    WHERE folder_id NOT IN ($placeholders)";
            
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($gologinFolderIds);
            
            $deletedCount = $stmt->rowCount();
            if ($deletedCount > 0) {
                error_log("Deleted $deletedCount folders that no longer exist on GoLogin");
            }
            
            return $deletedCount;
        } catch (Exception $e) {
            error_log("Error deleting removed folders: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Get last sync status
     */
    public function getLastSyncStatus() {
        $sql = "SELECT * FROM gologin_sync_log 
                ORDER BY started_at DESC 
                LIMIT 1";
        
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}
?>
