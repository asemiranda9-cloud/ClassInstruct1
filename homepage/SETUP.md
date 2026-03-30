# ClassInstruct — Sign-In Backend Setup Guide

## Files delivered

| File | Purpose |
|------|---------|
| `send_otp.php` | Generates & emails a real 6-digit OTP via SMTP |
| `verify_otp.php` | Verifies the OTP server-side (session-stored, bcrypt-hashed) |
| `google_oauth.php` | Handles Google OAuth 2.0 redirect + callback |
| `signin_modal_wired.js` | Replaces the demo `<script>` block in `homepage.php` |

---

## 1. Install PHP dependencies

```bash
composer require phpmailer/phpmailer league/oauth2-google
```

---

## 2. Configure Gmail SMTP (App Password)

1. Go to your Google Account → **Security → 2-Step Verification** (must be ON)
2. Go to **App Passwords** → generate one for "Mail / Other"
3. In `send_otp.php`, set:

```php
const SMTP_USER = 'your-real-gmail@gmail.com';
const SMTP_PASS = 'xxxx xxxx xxxx xxxx';   // 16-char App Password
```

> **Alternative:** Use [SendGrid](https://sendgrid.com) or [Mailgun](https://mailgun.com) SMTP — same config, higher deliverability.

---

## 3. Set up Google OAuth

### In Google Cloud Console:
1. [console.cloud.google.com](https://console.cloud.google.com) → New Project
2. **APIs & Services → OAuth consent screen** → External → fill in App name
3. **Credentials → Create OAuth 2.0 Client ID** → Web application
4. Add **Authorized redirect URI:**
   ```
   https://yourdomain.com/google_oauth.php?action=callback
   ```
5. Copy **Client ID** and **Client Secret**

### In your server environment (recommended):
```bash
# .env or server environment variables
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxx
APP_URL=https://yourdomain.com
APP_SECRET=your-random-secret-string-here
```

Or edit directly in `google_oauth.php` (not recommended for production).

---

## 4. Wire the frontend

In `homepage.php`, find the bottom `<script>` block (starts with `(function () {`) and **replace it entirely** with the contents of `signin_modal_wired.js`.

Or just link it:
```html
<script src="signin_modal_wired.js"></script>
```

---

## 5. PHP session configuration (production)

Add to the top of your main PHP files or `php.ini`:

```php
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_secure', '1');   // requires HTTPS
ini_set('session.cookie_samesite', 'Lax');
ini_set('session.use_strict_mode', '1');
```

---

## 6. Security checklist

- [ ] HTTPS enabled (required for secure cookies & OAuth)
- [ ] `APP_SECRET` set to a random 32+ char string
- [ ] Gmail App Password (not your real Gmail password)
- [ ] `SMTP_PASS` never committed to git — use `.env`
- [ ] Add `vendor/` and `.env` to `.gitignore`
- [ ] Restrict CORS `Access-Control-Allow-Origin` to your domain

---

## Flow diagram

```
User clicks "Sign In"
        │
        ├─── Email OTP flow:
        │       emailInput → POST /send_otp.php
        │           └─ generates OTP, stores hash in $_SESSION
        │           └─ sends real email via PHPMailer/SMTP
        │       user enters 6-digit code → POST /verify_otp.php
        │           └─ verifies hash, clears session OTP
        │           └─ creates $_SESSION['ci_user'] + returns token
        │           └─ frontend redirects to /dashboard
        │
        └─── Google OAuth flow:
                btnGoogle click → GET /google_oauth.php?action=redirect
                    └─ stores CSRF state in session
                    └─ redirects to accounts.google.com
                Google callback → GET /google_oauth.php?action=callback
                    └─ validates CSRF state
                    └─ exchanges code for access token
                    └─ fetches user profile (email, name, avatar)
                    └─ creates $_SESSION['ci_user']
                    └─ redirects to /dashboard
```
