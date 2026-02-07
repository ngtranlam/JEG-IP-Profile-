-- Simplified migration script to fix users.id to AUTO_INCREMENT
-- This script handles foreign keys automatically

-- Step 1: Delete UUID users
DELETE FROM users WHERE id LIKE '%-%';

-- Step 2: Find and show all foreign keys referencing users table
-- Run this first to see what constraints exist
SELECT 
    CONSTRAINT_NAME, 
    TABLE_NAME
FROM 
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE 
    REFERENCED_TABLE_NAME = 'users' 
    AND TABLE_SCHEMA = DATABASE();

-- Step 3: Drop foreign keys (uncomment after seeing constraint names above)
-- Example:
-- ALTER TABLE gologin_profile_permissions DROP FOREIGN KEY gologin_profile_permissions_ibfk_1;

-- Step 4: Alter users.id to INT AUTO_INCREMENT
-- ALTER TABLE users MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;

-- Step 5: Alter related tables' user_id columns
-- ALTER TABLE gologin_profile_permissions MODIFY COLUMN user_id INT NOT NULL;

-- Step 6: Recreate foreign keys
-- ALTER TABLE gologin_profile_permissions 
-- ADD CONSTRAINT fk_permissions_user 
-- FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 7: Set AUTO_INCREMENT value
-- SELECT MAX(id) FROM users;
-- ALTER TABLE users AUTO_INCREMENT = 62;  -- Replace with MAX(id) + 1

-- Step 8: Verify
-- DESCRIBE users;
-- SELECT * FROM users ORDER BY id DESC LIMIT 5;
