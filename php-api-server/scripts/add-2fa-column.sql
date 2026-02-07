-- Add 2FA support to users table

-- Add is2FAEnabled column
ALTER TABLE users ADD COLUMN is2FAEnabled TINYINT(1) DEFAULT 0 AFTER requirePasswordChange;

-- Verify the change
DESCRIBE users;
