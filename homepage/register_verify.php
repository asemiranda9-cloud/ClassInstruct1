<?php
/**
 * register_verify.php
 * ClassInstruct — Registration OTP Verification & Account Creation
 *
 * POST body (JSON): { "otp": "123456" }
 * Response (JSON):
 *   { "success": true,  "token": "...", "email": "...", "name": "..." }
 *   { "success": false, "error": "..." }
 *
 * On success:
 *   - Verifies the OTP stored in $_SESSION['ci_reg_pending']
 *   - Inserts the new user into the `users` table
 *   - Creates an authenticated session ($_SESSION['ci_user'])
 *   - Returns a short-lived HMAC token for SPA use
 */

declare(strict_types=1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST')    { json_fail('Method not allowed.', 405); }

// Use shared session with dashboard
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_path', '/');
    session_name('CI_SESSION');
    session_start();
}

const REG_SESSION_KEY = 'ci_reg_pending';
const MAX_ATTEMPTS    = 5;

// ─── Parse input ─────────────────────────────────────────────────────────────
$body = json_decode(file_get_contents('php://input'), true) ?? [];
$otp  = trim($body['otp'] ?? '');

if (!preg_match('/^\d{6}$/', $otp)) {
    json_fail('OTP must be a 6-digit number.');
}

// ─── Load session data ────────────────────────────────────────────────────────
$pending = $_SESSION[REG_SESSION_KEY] ?? null;

if (empty($pending['otp'])) {
    json_fail('No active registration session. Please fill in the form again.', 401);
}

// ─── Expiry check ─────────────────────────────────────────────────────────────
if (time() > ($pending['expires'] ?? 0)) {
    unset($_SESSION[REG_SESSION_KEY]);
    json_fail('Code has expired. Please request a new one.', 401);
}

// ─── Brute-force protection ──────────────────────────────────────────────────
$_SESSION[REG_SESSION_KEY]['attempts']++;
if ($_SESSION[REG_SESSION_KEY]['attempts'] > MAX_ATTEMPTS) {
    unset($_SESSION[REG_SESSION_KEY]);
    json_fail('Too many incorrect attempts. Please start over.', 429);
}

// ─── Verify OTP ───────────────────────────────────────────────────────────────
if (!password_verify($otp, $pending['otp'])) {
    $remaining = MAX_ATTEMPTS - $_SESSION[REG_SESSION_KEY]['attempts'];
    json_fail("Incorrect code. $remaining attempt(s) remaining.");
}

// ─── OTP verified — create the account ───────────────────────────────────────
unset($_SESSION[REG_SESSION_KEY]);   // single-use

$firstName    = $pending['firstName'];
$lastName     = $pending['lastName'];
$gender       = $pending['gender'] ?? 'Other';
$email        = $pending['email'];
$passwordHash = $pending['passwordHash'];

$autoload = __DIR__ . '/vendor/autoload.php';
if (file_exists($autoload)) require $autoload;
require __DIR__ . '/db.php';

try {
    $stmt = $conn->prepare(
        'INSERT INTO users (first_name, last_name, gender, email, password_hash, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())'
    );
    $stmt->bind_param('sssss', $firstName, $lastName, $gender, $email, $passwordHash);
    $stmt->execute();
} catch (mysqli_sql_exception $e) {
    if ($e->getCode() === 1062) {
        json_fail('An account with this email already exists. Please sign in instead.');
    }
    error_log('[ClassInstruct] DB insert error: ' . $e->getMessage());
    json_fail('Account creation failed. Please try again.', 500);
}

// ─── Create authenticated session ────────────────────────────────────────────
session_regenerate_id(true);

$_SESSION['ci_user'] = [
    'email'       => $email,
    'name'        => $firstName . ' ' . $lastName,
    'first_name'  => $firstName,
    'last_name'   => $lastName,
    'gender'      => $gender,
    'auth_method' => 'otp_register',
    'authed_at'   => time(),
];

$token = generateSimpleToken($email);

echo json_encode([
    'success'    => true,
    'email'      => $email,
    'name'       => $firstName . ' ' . $lastName,
    'first_name' => $firstName,
    'last_name'  => $lastName,
    'gender'     => $gender,
    'token'      => $token,
    'redirect'   => '/dashboard',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function json_fail(string $msg, int $code = 400): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

/**
 * Minimal HMAC-signed token.
 * Replace with firebase/php-jwt in production.
 */
function generateSimpleToken(string $email): string
{
    $secret  = getenv('APP_SECRET') ?: 'change-me-in-env';
    $payload = base64_encode(json_encode([
        'sub' => $email,
        'iat' => time(),
        'exp' => time() + 3600,
    ]));
    $sig = hash_hmac('sha256', $payload, $secret);
    return $payload . '.' . $sig;
}