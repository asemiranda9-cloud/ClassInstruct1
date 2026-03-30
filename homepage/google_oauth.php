<?php
/**
 * google_oauth.php
 * ClassInstruct — Google OAuth 2.0 Handler
 *
 * Two entry points:
 *   GET ?action=redirect  → sends the browser to Google's consent screen
 *   GET ?action=callback  → Google redirects back here with ?code=...
 *
 * Requirements:
 *   composer require league/oauth2-google
 *   (or: composer require google/apiclient)
 *
 * Setup (Google Cloud Console):
 *   1. Create a project → APIs & Services → Credentials
 *   2. Create OAuth 2.0 Client ID (Web application)
 *   3. Add Authorized redirect URI:  https://yourdomain.com/google_oauth.php?action=callback
 *   4. Copy Client ID + Client Secret below (or into .env)
 */

declare(strict_types=1);

// ─── Config ───────────────────────────────────────────────────────────────────
// Prefer reading from environment variables in production:
//   putenv('GOOGLE_CLIENT_ID=xxx') or use a .env loader like vlucas/phpdotenv
$config = [
    'client_id'     => getenv('GOOGLE_CLIENT_ID')     ?: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
    'client_secret' => getenv('GOOGLE_CLIENT_SECRET') ?: 'YOUR_GOOGLE_CLIENT_SECRET',
    'redirect_uri'  => getenv('APP_URL')               
                        ? getenv('APP_URL') . '/google_oauth.php?action=callback'
                        : 'https://yourdomain.com/google_oauth.php?action=callback',
    'scopes'        => ['openid', 'email', 'profile'],
];

session_start();

$autoload = __DIR__ . '/vendor/autoload.php';
if (!file_exists($autoload)) {
    die('Server error: Run composer require league/oauth2-google');
}
require $autoload;

use League\OAuth2\Client\Provider\Google;

$provider = new Google([
    'clientId'     => $config['client_id'],
    'clientSecret' => $config['client_secret'],
    'redirectUri'  => $config['redirect_uri'],
    'hostedDomain' => '',                        // set to 'yourschool.edu' to restrict domain
]);

$action = $_GET['action'] ?? '';

// ══════════════════════════════════════════════════════════════════════════════
// STEP 1 — Redirect to Google
// ══════════════════════════════════════════════════════════════════════════════
if ($action === 'redirect') {

    $authUrl = $provider->getAuthorizationUrl([
        'scope'  => $config['scopes'],
        'prompt' => 'select_account',            // always show account chooser
    ]);

    // Store CSRF state token in session
    $_SESSION['oauth2_state'] = $provider->getState();

    header('Location: ' . $authUrl);
    exit;
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 2 — Handle callback from Google
// ══════════════════════════════════════════════════════════════════════════════
if ($action === 'callback') {

    // ── CSRF validation ────────────────────────────────────────────────────────
    if (empty($_GET['state']) || $_GET['state'] !== ($_SESSION['oauth2_state'] ?? '')) {
        unset($_SESSION['oauth2_state']);
        redirectWithError('OAuth state mismatch. Please try again.');
    }
    unset($_SESSION['oauth2_state']);

    // ── Error from Google (user denied, etc.) ─────────────────────────────────
    if (!empty($_GET['error'])) {
        redirectWithError('Google sign-in was cancelled.');
    }

    if (empty($_GET['code'])) {
        redirectWithError('No authorisation code received from Google.');
    }

    // ── Exchange code for access token ────────────────────────────────────────
    try {
        $token = $provider->getAccessToken('authorization_code', [
            'code' => $_GET['code'],
        ]);

        /** @var \League\OAuth2\Client\Provider\GoogleUser $googleUser */
        $googleUser = $provider->getResourceOwner($token);

        $email    = $googleUser->getEmail();
        $name     = $googleUser->getName();
        $googleId = $googleUser->getId();
        $avatar   = $googleUser->getAvatar();

        // ── Optionally: look up or create user in your DB ─────────────────────
        // $user = User::findOrCreateByGoogle($email, $googleId, $name, $avatar);

        // ── Start authenticated session ───────────────────────────────────────
        session_regenerate_id(true);    // prevent session fixation
        $_SESSION['ci_user'] = [
            'email'       => $email,
            'name'        => $name,
            'google_id'   => $googleId,
            'avatar'      => $avatar,
            'auth_method' => 'google',
            'authed_at'   => time(),
        ];

        // ── Redirect to dashboard ─────────────────────────────────────────────
        header('Location: /dashboard');
        exit;

    } catch (\Exception $e) {
        error_log('[ClassInstruct] Google OAuth error: ' . $e->getMessage());
        redirectWithError('Google sign-in failed. Please try again.');
    }
}

// ── Unknown action ────────────────────────────────────────────────────────────
http_response_code(400);
echo 'Bad request.';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function redirectWithError(string $msg): never
{
    // Pass error message back to homepage modal via query string
    header('Location: /?auth_error=' . urlencode($msg));
    exit;
}
