<?php
// ═══════════════════════════════════
//  db.php — ClassInstruct MySQL Backend
// ═══════════════════════════════════

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

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'classinstructdb');

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $conn->connect_error]);
    exit;
}
$conn->set_charset('utf8mb4');

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
    case 'DELETE': deleteStudent($conn, $id); break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();

// ═══════════════════════════════════
//  GET — List all students
// ═══════════════════════════════════
function getStudents($conn) {
    $sql = "SELECT * FROM students ORDER BY full_name ASC";
    $result = $conn->query($sql);
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
}

// ═══════════════════════════════════
//  GET — List distinct sections from student data
// ═══════════════════════════════════
function getSections($conn) {
    $sql = "SELECT DISTINCT section FROM students WHERE section IS NOT NULL AND section != '' ORDER BY section ASC";
    $result = $conn->query($sql);
    if (!$result) {
        http_response_code(500);
        echo json_encode(['error' => $conn->error]);
        return;
    }
    $sections = [];
    while ($row = $result->fetch_assoc()) {
        $sections[] = $row['section'];
    }
    echo json_encode($sections);
}

// ═══════════════════════════════════
//  POST — Add new student
// ═══════════════════════════════════
function addStudent($conn) {
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

    // Only enforce uniqueness when an actual ID was supplied
    if ($studentId !== null) {
        $sid   = $conn->real_escape_string($studentId);
        $check = $conn->query("SELECT id FROM students WHERE student_id = '$sid'");
        if ($check && $check->num_rows > 0) {
            http_response_code(409);
            echo json_encode(['error' => 'Student ID / LRN already exists']);
            return;
        }
    }

    $stmt = $conn->prepare(
        "INSERT INTO students
          (student_id, full_name, dob, gender, grade, section, enroll_date,
           prev_school, email, phone, address,
           father_name, father_phone, mother_name, mother_phone,
           guardian_name, guardian_relation, guardian_phone)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    );

    $dob        = empty($data['dob'])        ? null : $data['dob'];
    $enrollDate = empty($data['enrollDate']) ? null : $data['enrollDate'];

    // Bind $studentId (may be null) — NOT $data['studentId']
    $stmt->bind_param('ssssssssssssssssss',
        $studentId,            $fullName,               $dob,
        $data['gender'],       $data['grade'],           $data['section'],
        $enrollDate,           $data['prevSchool'],      $data['email'],
        $data['phone'],        $data['address'],         $data['fatherName'],
        $data['fatherPhone'],  $data['motherName'],      $data['motherPhone'],
        $data['guardianName'], $data['guardianRelation'],$data['guardianPhone']
    );

    if ($stmt->execute()) {
        $newId = $conn->insert_id;
        $row = $conn->query("SELECT * FROM students WHERE id = $newId")->fetch_assoc();
        http_response_code(201);
        echo json_encode(mapRow($row));
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
        $sid   = $conn->real_escape_string($studentId);
        $check = $conn->query("SELECT id FROM students WHERE student_id = '$sid' AND id != $id");
        if ($check && $check->num_rows > 0) {
            http_response_code(409);
            echo json_encode(['error' => 'Student ID / LRN already exists']);
            return;
        }
    }

    $stmt = $conn->prepare("
        UPDATE students SET
          student_id=?, full_name=?, dob=?, gender=?, grade=?, section=?, enroll_date=?,
          prev_school=?, email=?, phone=?, address=?,
          father_name=?, father_phone=?, mother_name=?, mother_phone=?,
          guardian_name=?, guardian_relation=?, guardian_phone=?
        WHERE id=?
    ");

    $dob        = empty($data['dob'])        ? null : $data['dob'];
    $enrollDate = empty($data['enrollDate']) ? null : $data['enrollDate'];

    $stmt->bind_param('ssssssssssssssssssi',
        $studentId,            $fullName,               $dob,
        $data['gender'],       $data['grade'],           $data['section'],
        $enrollDate,           $data['prevSchool'],      $data['email'],
        $data['phone'],        $data['address'],         $data['fatherName'],
        $data['fatherPhone'],  $data['motherName'],      $data['motherPhone'],
        $data['guardianName'], $data['guardianRelation'],$data['guardianPhone'],
        $id
    );

    if ($stmt->execute()) {
        $row = $conn->query("SELECT * FROM students WHERE id = $id")->fetch_assoc();
        echo json_encode(mapRow($row));
    } else {
        http_response_code(500);
        echo json_encode(['error' => $stmt->error]);
    }
    $stmt->close();
}

// ═══════════════════════════════════
//  POST — Add new section (free-text)
// ═══════════════════════════════════
function addSection($conn, $name) {
    $name = isset($name) ? trim((string)$name) : '';
    if ($name === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Section name is required']);
        return;
    }
    // Sections are stored per-student, so we just return success.
    // The section becomes available once a student is assigned to it.
    echo json_encode(['success' => true, 'section' => $name]);
}

// ═══════════════════════════════════
//  DELETE — Delete student by ID
// ═══════════════════════════════════
function deleteStudent($conn, $id) {
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'Missing id']); return; }

    $stmt = $conn->prepare("DELETE FROM students WHERE id = ?");
    $stmt->bind_param('i', $id);

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
        'createdAt'        => $row['created_at'],
    ];
}