-- Fix users table ID to use AUTO_INCREMENT instead of VARCHAR UUID
-- This allows new users to have numeric IDs like existing users

-- IMPORTANT: Run this script carefully and backup your data first!

-- Step 1: Check current table structure
DESCRIBE users;

-- Step 1.5: Find foreign key constraint name
SELECT 
    CONSTRAINT_NAME, 
    TABLE_NAME, 
    COLUMN_NAME, 
    REFERENCED_TABLE_NAME, 
    REFERENCED_COLUMN_NAME
FROM 
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE 
    REFERENCED_TABLE_NAME = 'users' 
    AND TABLE_SCHEMA = 'gryjeqlb_lgprofiles';

-- Step 2: Delete any users with UUID format IDs (created with new code)
-- These will need to be recreated after fixing the schema
DELETE FROM users WHERE id LIKE '%-%';

-- Step 3: Drop foreign key constraint from gologin_profile_permissions
-- Replace 'CONSTRAINT_NAME_HERE' with the actual constraint name from Step 1.5
-- ALTER TABLE gologin_profile_permissions DROP FOREIGN KEY CONSTRAINT_NAME_HERE;

-- Step 4: Alter the id column to INT AUTO_INCREMENT in users table
-- This assumes all remaining IDs are numeric strings that can be converted to INT
ALTER TABLE users MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;

-- Step 5: Alter the user_id column in gologin_profile_permissions to match
ALTER TABLE gologin_profile_permissions MODIFY COLUMN user_id INT NOT NULL;

-- Step 6: Recreate the foreign key constraint
ALTER TABLE gologin_profile_permissions 
ADD CONSTRAINT fk_permissions_user 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 7: Set AUTO_INCREMENT to start after the highest existing ID
-- Find the max ID first
SELECT MAX(id) as max_id FROM users;

-- Then set AUTO_INCREMENT (replace <max_id+1> with actual value)
-- Example: If max_id is 61, run: ALTER TABLE users AUTO_INCREMENT = 62;
ALTER TABLE users AUTO_INCREMENT = 62;

-- Step 8: Verify the change
DESCRIBE users;
DESCRIBE gologin_profile_permissions;
SELECT * FROM users ORDER BY id DESC LIMIT 5;
