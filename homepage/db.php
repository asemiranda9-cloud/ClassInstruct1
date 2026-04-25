<?php
declare(strict_types=1);

/**
 * db.php — Shared MySQLi connection for ClassInstruct auth
 * (send_otp.php, verify_otp.php, register_otp.php, etc.)
 */

error_reporting(0);
ini_set('display_errors', '0');

// Hard-coded credentials — change these to match your Laragon MySQL
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'classinstructdb');

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($conn->connect_error) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error'   => 'Database connection failed. Please try again later.',
    ]);
    exit;
}

$conn->set_charset('utf8mb4');