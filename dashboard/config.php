<?php
/**
 * config.php — Environment Configuration Loader
 * Place this file in: dashboard/
 *
 * All DB files (api/db.php, Grades/grades_db.php, attendance/attedance_db.php)
 * load this via: require_once __DIR__ . '/../config.php';
 */

function loadEnv(string $path): void {
    if (!file_exists($path)) return;

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;

        if (strpos($line, '=') !== false) {
            [$key, $value] = explode('=', $line, 2);
            $key   = trim($key);
            $value = trim($value);
            if (($commentPos = strpos($value, ' #')) !== false) {
                $value = trim(substr($value, 0, $commentPos));
            }
            $value = trim($value, '"\'');
            $_ENV[$key] = $value;
            putenv("$key=$value");
        }
    }
}

// .env sits in the same folder as this config.php (dashboard/)
loadEnv(__DIR__ . '/.env');

if (!function_exists('env')) {
    function env(string $key, string $default = ''): string {
        return $_ENV[$key] ?? getenv($key) ?: $default;
    }
}