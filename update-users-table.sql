-- Add missing columns to users table if they don't exist
-- Run this in phpMyAdmin

-- Add is_active if missing
ALTER TABLE users ADD COLUMN is_active TINYINT(1) DEFAULT 1;
ALTER TABLE users ADD COLUMN login_attempts TINYINT(1) DEFAULT 0;
ALTER TABLE users ADD COLUMN lockout_until DATETIME DEFAULT NULL;
ALTER TABLE users ADD COLUMN perm_locked TINYINT(1) DEFAULT 0;
ALTER TABLE users ADD COLUMN unlock_token VARCHAR(64) NULL;
ALTER TABLE users ADD COLUMN unlock_token_expiry DATETIME NULL;
ALTER TABLE users ADD COLUMN google_picture VARCHAR(500) NULL;
ALTER TABLE users ADD COLUMN auth_method ENUM('otp_register') DEFAULT 'otp_register';
ALTER TABLE users ADD COLUMN is_verified TINYINT(1) DEFAULT 1;
ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL;