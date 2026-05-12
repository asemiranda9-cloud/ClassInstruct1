-- =====================================================
-- Safe Multi-User Migration (No Data Loss)
-- Run this in phpMyAdmin on InfinityFree
-- =====================================================

-- Helper: add column only if it doesn't exist
DROP PROCEDURE IF EXISTS add_col;
DELIMITER $$
CREATE PROCEDURE add_col(IN tbl VARCHAR(100), IN col VARCHAR(100), IN col_def TEXT)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = tbl
          AND COLUMN_NAME  = col
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', col_def);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

-- Helper: add index only if it doesn't exist
DROP PROCEDURE IF EXISTS add_idx;
DELIMITER $$
CREATE PROCEDURE add_idx(IN tbl VARCHAR(100), IN idx VARCHAR(100), IN col VARCHAR(100))
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = tbl
          AND INDEX_NAME   = idx
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD INDEX `', idx, '` (', col, ')');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

-- =====================================================
-- 1. Add missing columns to users table (for OTP login)
-- =====================================================
CALL add_col('users', 'is_active', 'TINYINT(1) DEFAULT 1');
CALL add_col('users', 'login_attempts', 'INT DEFAULT 0');
CALL add_col('users', 'lockout_until', 'DATETIME DEFAULT NULL');
CALL add_col('users', 'perm_locked', 'TINYINT(1) DEFAULT 0');

-- =====================================================
-- 2. Add user_id to EXISTING students table
-- =====================================================
CALL add_col('students', 'user_id', 'INT NOT NULL DEFAULT 1');
CALL add_idx('students', 'idx_user_id', 'user_id');

-- Update existing students to user_id = 1
UPDATE students SET user_id = 1 WHERE user_id IS NULL OR user_id = 0;

-- =====================================================
-- 3. Create sections table
-- =====================================================
CREATE TABLE IF NOT EXISTS sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL DEFAULT 1,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    UNIQUE KEY unique_user_section (user_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 4. Create subjects table
-- =====================================================
CREATE TABLE IF NOT EXISTS subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL DEFAULT 1,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20),
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 5. Create grade_weights table
-- =====================================================
CREATE TABLE IF NOT EXISTS grade_weights (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL DEFAULT 1,
    subject VARCHAR(100) NOT NULL DEFAULT '__default__',
    written_works_pct INT DEFAULT 30,
    performance_tasks_pct INT DEFAULT 50,
    quarterly_assessment_pct INT DEFAULT 20,
    INDEX idx_user_id (user_id),
    UNIQUE KEY unique_user_subject (user_id, subject)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO grade_weights (user_id, subject, written_works_pct, performance_tasks_pct, quarterly_assessment_pct)
VALUES (1, '__default__', 30, 50, 20);

-- =====================================================
-- 6. Create gpa_scales table
-- =====================================================
CREATE TABLE IF NOT EXISTS gpa_scales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL DEFAULT 1,
    scale_name VARCHAR(100) NOT NULL DEFAULT 'Default',
    min_grade DECIMAL(5,2) NOT NULL,
    max_grade DECIMAL(5,2) NOT NULL,
    gpa_value DECIMAL(4,2) NOT NULL,
    letter_grade VARCHAR(5),
    descriptor VARCHAR(100),
    sort_order INT DEFAULT 0,
    INDEX idx_user_id (user_id),
    UNIQUE KEY unique_user_range (user_id, min_grade, max_grade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO gpa_scales (user_id, scale_name, min_grade, max_grade, gpa_value, letter_grade, descriptor, sort_order) VALUES
(1, 'DepEd Default', 90, 100, 1.00, 'A', 'Outstanding', 1),
(1, 'DepEd Default', 85, 89.99, 1.50, 'B+', 'Very Satisfactory', 2),
(1, 'DepEd Default', 80, 84.99, 2.00, 'B', 'Satisfactory', 3),
(1, 'DepEd Default', 75, 79.99, 2.50, 'C', 'Fairly Satisfactory', 4),
(1, 'DepEd Default', 0, 74.99, 5.00, 'F', 'Did Not Meet', 5);

-- =====================================================
-- 7. Create subject_grades table
-- =====================================================
CREATE TABLE IF NOT EXISTS subject_grades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL DEFAULT 1,
    subject_id INT NOT NULL,
    grade_level VARCHAR(20) NOT NULL,
    INDEX idx_user_id (user_id),
    UNIQUE KEY unique_user_subj_grade (user_id, subject_id, grade_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 8. Create grades table
-- =====================================================
CREATE TABLE IF NOT EXISTS grades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL DEFAULT 1,
    student_id INT NOT NULL,
    subject VARCHAR(100) NOT NULL,
    quarter VARCHAR(10) NOT NULL DEFAULT 'Q1',
    written_works DECIMAL(5,2) DEFAULT NULL,
    performance_tasks DECIMAL(5,2) DEFAULT NULL,
    quarterly_assessment DECIMAL(5,2) DEFAULT NULL,
    attendance DECIMAL(5,2) DEFAULT NULL,
    final_grade DECIMAL(5,2) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    UNIQUE KEY unique_user_grade (user_id, student_id, subject, quarter)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 9. Create grade_item_scores table
-- =====================================================
CREATE TABLE IF NOT EXISTS grade_item_scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL DEFAULT 1,
    student_id INT NOT NULL,
    subject VARCHAR(100) NOT NULL,
    quarter VARCHAR(10) NOT NULL,
    component_key VARCHAR(10) NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    item_max_score DECIMAL(5,2) DEFAULT 100,
    score DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    UNIQUE KEY unique_user_item_score (user_id, student_id, subject, quarter, component_key, item_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 10. Create attendance table
-- =====================================================
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL DEFAULT 1,
    student_id INT NOT NULL,
    date DATE NOT NULL,
    status ENUM('present', 'late', 'absent') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    UNIQUE KEY unique_user_attendance (user_id, student_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 11. Create school_calendar table
-- =====================================================
CREATE TABLE IF NOT EXISTS school_calendar (
    date DATE PRIMARY KEY,
    is_school_day TINYINT(1) NOT NULL DEFAULT 1,
    quarter VARCHAR(3) NOT NULL DEFAULT '',
    holiday_name VARCHAR(255) NOT NULL DEFAULT '',
    INDEX idx_is_school_day (is_school_day),
    INDEX idx_quarter (quarter)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- Cleanup
-- =====================================================
DROP PROCEDURE IF EXISTS add_col;
DROP PROCEDURE IF EXISTS add_idx;