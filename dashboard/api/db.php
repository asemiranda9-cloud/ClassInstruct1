<?php
// ═══════════════════════════════════
//  db.php — ClassInstruct MySQL Backend
// ═══════════════════════════════════

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// ── Database Config (XAMPP defaults) ──
define('DB_HOST', 'localhost');
define('DB_USER', 'root');       // XAMPP default user
define('DB_PASS', '');           // XAMPP default password (empty)
define('DB_NAME', 'classinstructdb');

// ── Connect ──
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $conn->connect_error]);
    exit;
}
$conn->set_charset('utf8mb4');

// ── Router ──
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {
    case 'GET':    getStudents($conn); break;
    case 'POST':   addStudent($conn);  break;
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
//  POST — Add new student
// ═══════════════════════════════════
function addStudent($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) { http_response_code(400); echo json_encode(['error' => 'Invalid JSON']); return; }

    // Check duplicate studentId
    $sid = $conn->real_escape_string($data['studentId'] ?? '');
    $check = $conn->query("SELECT id FROM students WHERE student_id = '$sid'");
    if ($check->num_rows > 0) {
        http_response_code(409);
        echo json_encode(['error' => 'Student ID / LRN already exists']);
        return;
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

    $stmt->bind_param('ssssssssssssssssss',
        $data['studentId'],  $data['fullName'],     $dob,
        $data['gender'],     $data['grade'],         $data['section'],
        $enrollDate,        $data['prevSchool'],    $data['email'],
        $data['phone'],      $data['address'],       $data['fatherName'],
        $data['fatherPhone'],$data['motherName'],    $data['motherPhone'],
        $data['guardianName'],$data['guardianRelation'],$data['guardianPhone']
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

    // Check duplicate studentId (excluding self)
    $sid = $conn->real_escape_string($data['studentId'] ?? '');
    $check = $conn->query("SELECT id FROM students WHERE student_id = '$sid' AND id != $id");
    if ($check->num_rows > 0) {
        http_response_code(409);
        echo json_encode(['error' => 'Student ID / LRN already exists']);
        return;
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
        $data['studentId'],  $data['fullName'],      $dob,
        $data['gender'],     $data['grade'],          $data['section'],
        $enrollDate,        $data['prevSchool'],     $data['email'],
        $data['phone'],      $data['address'],        $data['fatherName'],
        $data['fatherPhone'],$data['motherName'],     $data['motherPhone'],
        $data['guardianName'],$data['guardianRelation'],$data['guardianPhone'],
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
    return [
        'id'               => (int)$row['id'],
        'studentId'        => $row['student_id'],
        'fullName'         => $row['full_name'],
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