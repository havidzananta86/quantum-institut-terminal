<?php
declare(strict_types=1);
/**
 * Quantum Institut — Database Migration Runner
 *
 * Usage: php database/migrate.php
 * Applies all pending SQL migrations from database/migrations/ in order.
 */

require_once __DIR__ . '/../config/database.php';

try {
    $pdo = new PDO(
        "mysql:host=$db_host;dbname=$db_name;charset=utf8mb4",
        $db_user,
        $db_pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    fwrite(STDERR, "DB connection failed: " . $e->getMessage() . "\n");
    exit(1);
}

$pdo->exec("CREATE TABLE IF NOT EXISTS `migrations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `filename` VARCHAR(255) NOT NULL UNIQUE,
    `applied_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$applied = [];
$stmt = $pdo->query("SELECT filename FROM migrations ORDER BY id");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $applied[$row['filename']] = true;
}

$dir = __DIR__ . '/migrations';
$files = glob($dir . '/*.sql');
sort($files);

$count = 0;
foreach ($files as $file) {
    $name = basename($file);
    if (isset($applied[$name])) {
        continue;
    }

    $sql = file_get_contents($file);
    if (empty(trim($sql)) || str_starts_with(trim($sql), '-- Migration 001')) {
        $pdo->prepare("INSERT INTO migrations (filename) VALUES (?)")->execute([$name]);
        echo "SKIP  $name (baseline)\n";
        continue;
    }

    echo "APPLY $name ... ";
    try {
        $pdo->exec($sql);
        $pdo->prepare("INSERT INTO migrations (filename) VALUES (?)")->execute([$name]);
        echo "OK\n";
        $count++;
    } catch (PDOException $e) {
        echo "FAIL: " . $e->getMessage() . "\n";
        exit(1);
    }
}

echo $count === 0 ? "All migrations up to date.\n" : "$count migration(s) applied.\n";
