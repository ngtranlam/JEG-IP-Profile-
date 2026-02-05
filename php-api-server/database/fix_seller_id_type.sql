-- Fix seller_id column type to match users.id (VARCHAR(36))
-- This fixes the issue where newly created users with UUID cannot be assigned to folders

-- Drop foreign key constraint first
ALTER TABLE `gologin_folders`
DROP FOREIGN KEY IF EXISTS `fk_folder_seller`;

-- Drop index
ALTER TABLE `gologin_folders`
DROP INDEX IF EXISTS `idx_seller_id`;

-- Change seller_id column type from INT to VARCHAR(36)
ALTER TABLE `gologin_folders` 
MODIFY COLUMN `seller_id` VARCHAR(36) NULL DEFAULT NULL COMMENT 'ID of seller assigned to this folder. NULL means accessible to all admins.';

-- Add index back
ALTER TABLE `gologin_folders`
ADD INDEX `idx_seller_id` (`seller_id`);

-- Add foreign key constraint back with correct type
ALTER TABLE `gologin_folders`
ADD CONSTRAINT `fk_folder_seller`
FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`)
ON DELETE SET NULL
ON UPDATE CASCADE;
