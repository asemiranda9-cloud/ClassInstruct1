<?php
declare(strict_types=1);

/**
 * google_oauth.php
 * ClassInstruct — Google OAuth 2.0 Handler
 *
 * Two entry points:
 *   GET ?action=redirect  → sends the browser to Google's consent screen
 *   GET ?action=callback  → Google redirects back here with ?code=...
 *
 * Requirements:
 *   composer require league/oauth2-google vlucas/phpdotenv
 *
 * Setup (Google Cloud Console):
 *   1. Create a project → APIs & Services → Credentials
 *   2. Create OAuth 2.0 Client ID (Web application)
 *   3. Add Authorized redirect URI: http://localhost/ClassInstruct1/homepage/google_oauth.php?action=callback
 *   4. Copy Client ID + Client Secret into your .env file (NEVER hardcode them)
 */

// ─── Load Composer autoload ────────────────────────────────────────────────────
$autoload = __DIR__ . '/vendor/autoload.php';
if (!file_exists($autoload)) {
    die('Server error: Run composer require league/oauth2-google vlucas/phpdotenv');
}
require $autoload;

// ─── Load .env ─────────────────────────────────────────────────────────────────
$dotenvPath = __DIR__ . '/.env';
if (file_exists($dotenvPath)) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
    $dotenv->load();
    $dotenv->required(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'APP_URL'])->notEmpty();
}

// ─── Config (reads from .env) ──────────────────────────────────────────────────
$config = [
    'client_id'     => $_ENV['GOOGLE_CLIENT_ID']     ?? '',
    'client_secret' => $_ENV['GOOGLE_CLIENT_SECRET'] ?? '',
    'redirect_uri'  => ($_ENV['APP_URL'] ?? '') . '/google_oauth.php?action=callback',
    'scopes'        => ['openid', 'email', 'profile'],
];

session_start();

use League\OAuth2\Client\Provider\Google;

$provider = new Google([
    'clientId'     => $config['client_id'],
    'clientSecret' => $config['client_secret'],
    'redirectUri'  => $config['redirect_uri'],
]);

$action = $_GET['action'] ?? '';

// ══════════════════════════════════════════════════════════════════════════════
// STEP 1 — Redirect to Google
// ══════════════════════════════════════════════════════════════════════════════
if ($action === 'redirect') {

    $authUrl = $provider->getAuthorizationUrl([
        'scope'  => $config['scopes'],
        'prompt' => 'select_account',
    ]);

    $_SESSION['oauth2_state'] = $provider->getState();

    header('Location: ' . $authUrl);
    exit;
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 2 — Handle callback from Google
// ══════════════════════════════════════════════════════════════════════════════
if ($action === 'callback') {

    if (empty($_GET['state']) || $_GET['state'] !== ($_SESSION['oauth2_state'] ?? '')) {
        unset($_SESSION['oauth2_state']);
        redirectWithError('OAuth state mismatch. Please try again.');
    }
    unset($_SESSION['oauth2_state']);

    if (!empty($_GET['error'])) {
        redirectWithError('Google sign-in was cancelled.');
    }

    if (empty($_GET['code'])) {
        redirectWithError('No authorisation code received from Google.');
    }

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

        session_regenerate_id(true);
        $_SESSION['ci_user'] = [
            'email'       => $email,
            'name'        => $name,
            'google_id'   => $googleId,
            'avatar'      => $avatar,
            'auth_method' => 'google',
            'authed_at'   => time(),
        ];

        header('Location: /ClassInstruct1/dashboard/sidebar.html');
        exit;

    } catch (\Exception $e) {
        error_log('[ClassInstruct] Google OAuth error: ' . $e->getMessage());
        redirectWithError('Google sign-in failed. Please try again.');
    }
}

http_response_code(400);
echo 'Bad request.';

function redirectWithError(string $msg): never
{
    header('Location: /ClassInstruct1/homepage/homepage.php?auth_error=' . urlencode($msg));
    exit;
}