<?php
declare(strict_types=1);

/**
 * send_otp.php — ClassInstruct OTP sender with login-attempt lockout
 *
 * Lockout rules:
 *   Attempts 1-3  → show remaining count
 *   Attempt  3    → 30-min soft lockout
 *   Attempts 4-6  → after cooldown, show remaining count again
 *   Attempt  6    → permanent lock (perm_locked = 1)
 */

error_reporting(0);
ini_set('display_errors', '0');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST')    { json_fail('Method not allowed.', 405); }

$autoload = __DIR__ . '/vendor/autoload.php';
if (!file_exists($autoload)) json_fail('Server error: run composer install.', 500);
require $autoload;

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

$dotenvPath = __DIR__ . '/.env';
if (file_exists($dotenvPath)) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
    $dotenv->load();
}

$smtpHost     = $_ENV['SMTP_HOST']      ?? 'smtp.gmail.com';
$smtpPort     = (int)($_ENV['SMTP_PORT'] ?? 587);
$smtpUser     = $_ENV['SMTP_USER']      ?? 'asemiranda9@gmail.com';
$smtpPass     = $_ENV['SMTP_PASS']      ?? 'yovy xovh axwy rtzx';
$smtpFrom     = $_ENV['SMTP_FROM']      ?? 'asemiranda9@gmail.com';
$smtpFromName = $_ENV['SMTP_FROM_NAME'] ?? 'ClassInstruct';

define('OTP_EXPIRY_SEC',    120);
define('OTP_SESSION_KEY',   'ci_otp_data');
define('SOFT_LIMIT',        3);     // wrong passwords before 10s cooldown
define('PERM_LIMIT',        6);     // total wrong passwords before permanent lock
define('SOFT_LOCKOUT_SECS', 10);    // 10 second cooldown

session_start();

// ─── Parse input ─────────────────────────────────────────────────────────────
$body     = json_decode(file_get_contents('php://input'), true) ?? [];
$email    = trim($body['email']    ?? '');
$password = $body['password']      ?? '';

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) json_fail('Invalid email address.');
if (empty($password)) json_fail('Password is required.');

// ─── DB ───────────────────────────────────────────────────────────────────────
require __DIR__ . '/db.php';

$stmt = $conn->prepare(
    'SELECT id, password_hash, login_attempts, lockout_until, perm_locked
     FROM users WHERE email = ? AND is_active = 1 LIMIT 1'
);
$stmt->bind_param('s', $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$user) json_fail('No account found with that email address.');

if (empty($user['password_hash'])) {
    json_fail("This account uses Google sign-in. Please use the 'Continue with Google' button.");
}

$userId   = (int) $user['id'];
$attempts = (int) $user['login_attempts'];

// ─── Permanent lock ───────────────────────────────────────────────────────────
if ((int)$user['perm_locked'] === 1) {
    json_fail(
        'Your account has been locked due to too many failed attempts.',
        403,
        ['perm_locked' => true]
    );
}

// ─── Soft lockout ─────────────────────────────────────────────────────────────
$justUnlocked = false;
if (!empty($user['lockout_until'])) {
    $until = strtotime($user['lockout_until']);
    if (time() < $until) {
        $wait = $until - time();
        $secs = (int) ceil($wait);
        json_fail(
            "Too many failed attempts. Please try again in {$secs} second" . ($secs === 1 ? '' : 's') . '.',
            429,
            ['temp_locked' => true, 'wait_seconds' => $wait]
        );
    }
    // Cooldown passed — clear the lockout timestamp, keep attempt counter
    $clearStmt = $conn->prepare("UPDATE users SET lockout_until = NULL WHERE id = ?");
    $clearStmt->bind_param('i', $userId);
    $clearStmt->execute();
    $clearStmt->close();
    $user['lockout_until'] = null;
    $justUnlocked = true;
}

// ─── Session rate limiting (OTP resend) — skip if DB lockout just cleared ────
if (!$justUnlocked && !empty($_SESSION['ci_otp_last_sent'])) {
    $elapsed = time() - $_SESSION['ci_otp_last_sent'];
    if ($elapsed < 60) {
        json_fail('Please wait ' . (60 - $elapsed) . ' seconds before requesting another code.', 429);
    }
}

// ─── Verify password ──────────────────────────────────────────────────────────
if (!password_verify($password, $user['password_hash'])) {
    $newAttempts = $attempts + 1;

    // After cooldown, attempts was kept (e.g. 3). Next 3 wrong (4,5,6) → perm lock
    if ($newAttempts >= PERM_LIMIT) {
        $permStmt = $conn->prepare("UPDATE users SET login_attempts = ?, perm_locked = 1, lockout_until = NULL WHERE id = ?");
        $permStmt->bind_param('ii', $newAttempts, $userId);
        $permStmt->execute();
        $permStmt->close();
        json_fail(
            'Your account has been locked due to too many failed attempts.',
            403,
            ['perm_locked' => true]
        );
    }

    // First 3 wrong answers → 10s cooldown
    if ($newAttempts >= SOFT_LIMIT && empty($user['lockout_until'])) {
        $until    = date('Y-m-d H:i:s', time() + SOFT_LOCKOUT_SECS);
        $softStmt = $conn->prepare("UPDATE users SET login_attempts = ?, lockout_until = ? WHERE id = ?");
        $softStmt->bind_param('isi', $newAttempts, $until, $userId);
        $softStmt->execute();
        $softStmt->close();
        json_fail(
            'Too many failed attempts. Please try again in ' . SOFT_LOCKOUT_SECS . ' seconds.',
            429,
            ['temp_locked' => true, 'wait_seconds' => SOFT_LOCKOUT_SECS]
        );
    }

    $attemptsStmt = $conn->prepare("UPDATE users SET login_attempts = ? WHERE id = ?");
    $attemptsStmt->bind_param('ii', $newAttempts, $userId);
    $attemptsStmt->execute();
    $attemptsStmt->close();

    // Remaining before next threshold
    $nextThreshold = $newAttempts < SOFT_LIMIT ? SOFT_LIMIT : PERM_LIMIT;
    $remaining     = $nextThreshold - $newAttempts;

    json_fail(
        "Incorrect password. {$remaining} attempt" . ($remaining === 1 ? '' : 's') . ' remaining before lockout.',
        401,
        ['attempts_remaining' => $remaining]
    );
}

// ─── Correct password — reset counters ───────────────────────────────────────
$resetStmt = $conn->prepare("UPDATE users SET login_attempts = 0, lockout_until = NULL WHERE id = ?");
$resetStmt->bind_param('i', $userId);
$resetStmt->execute();
$resetStmt->close();

// ─── Generate & store OTP ─────────────────────────────────────────────────────
$otp     = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
$expires = time() + OTP_EXPIRY_SEC;

$_SESSION[OTP_SESSION_KEY] = [
    'otp'      => password_hash($otp, PASSWORD_BCRYPT),
    'email'    => $email,
    'expires'  => $expires,
    'attempts' => 0,
];
$_SESSION['ci_otp_last_sent'] = time();

// ─── Send email ───────────────────────────────────────────────────────────────
$mail = new PHPMailer(true);
try {
    $mail->isSMTP();
    $mail->Host       = $smtpHost;
    $mail->SMTPAuth   = true;
    $mail->Username   = $smtpUser;
    $mail->Password   = $smtpPass;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = $smtpPort;
    $mail->setFrom($smtpFrom, $smtpFromName);
    $mail->addAddress($email);
    $mail->isHTML(true);
    $mail->Subject = 'Your ClassInstruct sign-in code: ' . $otp;
    $mail->Body    = buildHtmlEmail($otp, $email);
    $mail->AltBody = "Your ClassInstruct sign-in code is: $otp\n\nExpires in 2 minutes. Do not share it.";
    $mail->send();
    echo json_encode(['success' => true]);
} catch (MailException $e) {
    error_log('[ClassInstruct] Mailer error: ' . $mail->ErrorInfo);
    json_fail('Failed to send email. Please try again.', 500);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function json_fail(string $msg, int $code = 400, array $extra = []): never
{
    http_response_code($code);
    echo json_encode(array_merge(['success' => false, 'error' => $msg], $extra));
    exit;
}

function buildHtmlEmail(string $otp, string $email): string
{
    $digits = implode('', array_map(
        fn($d) => "<span style='display:inline-block;width:48px;height:56px;line-height:56px;text-align:center;font-size:28px;font-weight:700;background:#f3f4f6;border-radius:8px;margin:0 4px;color:#1f2937;'>$d</span>",
        str_split($otp)
    ));
    return <<<HTML
    <!DOCTYPE html><html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:'Inter',-apple-system,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;max-width:480px;width:100%;">
            <tr><td style="height:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6);"></td></tr>
            <tr><td style="padding:40px 40px 32px;">
              <div style="margin-bottom:28px;"><span style="font-size:18px;font-weight:700;color:#111827;">ClassInstruct</span></div>
              <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">Your sign-in code</h1>
              <p style="font-size:14px;color:#6b7280;margin:0 0 28px;line-height:1.6;">Enter this code to sign in. It expires in <strong>2 minutes</strong>.</p>
              <div style="text-align:center;margin:0 0 28px;">{$digits}</div>
              <div style="background:#fef3c7;border-left:3px solid #f59e0b;border-radius:6px;padding:12px 16px;margin-bottom:28px;">
                <p style="margin:0;font-size:13px;color:#92400e;">🔒 Never share this code. ClassInstruct staff will never ask for it.</p>
              </div>
              <p style="font-size:13px;color:#9ca3af;margin:0;">Request made for: <strong>{$email}</strong></p>
            </td></tr>
            <tr><td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">© 2025 ClassInstruct · AI-Powered Teaching Platform</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>
    HTML;
}