<?php
/**
 * register_otp.php
 * ClassInstruct — Registration OTP Sender
 *
 * POST body (JSON):
 *   First call:  { "firstName": "Juan", "lastName": "dela Cruz", "email": "user@gmail.com", "password": "secret123" }
 *   Resend call: { "resend": true }   ← reuses pending user data already in session
 *
 * Response (JSON):
 *   { "success": true }
 *   { "success": false, "error": "..." }
 *
 * Requirements:
 *   composer require phpmailer/phpmailer vlucas/phpdotenv
 */

declare(strict_types=1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');            // tighten in production
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST')    { json_fail('Method not allowed.', 405); }

// ─── Autoloader ──────────────────────────────────────────────────────────────
$autoload = __DIR__ . '/vendor/autoload.php';
if (!file_exists($autoload)) {
    json_fail('Server error: run composer install', 500);
}
require $autoload;

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

// ─── Load .env ───────────────────────────────────────────────────────────────
$dotenvPath = __DIR__ . '/.env';
if (file_exists($dotenvPath)) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
    $dotenv->load();
}

// ─── Config ──────────────────────────────────────────────────────────────────
const SMTP_HOST       = 'smtp.gmail.com';
const SMTP_PORT       = 587;
const SMTP_USER       = 'asemiranda9@gmail.com';     // ← change / move to .env
const SMTP_PASS       = 'yovy xovh axwy rtzx';       // ← Gmail App Password / .env
const SMTP_FROM       = 'asemiranda9@gmail.com';
const SMTP_FROM_NAME  = 'ClassInstruct';
const OTP_EXPIRY_SEC  = 120;
const REG_SESSION_KEY = 'ci_reg_pending';

session_start();

// ─── Parse input ─────────────────────────────────────────────────────────────
$body   = json_decode(file_get_contents('php://input'), true) ?? [];
$resend = !empty($body['resend']);

if ($resend) {
    // Re-use data stored in session from the first call
    $pending = $_SESSION[REG_SESSION_KEY] ?? null;
    if (empty($pending['email'])) {
        json_fail('No pending registration found. Please fill in the form again.', 400);
    }

    // ── Rate limiting for resend (30s cooldown, shorter than fresh registration) ──
    if (!empty($_SESSION['ci_reg_otp_last_sent'])) {
        $elapsed = time() - $_SESSION['ci_reg_otp_last_sent'];
        if ($elapsed < 30) {
            json_fail('Please wait ' . (30 - $elapsed) . ' seconds before requesting another code.', 429);
        }
    }

    $email     = $pending['email'];
    $firstName = $pending['firstName'];
} else {
    // ── Rate limiting for fresh registration (60s cooldown) ─────────────────
    if (!empty($_SESSION['ci_reg_otp_last_sent'])) {
        $elapsed = time() - $_SESSION['ci_reg_otp_last_sent'];
        if ($elapsed < 60) {
            json_fail('Please wait ' . (60 - $elapsed) . ' seconds before requesting another code.', 429);
        }
    }

    // ── Validate inputs ──────────────────────────────────────────────────────
    $firstName = trim($body['firstName'] ?? '');
    $lastName  = trim($body['lastName']  ?? '');
    $gender    = trim($body['gender']    ?? '');
    $email     = trim($body['email']     ?? '');
    $password  = $body['password']       ?? '';

    if (empty($firstName) || empty($lastName)) {
        json_fail('Please enter your first and last name.');
    }
    if (empty($gender) || !in_array($gender, ['Male', 'Female', 'Other'], true)) {
        json_fail('Please select a valid gender.');
    }
    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_fail('Invalid email address.');
    }
    if (strlen($password) < 8) {
        json_fail('Password must be at least 8 characters.');
    }

    // ── Check if email is already registered ─────────────────────────────────
    require __DIR__ . '/db.php';
$stmt = $conn->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    json_fail('An account with this email already exists. Please sign in instead.');
}

    // ── Store pending registration in session (hash password immediately) ────
    $_SESSION[REG_SESSION_KEY] = [
        'firstName'    => $firstName,
        'lastName'     => $lastName,
        'gender'       => $gender,
        'email'        => $email,
        'passwordHash' => password_hash($password, PASSWORD_BCRYPT),
        'registeredAt' => time(),
    ];
}

// ─── Generate & store OTP (always refresh expires so resends get a full new window) ──
$otp     = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
$expires = time() + OTP_EXPIRY_SEC;

$_SESSION[REG_SESSION_KEY]['otp']      = password_hash($otp, PASSWORD_BCRYPT);
$_SESSION[REG_SESSION_KEY]['expires']  = $expires;   // ← reset expiry on every send/resend
$_SESSION[REG_SESSION_KEY]['attempts'] = 0;           // ← reset attempt counter too
$_SESSION['ci_reg_otp_last_sent']      = time();

// ─── Send email ───────────────────────────────────────────────────────────────
$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host       = SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = SMTP_USER;
    $mail->Password   = SMTP_PASS;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = SMTP_PORT;

    $mail->setFrom(SMTP_FROM, SMTP_FROM_NAME);
    $mail->addAddress($email, $firstName);

    $mail->isHTML(true);
    $mail->Subject = 'Your ClassInstruct registration code: ' . $otp;
    $mail->Body    = buildRegEmail($otp, $firstName, $email);
    $mail->AltBody = "Hi $firstName,\n\nYour ClassInstruct registration code is: $otp\n\nThis code expires in 2 minutes. Do not share it with anyone.\n\nIf you didn't create this account, you can safely ignore this email.";

    $mail->send();

    echo json_encode(['success' => true]);

} catch (MailException $e) {
    error_log('[ClassInstruct] Registration mailer error: ' . $mail->ErrorInfo);
    json_fail('Failed to send email. Please try again.', 500);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function json_fail(string $msg, int $code = 400): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

function buildRegEmail(string $otp, string $firstName, string $email): string
{
    $digits = implode('', array_map(
        fn($d) => "<span style='display:inline-block;width:48px;height:56px;line-height:56px;text-align:center;font-size:28px;font-weight:700;background:#f3f4f6;border-radius:8px;margin:0 4px;color:#1f2937;'>$d</span>",
        str_split($otp)
    ));

    return <<<HTML
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:'Inter',-apple-system,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;max-width:480px;width:100%;">
            <!-- Accent bar -->
            <tr><td style="height:4px;background:linear-gradient(90deg,#b8860b,#f5f3f0);"></td></tr>
            <!-- Body -->
            <tr><td style="padding:40px 40px 32px;">
              <div style="margin-bottom:28px;">
                <span style="font-size:18px;font-weight:700;color:#111827;">🎓 ClassInstruct</span>
              </div>
              <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">Welcome, {$firstName}! 🎉</h1>
              <p style="font-size:14px;color:#6b7280;margin:0 0 8px;line-height:1.6;">
                Thanks for creating a ClassInstruct account. Enter the code below to complete your registration.
              </p>
              <p style="font-size:14px;color:#6b7280;margin:0 0 28px;line-height:1.6;">
                It expires in <strong>2 minutes</strong>.
              </p>
              <!-- OTP digits -->
              <div style="text-align:center;margin:0 0 28px;">{$digits}</div>
              <!-- Warning -->
              <div style="background:#fef3c7;border-left:3px solid #f59e0b;border-radius:6px;padding:12px 16px;margin-bottom:28px;">
                <p style="margin:0;font-size:13px;color:#92400e;">
                  🔒 Never share this code with anyone. ClassInstruct staff will never ask for it.
                </p>
              </div>
              <p style="font-size:13px;color:#9ca3af;margin:0;">
                If you didn't create an account, you can safely ignore this email.<br>
                This request was made for: <strong>{$email}</strong>
              </p>
            </td></tr>
            <!-- Footer -->
            <tr><td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                © 2025 ClassInstruct · AI-Powered Teaching Platform
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
    HTML;
}