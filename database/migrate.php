<?php
declare(strict_types=1);
/**
 * Quantum Institut — Database Migration Runner
 *
 * Usage:
 *   php database/migrate.php                       apply all pending migrations
 *   php database/migrate.php --status              list applied / pending, change nothing
 *   php database/migrate.php --baseline            record migrations whose tables, columns
 *                                                  and indexes already exist; apply nothing
 *   php database/migrate.php --baseline --dry-run  show what --baseline would record
 *   php database/migrate.php --dry-run             show what would be applied
 *
 * Fresh database: import database/schema.sql, then run this script with no options.
 * Existing database that never had a `migrations` table (tables were created by hand
 * or by importing the .sql files directly): run --baseline once, then run normally.
 *
 * Each file is split into statements and run one by one. PDO::exec() on a
 * multi-statement string only reports an error from the FIRST statement, so a
 * failure later in the file used to be recorded as "OK".
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$opts     = array_slice($argv, 1);
$baseline = in_array('--baseline', $opts, true);
$status   = in_array('--status', $opts, true);
$dryRun   = in_array('--dry-run', $opts, true) || $status;
foreach ($opts as $o) {
    if (!in_array($o, ['--baseline', '--status', '--dry-run'], true)) {
        fwrite(STDERR, "Unknown option: $o\n");
        exit(2);
    }
}

try {
    // Reuse exactly the connection factory used by the web application.
    // Keeping a second set of variable names here made migrations silently
    // target a different/nonexistent configuration.
    $pdo = getDBConnection();
} catch (PDOException $e) {
    fwrite(STDERR, "DB connection failed: " . $e->getMessage() . "\n");
    exit(1);
}

/**
 * Split a SQL file into statements, dropping comments. Handles quoted strings,
 * backtick identifiers, "-- ", "#" and block comments. The migrations use no
 * stored procedures, so there is no DELIMITER handling.
 */
function qi_sql_statements(string $sql): array
{
    $out = [];
    $buf = '';
    $len = strlen($sql);
    $quote = null;
    for ($i = 0; $i < $len; $i++) {
        $c = $sql[$i];
        $n = $i + 1 < $len ? $sql[$i + 1] : '';
        if ($quote !== null) {
            $buf .= $c;
            if ($c === '\\' && $quote !== '`') {
                $buf .= $n;
                $i++;
            } elseif ($c === $quote) {
                $quote = null;
            }
            continue;
        }
        if ($c === "'" || $c === '"' || $c === '`') {
            $quote = $c;
            $buf .= $c;
        } elseif (($c === '-' && $n === '-' && ($i + 2 >= $len || ctype_space($sql[$i + 2]))) || $c === '#') {
            while ($i < $len && $sql[$i] !== "\n") $i++;
            $buf .= "\n";
        } elseif ($c === '/' && $n === '*') {
            $end = strpos($sql, '*/', $i + 2);
            $i = $end === false ? $len : $end + 1;
            $buf .= ' ';
        } elseif ($c === ';') {
            if (trim($buf) !== '') $out[] = trim($buf);
            $buf = '';
        } else {
            $buf .= $c;
        }
    }
    if (trim($buf) !== '') $out[] = trim($buf);
    return $out;
}

const QI_IDENT = '`?([A-Za-z0-9_]+)`?';

/**
 * What a statement leaves behind, so its presence can be checked:
 * ['table', t] | ['column', t, c] | ['index', t, i] | ['marker'] | ['unknown'].
 */
function qi_sql_effect(string $stmt): array
{
    $s = preg_replace('/\s+/', ' ', $stmt);
    $id = QI_IDENT;
    if (preg_match("/^CREATE TABLE (?:IF NOT EXISTS )?$id/i", $s, $m)) {
        return ['table', $m[1]];
    }
    if (preg_match("/^CREATE (?:UNIQUE |FULLTEXT |SPATIAL )?INDEX (?:IF NOT EXISTS )?$id ON $id/i", $s, $m)) {
        return ['index', $m[2], $m[1]];
    }
    if (preg_match("/^ALTER TABLE $id ADD (.*)$/i", $s, $m)) {
        $rest = $m[2];
        if (preg_match('/,\s*ADD\s/i', $rest) || preg_match('/^(PRIMARY|FOREIGN|PARTITION)\s/i', $rest)) {
            return ['unknown']; // several clauses, or an unnamed key: not used by our migrations
        }
        if (preg_match("/^(?:UNIQUE |FULLTEXT |SPATIAL )?(?:INDEX|KEY) (?:IF NOT EXISTS )?$id/i", $rest, $k)
            || preg_match("/^CONSTRAINT $id (?:UNIQUE|FOREIGN|PRIMARY)/i", $rest, $k)) {
            return ['index', $m[1], $k[1]];
        }
        if (preg_match("/^(?:COLUMN )?(?:IF NOT EXISTS )?$id /i", $rest, $k)) {
            return ['column', $m[1], $k[1]];
        }
    }
    if (preg_match('/^SELECT /i', $s)) {
        return ['marker'];
    }
    return ['unknown'];
}

function qi_effect_present(PDO $pdo, array $e): ?bool
{
    switch ($e[0]) {
        case 'table':
            $q = $pdo->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
            $q->execute([$e[1]]);
            return (int)$q->fetchColumn() > 0;
        case 'column':
            $q = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?');
            $q->execute([$e[1], $e[2]]);
            return (int)$q->fetchColumn() > 0;
        case 'index':
            $q = $pdo->prepare('SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?');
            $q->execute([$e[1], $e[2]]);
            if ((int)$q->fetchColumn() > 0) return true;
            $q = $pdo->prepare('SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?');
            $q->execute([$e[1], $e[2]]);
            return (int)$q->fetchColumn() > 0;
        case 'marker':
            return true;
        default:
            return null; // cannot tell
    }
}

function qi_describe(array $e): string
{
    return match ($e[0]) {
        'table'  => "table {$e[1]}",
        'column' => "column {$e[1]}.{$e[2]}",
        'index'  => "index {$e[1]}.{$e[2]}",
        'marker' => 'marker SELECT (no schema change)',
        default  => 'unverifiable statement',
    };
}

/** Statements of a migration. 001 is a marker for schema.sql, so check that file's tables. */
function qi_migration_statements(string $file): array
{
    $sql = (string)file_get_contents($file);
    if (str_starts_with(trim($sql), '-- Migration 001')) {
        return array_values(array_filter(
            qi_sql_statements((string)@file_get_contents(__DIR__ . '/schema.sql')),
            fn($s) => qi_sql_effect($s)[0] === 'table'
        ));
    }
    return qi_sql_statements($sql);
}

/** Missing objects of a migration: [] = everything present; null entries = unverifiable. */
function qi_missing(PDO $pdo, array $stmts): array
{
    $missing = [];
    foreach ($stmts as $st) {
        $e = qi_sql_effect($st);
        $present = qi_effect_present($pdo, $e);
        if ($present !== true) $missing[] = qi_describe($e);
    }
    return $missing;
}

// --dry-run and --status must not write anything, not even this table.
if (!$dryRun) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `migrations` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `filename` VARCHAR(255) NOT NULL UNIQUE,
        `applied_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

$applied = [];
if (qi_effect_present($pdo, ['table', 'migrations'])) {
    $stmt = $pdo->query("SELECT filename FROM migrations ORDER BY id");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $applied[$row['filename']] = true;
    }
}

$dir = __DIR__ . '/migrations';
$files = glob($dir . '/*.sql');
sort($files);
$record = $dryRun ? null : $pdo->prepare("INSERT INTO migrations (filename) VALUES (?)");

// ---------------------------------------------------------------- --status
if ($status) {
    foreach ($files as $file) {
        $name = basename($file);
        echo (isset($applied[$name]) ? 'applied  ' : 'pending  '), $name, "\n";
    }
    exit(0);
}

// -------------------------------------------------------------- --baseline
if ($baseline) {
    $recorded = 0;
    $left = 0;
    foreach ($files as $file) {
        $name = basename($file);
        if (isset($applied[$name])) {
            echo "ALREADY  $name\n";
            continue;
        }
        $stmts = qi_migration_statements($file);
        $missing = qi_missing($pdo, $stmts);
        if ($missing === []) {
            if (!$dryRun) $record->execute([$name]);
            echo ($dryRun ? 'WOULD RECORD ' : 'RECORD   '), $name, "\n";
            $recorded++;
        } else {
            echo "PENDING  $name  (missing: " . implode(', ', array_unique($missing)) . ")\n";
            $left++;
        }
    }
    echo $dryRun ? "Dry run: nothing written.\n" : "$recorded migration(s) recorded as applied.\n";
    if ($left > 0) {
        echo "$left migration(s) left pending. Run without --baseline to apply them;\n"
           . "statements whose table/column/index already exists are skipped.\n";
    }
    exit(0);
}

// ------------------------------------------------------------------- apply
// A database built before this table existed looks like "nothing applied".
// Applying blindly would fail halfway on an ALTER TABLE ADD COLUMN that is
// already there, so stop and point at --baseline instead.
if ($applied === []) {
    if (qi_effect_present($pdo, ['table', 'users']) !== true) {
        echo "Table `users` not found. Import database/schema.sql first, then run this again.\n";
        exit(1);
    }
    foreach ($files as $file) {
        if (str_starts_with(basename($file), '001_')) continue;
        foreach (qi_sql_statements((string)file_get_contents($file)) as $st) {
            $e = qi_sql_effect($st);
            if ($e[0] === 'table' && qi_effect_present($pdo, $e) === true) {
                echo "The `migrations` table is empty but " . qi_describe($e) . " (from " . basename($file) . ") already exists.\n"
                   . "Run `php database/migrate.php --baseline` first (add --dry-run to preview).\n";
                exit(1);
            }
        }
    }
}

$count = 0;
foreach ($files as $file) {
    $name = basename($file);
    if (isset($applied[$name])) {
        continue;
    }

    $sql = (string)file_get_contents($file);
    if (trim($sql) === '' || str_starts_with(trim($sql), '-- Migration 001')) {
        if (!$dryRun) $record->execute([$name]);
        echo "SKIP  $name (baseline)\n";
        continue;
    }

    echo ($dryRun ? 'WOULD APPLY ' : 'APPLY '), $name, " ...\n";
    foreach (qi_sql_statements($sql) as $i => $st) {
        $e = qi_sql_effect($st);
        if ($e[0] !== 'marker' && qi_effect_present($pdo, $e) === true) {
            echo "      [" . ($i + 1) . "] " . qi_describe($e) . " already present, skipped\n";
            continue;
        }
        if ($dryRun) {
            echo "      [" . ($i + 1) . "] " . qi_describe($e) . "\n";
            continue;
        }
        // Existence was checked above, so drop the MariaDB-only "IF NOT EXISTS"
        // on CREATE INDEX; MySQL 8 rejects it as a syntax error.
        if ($e[0] === 'index') {
            $st = preg_replace('/^(CREATE\s+(?:UNIQUE\s+|FULLTEXT\s+|SPATIAL\s+)?INDEX\s+)IF\s+NOT\s+EXISTS\s+/i', '$1', $st);
        }
        try {
            // query() + closeCursor() rather than exec(): a marker SELECT (015)
            // otherwise leaves an unread result set and the next query fails
            // with "Cannot execute queries while other unbuffered queries are active".
            $r = $pdo->query($st);
            if ($r instanceof PDOStatement) $r->closeCursor();
        } catch (PDOException $e2) {
            echo "FAIL in statement " . ($i + 1) . ": " . $e2->getMessage() . "\n";
            echo "DDL is not transactional: earlier statements of $name stay applied.\n"
               . "Fix the cause and run again; they will be skipped as already present.\n";
            exit(1);
        }
    }
    if (!$dryRun) {
        $record->execute([$name]);
        echo "      OK\n";
    }
    $count++;
}

if ($dryRun) {
    echo "Dry run: nothing written.\n";
} else {
    echo $count === 0 ? "All migrations up to date.\n" : "$count migration(s) applied.\n";
}
