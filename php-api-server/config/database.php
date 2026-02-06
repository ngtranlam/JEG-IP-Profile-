<?php
class Database {
    private $host;
    private $db_name;
    private $username;
    private $password;
    private $conn;

    public function __construct() {
        $this->host = $_ENV['DB_HOST'] ?? '127.0.0.1';
        $this->db_name = $_ENV['DB_NAME'] ?? '';
        $this->username = $_ENV['DB_USERNAME'] ?? '';
        $this->password = $_ENV['DB_PASSWORD'] ?? '';
    }

    public function getConnection() {
        $this->conn = null;

        try {
            $this->conn = new PDO(
                "mysql:host=" . $this->host . ";dbname=" . $this->db_name,
                $this->username,
                $this->password
            );
            $this->conn->exec("set names utf8");
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        } catch(PDOException $exception) {
            error_log("Connection error: " . $exception->getMessage());
            throw new Exception("Database connection failed");
        }

        return $this->conn;
    }

    public function createTables() {
        $sql_profiles = "
            CREATE TABLE IF NOT EXISTS profiles (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                proxy TEXT,
                user_data_dir TEXT NOT NULL,
                fingerprint TEXT NOT NULL,
                status ENUM('active', 'suspended', 'archived') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                last_used TIMESTAMP NULL
            )
        ";

        $sql_proxies = "
            CREATE TABLE IF NOT EXISTS proxies (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                type ENUM('http', 'https', 'socks4', 'socks5') NOT NULL,
                host VARCHAR(255) NOT NULL,
                port INT NOT NULL,
                username VARCHAR(255),
                password TEXT,
                change_ip_url TEXT,
                current_ip VARCHAR(45),
                country VARCHAR(100),
                city VARCHAR(100),
                timezone VARCHAR(100),
                isp VARCHAR(255),
                status ENUM('active', 'inactive', 'error') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                last_checked TIMESTAMP NULL
            )
        ";

        try {
            $this->conn->exec($sql_profiles);
            $this->conn->exec($sql_proxies);
            return true;
        } catch(PDOException $exception) {
            error_log("Table creation error: " . $exception->getMessage());
            return false;
        }
    }
}
?>
