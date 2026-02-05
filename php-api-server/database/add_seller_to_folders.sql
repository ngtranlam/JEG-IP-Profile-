-- Add seller_id column to gologin_folders table
-- This allows assigning folders to specific sellers

ALTER TABLE `gologin_folders` 
ADD COLUMN `seller_id` INT(11) NULL DEFAULT NULL AFTER `name`,
ADD INDEX `idx_seller_id` (`seller_id`);

-- Add foreign key constraint to users table
ALTER TABLE `gologin_folders`
ADD CONSTRAINT `fk_folder_seller`
FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Optional: Add comment to explain the column
ALTER TABLE `gologin_folders` 
MODIFY COLUMN `seller_id` INT(11) NULL DEFAULT NULL COMMENT 'ID of seller assigned to this folder. NULL means accessible to all admins.';
