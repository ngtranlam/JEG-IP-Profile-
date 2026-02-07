-- Final migration script to fix users.id to AUTO_INCREMENT
-- Handle foreign key from sessions table

-- Step 1: Delete UUID users
DELETE FROM users WHERE id LIKE '%-%';

-- Step 2: Drop foreign key from sessions table
ALTER TABLE sessions DROP FOREIGN KEY sessions_ibfk_1;

-- Step 3: Alter users.id to INT AUTO_INCREMENT
ALTER TABLE users MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;

-- Step 4: Alter sessions.user_id to INT to match
ALTER TABLE sessions MODIFY COLUMN user_id INT NOT NULL;

-- Step 5: Recreate foreign key
ALTER TABLE sessions 
ADD CONSTRAINT sessions_ibfk_1 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 6: Get max ID to set AUTO_INCREMENT
SELECT MAX(id) as max_id FROM users;

-- Step 7: Set AUTO_INCREMENT (replace 62 with MAX(id) + 1 from Step 6)
-- If max_id is 61, use 62. If max_id is 58, use 59, etc.
ALTER TABLE users AUTO_INCREMENT = 62;

-- Step 8: Verify the change
DESCRIBE users;
DESCRIBE sessions;
SELECT id, userName, fullName, requirePasswordChange FROM users ORDER BY id DESC LIMIT 5;
