<?php
declare(strict_types=1);

/**
 * db.php — Shared MySQLi database connection using .env credentials
 */

$dotenvPath = __DIR__ . '/.env';
if (file_exists($dotenvPath)) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
    $dotenv->load();
}

$host     = $_ENV['DB_HOST']     ?? '127.0.0.1';
$port     = $_ENV['DB_PORT']     ?? '3306';
$database = $_ENV['DB_DATABASE'] ?? 'classinstructdb';
$username = $_ENV['DB_USERNAME'] ?? 'root';
$password = $_ENV['DB_PASSWORD'] ?? '';

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

try {
    $conn = new mysqli($host, $username, $password, $database, (int) $port);
    $conn->set_charset('utf8mb4');
} catch (mysqli_sql_exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed', 'details' => $e->getMessage()]);
    exit;
}
