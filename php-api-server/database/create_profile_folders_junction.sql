-- Create junction table for many-to-many relationship between profiles and folders
-- This allows one profile to belong to multiple folders

CREATE TABLE IF NOT EXISTS `gologin_profile_folders` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `profile_id` VARCHAR(255) NOT NULL,
  `folder_id` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_profile_folder` (`profile_id`, `folder_id`),
  KEY `idx_profile_id` (`profile_id`),
  KEY `idx_folder_id` (`folder_id`),
  CONSTRAINT `fk_pf_profile` FOREIGN KEY (`profile_id`) REFERENCES `gologin_profiles` (`profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pf_folder` FOREIGN KEY (`folder_id`) REFERENCES `gologin_folders` (`folder_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add index for better query performance
CREATE INDEX `idx_created_at` ON `gologin_profile_folders` (`created_at`);
