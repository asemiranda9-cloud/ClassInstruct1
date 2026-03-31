USE classinstruct;

CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  date DATE NOT NULL,
  status ENUM('present', 'late', 'absent') NOT NULL,
  UNIQUE KEY unique_record (student_id, date),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  dob DATE,
  gender ENUM('Male', 'Female') NOT NULL,
  grade VARCHAR(50) NOT NULL,
  section VARCHAR(20) NOT NULL,
  enroll_date DATE,
  prev_school VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  father_name VARCHAR(255),
  father_phone VARCHAR(20),
  mother_name VARCHAR(255),
  mother_phone VARCHAR(20),
  guardian_name VARCHAR(255),
  guardian_relation VARCHAR(100),
  guardian_phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample data
INSERT IGNORE INTO students (student_id, full_name, dob, gender, grade, section, enroll_date, email, phone) VALUES
('LRN001', 'John Doe', '2012-05-15', 'Male', 'Grade 5', 'Section A', '2023-09-01', 'john@example.com', '+1234567890'),
('LRN002', 'Jane Smith', '2012-08-22', 'Female', 'Grade 5', 'Section B', '2023-09-01', 'jane@example.com', '+1234567891'),
('LRN003', 'Mike Johnson', '2012-03-10', 'Male', 'Grade 6', 'Section A', '2023-09-01', 'mike@example.com', '+1234567892');
