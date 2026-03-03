-- Migration script to add profile-folder many-to-many relationship
-- Run this on production database to enable multi-folder support for profiles

-- Step 1: Create junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS `gologin_profile_folders` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `profile_id` VARCHAR(255) NOT NULL,
  `folder_id` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_profile_folder` (`profile_id`, `folder_id`),
  KEY `idx_profile_id` (`profile_id`),
  KEY `idx_folder_id` (`folder_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_pf_profile` FOREIGN KEY (`profile_id`) REFERENCES `gologin_profiles` (`profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pf_folder` FOREIGN KEY (`folder_id`) REFERENCES `gologin_folders` (`folder_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Migrate existing profile-folder relationships from gologin_profiles.folder_id
-- This will populate the junction table with existing one-to-one relationships
INSERT IGNORE INTO `gologin_profile_folders` (`profile_id`, `folder_id`)
SELECT `profile_id`, `folder_id`
FROM `gologin_profiles`
WHERE `folder_id` IS NOT NULL AND `folder_id` != '';

-- Step 3: Verify migration
-- Check how many relationships were migrated
SELECT 
    COUNT(*) as total_relationships,
    COUNT(DISTINCT profile_id) as unique_profiles,
    COUNT(DISTINCT folder_id) as unique_folders
FROM `gologin_profile_folders`;

-- Note: The folder_id column in gologin_profiles table is kept for backward compatibility
-- and will continue to be used for the "primary" folder display
-- The new junction table allows profiles to belong to multiple folders simultaneously
