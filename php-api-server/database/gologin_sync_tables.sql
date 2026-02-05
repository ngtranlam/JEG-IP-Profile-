-- SQL Script to create tables for GoLogin folders and profiles synchronization
-- Run this in phpMyAdmin to create the necessary tables

-- Table: gologin_folders
-- Stores folder data synced from GoLogin API
CREATE TABLE IF NOT EXISTS `gologin_folders` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `folder_id` VARCHAR(255) NOT NULL COMMENT 'GoLogin folder ID',
  `name` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  `synced_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last sync time from GoLogin API',
  PRIMARY KEY (`id`),
  UNIQUE KEY `folder_id` (`folder_id`),
  KEY `idx_name` (`name`),
  KEY `idx_synced_at` (`synced_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: gologin_profiles
-- Stores profile data synced from GoLogin API
CREATE TABLE IF NOT EXISTS `gologin_profiles` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `profile_id` VARCHAR(255) NOT NULL COMMENT 'GoLogin profile ID',
  `name` VARCHAR(255) NOT NULL,
  `folder_id` VARCHAR(255) DEFAULT NULL COMMENT 'GoLogin folder ID',
  `browser_type` VARCHAR(50) DEFAULT NULL,
  `os` VARCHAR(50) DEFAULT NULL,
  `user_agent` TEXT DEFAULT NULL,
  `screen_width` INT(11) DEFAULT NULL,
  `screen_height` INT(11) DEFAULT NULL,
  `proxy_enabled` TINYINT(1) DEFAULT 0,
  `proxy_type` VARCHAR(50) DEFAULT NULL,
  `proxy_host` VARCHAR(255) DEFAULT NULL,
  `proxy_port` INT(11) DEFAULT NULL,
  `proxy_username` VARCHAR(255) DEFAULT NULL,
  `status` VARCHAR(50) DEFAULT 'active' COMMENT 'active, running, stopped, deleted',
  `can_be_running` TINYINT(1) DEFAULT 1,
  `last_activity` TIMESTAMP NULL DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `raw_data` LONGTEXT DEFAULT NULL COMMENT 'Full JSON data from GoLogin API',
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  `synced_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last sync time from GoLogin API',
  PRIMARY KEY (`id`),
  UNIQUE KEY `profile_id` (`profile_id`),
  KEY `idx_folder_id` (`folder_id`),
  KEY `idx_name` (`name`),
  KEY `idx_status` (`status`),
  KEY `idx_synced_at` (`synced_at`),
  KEY `idx_last_activity` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: gologin_profile_permissions
-- Stores which sellers have access to which profiles/folders
CREATE TABLE IF NOT EXISTS `gologin_profile_permissions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL COMMENT 'User ID from users table',
  `folder_id` VARCHAR(255) DEFAULT NULL COMMENT 'GoLogin folder ID - if NULL, permission is for specific profile',
  `profile_id` VARCHAR(255) DEFAULT NULL COMMENT 'GoLogin profile ID - if NULL, permission is for entire folder',
  `permission_type` ENUM('view', 'edit', 'delete', 'use') NOT NULL DEFAULT 'view',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_folder_id` (`folder_id`),
  KEY `idx_profile_id` (`profile_id`),
  KEY `idx_permission_type` (`permission_type`),
  CONSTRAINT `fk_permissions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: gologin_sync_log
-- Tracks synchronization history and status
CREATE TABLE IF NOT EXISTS `gologin_sync_log` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `sync_type` ENUM('folders', 'profiles', 'full') NOT NULL,
  `status` ENUM('started', 'completed', 'failed') NOT NULL,
  `folders_synced` INT(11) DEFAULT 0,
  `profiles_synced` INT(11) DEFAULT 0,
  `errors` TEXT DEFAULT NULL,
  `started_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` TIMESTAMP NULL DEFAULT NULL,
  `duration_seconds` INT(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sync_type` (`sync_type`),
  KEY `idx_status` (`status`),
  KEY `idx_started_at` (`started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert initial sync log entry
INSERT INTO `gologin_sync_log` (`sync_type`, `status`, `started_at`) 
VALUES ('full', 'completed', NOW())
ON DUPLICATE KEY UPDATE `id` = `id`;
