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

error_reporting(0);
ini_set('display_errors', '0');

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
            $conn->query("UPDATE users SET unlock_token = NULL, unlock_token_exp = NULL WHERE id = {$user['id']}");
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

                    $conn->query(
                        "UPDATE users
                         SET unlock_token = '{$tokenHash}', unlock_token_exp = '{$expiry}'
                         WHERE id = {$user['id']}"
                    );

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
                $conn->query("UPDATE users SET unlock_token = NULL, unlock_token_exp = NULL WHERE id = {$user['id']}");
                $step = 'error';
                $pageError = 'This reset link has expired. Please request a new one.';
            } else {
                $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
                $conn->query(
                    "UPDATE users
                     SET password_hash = '{$conn->real_escape_string($newHash)}',
                         unlock_token = NULL, unlock_token_exp = NULL,
                         perm_locked = 0, login_attempts = 0, lockout_until = NULL
                     WHERE id = {$user['id']}"
                );
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
            <tr><td style="height:4px;background:linear-gradient(90deg,#b8860b,#f5f3f0);"></td></tr>
            <tr><td style="padding:40px 40px 32px;">
              <div style="margin-bottom:24px;"><span style="font-size:18px;font-weight:700;color:#111827;">🎓 ClassInstruct</span></div>
              <div style="text-align:center;font-size:48px;margin-bottom:16px;">🔑</div>
              <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;text-align:center;">Reset Your Password</h1>
              <p style="font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.6;text-align:center;">
                Hi <strong>{$firstName}</strong>, click the button below to choose a new password.<br>
                This link expires in <strong>30 minutes</strong>.
              </p>
              <div style="text-align:center;margin:0 0 28px;">
                <a href="{$resetUrl}" style="display:inline-block;padding:14px 32px;background:#b8860b;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;">
                  Reset My Password
                </a>
              </div>
              <p style="font-size:12px;color:#9ca3af;margin:0 0 16px;word-break:break-all;text-align:center;">
                Or copy this link: {$resetUrl}
              </p>
              <div style="background:#fef3c7;border-left:3px solid #f59e0b;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#92400e;">
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
            <tr><td style="height:4px;background:linear-gradient(90deg,#b8860b,#f5f3f0);"></td></tr>
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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --gold: #b8860b; --gold-dark: #a07609;
      --gray-50: #f9fafb; --gray-100: #f3f4f6; --gray-200: #e5e7eb;
      --gray-400: #9ca3af; --gray-500: #6b7280; --gray-700: #374151;
      --gray-800: #1f2937; --gray-900: #111827;
      --error: #ef4444; --success: #10b981;
    }
    body {
      font-family: 'Inter', sans-serif;
      background: #fafaf8;
      min-height: 100vh;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 24px 16px;
      color: var(--gray-900);
    }
    .card {
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.10);
      width: 100%; max-width: 440px;
      overflow: hidden;
    }
    .card-accent { height: 4px; background: linear-gradient(90deg, #b8860b, #f5f3f0); }
    .card-body { padding: 40px 40px 36px; }
    .brand { font-size: 16px; font-weight: 700; color: var(--gray-900); margin-bottom: 28px; }
    .icon-wrap { text-align: center; font-size: 52px; margin-bottom: 16px; }
    h1 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 22px; font-weight: 700;
      color: var(--gray-900); margin: 0 0 10px;
      text-align: center;
    }
    .subtitle {
      font-size: 14px; color: var(--gray-500);
      line-height: 1.6; text-align: center; margin-bottom: 28px;
    }
    .form-group { margin-bottom: 16px; }
    label {
      display: block; font-size: 12px; font-weight: 600;
      color: var(--gray-700); margin-bottom: 6px;
      letter-spacing: 0.4px; text-transform: uppercase;
    }
    input[type="email"],
    input[type="password"],
    input[type="text"] {
      width: 100%; padding: 12px 44px 12px 14px;
      border: 1.5px solid var(--gray-200);
      border-radius: 10px; font-size: 14px; color: var(--gray-900);
      background: #fff; outline: none; transition: border-color 200ms;
      box-sizing: border-box;
    }
    input:focus { border-color: var(--gold); }
    input.error { border-color: var(--error); }
    .field-error { font-size: 12px; color: var(--error); margin-top: 5px; display: none; }
    .field-error.show { display: block; }

    /* Password wrapper — eye button sits inside the input */
    .pw-wrap { position: relative; }
    .toggle-pw {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer;
      color: var(--gray-400); font-size: 15px; padding: 4px;
      line-height: 1; display: flex; align-items: center; justify-content: center;
    }
    .toggle-pw:hover { color: var(--gray-700); }

    /* Strength bar */
    .strength-bar {
      height: 4px; border-radius: 9999px;
      background: var(--gray-200); margin-top: 8px; overflow: hidden;
    }
    .strength-fill {
      height: 100%; width: 0%; border-radius: 9999px;
      transition: width 300ms, background 300ms;
    }
    .strength-label { font-size: 11px; color: var(--gray-400); margin-top: 4px; }

    .btn-primary {
      display: block; width: 100%; padding: 13px;
      background: var(--gold); color: #fff; border: none;
      border-radius: 10px; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: background 200ms, opacity 200ms;
      margin-top: 8px;
    }
    .btn-primary:hover { background: var(--gold-dark); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .back-link { display: block; text-align: center; margin-top: 18px; font-size: 13px; color: var(--gray-500); }
    .back-link a { color: var(--gold); font-weight: 600; text-decoration: none; }
    .back-link a:hover { text-decoration: underline; }

    .alert-error {
      background: #fef2f2; border: 1px solid #fecaca;
      border-radius: 10px; padding: 12px 16px;
      font-size: 13px; color: #b91c1c; margin-bottom: 18px;
    }

    .state-box { text-align: center; }
    .state-box .big-icon { font-size: 56px; margin-bottom: 16px; }
    .state-box h2 { font-family: 'Playfair Display', serif; font-size: 20px; color: var(--gray-900); margin-bottom: 10px; }
    .state-box p { font-size: 14px; color: var(--gray-500); line-height: 1.6; margin-bottom: 24px; }

    .card-footer {
      padding: 16px 40px;
      background: var(--gray-50);
      border-top: 1px solid var(--gray-200);
      font-size: 12px; color: var(--gray-400); text-align: center;
    }
  </style>
</head>
<body>

<div class="card">
  <div class="card-accent"></div>
  <div class="card-body">

    <div class="brand">🎓 ClassInstruct</div>

    <?php if ($step === 'form'): ?>
      <!-- ── REQUEST FORM ── -->
      <div class="icon-wrap">🔑</div>
      <h1>Forgot Password?</h1>
      <p class="subtitle">Enter your email and we'll send you a link to reset your password.</p>

      <?php if ($pageError): ?>
        <div class="alert-error"><?= htmlspecialchars($pageError) ?></div>
      <?php endif; ?>

      <form method="POST" action="forgot_password.php" novalidate id="forgotForm">
        <input type="hidden" name="step" value="send">
        <div class="form-group">
          <label for="emailInput">Email Address</label>
          <input
            type="email"
            id="emailInput"
            name="email"
            value="<?= htmlspecialchars($prefillEmail) ?>"
            placeholder="you@example.com"
            autocomplete="email"
            required
          >
          <div class="field-error" id="emailError"></div>
        </div>
        <button type="submit" class="btn-primary" id="submitBtn">
          Send Reset Link
        </button>
      </form>

      <p class="back-link">Remember your password? <a href="homepage.php">Sign in</a></p>

    <?php elseif ($step === 'sent'): ?>
      <!-- ── EMAIL SENT ── -->
      <div class="state-box">
        <div class="big-icon">📧</div>
        <h2>Check Your Email</h2>
        <p>
          If a matching account exists, we've sent a password reset link.<br>
          The link expires in <strong>30 minutes</strong>.
        </p>
        <p style="font-size:12px;color:var(--gray-400);">
          Didn't receive it? Check your spam folder, or
          <a href="forgot_password.php" style="color:var(--gold);font-weight:600;">try again</a>.
        </p>
      </div>

    <?php elseif ($step === 'reset_form'): ?>
      <!-- ── NEW PASSWORD FORM ── -->
      <div class="icon-wrap">🔐</div>
      <h1>Set New Password</h1>
      <p class="subtitle">Choose a strong password for your account.</p>

      <?php if ($pageError): ?>
        <div class="alert-error"><?= htmlspecialchars($pageError) ?></div>
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
              required
            >
            <button type="button" class="toggle-pw" id="togglePw2" aria-label="Show password">
              <i class="fa-regular fa-eye"></i>
            </button>
          </div>
          <div class="field-error" id="pwConfirmError"></div>
        </div>

        <button type="submit" class="btn-primary" id="resetBtn">
          Update Password
        </button>
      </form>

    <?php elseif ($step === 'success'): ?>
      <!-- ── SUCCESS ── -->
      <div class="state-box">
        <div class="big-icon">✅</div>
        <h2>Password Updated!</h2>
        <p>Your password has been changed successfully. You can now sign in with your new password.</p>
        <a href="homepage.php" class="btn-primary" style="display:inline-block;width:auto;padding:13px 32px;text-decoration:none;">
          Go to Sign In
        </a>
      </div>

    <?php elseif ($step === 'error'): ?>
      <!-- ── ERROR ── -->
      <div class="state-box">
        <div class="big-icon">❌</div>
        <h2>Link Invalid</h2>
        <p><?= htmlspecialchars($pageError) ?></p>
        <a href="forgot_password.php" class="btn-primary" style="display:inline-block;width:auto;padding:13px 32px;text-decoration:none;">
          Request New Link
        </a>
      </div>

    <?php endif; ?>
  </div>

  <div class="card-footer">© 2025 ClassInstruct · AI-Powered Teaching Platform</div>
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
      document.getElementById('submitBtn').disabled = true;
      document.getElementById('submitBtn').textContent = 'Sending…';
    });
    document.getElementById('emailInput')?.addEventListener('input', function() {
      this.classList.remove('error');
      document.getElementById('emailError').classList.remove('show');
    });
  }

  // ── Reset form ────────────────────────────────────────────────────────────
  const resetForm = document.getElementById('resetForm');
  if (resetForm) {
    // Show/hide toggles
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

    // Strength meter
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

      strengthFill.style.width      = v.length ? pct[score - 1] || '20%' : '0%';
      strengthFill.style.background = v.length ? colors[score - 1] : '';
      strengthLabel.textContent     = v.length ? labels[score - 1] : '';
    });

    // Submit validation
    resetForm.addEventListener('submit', function(e) {
      const pw      = document.getElementById('pwInput');
      const pwc     = document.getElementById('pwConfirmInput');
      const pwErr   = document.getElementById('pwError');
      const pwcErr  = document.getElementById('pwConfirmError');
      let valid = true;

      if (pw.value.length < 8) {
        pw.classList.add('error');
        pwErr.textContent = 'Password must be at least 8 characters.';
        pwErr.classList.add('show');
        valid = false;
      } else {
        pw.classList.remove('error');
        pwErr.classList.remove('show');
      }

      if (pw.value !== pwc.value) {
        pwc.classList.add('error');
        pwcErr.textContent = 'Passwords do not match.';
        pwcErr.classList.add('show');
        valid = false;
      } else {
        pwc.classList.remove('error');
        pwcErr.classList.remove('show');
      }

      if (!valid) { e.preventDefault(); return; }

      document.getElementById('resetBtn').disabled    = true;
      document.getElementById('resetBtn').textContent = 'Updating…';
    });

    document.getElementById('pwInput')?.addEventListener('input', function() {
      this.classList.remove('error');
      document.getElementById('pwError').classList.remove('show');
    });
    document.getElementById('pwConfirmInput')?.addEventListener('input', function() {
      this.classList.remove('error');
      document.getElementById('pwConfirmError').classList.remove('show');
    });
  }
</script>

</body>
</html>