<?php
/**
 * forgot_password.php
 * ClassInstruct — Password Reset via Email Token
 *
 * Flow:
 *   GET  (no token)         → show "send reset link" form
 *   POST ?step=send         → generate token, email it, show confirmation
 *   GET  ?token=...         → validate token, show new-password form
 *   POST ?step=reset&token= → validate token + new password, update DB, show success
 *
 * Token rules:
 *   - 64-char hex (32 random bytes)
 *   - Stored as SHA-256 hash in unlock_token column (reused for password reset)
 *   - Expires after 30 minutes (unlock_token_exp)
 *   - Single-use: cleared on successful password change
 *
 * Note: reuses unlock_token / unlock_token_exp columns to avoid schema changes.
 *       The two flows (unlock vs reset) cannot collide because reset always
 *       overwrites whatever token is there.
 */

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// ─── Autoloader & env ────────────────────────────────────────────────────────
$autoload = __DIR__ . '/vendor/autoload.php';
if (!file_exists($autoload)) die('Server error: run composer install');
require $autoload;

$dotenvPath = __DIR__ . '/.env';
if (file_exists($dotenvPath)) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
    $dotenv->load();
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

$smtpHost     = $_ENV['SMTP_HOST']      ?? 'smtp.gmail.com';
$smtpPort     = (int)($_ENV['SMTP_PORT'] ?? 587);
$smtpUser     = $_ENV['SMTP_USER']      ?? 'asemiranda9@gmail.com';
$smtpPass     = $_ENV['SMTP_PASS']      ?? 'yovy xovh axwy rtzx';
$smtpFrom     = $_ENV['SMTP_FROM']      ?? 'asemiranda9@gmail.com';
$smtpFromName = $_ENV['SMTP_FROM_NAME'] ?? 'ClassInstruct';
if (!empty($_ENV['APP_URL'])) {
    $appUrl = rtrim($_ENV['APP_URL'], '/');
} else {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $dir    = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');
    $appUrl = $scheme . '://' . $host . ($dir === '/' ? '' : $dir);
}

define('TOKEN_EXPIRY_SECS', 1800); // 30 minutes

// ─── State vars ──────────────────────────────────────────────────────────────
$step         = 'form';    // form | sent | reset_form | success | error
$pageError    = '';
$prefillEmail = trim($_GET['email'] ?? '');
$resetToken   = '';        // raw token for the reset form

// ══════════════════════════════════════════════════════════════════════════════
// STEP A — GET ?token=... → show the new-password form (or error)
// ══════════════════════════════════════════════════════════════════════════════
if (!empty($_GET['token']) && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $rawToken = trim($_GET['token']);

    if (!preg_match('/^[0-9a-f]{64}$/', $rawToken)) {
        $step = 'error';
        $pageError = 'Invalid or malformed reset link.';
    } else {
        require __DIR__ . '/db.php';
        $tokenHash = hash('sha256', $rawToken);

        $stmt = $conn->prepare(
            'SELECT id, email, first_name, unlock_token_exp
             FROM users
             WHERE unlock_token = ? AND is_active = 1
             LIMIT 1'
        );
        $stmt->bind_param('s', $tokenHash);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$user) {
            $step = 'error';
            $pageError = 'This reset link is invalid or has already been used.';
        } elseif (empty($user['unlock_token_exp']) || time() > strtotime($user['unlock_token_exp'])) {
            $expiredStmt = $conn->prepare("UPDATE users SET unlock_token = NULL, unlock_token_exp = NULL WHERE id = ?");
            $expiredStmt->bind_param('i', $user['id']);
            $expiredStmt->execute();
            $step = 'error';
            $pageError = 'This reset link has expired. Please request a new one.';
        } else {
            $step       = 'reset_form';
            $resetToken = $rawToken;
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP B — POST: send reset email OR process new password
// ══════════════════════════════════════════════════════════════════════════════
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $postStep = trim($_POST['step'] ?? 'send');

    // ── B1: Send the reset email ──────────────────────────────────────────────
    if ($postStep === 'send') {
        $email = trim($_POST['email'] ?? '');

        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $step = 'form';
            $pageError = 'Please enter a valid email address.';
        } else {
            require __DIR__ . '/db.php';

            $stmt = $conn->prepare(
                'SELECT id, first_name, is_active, google_id FROM users WHERE email = ? LIMIT 1'
            );
            $stmt->bind_param('s', $email);
            $stmt->execute();
            $user = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            // Always show "sent" to prevent user enumeration
            $step = 'sent';

            if ($user && (int)$user['is_active'] === 1) {
                // Google-only accounts have no password — skip silently
                if (!empty($user['google_id'])) {
                    // Send a "use Google sign-in" notice instead
                    $firstName = $user['first_name'];
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
                        $mail->addAddress($email, $firstName);
                        $mail->isHTML(true);
                        $mail->Subject = 'ClassInstruct — Password reset request';
                        $mail->Body    = buildGoogleNoticeEmail($firstName, $email);
                        $mail->AltBody = "Hi {$firstName},\n\nYour ClassInstruct account uses Google sign-in. Please use 'Continue with Google' instead of email/password.";
                        $mail->send();
                    } catch (MailException) { /* silent */ }
                } else {
                    // Normal account: generate token
                    $rawToken  = bin2hex(random_bytes(32));
                    $tokenHash = hash('sha256', $rawToken);
                    $expiry    = date('Y-m-d H:i:s', time() + TOKEN_EXPIRY_SECS);
                    $firstName = $user['first_name'];

                    $updStmt = $conn->prepare(
                        "UPDATE users SET unlock_token = ?, unlock_token_exp = ? WHERE id = ?"
                    );
                    $updStmt->bind_param('ssi', $tokenHash, $expiry, $user['id']);
                    $updStmt->execute();
                    $updStmt->close();

                    $resetUrl = $appUrl . '/forgot_password.php?token=' . $rawToken;

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
                        $mail->addAddress($email, $firstName);
                        $mail->isHTML(true);
                        $mail->Subject = 'Reset your ClassInstruct password';
                        $mail->Body    = buildResetEmail($firstName, $resetUrl, $email);
                        $mail->AltBody = "Hi {$firstName},\n\nReset your password at:\n{$resetUrl}\n\nExpires in 30 minutes. If you didn't request this, ignore this email.";
                        $mail->send();
                    } catch (MailException $e) {
                        error_log('[ClassInstruct] Reset mailer error: ' . $mail->ErrorInfo);
                    }
                }
            }
        }
    }

    // ── B2: Process new password ──────────────────────────────────────────────
    if ($postStep === 'reset') {
        $rawToken    = trim($_POST['token']    ?? '');
        $newPassword = $_POST['password']      ?? '';
        $confirmPass = $_POST['password_confirm'] ?? '';

        if (!preg_match('/^[0-9a-f]{64}$/', $rawToken)) {
            $step = 'error';
            $pageError = 'Invalid reset token.';
        } elseif (strlen($newPassword) < 8) {
            $step       = 'reset_form';
            $resetToken = $rawToken;
            $pageError  = 'Password must be at least 8 characters.';
        } elseif ($newPassword !== $confirmPass) {
            $step       = 'reset_form';
            $resetToken = $rawToken;
            $pageError  = 'Passwords do not match.';
        } else {
            require __DIR__ . '/db.php';
            $tokenHash = hash('sha256', $rawToken);

            $stmt = $conn->prepare(
                'SELECT id, email, unlock_token_exp FROM users WHERE unlock_token = ? AND is_active = 1 LIMIT 1'
            );
            $stmt->bind_param('s', $tokenHash);
            $stmt->execute();
            $user = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            if (!$user) {
                $step = 'error';
                $pageError = 'This reset link is invalid or has already been used.';
            } elseif (empty($user['unlock_token_exp']) || time() > strtotime($user['unlock_token_exp'])) {
                $expiredStmt = $conn->prepare("UPDATE users SET unlock_token = NULL, unlock_token_exp = NULL WHERE id = ?");
                $expiredStmt->bind_param('i', $user['id']);
                $expiredStmt->execute();
                $step = 'error';
                $pageError = 'This reset link has expired. Please request a new one.';
            } else {
                $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
                $resetStmt = $conn->prepare(
                    "UPDATE users
                     SET password_hash = ?, unlock_token = NULL, unlock_token_exp = NULL,
                         perm_locked = 0, login_attempts = 0, lockout_until = NULL
                     WHERE id = ?"
                );
                $resetStmt->bind_param('si', $newHash, $user['id']);
                $resetStmt->execute();
                $step = 'success';
            }
        }
    }
}

// ─── Email builders ──────────────────────────────────────────────────────────
function buildResetEmail(string $firstName, string $resetUrl, string $email): string
{
    return <<<HTML
    <!DOCTYPE html><html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:'Inter',-apple-system,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;max-width:480px;width:100%;">
            <tr><td style="height:4px;background:linear-gradient(90deg,#6c63ff,#ede9ff);"></td></tr>
            <tr><td style="padding:40px 40px 32px;">
              <div style="margin-bottom:24px;"><span style="font-size:18px;font-weight:700;color:#111827;">🎓 ClassInstruct</span></div>
              <div style="text-align:center;font-size:48px;margin-bottom:16px;">🔑</div>
              <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;text-align:center;">Reset Your Password</h1>
              <p style="font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.6;text-align:center;">
                Hi <strong>{$firstName}</strong>, click the button below to choose a new password.<br>
                This link expires in <strong>30 minutes</strong>.
              </p>
              <div style="text-align:center;margin:0 0 28px;">
                <a href="{$resetUrl}" style="display:inline-block;padding:14px 32px;background:#6c63ff;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;">
                  Reset My Password
                </a>
              </div>
              <p style="font-size:12px;color:#9ca3af;margin:0 0 16px;word-break:break-all;text-align:center;">
                Or copy this link: {$resetUrl}
              </p>
              <div style="background:#ede9ff;border-left:3px solid #f59e0b;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#3730a3;">
                  🔒 If you didn't request this, your account is safe — just ignore this email.
                </p>
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

function buildGoogleNoticeEmail(string $firstName, string $email): string
{
    return <<<HTML
    <!DOCTYPE html><html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:'Inter',-apple-system,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;max-width:480px;width:100%;">
            <tr><td style="height:4px;background:linear-gradient(90deg,#6c63ff,#ede9ff);"></td></tr>
            <tr><td style="padding:40px 40px 32px;">
              <div style="margin-bottom:24px;"><span style="font-size:18px;font-weight:700;color:#111827;">🎓 ClassInstruct</span></div>
              <div style="text-align:center;font-size:48px;margin-bottom:16px;">🔍</div>
              <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;text-align:center;">Google Account Detected</h1>
              <p style="font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.6;">
                Hi <strong>{$firstName}</strong>,<br><br>
                Your ClassInstruct account (<strong>{$email}</strong>) was created using Google Sign-In, so it doesn't have a separate password.<br><br>
                To access your account, please use the <strong>"Continue with Google"</strong> button on the sign-in page.
              </p>
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
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Forgot Password — ClassInstruct</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --gold: #6c63ff; --gold-dark: #5548e8; --gold-light: rgba(108,99,255,.12);
      --gray-50: #f9fafb; --gray-100: #f3f4f6; --gray-200: #e5e7eb;
      --gray-400: #9ca3af; --gray-500: #6b7280; --gray-700: #374151;
      --gray-800: #1f2937; --gray-900: #111827;
      --error: #ef4444; --success: #10b981;
      --white: #ffffff;
      --radius: 0.75rem; --radius-full: 9999px;
      --shadow-lg: 0 20px 48px rgba(0,0,0,.13);
      --transition: 220ms ease;
    }

    html, body { height: 100%; }

    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: #0a0818;
      min-height: 100vh;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 24px 16px;
      color: var(--gray-900);
      -webkit-font-smoothing: antialiased;
      position: relative; overflow: hidden;
    }

    /* Atmospheric background rings */
    .bg-ring {
      position: fixed; border-radius: 50%;
      border: 1px solid rgba(108,99,255,.1);
      pointer-events: none; z-index: 0;
      animation: slowSpin 40s linear infinite;
    }
    .bg-ring-1 { width: 700px; height: 700px; top: -200px; right: -200px; }
    .bg-ring-2 { width: 480px; height: 480px; bottom: -120px; left: -160px; border-color: rgba(108,99,255,.07); animation-direction: reverse; animation-duration: 28s; }
    .bg-orb {
      position: fixed; border-radius: 50%; pointer-events: none; z-index: 0;
      animation: floatOrb 8s ease-in-out infinite;
    }
    .bg-orb-1 { width: 5px; height: 5px; background: var(--gold); opacity: .6; top: 30%; right: 18%; }
    .bg-orb-2 { width: 4px; height: 4px; background: #a78bfa; opacity: .4; bottom: 25%; left: 20%; animation-delay: 3s; }
    @keyframes slowSpin { to { transform: rotate(360deg); } }
    @keyframes floatOrb { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }

    /* Card */
    .card {
      position: relative; z-index: 1;
      background: #fff;
      border-radius: 24px;
      box-shadow: var(--shadow-lg);
      width: 100%; max-width: 460px;
      overflow: hidden;
      animation: cardIn .4s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes cardIn { from { opacity:0; transform: translateY(24px) scale(.97); } to { opacity:1; transform: translateY(0) scale(1); } }

    .card-accent {
      height: 3px;
      background: linear-gradient(90deg, var(--gold), #a78bfa, var(--gold));
    }

    .card-body { padding: 40px 44px 36px; }

    /* Brand */
    .brand {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 32px;
    }
    .brand-icon {
      width: 36px; height: 36px; border-radius: 8px;
      background: linear-gradient(135deg, var(--gold), #a78bfa);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; box-shadow: 0 3px 10px rgba(108,99,255,.4);
    }
    .brand-name {
      font-family: 'Playfair Display', serif;
      font-size: 17px; font-weight: 700; color: var(--gray-900);
      letter-spacing: -.2px;
    }

    /* Icon circle */
    .icon-wrap {
      width: 72px; height: 72px; border-radius: 50%; margin: 0 auto 20px;
      display: flex; align-items: center; justify-content: center;
      font-size: 32px;
      background: linear-gradient(135deg, rgba(108,99,255,.12), rgba(245,200,66,.08));
      border: 1.5px solid rgba(108,99,255,.2);
      box-shadow: 0 0 0 8px rgba(108,99,255,.06);
      animation: popIn .45s cubic-bezier(.34,1.56,.64,1) .15s both;
    }
    @keyframes popIn { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }

    h1 {
      font-family: 'Playfair Display', serif;
      font-size: 24px; font-weight: 700;
      color: var(--gray-900); margin: 0 0 8px;
      text-align: center; letter-spacing: -.3px;
    }
    .subtitle {
      font-size: 14px; color: var(--gray-500);
      line-height: 1.65; text-align: center; margin-bottom: 28px;
    }

    /* Form */
    .form-group { margin-bottom: 18px; }
    label {
      display: block; font-size: .8125rem; font-weight: 500;
      color: var(--gray-700); margin-bottom: 6px;
    }

    .input-wrap { position: relative; }
    .input-icon {
      position: absolute; left: .875rem; top: 50%; transform: translateY(-50%);
      color: var(--gray-400); font-size: 14px; pointer-events: none;
    }

    input[type="email"],
    input[type="password"],
    input[type="text"] {
      width: 100%; padding: .75rem .875rem .75rem 2.5rem;
      border: 1.5px solid var(--gray-200);
      border-radius: var(--radius); font-size: .9375rem;
      font-family: inherit; color: var(--gray-900);
      background: var(--white); outline: none;
      transition: border-color var(--transition), box-shadow var(--transition);
    }
    input[type="email"]:focus,
    input[type="password"]:focus,
    input[type="text"]:focus {
      border-color: var(--gold);
      box-shadow: 0 0 0 3px rgba(108,99,255,.12);
    }
    input.error { border-color: var(--error); }

    .field-error { font-size: .8125rem; color: var(--error); margin-top: .375rem; display: none; }
    .field-error.show { display: block; }

    /* Password eye toggle */
    .pw-wrap { position: relative; }
    .toggle-pw {
      position: absolute; right: .75rem; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer;
      color: var(--gray-400); font-size: 15px; padding: 4px;
      display: flex; align-items: center; transition: color var(--transition);
    }
    .toggle-pw:hover { color: var(--gray-700); }

    /* Strength bar */
    .strength-bar {
      height: 4px; border-radius: var(--radius-full);
      background: var(--gray-200); margin-top: 8px; overflow: hidden;
    }
    .strength-fill {
      height: 100%; width: 0%; border-radius: var(--radius-full);
      transition: width 300ms, background 300ms;
    }
    .strength-label { font-size: 11px; color: var(--gray-400); margin-top: 4px; }

    /* Button */
    .btn-primary {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; padding: .875rem 1.5rem;
      background: linear-gradient(135deg, var(--gold), var(--gold-dark));
      color: #fff; border: none; border-radius: var(--radius);
      font-family: inherit; font-size: .9375rem; font-weight: 600;
      cursor: pointer; position: relative; overflow: hidden;
      box-shadow: 0 4px 14px rgba(108,99,255,.35);
      transition: transform var(--transition), box-shadow var(--transition), opacity var(--transition);
      margin-top: 4px; text-decoration: none;
    }
    .btn-primary::before {
      content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
      background: linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent);
      transition: left .5s;
    }
    .btn-primary:hover:not(:disabled)::before { left: 100%; }
    .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(108,99,255,.45); }
    .btn-primary:disabled { opacity: .6; cursor: not-allowed; transform: none; }

    /* Back link */
    .back-link {
      display: block; text-align: center; margin-top: 20px;
      font-size: .8125rem; color: var(--gray-400);
    }
    .back-link a { color: var(--gold); font-weight: 600; text-decoration: none; }
    .back-link a:hover { text-decoration: underline; }

    /* Alert */
    .alert-error {
      display: flex; align-items: flex-start; gap: 10px;
      background: #fef2f2; border: 1px solid #fecaca;
      border-radius: var(--radius); padding: 12px 14px;
      font-size: .8125rem; color: #b91c1c; margin-bottom: 20px;
    }
    .alert-error i { margin-top: 1px; flex-shrink: 0; }

    /* State boxes (sent / success / error) */
    .state-box { text-align: center; padding: 8px 0; }
    .state-icon {
      width: 76px; height: 76px; border-radius: 50%;
      margin: 0 auto 20px;
      display: flex; align-items: center; justify-content: center; font-size: 34px;
      animation: popIn .45s cubic-bezier(.34,1.56,.64,1) .1s both;
    }
    .state-icon.sent    { background: linear-gradient(135deg,#dbeafe,#bfdbfe); box-shadow: 0 0 0 8px rgba(59,130,246,.08); }
    .state-icon.success { background: linear-gradient(135deg,#d1fae5,#a7f3d0); box-shadow: 0 0 0 8px rgba(16,185,129,.08); }
    .state-icon.error   { background: linear-gradient(135deg,#fee2e2,#fecaca); box-shadow: 0 0 0 8px rgba(239,68,68,.08); }

    .state-box h2 {
      font-family: 'Playfair Display', serif;
      font-size: 21px; color: var(--gray-900); margin-bottom: 10px;
    }
    .state-box p { font-size: 14px; color: var(--gray-500); line-height: 1.65; margin-bottom: 20px; }
    .state-box .btn-primary { max-width: 220px; margin: 0 auto; }

    /* Divider hint */
    .hint-row {
      display: flex; align-items: center; gap: 10px; margin-top: 12px;
    }
    .hint-row hr { flex: 1; border: none; border-top: 1px solid var(--gray-200); }
    .hint-row span { font-size: 11px; color: var(--gray-400); white-space: nowrap; }

    /* Card footer */
    .card-footer {
      padding: 14px 44px;
      background: var(--gray-50);
      border-top: 1px solid var(--gray-200);
      font-size: 11px; color: var(--gray-400); text-align: center;
      font-family: 'JetBrains Mono', monospace; letter-spacing: .5px;
    }
  </style>
</head>
<body>

<!-- Atmospheric elements -->
<div class="bg-ring bg-ring-1"></div>
<div class="bg-ring bg-ring-2"></div>
<div class="bg-orb bg-orb-1"></div>
<div class="bg-orb bg-orb-2"></div>

<div class="card">
  <div class="card-accent"></div>
  <div class="card-body">

    <!-- Brand -->
    <div class="brand">
      <div class="brand-icon">🎓</div>
      <span class="brand-name">ClassInstruct</span>
    </div>

    <?php if ($step === 'form'): ?>
      <!-- ── REQUEST FORM ── -->
      <div class="icon-wrap">🔑</div>
      <h1>Forgot Password?</h1>
      <p class="subtitle">Enter your email and we'll send you a secure link to reset your password.</p>

      <?php if ($pageError): ?>
        <div class="alert-error"><i class="fa-solid fa-circle-exclamation"></i><?= htmlspecialchars($pageError) ?></div>
      <?php endif; ?>

      <form method="POST" action="forgot_password.php" novalidate id="forgotForm">
        <input type="hidden" name="step" value="send">
        <div class="form-group">
          <label for="emailInput">Email address</label>
          <div class="input-wrap">
            <span class="input-icon"><i class="fa-regular fa-envelope"></i></span>
            <input
              type="email"
              id="emailInput"
              name="email"
              value="<?= htmlspecialchars($prefillEmail) ?>"
              placeholder="you@example.com"
              autocomplete="email"
              required
            >
          </div>
          <div class="field-error" id="emailError"></div>
        </div>
        <button type="submit" class="btn-primary" id="submitBtn">
          <i class="fa-solid fa-paper-plane"></i>
          <span class="btn-label">Send Reset Link</span>
        </button>
      </form>

      <p class="back-link">Remember your password? <a href="../index.php">← Sign in</a></p>

    <?php elseif ($step === 'sent'): ?>
      <!-- ── EMAIL SENT ── -->
      <div class="state-box">
        <div class="state-icon sent">📧</div>
        <h2>Check Your Email</h2>
        <p>
          If a matching account exists, we've sent a password reset link to your inbox.<br>
          The link expires in <strong>30 minutes</strong>.
        </p>
        <p style="font-size:12px;color:var(--gray-400);margin-bottom:24px;">
          Didn't receive it? Check your spam folder, or
          <a href="forgot_password.php" style="color:var(--gold);font-weight:600;text-decoration:none;">try again</a>.
        </p>
        <a href="../index.php" class="btn-primary" style="text-decoration:none;">
          <i class="fa-solid fa-arrow-left"></i> Back to Sign In
        </a>
      </div>

    <?php elseif ($step === 'reset_form'): ?>
      <!-- ── NEW PASSWORD FORM ── -->
      <div class="icon-wrap">🔐</div>
      <h1>Set New Password</h1>
      <p class="subtitle">Choose a strong password for your account.</p>

      <?php if ($pageError): ?>
        <div class="alert-error"><i class="fa-solid fa-circle-exclamation"></i><?= htmlspecialchars($pageError) ?></div>
      <?php endif; ?>

      <form method="POST" action="forgot_password.php" novalidate id="resetForm">
        <input type="hidden" name="step" value="reset">
        <input type="hidden" name="token" value="<?= htmlspecialchars($resetToken) ?>">

        <div class="form-group">
          <label for="pwInput">New Password</label>
          <div class="pw-wrap">
            <input
              type="password"
              id="pwInput"
              name="password"
              placeholder="Min. 8 characters"
              autocomplete="new-password"
              style="padding-left:.875rem;"
              required
            >
            <button type="button" class="toggle-pw" id="togglePw1" aria-label="Show password">
              <i class="fa-regular fa-eye"></i>
            </button>
          </div>
          <div class="strength-bar"><div class="strength-fill" id="strengthFill"></div></div>
          <div class="strength-label" id="strengthLabel"></div>
          <div class="field-error" id="pwError"></div>
        </div>

        <div class="form-group">
          <label for="pwConfirmInput">Confirm Password</label>
          <div class="pw-wrap">
            <input
              type="password"
              id="pwConfirmInput"
              name="password_confirm"
              placeholder="Repeat your password"
              autocomplete="new-password"
              style="padding-left:.875rem;"
              required
            >
            <button type="button" class="toggle-pw" id="togglePw2" aria-label="Show password">
              <i class="fa-regular fa-eye"></i>
            </button>
          </div>
          <div class="field-error" id="pwConfirmError"></div>
        </div>

        <button type="submit" class="btn-primary" id="resetBtn">
          <i class="fa-solid fa-lock"></i>
          <span class="btn-label">Update Password</span>
        </button>
      </form>

    <?php elseif ($step === 'success'): ?>
      <!-- ── SUCCESS ── -->
      <div class="state-box">
        <div class="state-icon success">✅</div>
        <h2>Password Updated!</h2>
        <p>Your password has been changed successfully. You can now sign in with your new password.</p>
        <a href="../index.php" class="btn-primary" style="text-decoration:none;">
          <i class="fa-solid fa-arrow-right-to-bracket"></i> Go to Sign In
        </a>
      </div>

    <?php elseif ($step === 'error'): ?>
      <!-- ── ERROR ── -->
      <div class="state-box">
        <div class="state-icon error">⛔</div>
        <h2>Link Invalid</h2>
        <p><?= htmlspecialchars($pageError) ?></p>
        <a href="forgot_password.php" class="btn-primary" style="text-decoration:none;">
          <i class="fa-solid fa-rotate-right"></i> Request New Link
        </a>
      </div>

    <?php endif; ?>
  </div>

  <div class="card-footer">© 2025 CLASSINSTRUCT · AI-POWERED TEACHING PLATFORM</div>
</div>

<script>
  // ── Send form validation ──────────────────────────────────────────────────
  const forgotForm = document.getElementById('forgotForm');
  if (forgotForm) {
    forgotForm.addEventListener('submit', function(e) {
      const input = document.getElementById('emailInput');
      const err   = document.getElementById('emailError');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) {
        e.preventDefault();
        input.classList.add('error');
        err.textContent = 'Please enter a valid email address.';
        err.classList.add('show');
        input.focus();
        return;
      }
      input.classList.remove('error');
      err.classList.remove('show');
      const btn = document.getElementById('submitBtn');
      btn.disabled = true;
      btn.querySelector('.btn-label').textContent = 'Sending…';
    });
    document.getElementById('emailInput')?.addEventListener('input', function() {
      this.classList.remove('error');
      document.getElementById('emailError').classList.remove('show');
    });
  }

  // ── Reset form ────────────────────────────────────────────────────────────
  const resetForm = document.getElementById('resetForm');
  if (resetForm) {
    function setupToggle(btnId, inputId) {
      const btn = document.getElementById(btnId);
      const inp = document.getElementById(inputId);
      if (!btn || !inp) return;
      btn.addEventListener('click', () => {
        const isHidden = inp.type === 'password';
        inp.type = isHidden ? 'text' : 'password';
        btn.querySelector('i').className = isHidden ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
      });
    }
    setupToggle('togglePw1', 'pwInput');
    setupToggle('togglePw2', 'pwConfirmInput');

    const pwInput       = document.getElementById('pwInput');
    const strengthFill  = document.getElementById('strengthFill');
    const strengthLabel = document.getElementById('strengthLabel');

    pwInput?.addEventListener('input', function() {
      const v = this.value;
      let score = 0;
      if (v.length >= 8)  score++;
      if (v.length >= 12) score++;
      if (/[A-Z]/.test(v)) score++;
      if (/[0-9]/.test(v)) score++;
      if (/[^A-Za-z0-9]/.test(v)) score++;
      const colors = ['#ef4444','#f97316','#eab308','#22c55e','#10b981'];
      const labels = ['Very weak','Weak','Fair','Strong','Very strong'];
      const pct    = ['20%','40%','60%','80%','100%'];
      strengthFill.style.width      = v.length ? pct[score-1] || '20%' : '0%';
      strengthFill.style.background = v.length ? colors[score-1] : '';
      strengthLabel.textContent     = v.length ? labels[score-1] : '';
    });

    resetForm.addEventListener('submit', function(e) {
      const pw    = document.getElementById('pwInput');
      const pwc   = document.getElementById('pwConfirmInput');
      const pwErr = document.getElementById('pwError');
      const pwcErr= document.getElementById('pwConfirmError');
      let valid = true;
      if (pw.value.length < 8) {
        pw.classList.add('error'); pwErr.textContent = 'Password must be at least 8 characters.'; pwErr.classList.add('show'); valid = false;
      } else { pw.classList.remove('error'); pwErr.classList.remove('show'); }
      if (pw.value !== pwc.value) {
        pwc.classList.add('error'); pwcErr.textContent = 'Passwords do not match.'; pwcErr.classList.add('show'); valid = false;
      } else { pwc.classList.remove('error'); pwcErr.classList.remove('show'); }
      if (!valid) { e.preventDefault(); return; }
      const btn = document.getElementById('resetBtn');
      btn.disabled = true;
      btn.querySelector('.btn-label').textContent = 'Updating…';
    });

    document.getElementById('pwInput')?.addEventListener('input', function() {
      this.classList.remove('error'); document.getElementById('pwError').classList.remove('show');
    });
    document.getElementById('pwConfirmInput')?.addEventListener('input', function() {
      this.classList.remove('error'); document.getElementById('pwConfirmError').classList.remove('show');
    });
  }
</script>

</body>
</html>