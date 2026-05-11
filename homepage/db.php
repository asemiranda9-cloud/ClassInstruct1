<?php
declare(strict_types=1);

/**
 * db.php — Shared MySQLi connection for ClassInstruct auth
 * (send_otp.php, verify_otp.php, register_otp.php, etc.)
 */

require_once __DIR__ . '/config.php';

error_reporting(0);
ini_set('display_errors', '0');

if (!defined('DB_HOST')) define('DB_HOST', env('DB_HOST', 'localhost'));
if (!defined('DB_USER')) define('DB_USER', env('DB_USER', 'root'));
if (!defined('DB_PASS')) define('DB_PASS', env('DB_PASS', ''));
if (!defined('DB_NAME')) define('DB_NAME', env('DB_NAME', 'classinstructdb'));

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