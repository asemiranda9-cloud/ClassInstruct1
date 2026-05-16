<?php
// api/user.php — Get current user info from database
// Uses shared session from homepage login

error_reporting(0);
ini_set('display_errors', 0);
while (ob_get_level()) ob_end_clean();
ob_start();

set_exception_handler(function($e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
});

register_shutdown_function(function() {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR])) {
        while (ob_get_level()) ob_end_clean();
        http_response_code(500);
        echo json_encode(['error' => $e['message']]);
    }
});

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// Load config for DB settings
require_once __DIR__ . '/../config.php';

if (!defined('DB_HOST')) define('DB_HOST', env('DB_HOST', '127.0.0.1'));
if (!defined('DB_PORT')) define('DB_PORT', env('DB_PORT', '3306'));
if (!defined('DB_USER')) define('DB_USER', env('DB_USER', 'root'));
if (!defined('DB_PASS')) define('DB_PASS', env('DB_PASS', ''));
if (!defined('DB_NAME')) define('DB_NAME', env('DB_NAME', 'classinstructdb'));

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, (int)DB_PORT);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}
$conn->set_charset('utf8mb4');

// Get user_id from session (shared with homepage)
$userId = null;
if (isset($_SESSION['ci_user']['user_id'])) {
    $userId = (int)$_SESSION['ci_user']['user_id'];
} elseif (isset($_SESSION['user_id'])) {
    $userId = (int)$_SESSION['user_id'];
}

// If no session user_id, try to find by email
if (!$userId && isset($_GET['email'])) {
    $email = trim($_GET['email']);
    $stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($row = $result->fetch_assoc()) {
        $userId = (int)$row['id'];
    }
    $stmt->close();
}

// Debug: check query param if no session
if (!$userId && isset($_GET['user_id'])) {
    $userId = (int)$_GET['user_id'];
}

if (!$userId) {
    http_response_code(401);
    echo json_encode(['error' => 'Not logged in']);
    exit;
}

// Fetch user from database
$stmt = $conn->prepare("SELECT id, email, first_name, last_name, gender FROM users WHERE id = ?");
$stmt->bind_param('i', $userId);
$stmt->execute();
$result = $stmt->get_result();

if ($row = $result->fetch_assoc()) {
    echo json_encode([
        'success'    => true,
        'user_id'    => (int)$row['id'],
        'email'      => $row['email'],
        'first_name' => $row['first_name'] ?? '',
        'last_name'  => $row['last_name'] ?? '',
        'gender'     => $row['gender'] ?? '',
    ]);
} else {
    http_response_code(404);
    echo json_encode(['error' => 'User not found']);
}

$stmt->close();
$conn->close();