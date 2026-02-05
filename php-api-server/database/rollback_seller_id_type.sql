-- Rollback: Revert seller_id column type from VARCHAR(36) back to INT(11)
-- WARNING: This will only work if all current seller_id values are numeric or NULL
-- If you have UUID values in seller_id, this rollback will fail or lose data

-- Step 1: Check and drop foreign key constraint if exists
SET @constraint_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'gologin_folders' 
    AND CONSTRAINT_NAME = 'fk_folder_seller'
);

SET @drop_fk = IF(@constraint_exists > 0, 
    'ALTER TABLE `gologin_folders` DROP FOREIGN KEY `fk_folder_seller`', 
    'SELECT "Foreign key does not exist, skipping..."'
);
PREPARE stmt FROM @drop_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Drop index if exists
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'gologin_folders' 
    AND INDEX_NAME = 'idx_seller_id'
);

SET @drop_idx = IF(@index_exists > 0, 
    'ALTER TABLE `gologin_folders` DROP INDEX `idx_seller_id`', 
    'SELECT "Index does not exist, skipping..."'
);
PREPARE stmt FROM @drop_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 3: Change seller_id column type from VARCHAR(36) back to INT(11)
-- WARNING: This will fail if there are UUID values in seller_id
ALTER TABLE `gologin_folders` 
MODIFY COLUMN `seller_id` INT(11) NULL DEFAULT NULL COMMENT 'ID of seller assigned to this folder. NULL means accessible to all admins.';

-- Step 4: Add index back
ALTER TABLE `gologin_folders` 
ADD INDEX `idx_seller_id` (`seller_id`);

-- Step 5: Add foreign key constraint back
-- Note: This assumes users.id is also INT(11) after rollback
ALTER TABLE `gologin_folders` 
ADD CONSTRAINT `fk_folder_seller` 
FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`)
ON DELETE SET NULL
ON UPDATE CASCADE;
