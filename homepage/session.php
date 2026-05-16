<?php
/**
 * session.php — User Session Management
 * Place in: homepage/session.php
 */

// Use shared session with dashboard
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_path', '/');
    session_name('CI_SESSION');
    session_start();
}

function requireLogin() {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Unauthorized. Please login.']);
        exit;
    }
    return $_SESSION['user_id'];
}

function isLoggedIn() {
    return isset($_SESSION['user_id']);
}

function getUserId() {
    return $_SESSION['user_id'] ?? null;
}

function loginUser($userId, $email, $fullName) {
    $_SESSION['user_id'] = $userId;
    $_SESSION['user_email'] = $email;
    $_SESSION['user_name'] = $fullName;
    $_SESSION['login_time'] = time();
}

function logoutUser() {
    session_unset();
    session_destroy();
}