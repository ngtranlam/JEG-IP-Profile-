-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    userName VARCHAR(255) NOT NULL UNIQUE,
    fullName VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    password VARCHAR(255) NOT NULL,
    roles VARCHAR(10) NOT NULL,
    status VARCHAR(10) DEFAULT '1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_userName (userName),
    INDEX idx_email (email),
    INDEX idx_roles (roles)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
