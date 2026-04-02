<?php


/**
 * send_otp.php
 * ClassInstruct — Real OTP Email Sender
 *
 * POST body (JSON): { "email": "user@gmail.com" }
 * Response (JSON):  { "success": true } | { "success": false, "error": "..." }
 *
 * Requirements:
 *   composer require phpmailer/phpmailer
 */

declare(strict_types=1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');           // tighten in production
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST')    { json_fail('Method not allowed.', 405); }

// ─── Load Composer autoloader ───────────────────────────────────────────────
$autoload = __DIR__ . '/vendor/autoload.php';
if (!file_exists($autoload)) {
    json_fail('Server error: PHPMailer not installed. Run: composer require phpmailer/phpmailer', 500);
}
require $autoload;

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception as MailException;

// ─── Config (move to .env in production) ────────────────────────────────────
const SMTP_HOST     = 'smtp.gmail.com';     // or smtp.sendgrid.net, etc.
const SMTP_PORT     = 587;
const SMTP_USER     = 'asemiranda9@gmail.com'; // ← change
const SMTP_PASS     = 'yovy xovh axwy rtzx';  // ← use App Password if Gmail
const SMTP_FROM     = 'your-app@gmail.com';
const SMTP_FROM_NAME = 'ClassInstruct';
const OTP_EXPIRY_SEC = 120;                 // 2 minutes (matches frontend timer)
const OTP_SESSION_KEY = 'ci_otp_data';

session_start();

// ─── Rate limiting (simple per-session) ─────────────────────────────────────
if (!empty($_SESSION['ci_otp_last_sent'])) {
    $elapsed = time() - $_SESSION['ci_otp_last_sent'];
    if ($elapsed < 60) {
        json_fail('Please wait ' . (60 - $elapsed) . ' seconds before requesting another code.', 429);
    }
}

// ─── Parse & validate input ──────────────────────────────────────────────────
$body  = json_decode(file_get_contents('php://input'), true);
$email = trim($body['email'] ?? '');

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_fail('Invalid email address.');
}

// ─── Generate OTP ────────────────────────────────────────────────────────────
$otp     = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
$expires = time() + OTP_EXPIRY_SEC;

// Store in session (server-side — never expose OTP to the browser)
$_SESSION[OTP_SESSION_KEY] = [
    'otp'     => password_hash($otp, PASSWORD_BCRYPT),
    'email'   => $email,
    'expires' => $expires,
    'attempts'=> 0,
];
$_SESSION['ci_otp_last_sent'] = time();

// ─── Send email ───────────────────────────────────────────────────────────────
$mail = new PHPMailer(true);

try {
    // Server settings
    $mail->isSMTP();
    $mail->Host       = SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = SMTP_USER;
    $mail->Password   = SMTP_PASS;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = SMTP_PORT;

    // Recipients
    $mail->setFrom(SMTP_FROM, SMTP_FROM_NAME);
    $mail->addAddress($email);

    // Content
    $mail->isHTML(true);
    $mail->Subject = 'Your ClassInstruct sign-in code: ' . $otp;
    $mail->Body    = buildHtmlEmail($otp, $email);
    $mail->AltBody = "Your ClassInstruct sign-in code is: $otp\n\nThis code expires in 2 minutes. Do not share it with anyone.";

    $mail->send();

    echo json_encode(['success' => true]);

} catch (MailException $e) {
    error_log('[ClassInstruct] Mailer error: ' . $mail->ErrorInfo);
    json_fail('Failed to send email. Please try again.', 500);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function json_fail(string $msg, int $code = 400): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

function buildHtmlEmail(string $otp, string $email): string
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
            <tr><td style="height:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6);"></td></tr>
            <!-- Body -->
            <tr><td style="padding:40px 40px 32px;">
              <!-- Logo -->
              <div style="margin-bottom:28px;">
                <span style="font-size:18px;font-weight:700;color:#111827;">ClassInstruct</span>
              </div>
              <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">Your sign-in code</h1>
              <p style="font-size:14px;color:#6b7280;margin:0 0 28px;line-height:1.6;">
                Enter this code to sign in to ClassInstruct. It expires in <strong>2 minutes</strong>.
              </p>
              <!-- OTP digits -->
              <div style="text-align:center;margin:0 0 28px;">$digits</div>
              <!-- Warning -->
              <div style="background:#fef3c7;border-left:3px solid #f59e0b;border-radius:6px;padding:12px 16px;margin-bottom:28px;">
                <p style="margin:0;font-size:13px;color:#92400e;">
                  🔒 Never share this code with anyone. ClassInstruct staff will never ask for it.
                </p>
              </div>
              <p style="font-size:13px;color:#9ca3af;margin:0;">
                If you didn't request this code, you can safely ignore this email.<br>
                This request was made for: <strong>$email</strong>
              </p>
            </td></tr>
            <!-- Footer -->
            <tr><td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                © 2024 ClassInstruct · AI-Powered Teaching Platform
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
    HTML;
}
