<?php
require_once __DIR__ . '/../config/database.php';

class TeamService {
    private $db;
    private $conn;

    public function __construct() {
        $this->db = new Database();
        $this->conn = $this->db->getConnection();
        $this->ensureTablesExist();
    }

    private function ensureTablesExist() {
        try {
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS `teams` (
                    `id` INT(11) NOT NULL AUTO_INCREMENT,
                    `name` VARCHAR(255) NOT NULL,
                    `leader_id` INT(11) DEFAULT NULL,
                    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    KEY `idx_leader_id` (`leader_id`),
                    KEY `idx_name` (`name`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS `team_members` (
                    `id` INT(11) NOT NULL AUTO_INCREMENT,
                    `team_id` INT(11) NOT NULL,
                    `user_id` INT(11) NOT NULL,
                    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    UNIQUE KEY `unique_user_team` (`user_id`),
                    KEY `idx_team_id` (`team_id`),
                    KEY `idx_user_id` (`user_id`),
                    CONSTRAINT `fk_team_members_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_team_members_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS `team_member_folders` (
                    `id` INT(11) NOT NULL AUTO_INCREMENT,
                    `team_id` INT(11) NOT NULL,
                    `user_id` INT(11) NOT NULL,
                    `folder_id` VARCHAR(255) NOT NULL,
                    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    UNIQUE KEY `unique_member_folder` (`user_id`, `folder_id`),
                    KEY `idx_team_id` (`team_id`),
                    KEY `idx_user_id` (`user_id`),
                    KEY `idx_folder_id` (`folder_id`),
                    CONSTRAINT `fk_tmf_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_tmf_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        } catch (Exception $e) {
            // Tables might already exist with constraints, ignore
            error_log("TeamService table creation notice: " . $e->getMessage());
        }
    }

    /**
     * List all teams (admin) or teams where user is leader/member
     */
    public function getTeams($user) {
        $userRole = $user['roles'];
        $userId = $user['id'];

        if ($userRole === '1') {
            // Admin sees all teams
            $sql = "SELECT t.*, 
                    u.fullName as leaderName, u.userName as leaderUserName,
                    (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as memberCount
                    FROM teams t
                    LEFT JOIN users u ON t.leader_id = u.id
                    ORDER BY t.created_at DESC";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute();
        } else {
            // Leader/member sees only their team
            $sql = "SELECT t.*, 
                    u.fullName as leaderName, u.userName as leaderUserName,
                    (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as memberCount
                    FROM teams t
                    LEFT JOIN users u ON t.leader_id = u.id
                    WHERE t.leader_id = :userId
                    OR t.id IN (SELECT team_id FROM team_members WHERE user_id = :userId2)
                    ORDER BY t.created_at DESC";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(':userId', $userId);
            $stmt->bindParam(':userId2', $userId);
            $stmt->execute();
        }

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Create a new team
     */
    public function createTeam($name, $leaderId = null) {
        $sql = "INSERT INTO teams (name, leader_id) VALUES (:name, :leader_id)";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':name', $name);
        $stmt->bindParam(':leader_id', $leaderId);
        $stmt->execute();

        $teamId = $this->conn->lastInsertId();

        // If leader is set, also add them as a team member
        if ($leaderId) {
            $this->addMemberInternal($teamId, $leaderId);
            // Update user role to Leader if they are a Seller
            $this->promoteToLeader($leaderId);
        }

        return $this->getTeamById($teamId);
    }

    /**
     * Update a team
     */
    public function updateTeam($teamId, $data, $user) {
        $userRole = $user['roles'];
        $userId = $user['id'];

        // Check permission
        if ($userRole !== '1') {
            $team = $this->getTeamById($teamId);
            if (!$team || (int)$team['leader_id'] !== (int)$userId) {
                throw new Exception("You don't have permission to edit this team");
            }
            // Leader can only change name, not leader_id
            if (isset($data['leaderId'])) {
                throw new Exception("Only admin can change team leader");
            }
        }

        $updates = [];
        $params = [':id' => $teamId];

        if (isset($data['name'])) {
            $updates[] = "name = :name";
            $params[':name'] = $data['name'];
        }

        if (isset($data['leaderId']) && $userRole === '1') {
            $oldTeam = $this->getTeamById($teamId);
            $oldLeaderId = $oldTeam ? $oldTeam['leader_id'] : null;
            $newLeaderId = $data['leaderId'];

            $updates[] = "leader_id = :leader_id";
            $params[':leader_id'] = $newLeaderId;

            // Add new leader as member if not already
            if ($newLeaderId) {
                $this->addMemberInternal($teamId, $newLeaderId);
                $this->promoteToLeader($newLeaderId);
            }

            // Demote old leader to Seller if they're no longer leading any team
            if ($oldLeaderId && (int)$oldLeaderId !== (int)$newLeaderId) {
                $this->demoteIfNotLeading($oldLeaderId);
            }
        }

        if (empty($updates)) return;

        $sql = "UPDATE teams SET " . implode(', ', $updates) . " WHERE id = :id";
        $stmt = $this->conn->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
    }

    /**
     * Delete a team
     */
    public function deleteTeam($teamId) {
        $team = $this->getTeamById($teamId);
        $leaderId = $team ? $team['leader_id'] : null;

        $sql = "DELETE FROM teams WHERE id = :id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':id', $teamId);
        $stmt->execute();

        // Demote leader if they're no longer leading any team
        if ($leaderId) {
            $this->demoteIfNotLeading($leaderId);
        }
    }

    /**
     * Get team members
     */
    public function getMembers($teamId) {
        $team = $this->getTeamById($teamId);
        $leaderId = $team ? (int)$team['leader_id'] : 0;

        $sql = "SELECT tm.user_id as userId, u.userName, u.fullName, u.email, u.roles,
                CASE WHEN u.id = :leader_id THEN 1 ELSE 0 END as isLeader
                FROM team_members tm
                JOIN users u ON tm.user_id = u.id
                WHERE tm.team_id = :team_id
                ORDER BY isLeader DESC, u.fullName ASC";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':team_id', $teamId);
        $stmt->bindParam(':leader_id', $leaderId);
        $stmt->execute();

        $members = $stmt->fetchAll(PDO::FETCH_ASSOC);
        // Cast isLeader to boolean
        foreach ($members as &$m) {
            $m['isLeader'] = (bool)$m['isLeader'];
        }
        return $members;
    }

    /**
     * Add member to team
     */
    public function addMember($teamId, $userId, $user) {
        $userRole = $user['roles'];
        $currentUserId = $user['id'];

        // Check permission
        if ($userRole !== '1') {
            $team = $this->getTeamById($teamId);
            if (!$team || (int)$team['leader_id'] !== (int)$currentUserId) {
                throw new Exception("You don't have permission to manage this team");
            }
        }

        // Check if user is already in a team
        $checkSql = "SELECT tm.team_id, t.name as team_name FROM team_members tm 
                     JOIN teams t ON tm.team_id = t.id
                     WHERE tm.user_id = :user_id";
        $checkStmt = $this->conn->prepare($checkSql);
        $checkStmt->bindParam(':user_id', $userId);
        $checkStmt->execute();
        $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            throw new Exception("User is already in team: " . $existing['team_name']);
        }

        $this->addMemberInternal($teamId, $userId);
    }

    /**
     * Remove member from team
     */
    public function removeMember($teamId, $userId, $user) {
        $userRole = $user['roles'];
        $currentUserId = $user['id'];

        // Check permission
        if ($userRole !== '1') {
            $team = $this->getTeamById($teamId);
            if (!$team || (int)$team['leader_id'] !== (int)$currentUserId) {
                throw new Exception("You don't have permission to manage this team");
            }
            // Leader cannot remove themselves
            if ((int)$userId === (int)$currentUserId) {
                throw new Exception("Leader cannot remove themselves from the team");
            }
        }

        // Remove member's folder permissions first
        $delFolders = "DELETE FROM team_member_folders WHERE team_id = :team_id AND user_id = :user_id";
        $delStmt = $this->conn->prepare($delFolders);
        $delStmt->bindParam(':team_id', $teamId);
        $delStmt->bindParam(':user_id', $userId);
        $delStmt->execute();

        // Remove from team
        $sql = "DELETE FROM team_members WHERE team_id = :team_id AND user_id = :user_id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':team_id', $teamId);
        $stmt->bindParam(':user_id', $userId);
        $stmt->execute();

        // If removed user was the leader, clear the leader
        $team = $this->getTeamById($teamId);
        if ($team && (int)$team['leader_id'] === (int)$userId) {
            $clearLeader = "UPDATE teams SET leader_id = NULL WHERE id = :team_id";
            $clStmt = $this->conn->prepare($clearLeader);
            $clStmt->bindParam(':team_id', $teamId);
            $clStmt->execute();
            $this->demoteIfNotLeading($userId);
        }
    }

    /**
     * Get folders assigned to a team member
     */
    public function getMemberFolders($teamId, $userId) {
        $sql = "SELECT tmf.folder_id, f.name 
                FROM team_member_folders tmf
                JOIN gologin_folders f ON tmf.folder_id = f.folder_id
                WHERE tmf.team_id = :team_id AND tmf.user_id = :user_id
                ORDER BY f.name ASC";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':team_id', $teamId);
        $stmt->bindParam(':user_id', $userId);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Set folders for a team member (replace all)
     */
    public function setMemberFolders($teamId, $userId, $folderIds, $user) {
        $userRole = $user['roles'];
        $currentUserId = $user['id'];

        // Check permission
        if ($userRole !== '1') {
            $team = $this->getTeamById($teamId);
            if (!$team || (int)$team['leader_id'] !== (int)$currentUserId) {
                throw new Exception("You don't have permission to manage folder permissions");
            }
        }

        // Delete existing folder permissions
        $delSql = "DELETE FROM team_member_folders WHERE team_id = :team_id AND user_id = :user_id";
        $delStmt = $this->conn->prepare($delSql);
        $delStmt->bindParam(':team_id', $teamId);
        $delStmt->bindParam(':user_id', $userId);
        $delStmt->execute();

        // Insert new folder permissions
        if (!empty($folderIds)) {
            $sql = "INSERT INTO team_member_folders (team_id, user_id, folder_id) VALUES (:team_id, :user_id, :folder_id)";
            $stmt = $this->conn->prepare($sql);
            foreach ($folderIds as $folderId) {
                $stmt->bindParam(':team_id', $teamId);
                $stmt->bindParam(':user_id', $userId);
                $stmt->bindParam(':folder_id', $folderId);
                $stmt->execute();
            }
        }

        // Also update gologin_folders.seller_id for backward compatibility
        // This ensures the existing seller-based folder filtering works
        $this->syncFolderSellerAssignment($userId, $folderIds);
    }

    // ---- Internal helpers ----

    private function getTeamById($teamId) {
        $sql = "SELECT * FROM teams WHERE id = :id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':id', $teamId);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    private function addMemberInternal($teamId, $userId) {
        try {
            $sql = "INSERT IGNORE INTO team_members (team_id, user_id) VALUES (:team_id, :user_id)";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(':team_id', $teamId);
            $stmt->bindParam(':user_id', $userId);
            $stmt->execute();
        } catch (Exception $e) {
            // Might fail if user already in another team
            if (strpos($e->getMessage(), 'unique_user_team') !== false) {
                throw new Exception("User is already in another team");
            }
            throw $e;
        }
    }

    private function promoteToLeader($userId) {
        $sql = "UPDATE users SET roles = '2' WHERE id = :id AND roles = '3'";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':id', $userId);
        $stmt->execute();
    }

    private function demoteIfNotLeading($userId) {
        // Check if user is still a leader of any team
        $sql = "SELECT COUNT(*) as cnt FROM teams WHERE leader_id = :id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':id', $userId);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        if ((int)$result['cnt'] === 0) {
            // No longer leading any team, demote to Seller
            $sql2 = "UPDATE users SET roles = '3' WHERE id = :id AND roles = '2'";
            $stmt2 = $this->conn->prepare($sql2);
            $stmt2->bindParam(':id', $userId);
            $stmt2->execute();
        }
    }

    private function syncFolderSellerAssignment($userId, $folderIds) {
        // Remove user from folders not in the new list
        $removeSql = "UPDATE gologin_folders SET seller_id = NULL WHERE seller_id = :user_id";
        $params = [':user_id' => $userId];
        
        if (!empty($folderIds)) {
            $placeholders = [];
            foreach ($folderIds as $i => $fid) {
                $key = ':keep_fid_' . $i;
                $placeholders[] = $key;
                $params[$key] = $fid;
            }
            $removeSql .= " AND folder_id NOT IN (" . implode(',', $placeholders) . ")";
        }

        $removeStmt = $this->conn->prepare($removeSql);
        foreach ($params as $k => $v) {
            $removeStmt->bindValue($k, $v);
        }
        $removeStmt->execute();

        // Assign user to new folders
        foreach ($folderIds as $folderId) {
            $assignSql = "UPDATE gologin_folders SET seller_id = :user_id WHERE folder_id = :folder_id";
            $assignStmt = $this->conn->prepare($assignSql);
            $assignStmt->bindParam(':user_id', $userId);
            $assignStmt->bindParam(':folder_id', $folderId);
            $assignStmt->execute();
        }
    }
}
?>
