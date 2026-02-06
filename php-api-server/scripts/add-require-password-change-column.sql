-- Add requirePasswordChange column to users table
ALTER TABLE users ADD COLUMN requirePasswordChange TINYINT(1) DEFAULT 1 AFTER status;

-- Set requirePasswordChange to 1 for all existing users
UPDATE users SET requirePasswordChange = 1;
