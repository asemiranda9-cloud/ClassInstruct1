<?php
/**
 * archive_db.php — ClassInstruct End-of-Year Student Archive Backend
 *
 * Place this file in the SAME folder as db.php (the one Student.js talks to),
 * next to StudentArchive.html / StudentArchive.js.
 *
 * What it does:
 *   - Lets a teacher move ALL of their current students out of the active
 *     "students" table into an "archived_students" table, tagged with a
 *     school-year label (e.g. "SY 2025-2026") — either on demand ("Archive
 *     Now") or automatically once a scheduled date has passed.
 *   - Grades / grade item scores tied to those students are copied over too
 *     (so report cards aren't lost) before the active rows are deleted.
 *   - Archived students can be listed, searched, permanently deleted, or
 *     restored back into the active roster if archived by mistake.
 *
 * IMPORTANT — about the "automatic schedule":
 *   Shared PHP hosting usually has no real cron access, so this uses a
 *   "soft" scheduler: every time StudentArchive.js or Student.js loads, it
 *   quietly calls ?action=check_schedule, which runs the archive job if
 *   today has reached the scheduled date. That means the automatic run
 *   fires the next time someone opens the app on/after that date — not at
 *   the exact minute it arrives. If your host DOES give you real cron
 *   access, you can instead point a daily cron job at:
 *     php archive_db.php-as-cli is not supported; use:
 *     curl "https://yourdomain.com/path/to/archive_db.php?action=check_schedule"
 *   for a true background-scheduled run.
 */

require_once __DIR__ . '/../config.php';

ini_set('display_errors', 0);
error_reporting(0);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

if (!defined('DB_HOST')) define('DB_HOST', env('DB_HOST', '127.0.0.1'));
if (!defined('DB_PORT')) define('DB_PORT', env('DB_PORT', '3306'));
if (!defined('DB_USER')) define('DB_USER', env('DB_USER', 'root'));
if (!defined('DB_PASS')) define('DB_PASS', env('DB_PASS', ''));
if (!defined('DB_NAME')) define('DB_NAME', env('DB_NAME', 'classinstructdb'));

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, (int)DB_PORT);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'DB connection failed: ' . $conn->connect_error]);
    exit;
}
$conn->set_charset('utf8mb4');

// ── Session check ───────────────────────────────────────────────────────
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_path', '/');
    session_name('CI_SESSION');
    session_start();
}
$userId = $_SESSION['ci_user']['user_id'] ?? null;
if (!$userId) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized. Please login.']);
    exit;
}

// ═══════════════════════════════════════════════════════════════════════
//  SCHEMA HELPERS
// ═══════════════════════════════════════════════════════════════════════
function tableExists($conn, $table) {
    $t = $conn->real_escape_string($table);
    $r = $conn->query("SHOW TABLES LIKE '$t'");
    return $r && $r->num_rows > 0;
}
function columnExists($conn, $table, $col) {
    $t = $conn->real_escape_string($table);
    $c = $conn->real_escape_string($col);
    $r = $conn->query("SHOW COLUMNS FROM `$t` LIKE '$c'");
    return $r && $r->num_rows > 0;
}
function ensureColumn($conn, $table, $col, $ddl) {
    if (!columnExists($conn, $table, $col)) {
        $conn->query("ALTER TABLE `$table` ADD COLUMN $ddl");
    }
}
// Drop any UNIQUE index (besides PRIMARY) copied over via `LIKE`, since an
// archive table must be able to hold the same student id / LRN more than
// once across multiple school years.
function dropNonPrimaryUniqueKeys($conn, $table) {
    $r = $conn->query("SHOW INDEX FROM `$table` WHERE Non_unique = 0 AND Key_name != 'PRIMARY'");
    if (!$r) return;
    $seen = [];
    while ($row = $r->fetch_assoc()) {
        $seen[$row['Key_name']] = true;
    }
    foreach (array_keys($seen) as $keyName) {
        $conn->query("ALTER TABLE `$table` DROP INDEX `$keyName`");
    }
}

function initTables($conn) {
    // Settings singleton table (one row per teacher/user)
    $conn->query("
        CREATE TABLE IF NOT EXISTS archive_settings (
            user_id INT PRIMARY KEY,
            enabled TINYINT(1) NOT NULL DEFAULT 0,
            scheduled_date DATE DEFAULT NULL,
            school_year_label VARCHAR(30) DEFAULT NULL,
            auto_recurring TINYINT(1) NOT NULL DEFAULT 0,
            last_run_at TIMESTAMP NULL DEFAULT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ");

    if (!tableExists($conn, 'students')) return; // nothing to mirror yet

    if (!tableExists($conn, 'archived_students')) {
        $conn->query("CREATE TABLE archived_students LIKE students");
        dropNonPrimaryUniqueKeys($conn, 'archived_students');
    }
    ensureColumn($conn, 'archived_students', 'school_year', "school_year VARCHAR(30) DEFAULT NULL");
    ensureColumn($conn, 'archived_students', 'archived_at', "archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

    if (tableExists($conn, 'grades') && !tableExists($conn, 'archived_grades')) {
        $conn->query("CREATE TABLE archived_grades LIKE grades");
        dropNonPrimaryUniqueKeys($conn, 'archived_grades');
    }
    if (tableExists($conn, 'grade_item_scores') && !tableExists($conn, 'archived_grade_item_scores')) {
        $conn->query("CREATE TABLE archived_grade_item_scores LIKE grade_item_scores");
        dropNonPrimaryUniqueKeys($conn, 'archived_grade_item_scores');
    }
}
initTables($conn);

// ═══════════════════════════════════════════════════════════════════════
//  CORE: ARCHIVE ALL CURRENT STUDENTS FOR THIS USER
// ═══════════════════════════════════════════════════════════════════════
function archiveAllStudents($conn, $userId, $schoolYearLabel, $section = '') {
    if (!tableExists($conn, 'students')) {
        return ['error' => 'students table not found'];
    }
    $schoolYearLabel = $schoolYearLabel !== '' ? $schoolYearLabel : date('Y') . '-' . (date('Y') + 1);

    $section = trim((string)$section);
    if ($section !== '' && strtolower($section) !== 'all') {
        $secEsc = $conn->real_escape_string($section);
        $idsRes = $conn->query("SELECT id FROM students WHERE user_id = $userId AND section = '$secEsc'");
    } else {
        $idsRes = $conn->query("SELECT id FROM students WHERE user_id = $userId");
    }
    $ids = [];
    while ($row = $idsRes->fetch_assoc()) $ids[] = (int)$row['id'];

    if (count($ids) === 0) {
        return ['archivedCount' => 0, 'schoolYear' => $schoolYearLabel, 'students' => []];
    }
    $idList = implode(',', $ids);

    $conn->begin_transaction();
    try {
        $studentCols = [];
        $r = $conn->query("SHOW COLUMNS FROM students");
        while ($c = $r->fetch_assoc()) $studentCols[] = "`{$c['Field']}`";
        $colList = implode(',', $studentCols);
        $syEsc = $conn->real_escape_string($schoolYearLabel);

        $ok = $conn->query("
            INSERT INTO archived_students ($colList, school_year, archived_at)
            SELECT $colList, '$syEsc', NOW() FROM students WHERE id IN ($idList)
        ");
        if (!$ok) throw new Exception('Failed to copy students: ' . $conn->error);

        if (tableExists($conn, 'grades')) {
            $gCols = [];
            $r2 = $conn->query("SHOW COLUMNS FROM grades");
            while ($c = $r2->fetch_assoc()) $gCols[] = "`{$c['Field']}`";
            $gColList = implode(',', $gCols);
            $conn->query("
                INSERT INTO archived_grades ($gColList)
                SELECT $gColList FROM grades WHERE student_id IN ($idList)
            ");
        }
        if (tableExists($conn, 'grade_item_scores')) {
            $iCols = [];
            $r3 = $conn->query("SHOW COLUMNS FROM grade_item_scores");
            while ($c = $r3->fetch_assoc()) $iCols[] = "`{$c['Field']}`";
            $iColList = implode(',', $iCols);
            $conn->query("
                INSERT INTO archived_grade_item_scores ($iColList)
                SELECT $iColList FROM grade_item_scores WHERE student_id IN ($idList)
            ");
        }

        // ── Snapshot each archived student + their grades, BEFORE the active
        //    rows disappear, so the frontend can drop a Library entry (with a
        //    grades Excel attached) for every student in one round trip. ──
        $studentsSnapshot = [];
        $sRes = $conn->query("SELECT * FROM archived_students WHERE id IN ($idList)");
        while ($row = $sRes->fetch_assoc()) $studentsSnapshot[] = $row;

        $gradesByStudent = [];
        if (tableExists($conn, 'archived_grades')) {
            $gRes = $conn->query("
                SELECT student_id, subject, quarter, written_works, performance_tasks,
                       quarterly_assessment, attendance, final_grade
                FROM archived_grades WHERE student_id IN ($idList)
                ORDER BY subject ASC, quarter ASC
            ");
            while ($g = $gRes->fetch_assoc()) {
                $sid = (int)$g['student_id'];
                unset($g['student_id']);
                $gradesByStudent[$sid][] = $g;
            }
        }

        // Deleting from students cascades to grades / grade_item_scores
        // (both declared ON DELETE CASCADE against students.id).
        $delOk = $conn->query("DELETE FROM students WHERE id IN ($idList)");
        if (!$delOk) throw new Exception('Failed to clear active roster: ' . $conn->error);

        $conn->commit();

        // Normalize each snapshot row the same way listArchived() does, and
        // attach its grade rows.
        $cols = [];
        $r4 = $conn->query("SHOW COLUMNS FROM archived_students");
        while ($c = $r4->fetch_assoc()) $cols[] = $c['Field'];
        $nameCol  = in_array('fullName', $cols) ? 'fullName' : (in_array('full_name', $cols) ? 'full_name' : null);
        $sidCol   = in_array('studentId', $cols) ? 'studentId' : (in_array('student_id', $cols) ? 'student_id' : 'id');
        $gradeCol = in_array('grade', $cols) ? 'grade' : (in_array('grade_level', $cols) ? 'grade_level' : 'grade');

        $studentsOut = array_map(function($row) use ($nameCol, $sidCol, $gradeCol, $gradesByStudent) {
            $mapped = mapArchivedRow($row, $nameCol, $sidCol, $gradeCol);
            $mapped['grades'] = $gradesByStudent[(int)$row['id']] ?? [];
            return $mapped;
        }, $studentsSnapshot);

        return ['archivedCount' => count($ids), 'schoolYear' => $schoolYearLabel, 'students' => $studentsOut];
    } catch (Exception $e) {
        $conn->rollback();
        return ['error' => $e->getMessage()];
    }
}

// ═══════════════════════════════════════════════════════════════════════
//  ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════
function getSettings($conn, $userId) {
    $r = $conn->query("SELECT * FROM archive_settings WHERE user_id = $userId");
    $row = $r ? $r->fetch_assoc() : null;
    if (!$row) {
        echo json_encode([
            'enabled' => false, 'scheduledDate' => null, 'schoolYearLabel' => null,
            'autoRecurring' => false, 'lastRunAt' => null,
        ]);
        return;
    }
    echo json_encode([
        'enabled'         => (bool)$row['enabled'],
        'scheduledDate'   => $row['scheduled_date'],
        'schoolYearLabel' => $row['school_year_label'],
        'autoRecurring'   => (bool)$row['auto_recurring'],
        'lastRunAt'       => $row['last_run_at'],
    ]);
}

function saveSettings($conn, $userId) {
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $enabled  = !empty($body['enabled']) ? 1 : 0;
    $date     = !empty($body['scheduledDate']) ? $conn->real_escape_string($body['scheduledDate']) : null;
    $label    = isset($body['schoolYearLabel']) ? $conn->real_escape_string(trim($body['schoolYearLabel'])) : '';
    $auto     = !empty($body['autoRecurring']) ? 1 : 0;

    if ($enabled && !$date) {
        http_response_code(400);
        echo json_encode(['error' => 'A scheduled date is required to enable auto-archiving.']);
        return;
    }
    $dateSql = $date ? "'$date'" : 'NULL';
    $conn->query("
        INSERT INTO archive_settings (user_id, enabled, scheduled_date, school_year_label, auto_recurring)
        VALUES ($userId, $enabled, $dateSql, '$label', $auto)
        ON DUPLICATE KEY UPDATE enabled=$enabled, scheduled_date=$dateSql, school_year_label='$label', auto_recurring=$auto
    ");
    echo json_encode(['success' => true]);
}

function archiveNow($conn, $userId) {
    $body    = json_decode(file_get_contents('php://input'), true) ?: [];
    $label   = isset($body['schoolYearLabel']) ? trim($body['schoolYearLabel']) : '';
    $section = isset($body['section']) ? trim($body['section']) : '';
    $result = archiveAllStudents($conn, $userId, $label, $section);
    if (isset($result['error'])) { http_response_code(500); echo json_encode($result); return; }

    $conn->query("
        INSERT INTO archive_settings (user_id, enabled, last_run_at)
        VALUES ($userId, 0, NOW())
        ON DUPLICATE KEY UPDATE last_run_at = NOW(), enabled = 0
    ");
    echo json_encode(['success' => true] + $result);
}

// Soft-scheduler: call this on every page load. Runs the archive job
// exactly once per scheduled date if it has arrived and hasn't run yet.
function checkSchedule($conn, $userId) {
    $r = $conn->query("SELECT * FROM archive_settings WHERE user_id = $userId");
    $row = $r ? $r->fetch_assoc() : null;
    if (!$row || !$row['enabled'] || !$row['scheduled_date']) {
        echo json_encode(['ran' => false]);
        return;
    }
    $today = date('Y-m-d');
    $due = $row['scheduled_date'] <= $today;
    $alreadyRanToday = $row['last_run_at'] && date('Y-m-d', strtotime($row['last_run_at'])) >= $row['scheduled_date'];
    if (!$due || $alreadyRanToday) {
        echo json_encode(['ran' => false]);
        return;
    }

    $label  = $row['school_year_label'] ?: (date('Y') . '-' . (date('Y') + 1));
    $result = archiveAllStudents($conn, $userId, $label);
    if (isset($result['error'])) { echo json_encode(['ran' => false, 'error' => $result['error']]); return; }

    if ($row['auto_recurring']) {
        // Push the schedule forward exactly one year for next time.
        $next = date('Y-m-d', strtotime($row['scheduled_date'] . ' +1 year'));
        $conn->query("UPDATE archive_settings SET last_run_at = NOW(), scheduled_date = '$next' WHERE user_id = $userId");
    } else {
        $conn->query("UPDATE archive_settings SET last_run_at = NOW(), enabled = 0 WHERE user_id = $userId");
    }

    echo json_encode(['ran' => true] + $result);
}

// Mirrors db.php's mapRow(): DB only stores one combined name field
// (full_name or fullName) — split it into firstName/middleName/lastName
// for the frontend, and normalise the other JS-style keys it expects.
function mapArchivedRow($row, $nameCol, $sidCol, $gradeCol) {
    $fullName = $nameCol ? ($row[$nameCol] ?? '') : trim(($row['firstName'] ?? '') . ' ' . ($row['lastName'] ?? ''));
    $parts = preg_split('/\s+/', trim($fullName));
    $parts = array_filter($parts, fn($p) => $p !== '');
    $parts = array_values($parts);
    $firstName = $parts[0] ?? '';
    $middleName = '';
    $lastName = '';
    if (count($parts) >= 3) {
        $middleName = $parts[1];
        $lastName = implode(' ', array_slice($parts, 2));
    } elseif (count($parts) === 2) {
        $lastName = $parts[1];
    } elseif (count($parts) === 1) {
        $lastName = $parts[0];
    }

    $out = $row; // keep every raw column too, in case it's useful
    $out['firstName']  = $row['firstName']  ?? $firstName;
    $out['middleName'] = $row['middleName'] ?? $middleName;
    $out['lastName']   = $row['lastName']   ?? $lastName;
    $out['fullName']   = $fullName;
    $out['studentId']  = $row[$sidCol] ?? null;
    $out['grade']      = $row[$gradeCol] ?? ($row['grade'] ?? null);
    $out['id']         = (int)$row['id'];
    return $out;
}

function listArchived($conn, $userId) {
    if (!tableExists($conn, 'archived_students')) { echo json_encode([]); return; }
    $year    = $_GET['schoolYear'] ?? '';
    $q       = $_GET['q'] ?? '';
    $grade   = $_GET['grade'] ?? '';
    $section = $_GET['section'] ?? '';

    $cols = [];
    $r = $conn->query("SHOW COLUMNS FROM archived_students");
    while ($c = $r->fetch_assoc()) $cols[] = $c['Field'];
    $nameCol    = in_array('fullName', $cols) ? 'fullName' : (in_array('full_name', $cols) ? 'full_name' : null);
    $sidCol     = in_array('studentId', $cols) ? 'studentId' : (in_array('student_id', $cols) ? 'student_id' : 'id');
    $gradeCol   = in_array('grade', $cols) ? 'grade' : (in_array('grade_level', $cols) ? 'grade_level' : 'grade');
    $sectionCol = in_array('section', $cols) ? 'section' : 'section';

    $where  = "WHERE user_id = ?";
    $types  = 'i';
    $params = [$userId];
    if ($year)    { $where .= " AND school_year = ?"; $types .= 's'; $params[] = $year; }
    if ($grade)   { $where .= " AND `$gradeCol` = ?"; $types .= 's'; $params[] = $grade; }
    if ($section) { $where .= " AND `$sectionCol` = ?"; $types .= 's'; $params[] = $section; }
    if ($q) {
        $like = '%' . $q . '%';
        if ($nameCol) {
            $where .= " AND (`$nameCol` LIKE ? OR `$sidCol` LIKE ?)";
            $types .= 'ss';
            array_push($params, $like, $like);
        } else {
            $where .= " AND `$sidCol` LIKE ?";
            $types .= 's';
            array_push($params, $like);
        }
    }

    $orderCol = $nameCol ? "`$nameCol`" : "`$sidCol`";
    $sql = "SELECT * FROM archived_students $where ORDER BY archived_at DESC, $orderCol ASC";
    $stmt = $conn->prepare($sql);
    if (!$stmt) { http_response_code(500); echo json_encode(['error' => $conn->error]); return; }
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $res = $stmt->get_result();
    $rows = [];
    while ($row = $res->fetch_assoc()) $rows[] = mapArchivedRow($row, $nameCol, $sidCol, $gradeCol);
    echo json_encode($rows);
}

function listYears($conn, $userId) {
    if (!tableExists($conn, 'archived_students')) { echo json_encode([]); return; }
    $r = $conn->query("
        SELECT school_year, COUNT(*) as count
        FROM archived_students
        WHERE user_id = $userId AND school_year IS NOT NULL AND school_year != ''
        GROUP BY school_year ORDER BY school_year DESC
    ");
    $rows = [];
    while ($row = $r->fetch_assoc()) $rows[] = $row;
    echo json_encode($rows);
}

function restoreStudent($conn, $userId) {
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $id = (int)($body['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'Missing id']); return; }

    $check = $conn->query("SELECT id FROM archived_students WHERE id = $id AND user_id = $userId LIMIT 1");
    if (!$check || $check->num_rows === 0) {
        http_response_code(404); echo json_encode(['error' => 'Archived record not found']); return;
    }

    $cols = [];
    $r = $conn->query("SHOW COLUMNS FROM students");
    while ($c = $r->fetch_assoc()) $cols[] = "`{$c['Field']}`";
    $colList = implode(',', $cols);

    $conn->begin_transaction();
    try {
        $ok = $conn->query("INSERT INTO students ($colList) SELECT $colList FROM archived_students WHERE id = $id");
        if (!$ok) throw new Exception($conn->error);

        if (tableExists($conn, 'archived_grades')) {
            $gCols = [];
            $r2 = $conn->query("SHOW COLUMNS FROM grades");
            while ($c = $r2->fetch_assoc()) $gCols[] = "`{$c['Field']}`";
            $gColList = implode(',', $gCols);
            $conn->query("INSERT INTO grades ($gColList) SELECT $gColList FROM archived_grades WHERE student_id = $id");
        }
        if (tableExists($conn, 'archived_grade_item_scores')) {
            $iCols = [];
            $r3 = $conn->query("SHOW COLUMNS FROM grade_item_scores");
            while ($c = $r3->fetch_assoc()) $iCols[] = "`{$c['Field']}`";
            $iColList = implode(',', $iCols);
            $conn->query("INSERT INTO grade_item_scores ($iColList) SELECT $iColList FROM archived_grade_item_scores WHERE student_id = $id");
        }

        $conn->query("DELETE FROM archived_students WHERE id = $id");
        if (tableExists($conn, 'archived_grades')) $conn->query("DELETE FROM archived_grades WHERE student_id = $id");
        if (tableExists($conn, 'archived_grade_item_scores')) $conn->query("DELETE FROM archived_grade_item_scores WHERE student_id = $id");

        $conn->commit();
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        $conn->rollback();
        http_response_code(500);
        echo json_encode(['error' => 'Restore failed: ' . $e->getMessage()]);
    }
}

function deleteArchived($conn, $userId) {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'Missing id']); return; }
    $check = $conn->query("SELECT id FROM archived_students WHERE id = $id AND user_id = $userId LIMIT 1");
    if (!$check || $check->num_rows === 0) {
        http_response_code(404); echo json_encode(['error' => 'Archived record not found']); return;
    }
    if (tableExists($conn, 'archived_grades')) $conn->query("DELETE FROM archived_grades WHERE student_id = $id");
    if (tableExists($conn, 'archived_grade_item_scores')) $conn->query("DELETE FROM archived_grade_item_scores WHERE student_id = $id");
    $conn->query("DELETE FROM archived_students WHERE id = $id");
    echo json_encode(['success' => true]);
}

// ═══════════════════════════════════════════════════════════════════════
//  ROUTER
// ═══════════════════════════════════════════════════════════════════════
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        switch ($action) {
            case 'settings':       getSettings($conn, $userId);   break;
            case 'list':           listArchived($conn, $userId);  break;
            case 'years':          listYears($conn, $userId);     break;
            case 'check_schedule': checkSchedule($conn, $userId); break;
            default: http_response_code(400); echo json_encode(['error' => 'Unknown action']);
        }
        break;
    case 'POST':
        switch ($action) {
            case 'save_settings': saveSettings($conn, $userId); break;
            case 'archive_now':   archiveNow($conn, $userId);   break;
            case 'restore':       restoreStudent($conn, $userId); break;
            default: http_response_code(400); echo json_encode(['error' => 'Unknown action']);
        }
        break;
    case 'DELETE':
        switch ($action) {
            case 'delete': deleteArchived($conn, $userId); break;
            default: http_response_code(400); echo json_encode(['error' => 'Unknown action']);
        }
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
$conn->close();