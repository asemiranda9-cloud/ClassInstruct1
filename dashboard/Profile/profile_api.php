<?php
// Profile API — Get and update user profile

require_once __DIR__ . '/../config.php';

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
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

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

if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_path', '/');
    session_name('CI_SESSION');
    session_start();
}

// Get user_id from session
$userId = null;
if (isset($_SESSION['ci_user']['user_id'])) {
    $userId = (int)$_SESSION['ci_user']['user_id'];
} elseif (isset($_SESSION['user_id'])) {
    $userId = (int)$_SESSION['user_id'];
}

// If no session, try to find by email
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

if (!$userId) {
    http_response_code(401);
    echo json_encode(['error' => 'Not logged in']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Return user profile
    $stmt = $conn->prepare("SELECT id, email, first_name, last_name, gender, role, created_at FROM users WHERE id = ?");
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
            'role'       => $row['role'] ?? 'teacher',
            'created_at' => $row['created_at'],
        ]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
    }
    $stmt->close();
}
elseif ($method === 'PUT' || $method === 'POST') {
    // Update user profile
    $data = json_decode(file_get_contents('php://input'), true);

    $firstName = trim($data['first_name'] ?? '');
    $lastName  = trim($data['last_name'] ?? '');
    $gender    = trim($data['gender'] ?? '');

    $stmt = $conn->prepare("UPDATE users SET first_name = ?, last_name = ?, gender = ? WHERE id = ?");
    $stmt->bind_param('sssi', $firstName, $lastName, $gender, $userId);

    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => $stmt->error]);
    }
    $stmt->close();
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();