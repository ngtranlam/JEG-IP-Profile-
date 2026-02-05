<?php
require_once __DIR__ . '/../config/database.php';

class ProfileService {
    private $db;
    private $conn;

    public function __construct() {
        $this->db = new Database();
        $this->conn = $this->db->getConnection();
    }

    public function createProfile($profileData) {
        $id = $this->generateUUID();
        $now = date('Y-m-d H:i:s');
        
        $sql = "INSERT INTO profiles (id, name, proxy, user_data_dir, fingerprint, status, created_at, updated_at, last_used) 
                VALUES (:id, :name, :proxy, :user_data_dir, :fingerprint, :status, :created_at, :updated_at, :last_used)";
        
        $stmt = $this->conn->prepare($sql);
        
        $proxy = isset($profileData['proxy']) ? json_encode($profileData['proxy']) : null;
        $fingerprint = json_encode($profileData['fingerprint'] ?? $this->generateFingerprint());
        $userDataDir = '/profiles/' . $id; // Virtual path for server
        
        $stmt->bindParam(':id', $id);
        $stmt->bindParam(':name', $profileData['name']);
        $stmt->bindParam(':proxy', $proxy);
        $stmt->bindParam(':user_data_dir', $userDataDir);
        $stmt->bindParam(':fingerprint', $fingerprint);
        $stmt->bindParam(':status', $profileData['status'] ?? 'active');
        $stmt->bindParam(':created_at', $now);
        $stmt->bindParam(':updated_at', $now);
        $stmt->bindParam(':last_used', $profileData['last_used'] ?? null);
        
        if ($stmt->execute()) {
            return $this->getProfile($id);
        }
        
        throw new Exception("Failed to create profile");
    }

    public function updateProfile($id, $updates) {
        $existingProfile = $this->getProfile($id);
        if (!$existingProfile) {
            throw new Exception("Profile with id $id not found");
        }

        $setClause = [];
        $params = [':id' => $id, ':updated_at' => date('Y-m-d H:i:s')];
        
        $allowedFields = ['name', 'proxy', 'fingerprint', 'status', 'last_used'];
        
        foreach ($allowedFields as $field) {
            if (isset($updates[$field])) {
                $setClause[] = "$field = :$field";
                if ($field === 'proxy' || $field === 'fingerprint') {
                    $params[":$field"] = json_encode($updates[$field]);
                } else {
                    $params[":$field"] = $updates[$field];
                }
            }
        }
        
        if (empty($setClause)) {
            return $existingProfile;
        }
        
        $sql = "UPDATE profiles SET " . implode(', ', $setClause) . ", updated_at = :updated_at WHERE id = :id";
        $stmt = $this->conn->prepare($sql);
        
        if ($stmt->execute($params)) {
            return $this->getProfile($id);
        }
        
        throw new Exception("Failed to update profile");
    }

    public function deleteProfile($id) {
        $profile = $this->getProfile($id);
        if (!$profile) {
            throw new Exception("Profile with id $id not found");
        }

        $sql = "DELETE FROM profiles WHERE id = :id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':id', $id);
        
        if (!$stmt->execute()) {
            throw new Exception("Failed to delete profile");
        }
        
        return true;
    }

    public function getProfile($id) {
        $sql = "SELECT * FROM profiles WHERE id = :id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$row) {
            return null;
        }
        
        return $this->formatProfile($row);
    }

    public function listProfiles() {
        $sql = "SELECT * FROM profiles ORDER BY created_at DESC";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        
        $profiles = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $profiles[] = $this->formatProfile($row);
        }
        
        return $profiles;
    }

    public function updateLastUsed($id) {
        $sql = "UPDATE profiles SET last_used = :now, updated_at = :now WHERE id = :id";
        $stmt = $this->conn->prepare($sql);
        $now = date('Y-m-d H:i:s');
        $stmt->bindParam(':now', $now);
        $stmt->bindParam(':id', $id);
        
        return $stmt->execute();
    }

    private function formatProfile($row) {
        return [
            'id' => $row['id'],
            'name' => $row['name'],
            'proxy' => $row['proxy'] ? json_decode($row['proxy'], true) : null,
            'user_data_dir' => $row['user_data_dir'],
            'fingerprint' => json_decode($row['fingerprint'], true),
            'status' => $row['status'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
            'last_used' => $row['last_used']
        ];
    }

    private function generateUUID() {
        return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }

    private function generateFingerprint() {
        // Basic fingerprint generation - you can enhance this
        return [
            'userAgent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'viewport' => ['width' => 1920, 'height' => 1080],
            'screen' => ['width' => 1920, 'height' => 1080],
            'timezone' => 'America/New_York',
            'language' => 'en-US',
            'platform' => 'Win32'
        ];
    }
}
?>
