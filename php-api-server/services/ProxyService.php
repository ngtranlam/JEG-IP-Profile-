<?php
require_once __DIR__ . '/../config/database.php';

class ProxyService {
    private $db;
    private $conn;

    public function __construct() {
        $this->db = new Database();
        $this->conn = $this->db->getConnection();
    }

    public function createProxy($proxyData) {
        $id = $this->generateUUID();
        $now = date('Y-m-d H:i:s');
        
        // Encrypt password if provided
        $encryptedPassword = null;
        if (!empty($proxyData['password'])) {
            $encryptedPassword = $this->encryptPassword($proxyData['password']);
        }
        
        $sql = "INSERT INTO proxies (id, name, type, host, port, username, password, change_ip_url, 
                current_ip, country, city, timezone, isp, status, created_at, updated_at, last_checked) 
                VALUES (:id, :name, :type, :host, :port, :username, :password, :change_ip_url, 
                :current_ip, :country, :city, :timezone, :isp, :status, :created_at, :updated_at, :last_checked)";
        
        $stmt = $this->conn->prepare($sql);
        
        $stmt->bindParam(':id', $id);
        $stmt->bindParam(':name', $proxyData['name']);
        $stmt->bindParam(':type', $proxyData['type']);
        $stmt->bindParam(':host', $proxyData['host']);
        $stmt->bindParam(':port', $proxyData['port']);
        $stmt->bindParam(':username', $proxyData['username'] ?? null);
        $stmt->bindParam(':password', $encryptedPassword);
        $stmt->bindParam(':change_ip_url', $proxyData['change_ip_url'] ?? null);
        $stmt->bindParam(':current_ip', $proxyData['current_ip'] ?? null);
        $stmt->bindParam(':country', $proxyData['country'] ?? null);
        $stmt->bindParam(':city', $proxyData['city'] ?? null);
        $stmt->bindParam(':timezone', $proxyData['timezone'] ?? null);
        $stmt->bindParam(':isp', $proxyData['isp'] ?? null);
        $stmt->bindParam(':status', $proxyData['status'] ?? 'active');
        $stmt->bindParam(':created_at', $now);
        $stmt->bindParam(':updated_at', $now);
        $stmt->bindParam(':last_checked', $proxyData['last_checked'] ?? null);
        
        if ($stmt->execute()) {
            return $this->getProxy($id);
        }
        
        throw new Exception("Failed to create proxy");
    }

    public function updateProxy($id, $updates) {
        $existingProxy = $this->getProxy($id);
        if (!$existingProxy) {
            throw new Exception("Proxy with id $id not found");
        }

        $setClause = [];
        $params = [':id' => $id, ':updated_at' => date('Y-m-d H:i:s')];
        
        $allowedFields = ['name', 'type', 'host', 'port', 'username', 'password', 'change_ip_url', 
                         'current_ip', 'country', 'city', 'timezone', 'isp', 'status', 'last_checked'];
        
        foreach ($allowedFields as $field) {
            if (isset($updates[$field])) {
                $setClause[] = "$field = :$field";
                if ($field === 'password' && !empty($updates[$field])) {
                    $params[":$field"] = $this->encryptPassword($updates[$field]);
                } else {
                    $params[":$field"] = $updates[$field];
                }
            }
        }
        
        if (empty($setClause)) {
            return $existingProxy;
        }
        
        $sql = "UPDATE proxies SET " . implode(', ', $setClause) . ", updated_at = :updated_at WHERE id = :id";
        $stmt = $this->conn->prepare($sql);
        
        if ($stmt->execute($params)) {
            return $this->getProxy($id);
        }
        
        throw new Exception("Failed to update proxy");
    }

    public function deleteProxy($id) {
        $proxy = $this->getProxy($id);
        if (!$proxy) {
            throw new Exception("Proxy with id $id not found");
        }

        // Check if any profiles are using this proxy
        $sql = "SELECT id, name FROM profiles WHERE JSON_EXTRACT(proxy, '$.id') = :proxy_id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':proxy_id', $id);
        $stmt->execute();
        
        $profilesUsingProxy = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (!empty($profilesUsingProxy)) {
            $profileNames = array_column($profilesUsingProxy, 'name');
            throw new Exception("Cannot delete proxy. It is being used by profiles: " . implode(', ', $profileNames));
        }

        $sql = "DELETE FROM proxies WHERE id = :id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':id', $id);
        
        if (!$stmt->execute()) {
            throw new Exception("Failed to delete proxy");
        }
        
        return true;
    }

    public function getProxy($id) {
        $sql = "SELECT * FROM proxies WHERE id = :id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$row) {
            return null;
        }
        
        return $this->formatProxy($row);
    }

    public function listProxies() {
        $sql = "SELECT * FROM proxies ORDER BY created_at DESC";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        
        $proxies = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $proxies[] = $this->formatProxy($row);
        }
        
        return $proxies;
    }

    public function validateProxy($id) {
        $proxy = $this->getProxy($id);
        if (!$proxy) {
            throw new Exception("Proxy with id $id not found");
        }

        $result = $this->testProxyConnection($proxy);
        
        // Update last_checked
        $sql = "UPDATE proxies SET last_checked = :now, updated_at = :now WHERE id = :id";
        $stmt = $this->conn->prepare($sql);
        $now = date('Y-m-d H:i:s');
        $stmt->bindParam(':now', $now);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        return $result;
    }

    public function rotateIP($id) {
        $proxy = $this->getProxy($id);
        if (!$proxy) {
            throw new Exception("Proxy with id $id not found");
        }

        if (empty($proxy['change_ip_url'])) {
            throw new Exception("Proxy does not have change IP URL configured");
        }

        // Call change IP URL
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $proxy['change_ip_url']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            throw new Exception("Failed to rotate IP. HTTP Code: $httpCode");
        }

        // Wait a bit for IP to change
        sleep(2);

        // Validate new IP
        return $this->validateProxy($id);
    }

    public function testProxyConfig($config) {
        $results = [];
        
        // Test different proxy types
        $types = ['http', 'socks5', 'socks4'];
        
        // Get location info once for the first successful connection
        $locationInfo = null;
        
        foreach ($types as $type) {
            $testProxy = array_merge($config, ['type' => $type]);
            $result = $this->testProxyConnection($testProxy, $locationInfo);
            
            // If this is the first successful connection, get location info
            if ($result['success'] && !$locationInfo && !empty($result['ip'])) {
                $locationInfo = $this->getLocationInfo($result['ip']);
                $result['country'] = $locationInfo['country'];
                $result['city'] = $locationInfo['city'];
            } elseif ($result['success'] && $locationInfo) {
                // Reuse location info for subsequent tests
                $result['country'] = $locationInfo['country'];
                $result['city'] = $locationInfo['city'];
            }
            
            $results[$type] = $result;
        }
        
        return $results;
    }

    private function getLocationInfo($ip) {
        try {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, "http://ip-api.com/json/$ip");
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 3);
            
            $response = curl_exec($ch);
            curl_close($ch);
            
            if ($response) {
                $data = json_decode($response, true);
                return [
                    'country' => $data['countryCode'] ?? null,
                    'city' => $data['city'] ?? null
                ];
            }
        } catch (Exception $e) {
            // Ignore location lookup errors
        }
        
        return ['country' => null, 'city' => null];
    }

    private function testProxyConnection($proxy, $skipLocation = false) {
        $startTime = microtime(true);
        
        try {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, 'http://httpbin.org/ip');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            
            // Set proxy
            if ($proxy['type'] === 'http' || $proxy['type'] === 'https') {
                curl_setopt($ch, CURLOPT_PROXY, $proxy['host'] . ':' . $proxy['port']);
                curl_setopt($ch, CURLOPT_PROXYTYPE, CURLPROXY_HTTP);
            } elseif ($proxy['type'] === 'socks5') {
                curl_setopt($ch, CURLOPT_PROXY, $proxy['host'] . ':' . $proxy['port']);
                curl_setopt($ch, CURLOPT_PROXYTYPE, CURLPROXY_SOCKS5);
            } elseif ($proxy['type'] === 'socks4') {
                curl_setopt($ch, CURLOPT_PROXY, $proxy['host'] . ':' . $proxy['port']);
                curl_setopt($ch, CURLOPT_PROXYTYPE, CURLPROXY_SOCKS4);
            }
            
            // Set auth if provided
            if (!empty($proxy['username']) && !empty($proxy['password'])) {
                // For test config, password is not encrypted yet (plain text)
                // Only decrypt if it looks like encrypted data (has encryption prefix or is from DB)
                $password = $proxy['password'];
                if (isset($proxy['id'])) {
                    // If proxy has ID, it's from DB and password is encrypted
                    $password = $this->decryptPassword($proxy['password']);
                }
                curl_setopt($ch, CURLOPT_PROXYUSERPWD, $proxy['username'] . ':' . $password);
            }
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);
            
            $endTime = microtime(true);
            $ping = round(($endTime - $startTime) * 1000);
            
            if ($response === false || !empty($error)) {
                return [
                    'success' => false,
                    'error' => $error ?: 'Connection failed',
                    'ping' => $ping
                ];
            }
            
            if ($httpCode !== 200) {
                return [
                    'success' => false,
                    'error' => "HTTP $httpCode",
                    'ping' => $ping
                ];
            }
            
            $data = json_decode($response, true);
            $ip = $data['origin'] ?? 'Unknown';
            
            return [
                'success' => true,
                'ip' => $ip,
                'ping' => $ping
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'ping' => 0
            ];
        }
    }

    private function formatProxy($row) {
        $proxy = [
            'id' => $row['id'],
            'name' => $row['name'],
            'type' => $row['type'],
            'host' => $row['host'],
            'port' => (int)$row['port'],
            'username' => $row['username'],
            'password' => $row['password'] ? $this->decryptPassword($row['password']) : null,
            'change_ip_url' => $row['change_ip_url'],
            'current_ip' => $row['current_ip'],
            'country' => $row['country'],
            'city' => $row['city'],
            'timezone' => $row['timezone'],
            'isp' => $row['isp'],
            'status' => $row['status'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
            'last_checked' => $row['last_checked']
        ];
        
        return $proxy;
    }

    private function encryptPassword($password) {
        $key = $_ENV['ENCRYPTION_KEY'] ?? 'default-key-change-this';
        return base64_encode(openssl_encrypt($password, 'AES-256-CBC', $key, 0, substr(hash('sha256', $key), 0, 16)));
    }

    private function decryptPassword($encryptedPassword) {
        $key = $_ENV['ENCRYPTION_KEY'] ?? 'default-key-change-this';
        return openssl_decrypt(base64_decode($encryptedPassword), 'AES-256-CBC', $key, 0, substr(hash('sha256', $key), 0, 16));
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
}
?>
