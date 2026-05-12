<?php
// ═══════════════════════════════════
//  db.php — ClassInstruct MySQL Backend
// ═══════════════════════════════════

require_once __DIR__ . '/../config.php';

// Disable all error output before anything else
error_reporting(0);
ini_set('display_errors', 0);
@ini_set('display_errors', '0');
// Start output buffer to catch any stray output
while (ob_get_level()) ob_end_clean();
ob_start();

// Return JSON on any fatal error
set_exception_handler(function($e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
});

register_shutdown_function(function() {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR])) {
        while (ob_get_level()) ob_end_clean();
        http_response_code(500);
        echo json_encode(['error' => $e['message']]);
    }
});

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

if (!defined('DB_HOST')) define('DB_HOST', env('DB_HOST', 'localhost'));
if (!defined('DB_USER')) define('DB_USER', env('DB_USER', 'root'));
if (!defined('DB_PASS')) define('DB_PASS', env('DB_PASS', ''));
if (!defined('DB_NAME')) define('DB_NAME', env('DB_NAME', 'classinstructdb'));

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $conn->connect_error, 'host' => DB_HOST, 'db' => DB_NAME]);
    exit;
}
$conn->set_charset('utf8mb4');

// ── Check user session ───────────────────────────────────────────────────────
session_start();
$userId = $_SESSION['ci_user']['user_id'] ?? null;
if (!$userId) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized. Please login.']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {
    case 'GET':
        if (isset($_GET['action']) && $_GET['action'] === 'sections') {
            getSections($conn);
        } else {
            getStudents($conn);
        }
        break;
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        if (isset($data['_action']) && $data['_action'] === 'add_section') {
            addSection($conn, $data['name']);
        } else {
            addStudent($conn);
        }
        break;
    case 'PUT':    updateStudent($conn, $id); break;
    case 'DELETE':
        if (isset($_GET['action']) && $_GET['action'] === 'delete_section') {
            deleteSection($conn);
        } else {
            deleteStudent($conn, $id);
        }
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();

// ═══════════════════════════════════
//  GET — List all students (filtered by user_id)
// ═══════════════════════════════════
function getStudents($conn) {
    global $userId;
    $stmt = $conn->prepare("SELECT * FROM students WHERE user_id = ? ORDER BY full_name ASC");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    if (!$result) {
        http_response_code(500);
        echo json_encode(['error' => $conn->error]);
        return;
    }
    $students = [];
    while ($row = $result->fetch_assoc()) {
        $students[] = mapRow($row);
    }
    echo json_encode($students);
    $stmt->close();
}

// ═══════════════════════════════════
//  GET — List sections (filtered by user_id)
// ═══════════════════════════════════
function getSections($conn) {
    global $userId;
    // Auto-create sections table with user_id
    $conn->query("
        CREATE TABLE IF NOT EXISTS sections (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            user_id    INT NOT NULL,
            name       VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_id (user_id),
            UNIQUE KEY unique_user_section (user_id, name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    // Migrate sections from students (only for this user)
    $conn->query("
        INSERT IGNORE INTO sections (user_id, name)
        SELECT DISTINCT user_id, section FROM students
        WHERE user_id = $userId AND section IS NOT NULL AND section != ''
    ");
    $stmt = $conn->prepare("SELECT name FROM sections WHERE user_id = ? ORDER BY name ASC");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    if (!$result) {
        http_response_code(500);
        echo json_encode(['error' => $conn->error]);
        return;
    }
    $sections = [];
    while ($row = $result->fetch_assoc()) {
        $sections[] = $row['name'];
    }
    echo json_encode($sections);
    $stmt->close();
}

// ═══════════════════════════════════
//  POST — Add new student
// ═══════════════════════════════════
function addStudent($conn) {
    global $userId;
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) { http_response_code(400); echo json_encode(['error' => 'Invalid JSON']); return; }

    // Normalise studentId: blank string or null both become SQL NULL.
    // MySQL allows multiple NULLs in a UNIQUE column, so students without
    // an LRN can all be inserted without conflicting with each other.
    $rawSid    = isset($data['studentId']) ? trim((string)$data['studentId']) : '';
    $studentId = ($rawSid === '') ? null : $rawSid;

    // Build full_name from parts
    $firstName  = isset($data['firstName']) ? trim((string)$data['firstName']) : '';
    $middleName = isset($data['middleName']) ? trim((string)$data['middleName']) : '';
    $lastName   = isset($data['lastName'])   ? trim((string)$data['lastName'])   : '';
    $fullName   = trim("$firstName $middleName $lastName");

    // Only enforce uniqueness when an actual ID was supplied (and for this user)
    if ($studentId !== null) {
        $checkStmt = $conn->prepare("SELECT id FROM students WHERE user_id = ? AND student_id = ?");
        $checkStmt->bind_param('is', $userId, $studentId);
        $checkStmt->execute();
        $checkResult = $checkStmt->get_result();
        if ($checkResult->num_rows > 0) {
            http_response_code(409);
            echo json_encode(['error' => 'Student ID / LRN already exists']);
            return;
        }
        $checkStmt->close();
    }

    $stmt = $conn->prepare(
        "INSERT INTO students
          (user_id, student_id, full_name, dob, gender, grade, section, enroll_date,
           prev_school, email, phone, address,
           father_name, father_phone, mother_name, mother_phone,
           guardian_name, guardian_relation, guardian_phone, status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    );

    $dob        = empty($data['dob'])        ? null : $data['dob'];
    $enrollDate = empty($data['enrollDate']) ? null : $data['enrollDate'];
    $status     = in_array($data['status'] ?? '', ['Active','Dropout']) ? $data['status'] : 'Active';

    // Bind $studentId (may be null) — NOT $data['studentId']
    $stmt->bind_param('isssssssssssssssssss',
        $userId,             $studentId,            $fullName,               $dob,
        $data['gender'],     $data['grade'],        $data['section'],
        $enrollDate,         $data['prevSchool'],   $data['email'],
        $data['phone'],      $data['address'],      $data['fatherName'],
        $data['fatherPhone'],$data['motherName'],   $data['motherPhone'],
        $data['guardianName'],$data['guardianRelation'],$data['guardianPhone'],
        $status
    );

    if ($stmt->execute()) {
        $newId = $conn->insert_id;
        $rowStmt = $conn->prepare("SELECT * FROM students WHERE id = ?");
        $rowStmt->bind_param('i', $newId);
        $rowStmt->execute();
        $row = $rowStmt->get_result()->fetch_assoc();
        http_response_code(201);
        echo json_encode(mapRow($row));
        $rowStmt->close();
    } else {
        http_response_code(500);
        echo json_encode(['error' => $stmt->error]);
    }
    $stmt->close();
}

// ═══════════════════════════════════
//  PUT — Update student by ID
// ═══════════════════════════════════
function updateStudent($conn, $id) {
    global $userId;
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'Missing id']); return; }

    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) { http_response_code(400); echo json_encode(['error' => 'Invalid JSON']); return; }

    // Same NULL normalisation as addStudent
    $rawSid    = isset($data['studentId']) ? trim((string)$data['studentId']) : '';
    $studentId = ($rawSid === '') ? null : $rawSid;

    // Build full_name from parts
    $firstName  = isset($data['firstName']) ? trim((string)$data['firstName']) : '';
    $middleName = isset($data['middleName']) ? trim((string)$data['middleName']) : '';
    $lastName   = isset($data['lastName'])   ? trim((string)$data['lastName'])   : '';
    $fullName   = trim("$firstName $middleName $lastName");

    // Only check uniqueness (excluding self) when a real ID is provided
    if ($studentId !== null) {
        $uidCheck = $conn->prepare("SELECT id FROM students WHERE user_id = ? AND student_id = ? AND id != ?");
        $uidCheck->bind_param('isi', $userId, $studentId, $id);
        $uidCheck->execute();
        $uidResult = $uidCheck->get_result();
        if ($uidResult->num_rows > 0) {
            http_response_code(409);
            echo json_encode(['error' => 'Student ID / LRN already exists']);
            return;
        }
        $uidCheck->close();
    }

    $stmt = $conn->prepare("
        UPDATE students SET
          student_id=?, full_name=?, dob=?, gender=?, grade=?, section=?, enroll_date=?,
          prev_school=?, email=?, phone=?, address=?,
          father_name=?, father_phone=?, mother_name=?, mother_phone=?,
          guardian_name=?, guardian_relation=?, guardian_phone=?, status=?
        WHERE user_id = ? AND id = ?
    ");

    $dob        = empty($data['dob'])        ? null : $data['dob'];
    $enrollDate = empty($data['enrollDate']) ? null : $data['enrollDate'];
    $status     = in_array($data['status'] ?? '', ['Active','Dropout']) ? $data['status'] : 'Active';

    $stmt->bind_param('sssssssssssssssssssii',
        $studentId,            $fullName,               $dob,
        $data['gender'],       $data['grade'],           $data['section'],
        $enrollDate,           $data['prevSchool'],      $data['email'],
        $data['phone'],        $data['address'],         $data['fatherName'],
        $data['fatherPhone'],  $data['motherName'],      $data['motherPhone'],
        $data['guardianName'], $data['guardianRelation'],$data['guardianPhone'],
        $status,               $userId,                 $id
    );

    if ($stmt->execute()) {
        $rowStmt = $conn->prepare("SELECT * FROM students WHERE id = ?");
        $rowStmt->bind_param('i', $id);
        $rowStmt->execute();
        $row = $rowStmt->get_result()->fetch_assoc();
        echo json_encode(mapRow($row));
        $rowStmt->close();
    } else {
        http_response_code(500);
        echo json_encode(['error' => $stmt->error]);
    }
    $stmt->close();
}

// ═══════════════════════════════════
//  POST — Add new section (persisted to sections table)
// ═══════════════════════════════════
function addSection($conn, $name) {
    global $userId;
    $name = isset($name) ? trim((string)$name) : '';
    if ($name === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Section name is required']);
        return;
    }
    $conn->query("
        CREATE TABLE IF NOT EXISTS sections (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            user_id    INT NOT NULL,
            name       VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_id (user_id),
            UNIQUE KEY unique_user_section (user_id, name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $stmt = $conn->prepare("INSERT IGNORE INTO sections (user_id, name) VALUES (?, ?)");
    $stmt->bind_param('is', $userId, $name);
    if ($stmt->execute()) {
        http_response_code($conn->affected_rows === 0 ? 200 : 201);
        echo json_encode(['success' => true, 'section' => $name]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => $stmt->error]);
    }
    $stmt->close();
}

// ═══════════════════════════════════
//  DELETE — Delete section by name
// ═══════════════════════════════════
function deleteSection($conn) {
    global $userId;
    $data = json_decode(file_get_contents('php://input'), true);
    $name = isset($data['name']) ? trim((string)$data['name']) : '';
    if ($name === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Section name is required']);
        return;
    }
    $stmt = $conn->prepare("DELETE FROM sections WHERE user_id = ? AND name = ?");
    $stmt->bind_param('is', $userId, $name);
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'deleted_section' => $name]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => $stmt->error]);
    }
    $stmt->close();
}

// ═══════════════════════════════════
//  DELETE — Delete student by ID
// ═══════════════════════════════════
function deleteStudent($conn, $id) {
    global $userId;
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'Missing id']); return; }

    $stmt = $conn->prepare("DELETE FROM students WHERE user_id = ? AND id = ?");
    $stmt->bind_param('ii', $userId, $id);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'deleted_id' => $id]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => $stmt->error]);
    }
    $stmt->close();
}

// ═══════════════════════════════════
//  Helper — Map DB row → JS-style keys
// ═══════════════════════════════════
function mapRow($row) {
    // Split full_name into first/middle/last if available
    $fullName = $row['full_name'] ?? '';
    $parts = preg_split('/\s+/', trim($fullName));
    $firstName = $parts[0] ?? '';
    $middleName = '';
    $lastName = '';
    if (count($parts) >= 3) {
        $middleName = $parts[1] ?? '';
        $lastName = implode(' ', array_slice($parts, 2));
    } elseif (count($parts) === 2) {
        $lastName = $parts[1] ?? '';
    } elseif (count($parts) === 1) {
        $lastName = $parts[0] ?? '';
    }

    return [
        'id'               => (int)$row['id'],
        'studentId'        => $row['student_id'],   // may be null — JS handles null fine
        'firstName'        => $firstName,
        'middleName'       => $middleName,
        'lastName'         => $lastName,
        'fullName'         => $fullName, // fallback for backward compat
        'dob'              => $row['dob'],
        'gender'           => $row['gender'],
        'grade'            => $row['grade'],
        'section'          => $row['section'],
        'enrollDate'       => $row['enroll_date'],
        'prevSchool'       => $row['prev_school'],
        'email'            => $row['email'],
        'phone'            => $row['phone'],
        'address'          => $row['address'],
        'fatherName'       => $row['father_name'],
        'fatherPhone'      => $row['father_phone'],
        'motherName'       => $row['mother_name'],
        'motherPhone'      => $row['mother_phone'],
        'guardianName'     => $row['guardian_name'],
        'guardianRelation' => $row['guardian_relation'],
        'guardianPhone'    => $row['guardian_phone'],
        'status'           => $row['status'] ?? 'Active',
        'createdAt'        => $row['created_at'],
    ];
}