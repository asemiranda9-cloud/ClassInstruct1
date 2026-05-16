<?php
// ═══════════════════════════════════════════════════════
//  attendance_db.php — ClassInstruct Attendance Backend
//  Works with existing students table (grade + section cols)
// ═══════════════════════════════════════════════════════

require_once __DIR__ . '/../config.php';

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

// ── Check user session ───────────────────────────────────────────────────────
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

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        switch ($action) {
            case 'sections':      getSections($conn);      break;
            case 'students':      getStudents($conn);      break;
            case 'attendance':    getAttendance($conn);   break;
            case 'summary':       getSummary($conn);       break;
            case 'schoolCalendar':getSchoolCalendar($conn);break;
            case 'monthlyReport': getMonthlyReport($conn); break;
            default:
                http_response_code(400);
                echo json_encode(['error' => 'Unknown action. Use: sections | students | attendance | summary | schoolCalendar']);
        }
        break;
    case 'POST':   saveAttendance($conn);   break;
    case 'PUT':    updateAttendance($conn); break;
    case 'DELETE': deleteAttendance($conn); break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
$conn->close();


// ═══════════════════════════════════════════════
//  GET sections
//  Returns distinct grade+section combos from students table
//  Each combo gets a stable virtual ID using DENSE_RANK
// ═══════════════════════════════════════════════
function getSections($conn) {
    global $userId;
    $result = $conn->query(
        "SELECT DISTINCT grade, section,
                CONCAT(grade, ' - ', section) AS name
         FROM students
         WHERE user_id = $userId AND (status IS NULL OR status != 'Dropout')
         ORDER BY grade ASC, section ASC"
    );
    if (!$result) {
        http_response_code(500);
        echo json_encode(['error' => $conn->error]);
        return;
    }
    $rows = [];
    $id   = 1;
    while ($r = $result->fetch_assoc()) {
        $rows[] = [
            'id'      => $id++,
            'grade'   => $r['grade'],
            'section' => $r['section'],
            'name'    => $r['name'],
        ];
    }
    echo json_encode($rows);
}


// ═══════════════════════════════════════════════
//  GET students
//  ?action=students[&grade=Grade+5&section=Section+A]
// ═══════════════════════════════════════════════
function getStudents($conn) {
    global $userId;
    $grade   = $_GET['grade']   ?? '';
    $section = $_GET['section'] ?? '';

    $sql  = "SELECT id, student_id, full_name, gender, grade, section FROM students WHERE user_id = $userId AND (status IS NULL OR status != 'Dropout')";
    $args = [];

    if ($grade !== '') {
        $g = $conn->real_escape_string($grade);
        $sql .= " AND grade = '$g'";
    }
    if ($section !== '') {
        $s = $conn->real_escape_string($section);
        $sql .= " AND section = '$s'";
    }
    $sql .= " ORDER BY full_name ASC";

    $result = $conn->query($sql);
    if (!$result) {
        http_response_code(500);
        echo json_encode(['error' => $conn->error]);
        return;
    }
    $rows = [];
    while ($r = $result->fetch_assoc()) $rows[] = $r;
    echo json_encode($rows);
}


// ═══════════════════════════════════════════════
//  GET attendance grid
//  ?action=attendance&start=YYYY-MM-DD&end=YYYY-MM-DD[&grade=...&section=...]
//
//  Returns `dates` = the requested window (7 days for week view).
//  Returns `statuses` = ALL historical records per student so the
//  front-end can compute correct year-to-date quarter pill counts.
//  Returns `schoolDays` = total school days per quarter (from school_calendar).
// ═══════════════════════════════════════════════
function getAttendance($conn) {
    global $userId;
    $grade   = $conn->real_escape_string($_GET['grade']   ?? '');
    $section = $conn->real_escape_string($_GET['section'] ?? '');

    // Accept start/end (week view) OR fall back to year/month (legacy)
    if (!empty($_GET['start']) && !empty($_GET['end'])) {
        $fromDate = $conn->real_escape_string($_GET['start']);
        $toDate   = $conn->real_escape_string($_GET['end']);
        $dates = [];
        $cur = new DateTime($fromDate);
        $end = new DateTime($toDate);
        while ($cur <= $end) {
            $dates[] = $cur->format('Y-m-d');
            $cur->modify('+1 day');
        }
    } else {
        // Legacy month-based fallback
        $year  = isset($_GET['year'])  ? (int)$_GET['year']  : (int)date('Y');
        $month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('m');
        $daysInMonth = cal_days_in_month(CAL_GREGORIAN, $month, $year);
        $fromDate = sprintf('%04d-%02d-01', $year, $month);
        $toDate   = sprintf('%04d-%02d-%02d', $year, $month, $daysInMonth);
        $dates = [];
        for ($d = 1; $d <= $daysInMonth; $d++) {
            $dates[] = sprintf('%04d-%02d-%02d', $year, $month, $d);
        }
    }

    // Ensure school_calendar exists and is seeded
    ensureSchoolCalendar($conn);

    // Fetch school-day counts per quarter
    $schoolDays = getSchoolDaysPerQuarter($conn);

    $where = "WHERE s.user_id = $userId AND (s.status IS NULL OR s.status != 'Dropout')";
    if ($grade)   $where .= " AND s.grade = '$grade'";
    if ($section) $where .= " AND s.section = '$section'";

    $result = $conn->query(
        "SELECT s.id, s.full_name, s.gender
         FROM students s $where
         ORDER BY s.full_name ASC"
    );
    if (!$result) {
        http_response_code(500);
        echo json_encode(['error' => $conn->error]);
        return;
    }

    $students   = [];
    $studentIds = [];
    while ($r = $result->fetch_assoc()) {
        $students[$r['id']] = [
            'id'        => (int)$r['id'],
            'full_name' => $r['full_name'],
            'gender'    => $r['gender'],
            'avatar'    => '',
            'statuses'  => [],   // ALL historical records for YTD quarter counts
        ];
        $studentIds[] = (int)$r['id'];
    }

    if (!empty($studentIds)) {
        $idList = implode(',', $studentIds);
        // Fetch ALL attendance history so JS can compute YTD quarter totals
        $atResult = $conn->query(
            "SELECT student_id, DATE_FORMAT(date,'%Y-%m-%d') AS date, status
             FROM attendance
             WHERE student_id IN ($idList)"
        );
        while ($r = $atResult->fetch_assoc()) {
            if (isset($students[$r['student_id']])) {
                $students[$r['student_id']]['statuses'][$r['date']] = $r['status'];
            }
        }
    }

    echo json_encode([
        'dates'       => $dates,
        'students'    => array_values($students),
        'schoolDays'  => $schoolDays,
    ]);
}


// ═══════════════════════════════════════════════
//  school_calendar — auto-create + seed
// ═══════════════════════════════════════════════

/** Creates the school_calendar table if it doesn't exist and seeds it. */
function ensureSchoolCalendar($conn) {
    $tableExists = $conn->query("SHOW TABLES LIKE 'school_calendar'")->num_rows > 0;
    if ($tableExists) return;

    $conn->query("
        CREATE TABLE school_calendar (
            date DATE PRIMARY KEY,
            is_school_day TINYINT(1) NOT NULL DEFAULT 1,
            quarter VARCHAR(3) NOT NULL DEFAULT '',
            holiday_name VARCHAR(255) NOT NULL DEFAULT '',
            INDEX idx_is_school_day (is_school_day),
            INDEX idx_quarter (quarter)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    // ── 2025-2026 DepEd Academic Calendar (Philippines) ──────────────────────
    // Q1: June–August 2025  |  Q2: September–October 2025
    // Q3: November 2025–January 2026  |  Q4: February–May 2026
    //
    // Key holidays (PALECO/Ateneo school calendar):
    //   Eid al-Fitr 2025 → June 30 (estimated, Shawwal 1, 1446 H)
    //   Eid al-Fitr 2026 → March 20 (estimated, Shawwal 1, 1447 H)
    //   Christmas Break  → Dec 25, 2025 – Jan 1, 2026 (no school)
    //   Independence Day  → June 12, 2025
    //   National Heroes Day → last Monday of November (吊)
    // ─────────────────────────────────────────────────────────────────────

    $schoolDays = [];

    // ── Q1: June 9 – August 29, 2025 ────────────────────────────────────────
    // School opens June 9 (Monday)
    $q1Start = '2025-06-09';  $q1End = '2025-08-29';

    // Regular Q1 days
    $cur = new DateTime($q1Start); $end = new DateTime($q1End);
    while ($cur <= $end) {
        $dow = (int)$cur->format('N'); // 1=Mon…7=Sun
        $ds  = $cur->format('Y-m-d');
        if ($dow < 6) {
            // June 12 = Independence Day (holiday, no school)
            if ($ds !== '2025-06-12') $schoolDays[$ds] = ['q' => 'Q1', 'h' => ''];
        }
        $cur->modify('+1 day');
    }
    // Eid al-Fitr: June 30 (school holiday)
    $schoolDays['2025-06-30'] = ['q' => 'Q1', 'h' => 'Eid al-Fitr'];

    // ── Q2: September 1 – October 31, 2025 ──────────────────────────────────
    $q2Start = '2025-09-01';  $q2End = '2025-10-31';
    $cur = new DateTime($q2Start); $end = new DateTime($q2End);
    while ($cur <= $end) {
        $dow = (int)$cur->format('N');
        $ds  = $cur->format('Y-m-d');
        if ($dow < 6) $schoolDays[$ds] = ['q' => 'Q2', 'h' => ''];
        $cur->modify('+1 day');
    }

    // ── Q3: November 3 – January 30, 2026 ───────────────────────────────────
    // School resumes November 3 (Monday after All Saints / Quiapo)
    // No classes Dec 25 – Jan 1 (Christmas Break)
    $q3Start = '2025-11-03';  $q3End = '2026-01-30';
    $cur = new DateTime($q3Start); $end = new DateTime($q3End);
    while ($cur <= $end) {
        $dow = (int)$cur->format('N');
        $ds  = $cur->format('Y-m-d');
        if ($dow < 6) {
            // Christmas break: Dec 25 – Jan 1 = no school
            if (!($ds >= '2025-12-25' && $ds <= '2026-01-01')) {
                $schoolDays[$ds] = ['q' => 'Q3', 'h' => ''];
            }
        }
        $cur->modify('+1 day');
    }

    // ── Q4: February 2 – May 8, 2026 ────────────────────────────────────────
    // Classes end May 8 (Friday)
    $q4Start = '2026-02-02';  $q4End = '2026-05-08';
    $cur = new DateTime($q4Start); $end = new DateTime($q4End);
    while ($cur <= $end) {
        $dow = (int)$cur->format('N');
        $ds  = $cur->format('Y-m-d');
        if ($dow < 6) {
            // Eid al-Fitr March 20, 2026
            if ($ds !== '2026-03-20') {
                $schoolDays[$ds] = ['q' => 'Q4', 'h' => ''];
            } else {
                $schoolDays[$ds] = ['q' => 'Q4', 'h' => 'Eid al-Fitr'];
            }
        }
        $cur->modify('+1 day');
    }

    // ── Bulk insert ──────────────────────────────────────────────────────────
    $ins = $conn->prepare(
        "INSERT IGNORE INTO school_calendar (date, is_school_day, quarter, holiday_name)
         VALUES (?, ?, ?, ?)"
    );
    $ds = ''; $sd = 1; $q = ''; $hn = '';
    $ins->bind_param('siss', $ds, $sd, $q, $hn);
    foreach ($schoolDays as $dateKey => $row) {
        $ds = $dateKey;
        $sd = 1;
        $q  = $row['q'];
        $hn = $row['h'];
        $ins->execute();
    }
    $ins->close();
}


/** Returns { Q1: n, Q2: n, Q3: n, Q4: n } school-day counts per quarter. */
function getSchoolDaysPerQuarter($conn) {
    $result = $conn->query(
        "SELECT quarter, COUNT(*) AS cnt
         FROM school_calendar
         WHERE is_school_day = 1 AND quarter != ''
         GROUP BY quarter"
    );
    $counts = ['Q1' => 0, 'Q2' => 0, 'Q3' => 0, 'Q4' => 0];
    while ($r = $result->fetch_assoc()) {
        $q = $r['quarter'];
        if (isset($counts[$q])) $counts[$q] = (int)$r['cnt'];
    }
    return $counts;
}


/** GET /?action=schoolCalendar — returns all school days for reference. */
function getSchoolCalendar($conn) {
    ensureSchoolCalendar($conn);
    $result = $conn->query(
        "SELECT date, is_school_day, quarter, holiday_name
         FROM school_calendar
         ORDER BY date ASC"
    );
    $rows = [];
    while ($r = $result->fetch_assoc()) {
        $rows[] = [
            'date'          => $r['date'],
            'isSchoolDay'   => (int)$r['is_school_day'],
            'quarter'       => $r['quarter'],
            'holidayName'   => $r['holiday_name'],
        ];
    }
    echo json_encode($rows);
}


// ═══════════════════════════════════════════════
//  GET summary
//  ?action=summary&year=2026&month=3
// ═══════════════════════════════════════════════
function getSummary($conn) {
    $year  = isset($_GET['year'])  ? (int)$_GET['year']  : (int)date('Y');
    $month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('m');

    $daysInMonth = cal_days_in_month(CAL_GREGORIAN, $month, $year);
    $fromDate    = sprintf('%04d-%02d-01', $year, $month);
    $toDate      = sprintf('%04d-%02d-%02d', $year, $month, $daysInMonth);

    $grade   = $_GET['grade']   ?? '';
    $section = $_GET['section'] ?? '';
    $gradeEsc   = $grade   ? $conn->real_escape_string($grade)   : '';
    $sectionEsc = $section ? $conn->real_escape_string($section) : '';
    $gradeFilter   = $gradeEsc   ? " AND s.grade='{$gradeEsc}'"   : '';
    $sectionFilter = $sectionEsc ? " AND s.section='{$sectionEsc}'" : '';

    // Overall totals
    $overall = $conn->query(
        "SELECT status, COUNT(*) AS cnt FROM attendance
         WHERE date BETWEEN '$fromDate' AND '$toDate'
         GROUP BY status"
    );
    $totals = ['present' => 0, 'late' => 0, 'absent' => 0];
    while ($r = $overall->fetch_assoc()) $totals[$r['status']] = (int)$r['cnt'];
    $totalAll = array_sum($totals);

    // Per grade+section breakdown
    $secResult = $conn->query(
        "SELECT s.grade, s.section,
                CONCAT(s.grade, ' - ', s.section) AS name,
                SUM(a.status='present') AS present_cnt,
                SUM(a.status='late')    AS late_cnt,
                SUM(a.status='absent')  AS absent_cnt
         FROM students s
         LEFT JOIN attendance a ON a.student_id = s.id
                               AND a.date BETWEEN '$fromDate' AND '$toDate'
         WHERE (s.status IS NULL OR s.status != 'Dropout') $gradeFilter $sectionFilter
         GROUP BY s.grade, s.section
         ORDER BY s.grade ASC, s.section ASC"
    );
    $sections = [];
    $id = 1;
    while ($r = $secResult->fetch_assoc()) {
        $tot = (int)$r['present_cnt'] + (int)$r['late_cnt'] + (int)$r['absent_cnt'];
        $sections[] = [
            'id'          => $id++,
            'grade'       => $r['grade'],
            'section'     => $r['section'],
            'name'        => $r['name'],
            'present'     => (int)$r['present_cnt'],
            'late'        => (int)$r['late_cnt'],
            'absent'      => (int)$r['absent_cnt'],
            'total'       => $tot,
            'present_pct' => $tot ? round($r['present_cnt'] / $tot * 100, 1) : 0,
            'late_pct'    => $tot ? round($r['late_cnt']    / $tot * 100, 1) : 0,
            'absent_pct'  => $tot ? round($r['absent_cnt']  / $tot * 100, 1) : 0,
        ];
    }

    echo json_encode([
        'overall' => [
            'present'     => $totals['present'],
            'late'        => $totals['late'],
            'absent'      => $totals['absent'],
            'total'       => $totalAll,
            'present_pct' => $totalAll ? round($totals['present'] / $totalAll * 100, 1) : 0,
            'late_pct'    => $totalAll ? round($totals['late']    / $totalAll * 100, 1) : 0,
            'absent_pct'  => $totalAll ? round($totals['absent']  / $totalAll * 100, 1) : 0,
        ],
        'sections' => $sections,
    ]);
}


// ═══════════════════════════════════════════════
//  GET monthlyReport
//  ?action=monthlyReport&year=2026&month=4[&grade=...&section=...]
//  Returns DepEd SF2-style aggregated monthly data.
// ═══════════════════════════════════════════════
function getMonthlyReport($conn) {
    $year   = isset($_GET['year'])  ? (int)$_GET['year']  : (int)date('Y');
    $month  = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('m');
    $grade   = $conn->real_escape_string($_GET['grade']   ?? '');
    $section = $conn->real_escape_string($_GET['section'] ?? '');

    ensureSchoolCalendar($conn);

    // Total school days in this month from school_calendar
    $monthStr = sprintf('%04d-%02d', $year, $month);
    $calResult = $conn->query(
        "SELECT COUNT(*) AS cnt FROM school_calendar
         WHERE is_school_day = 1
           AND date LIKE '$monthStr-%'"
    );
    $schoolDaysInMonth = (int)$calResult->fetch_assoc()['cnt'];

    // Build date range for the month
    $daysInMonth = cal_days_in_month(CAL_GREGORIAN, $month, $year);
    $fromDate    = sprintf('%04d-%02d-01', $year, $month);
    $toDate      = sprintf('%04d-%02d-%02d', $year, $month, $daysInMonth);

    // School-day dates in this month (weekdays only)
    $schoolDayDates = [];
    $cur = new DateTime($fromDate);
    $end = new DateTime($toDate);
    $allDatesInMonth = [];
    while ($cur <= $end) {
        $ds  = $cur->format('Y-m-d');
        $dow = (int)$cur->format('N');
        $allDatesInMonth[] = $ds;
        if ($dow < 6) $schoolDayDates[] = $ds;
        $cur->modify('+1 day');
    }

    // Filter students by grade/section (excluding dropouts)
    $where = "WHERE (status IS NULL OR status != 'Dropout')";
    if ($grade)   $where .= " AND grade = '$grade'";
    if ($section) $where .= " AND section = '$section'";

    $stuResult = $conn->query(
        "SELECT id, student_id, full_name, grade, section
         FROM students $where ORDER BY full_name ASC"
    );
    $students = [];
    $studentIds = [];
    while ($r = $stuResult->fetch_assoc()) {
        $students[$r['id']] = [
            'id'        => (int)$r['id'],
            'studentId' => $r['student_id'],
            'fullName'  => $r['full_name'],
            'grade'     => $r['grade'],
            'section'   => $r['section'],
        ];
        $studentIds[] = (int)$r['id'];
    }

    // Fetch all attendance records for these students in this month
    $presentCount = 0; $lateCount = 0; $absentCount = 0;
    $perStudent = [];

    if (!empty($studentIds)) {
        $idList = implode(',', $studentIds);
        $atResult = $conn->query(
            "SELECT student_id, date, status
             FROM attendance
             WHERE student_id IN ($idList)
               AND date BETWEEN '$fromDate' AND '$toDate'"
        );
        $recordCounts = ['present' => 0, 'late' => 0, 'absent' => 0];
        while ($r = $atResult->fetch_assoc()) {
            $sid = (int)$r['student_id'];
            if (!isset($perStudent[$sid])) {
                $perStudent[$sid] = ['present' => 0, 'late' => 0, 'absent' => 0, 'total' => 0];
            }
            $st = $r['status'];
            if (isset($perStudent[$sid][$st])) {
                $perStudent[$sid][$st]++;
                $perStudent[$sid]['total']++;
            }
            if (isset($recordCounts[$st])) $recordCounts[$st]++;
        }

        // Compute per-student attendance %
        foreach ($students as $id => &$s) {
            if (isset($perStudent[$id])) {
                $s['present']   = $perStudent[$id]['present'];
                $s['late']      = $perStudent[$id]['late'];
                $s['absent']    = $perStudent[$id]['absent'];
                $s['total']     = $perStudent[$id]['total'];
                $s['attendPct'] = $schoolDaysInMonth > 0
                    ? round(($perStudent[$id]['present'] + $perStudent[$id]['late']) / $schoolDaysInMonth * 100, 1)
                    : 0;
            } else {
                $s['present']   = 0;
                $s['late']      = 0;
                $s['absent']    = 0;
                $s['total']     = 0;
                $s['attendPct'] = 0;
            }
        }
        unset($s);
    }

    $totalStudents   = count($students);
    $totalPresent    = $recordCounts['present'];
    $totalLate       = $recordCounts['late'];
    $totalAbsent     = $recordCounts['absent'];
    $totalRecorded   = $totalPresent + $totalLate + $totalAbsent;

    // Average Daily Attendance = sum of daily presents / school days
    $ada = $schoolDaysInMonth > 0 && $totalStudents > 0
        ? round($totalPresent / $schoolDaysInMonth, 1)
        : 0;

    // Monthly % Attendance
    $monthlyPct = $totalRecorded > 0
        ? round(($totalPresent + $totalLate) / $totalRecorded * 100, 1)
        : 0;

    // Per-section breakdown
    $sectionsData = [];
    if ($grade && $section) {
        // Single section — include per-student rows
        $sectionsData[] = [
            'grade'       => $grade,
            'section'     => $section,
            'name'        => "$grade - $section",
            'students'    => array_values($students),
            'present'     => $totalPresent,
            'late'        => $totalLate,
            'absent'      => $totalAbsent,
            'ada'         => $ada,
            'attendPct'   => $monthlyPct,
        ];
    } else {
        // All sections — aggregate per section
        $secResult = $conn->query(
            "SELECT s.grade, s.section,
                    CONCAT(s.grade, ' - ', s.section) AS name,
                    SUM(a.status='present') AS present_cnt,
                    SUM(a.status='late')    AS late_cnt,
                    SUM(a.status='absent')  AS absent_cnt
             FROM students s
             LEFT JOIN attendance a ON a.student_id = s.id
                                   AND a.date BETWEEN '$fromDate' AND '$toDate'
             $where
             GROUP BY s.grade, s.section
             ORDER BY s.grade ASC, s.section ASC"
        );
        while ($r = $secResult->fetch_assoc()) {
            $pc = (int)$r['present_cnt'];
            $lc = (int)$r['late_cnt'];
            $ac = (int)$r['absent_cnt'];
            $tot = $pc + $lc + $ac;
            $sectionsData[] = [
                'grade'     => $r['grade'],
                'section'   => $r['section'],
                'name'      => $r['name'],
                'present'   => $pc,
                'late'      => $lc,
                'absent'    => $ac,
                'ada'       => $schoolDaysInMonth > 0 ? round($pc / $schoolDaysInMonth, 1) : 0,
                'attendPct' => $tot > 0 ? round(($pc + $lc) / $tot * 100, 1) : 0,
            ];
        }
    }

    echo json_encode([
        'year'              => $year,
        'month'             => $month,
        'monthName'         => date('F', mktime(0, 0, 0, $month, 1)),
        'schoolDaysInMonth' => $schoolDaysInMonth,
        'totalStudents'     => $totalStudents,
        'present'           => $totalPresent,
        'late'              => $totalLate,
        'absent'            => $totalAbsent,
        'ada'               => $ada,
        'monthlyAttendPct'  => $monthlyPct,
        'sections'          => $sectionsData,
    ]);
}


// ═══════════════════════════════════════════════
//  POST — upsert single attendance record
//  Body: { student_id, date, status }
// ═══════════════════════════════════════════════
function saveAttendance($conn) {
    global $userId;
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) { http_response_code(400); echo json_encode(['error' => 'Invalid JSON']); return; }

    $studentId = (int)($data['student_id'] ?? 0);
    $date      = $conn->real_escape_string($data['date']   ?? '');
    $status    = $conn->real_escape_string($data['status'] ?? '');

    if (!$studentId || !$date || !in_array($status, ['present','late','absent'])) {
        http_response_code(400);
        echo json_encode(['error' => 'student_id, date, and valid status (present|late|absent) required']);
        return;
    }

    $stmt = $conn->prepare(
        "INSERT INTO attendance (user_id, student_id, date, status)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status)"
    );
    $stmt->bind_param('iiss', $userId, $studentId, $date, $status);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'student_id' => $studentId, 'date' => $date, 'status' => $status]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => $stmt->error]);
    }
    $stmt->close();
}


// ═══════════════════════════════════════════════
//  PUT — bulk upsert for a whole day
//  Body: { records: [{student_id, date, status}] }
// ═══════════════════════════════════════════════
function updateAttendance($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!isset($data['records']) || !is_array($data['records'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Body must have a records array']);
        return;
    }
    $saved  = 0;
    $errors = [];
    $stmt   = $conn->prepare(
        "INSERT INTO attendance (student_id, date, status)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status)"
    );
    foreach ($data['records'] as $rec) {
        $sid    = (int)($rec['student_id'] ?? 0);
        $date   = $rec['date']   ?? '';
        $status = $rec['status'] ?? '';
        if (!$sid || !$date || !in_array($status, ['present','late','absent'])) {
            $errors[] = "Skipped: " . json_encode($rec);
            continue;
        }
        $stmt->bind_param('iss', $sid, $date, $status);
        $stmt->execute() ? $saved++ : ($errors[] = $stmt->error);
    }
    $stmt->close();
    echo json_encode(['saved' => $saved, 'errors' => $errors]);
}


// ═══════════════════════════════════════════════
//  DELETE — remove a single record
//  ?student_id=1&date=2026-03-02
// ═══════════════════════════════════════════════
function deleteAttendance($conn) {
    global $userId;
    $studentId = isset($_GET['student_id']) ? (int)$_GET['student_id'] : 0;
    $date      = $_GET['date'] ?? '';

    if (!$studentId || !$date) {
        http_response_code(400);
        echo json_encode(['error' => 'student_id and date query params required']);
        return;
    }
    $stmt = $conn->prepare("DELETE FROM attendance WHERE user_id = ? AND student_id = ? AND date = ?");
    $stmt->bind_param('iis', $userId, $studentId, $date);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'deleted' => $stmt->affected_rows]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => $stmt->error]);
    }
    $stmt->close();
}