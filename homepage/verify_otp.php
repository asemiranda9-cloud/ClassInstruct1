<?php
/**
 * verify_otp.php
 * ClassInstruct — OTP Verification Endpoint
 *
 * POST body (JSON): { "otp": "123456" }
 * Response (JSON):  { "success": true, "token": "..." } | { "success": false, "error": "..." }
 */

declare(strict_types=1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST')    { json_fail('Method not allowed.', 405); }

session_start();

const OTP_SESSION_KEY  = 'ci_otp_data';
const MAX_ATTEMPTS     = 5;

// ─── Parse input ─────────────────────────────────────────────────────────────
$body = json_decode(file_get_contents('php://input'), true);
$otp  = trim($body['otp'] ?? '');

if (!preg_match('/^\d{6}$/', $otp)) {
    json_fail('OTP must be a 6-digit number.');
}

// ─── Load session data ────────────────────────────────────────────────────────
$data = $_SESSION[OTP_SESSION_KEY] ?? null;

if (empty($data)) {
    json_fail('No active OTP session. Please request a new code.', 401);
}

// ─── Expiry check ─────────────────────────────────────────────────────────────
if (time() > $data['expires']) {
    unset($_SESSION[OTP_SESSION_KEY]);
    json_fail('Code has expired. Please request a new one.', 401);
}

// ─── Brute-force protection ──────────────────────────────────────────────────
$_SESSION[OTP_SESSION_KEY]['attempts']++;
if ($_SESSION[OTP_SESSION_KEY]['attempts'] > MAX_ATTEMPTS) {
    unset($_SESSION[OTP_SESSION_KEY]);
    json_fail('Too many incorrect attempts. Please request a new code.', 429);
}

// ─── Verify ───────────────────────────────────────────────────────────────────
if (!password_verify($otp, $data['otp'])) {
    $remaining = MAX_ATTEMPTS - $_SESSION[OTP_SESSION_KEY]['attempts'];
    json_fail("Incorrect code. $remaining attempt(s) remaining.");
}

// ─── Success — create session / auth token ────────────────────────────────────
unset($_SESSION[OTP_SESSION_KEY]);   // single-use: clear OTP immediately

$email = $data['email'];

// ── Fetch user details from DB ────────────────────────────────────────────────
require __DIR__ . '/db.php';
$firstName = '';
$lastName  = '';
$gender    = '';

$uStmt = $conn->prepare('SELECT first_name, last_name, gender FROM users WHERE email = ? AND is_active = 1 LIMIT 1');
$uStmt->bind_param('s', $email);
$uStmt->execute();
$uRow = $uStmt->get_result()->fetch_assoc();
$uStmt->close();

if ($uRow) {
    $firstName = $uRow['first_name'] ?? '';
    $lastName  = $uRow['last_name']  ?? '';
    $gender    = $uRow['gender']     ?? '';
}

// Start authenticated session
$_SESSION['ci_user'] = [
    'email'       => $email,
    'first_name'  => $firstName,
    'last_name'   => $lastName,
    'gender'      => $gender,
    'auth_method' => 'otp',
    'authed_at'   => time(),
];

$token = generateSimpleToken($email);

echo json_encode([
    'success'    => true,
    'email'      => $email,
    'first_name' => $firstName,
    'last_name'  => $lastName,
    'gender'     => $gender,
    'token'      => $token,
    'redirect'   => '/dashboard',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function json_fail(string $msg, int $code = 400): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

/**
 * Minimal HMAC-signed token.
 * In production replace with: composer require firebase/php-jwt
 */
function generateSimpleToken(string $email): string
{
    $secret  = getenv('APP_SECRET') ?: 'change-me-in-env';  // set APP_SECRET in your .env
    $payload = base64_encode(json_encode([
        'sub' => $email,
        'iat' => time(),
        'exp' => time() + 3600,  // 1 hour
    ]));
    $sig = hash_hmac('sha256', $payload, $secret);
    return $payload . '.' . $sig;
}