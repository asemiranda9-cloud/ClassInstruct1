<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// ── DB Config (XAMPP defaults) ──
define('DB_HOST', 'localhost');
define('DB_USER', 'root');   // XAMPP default
define('DB_PASS', '');       // XAMPP default (empty)
define('DB_NAME', 'classinstruct');

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'DB connection failed: ' . $conn->connect_error]);
    exit;
}
$conn->set_charset('utf8mb4');

// ── Router ──
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        switch ($action) {
            case 'sections':        getSections($conn);       break;
            case 'students':        getStudents($conn);       break;
            case 'attendance':      getAttendance($conn);     break;
            case 'summary':         getSummary($conn);        break;
            default:
                http_response_code(400);
                echo json_encode(['error' => 'Unknown action. Use: sections | students | attendance | summary']);
        }
        break;

    case 'POST':
        saveAttendance($conn);
        break;

    case 'PUT':
        updateAttendance($conn);
        break;

    case 'DELETE':
        deleteAttendance($conn);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();


// ═══════════════════════════════════════════════
//  GET sections — list all sections
//  Usage: attendance_db.php?action=sections
// ═══════════════════════════════════════════════
function getSections($conn) {
    $result = $conn->query("SELECT * FROM sections ORDER BY name ASC");
    $rows = [];
    while ($r = $result->fetch_assoc()) $rows[] = $r;
    echo json_encode($rows);
}


// ═══════════════════════════════════════════════
//  GET students — list students, optionally filtered by section
//  Usage: attendance_db.php?action=students[&section_id=1]
// ═══════════════════════════════════════════════
function getStudents($conn) {
    $sectionId = isset($_GET['section_id']) ? (int)$_GET['section_id'] : null;

    $sql = "SELECT s.id, s.student_id, s.full_name, s.avatar, sec.name AS section_name
            FROM students s
            LEFT JOIN sections sec ON s.section_id = sec.id";

    if ($sectionId) {
        $sql .= " WHERE s.section_id = $sectionId";
    }
    $sql .= " ORDER BY s.full_name ASC";

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
//  GET attendance — grid of statuses for a section + month
//  Usage: attendance_db.php?action=attendance&section_id=1&year=2026&month=3
//  Returns: { dates: [...], students: [{id, name, statuses: {date: status}}] }
// ═══════════════════════════════════════════════
function getAttendance($conn) {
    $sectionId = isset($_GET['section_id']) ? (int)$_GET['section_id'] : 1;
    $year      = isset($_GET['year'])       ? (int)$_GET['year']       : (int)date('Y');
    $month     = isset($_GET['month'])      ? (int)$_GET['month']      : (int)date('m');

    // Build all dates in the requested month
    $daysInMonth = cal_days_in_month(CAL_GREGORIAN, $month, $year);
    $dates = [];
    for ($d = 1; $d <= $daysInMonth; $d++) {
        $dates[] = sprintf('%04d-%02d-%02d', $year, $month, $d);
    }

    // Get students in section
    $result = $conn->query(
        "SELECT s.id, s.full_name, s.avatar
         FROM students s
         WHERE s.section_id = $sectionId
         ORDER BY s.full_name ASC"
    );
    $students = [];
    $studentIds = [];
    while ($r = $result->fetch_assoc()) {
        $students[$r['id']] = ['id' => $r['id'], 'full_name' => $r['full_name'], 'avatar' => $r['avatar'], 'statuses' => []];
        $studentIds[] = (int)$r['id'];
    }

    if (empty($studentIds)) {
        echo json_encode(['dates' => $dates, 'students' => []]);
        return;
    }

    // Get attendance records for those students in the month
    $idList   = implode(',', $studentIds);
    $fromDate = sprintf('%04d-%02d-01', $year, $month);
    $toDate   = sprintf('%04d-%02d-%02d', $year, $month, $daysInMonth);

    $atResult = $conn->query(
        "SELECT student_id, DATE_FORMAT(date,'%Y-%m-%d') AS date, status
         FROM attendance
         WHERE student_id IN ($idList)
           AND date BETWEEN '$fromDate' AND '$toDate'"
    );
    while ($r = $atResult->fetch_assoc()) {
        if (isset($students[$r['student_id']])) {
            $students[$r['student_id']]['statuses'][$r['date']] = $r['status'];
        }
    }

    echo json_encode(['dates' => $dates, 'students' => array_values($students)]);
}



function getSummary($conn) {
    $year  = isset($_GET['year'])  ? (int)$_GET['year']  : (int)date('Y');
    $month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('m');

    $daysInMonth = cal_days_in_month(CAL_GREGORIAN, $month, $year);
    $fromDate    = sprintf('%04d-%02d-01', $year, $month);
    $toDate      = sprintf('%04d-%02d-%02d', $year, $month, $daysInMonth);

    // Overall counts
    $overall = $conn->query(
        "SELECT status, COUNT(*) AS cnt
         FROM attendance
         WHERE date BETWEEN '$fromDate' AND '$toDate'
         GROUP BY status"
    );
    $totals = ['present' => 0, 'late' => 0, 'absent' => 0];
    while ($r = $overall->fetch_assoc()) $totals[$r['status']] = (int)$r['cnt'];
    $totalAll = array_sum($totals);


    $secResult = $conn->query(
        "SELECT sec.id, sec.name,
                SUM(a.status='present') AS present_cnt,
                SUM(a.status='late')    AS late_cnt,
                SUM(a.status='absent')  AS absent_cnt
         FROM sections sec
         LEFT JOIN students s   ON s.section_id = sec.id
         LEFT JOIN attendance a ON a.student_id  = s.id
                               AND a.date BETWEEN '$fromDate' AND '$toDate'
         GROUP BY sec.id, sec.name
         ORDER BY sec.name ASC"
    );
    $sections = [];
    while ($r = $secResult->fetch_assoc()) {
        $tot = (int)$r['present_cnt'] + (int)$r['late_cnt'] + (int)$r['absent_cnt'];
        $sections[] = [
            'id'          => (int)$r['id'],
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
        'overall'  => [
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
//  POST — Save / upsert attendance record
//  Body: { student_id, date, status }
// ═══════════════════════════════════════════════
function saveAttendance($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) { http_response_code(400); echo json_encode(['error' => 'Invalid JSON']); return; }

    $studentId = (int)($data['student_id'] ?? 0);
    $date      = $conn->real_escape_string($data['date']   ?? '');
    $status    = $conn->real_escape_string($data['status'] ?? '');

    if (!$studentId || !$date || !in_array($status, ['present','late','absent'])) {
        http_response_code(400);
        echo json_encode(['error' => 'student_id, date, and valid status (present|late|absent) are required']);
        return;
    }

    // INSERT … ON DUPLICATE KEY UPDATE (upsert)
    $stmt = $conn->prepare(
        "INSERT INTO attendance (student_id, date, status)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status)"
    );
    $stmt->bind_param('iss', $studentId, $date, $status);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'student_id' => $studentId, 'date' => $date, 'status' => $status]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => $stmt->error]);
    }
    $stmt->close();
}


// ═══════════════════════════════════════════════
//  PUT — Bulk upsert attendance for a whole day/section
//  Body: { records: [{student_id, date, status}, ...] }
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
            $errors[] = "Skipped invalid record: " . json_encode($rec);
            continue;
        }
        $stmt->bind_param('iss', $sid, $date, $status);
        $stmt->execute() ? $saved++ : ($errors[] = $stmt->error);
    }
    $stmt->close();

    echo json_encode(['saved' => $saved, 'errors' => $errors]);
}


// ═══════════════════════════════════════════════
//  DELETE — Remove a single attendance record
//  Usage: attendance_db.php?student_id=1&date=2026-03-02
// ═══════════════════════════════════════════════
function deleteAttendance($conn) {
    $studentId = isset($_GET['student_id']) ? (int)$_GET['student_id'] : 0;
    $date      = $_GET['date'] ?? '';

    if (!$studentId || !$date) {
        http_response_code(400);
        echo json_encode(['error' => 'student_id and date query params required']);
        return;
    }

    $stmt = $conn->prepare("DELETE FROM attendance WHERE student_id = ? AND date = ?");
    $stmt->bind_param('is', $studentId, $date);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'deleted' => $stmt->affected_rows]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => $stmt->error]);
    }
    $stmt->close();
}