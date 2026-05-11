<?php
/**
 * grades_db.php — ClassInstruct Grades Backend
 * Connects to existing students + new grades/gpa_scales tables
 */

require_once __DIR__ . '/../config.php';

// Suppress PHP HTML error output so JSON is never corrupted
ini_set('display_errors', 0);
error_reporting(0);

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
    echo json_encode(['error' => 'DB connection failed: ' . $conn->connect_error]);
    exit;
}
$conn->set_charset('utf8mb4');

// Auto-create tables if not exist
$conn->query("
    CREATE TABLE IF NOT EXISTS grades (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        subject VARCHAR(100) NOT NULL,
        quarter VARCHAR(10) NOT NULL DEFAULT 'Q1',
        written_works DECIMAL(5,2) DEFAULT NULL,
        performance_tasks DECIMAL(5,2) DEFAULT NULL,
        quarterly_assessment DECIMAL(5,2) DEFAULT NULL,
        attendance DECIMAL(5,2) DEFAULT NULL,
        final_grade DECIMAL(5,2) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_grade (student_id, subject, quarter),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
");

// grade_item_scores table for per-student per-item scores
$conn->query("
    CREATE TABLE IF NOT EXISTS grade_item_scores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        subject VARCHAR(100) NOT NULL,
        quarter VARCHAR(10) NOT NULL,
        component_key VARCHAR(10) NOT NULL,
        item_name VARCHAR(100) NOT NULL,
        item_max_score DECIMAL(5,2) DEFAULT 100,
        score DECIMAL(5,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_item_score (student_id, subject, quarter, component_key, item_name),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
");

$conn->query("
    CREATE TABLE IF NOT EXISTS subjects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20),
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
");

$conn->query("
    CREATE TABLE IF NOT EXISTS grade_weights (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subject VARCHAR(100) NOT NULL DEFAULT '__default__',
        written_works_pct INT DEFAULT 30,
        performance_tasks_pct INT DEFAULT 50,
        quarterly_assessment_pct INT DEFAULT 20,
        UNIQUE KEY unique_subject (subject)
    )
");

$conn->query("
    INSERT IGNORE INTO grade_weights (subject, written_works_pct, performance_tasks_pct, quarterly_assessment_pct)
    VALUES ('__default__', 30, 50, 20)
");

$conn->query("
    CREATE TABLE IF NOT EXISTS gpa_scales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        scale_name VARCHAR(100) NOT NULL DEFAULT 'Default',
        min_grade DECIMAL(5,2) NOT NULL,
        max_grade DECIMAL(5,2) NOT NULL,
        gpa_value DECIMAL(4,2) NOT NULL,
        letter_grade VARCHAR(5),
        descriptor VARCHAR(100),
        sort_order INT DEFAULT 0
    )
");

// Remove duplicate GPA rows — keep only the lowest id per min+max range
$conn->query("
    DELETE g1 FROM gpa_scales g1
    INNER JOIN gpa_scales g2
    WHERE g1.id > g2.id
      AND g1.min_grade = g2.min_grade
      AND g1.max_grade = g2.max_grade
");

// Add unique constraint only if it doesn't already exist
$result = $conn->query("SHOW INDEX FROM gpa_scales WHERE Key_name = 'unique_range'");
if ($result->num_rows == 0) {
    $conn->query("ALTER TABLE gpa_scales ADD UNIQUE KEY unique_range (min_grade, max_grade)");
}

// Insert defaults only if truly empty; INSERT IGNORE respects the unique key
$check = $conn->query("SELECT COUNT(*) as cnt FROM gpa_scales");
$row = $check->fetch_assoc();
if ($row['cnt'] == 0) {
    $conn->query("
        INSERT IGNORE INTO gpa_scales (scale_name, min_grade, max_grade, gpa_value, letter_grade, descriptor, sort_order) VALUES
        ('DepEd Default', 90,   100,   1.00, 'A',  'Outstanding',        1),
        ('DepEd Default', 85,   89.99, 1.50, 'B+', 'Very Satisfactory',  2),
        ('DepEd Default', 80,   84.99, 2.00, 'B',  'Satisfactory',       3),
        ('DepEd Default', 75,   79.99, 2.50, 'C',  'Fairly Satisfactory',4),
        ('DepEd Default', 0,    74.99, 5.00, 'F',  'Did Not Meet',       5)
    ");
}

// Create subject_grades table — links subjects to specific grade levels
$conn->query("
    CREATE TABLE IF NOT EXISTS subject_grades (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subject_id INT NOT NULL,
        grade_level VARCHAR(20) NOT NULL,
        UNIQUE KEY unique_subj_grade (subject_id, grade_level),
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    )
");

// NOTE: No default subjects are auto-inserted.
// Users add subjects manually via Manage Subjects and assign them to grade levels.

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        switch ($action) {
            case 'students':         getStudents($conn);        break;
            case 'grades':           getGrades($conn);          break;
            case 'subjects':         getSubjects($conn);        break;
            case 'weights':          getWeights($conn);         break;
            case 'gpa_scales':       getGpaScales($conn);       break;
            case 'summary':          getSummary($conn);         break;
            case 'item_scores':      getItemScores($conn);      break;
            case 'subject_grades':   getSubjectGrades($conn);   break;
            case 'distinct_grades':  getDistinctGrades($conn);  break;
            default: http_response_code(400); echo json_encode(['error' => 'Unknown action']);
        }
        break;
    case 'POST':
        switch ($action) {
            case 'save_grades':      saveGrades($conn);         break;
            case 'add_subject':      addSubject($conn);         break;
            case 'save_weights':     saveWeights($conn);        break;
            case 'save_gpa':         saveGpaScales($conn);      break;
            case 'save_subject_grades': saveSubjectGrades($conn); break;
            default: http_response_code(400); echo json_encode(['error' => 'Unknown action']);
        }
        break;
    case 'PUT':
        switch ($action) {
            case 'edit_subject':     editSubject($conn);        break;
            case 'toggle_subject':   toggleSubject($conn);      break;
            default: http_response_code(400); echo json_encode(['error' => 'Unknown action']);
        }
        break;
    case 'DELETE':
        switch ($action) {
            case 'delete_subject':   deleteSubject($conn);      break;
            case 'delete_gpa':       deleteGpaScale($conn);     break;
            default: http_response_code(400); echo json_encode(['error' => 'Unknown action']);
        }
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
$conn->close();


// ── GET students with optional grade/section filter ──
function getStudents($conn) {
    $grade   = $_GET['grade']   ?? '';
    $section = $_GET['section'] ?? '';

    // Auto-detect column naming: db.php may use camelCase (fullName, studentId)
    // or snake_case (full_name, student_id). Check which columns exist.
    $colCheck = $conn->query("SHOW COLUMNS FROM students");
    if (!$colCheck) {
        echo json_encode(['error' => 'students table not found: ' . $conn->error]);
        return;
    }
    $cols = [];
    while ($c = $colCheck->fetch_assoc()) $cols[] = $c['Field'];

    // Pick the right column names
    $nameCol = in_array('fullName',   $cols) ? 'fullName'   : (in_array('full_name',   $cols) ? 'full_name'   : 'name');
    $sidCol  = in_array('studentId',  $cols) ? 'studentId'  : (in_array('student_id',  $cols) ? 'student_id'  : 'id');

    $gradeCol   = in_array('grade',   $cols) ? 'grade'   : 'grade_level';
    $sectionCol = in_array('section', $cols) ? 'section' : 'section';

    $gradeFilter   = $grade   ? " AND `$gradeCol`='"   . $conn->real_escape_string($grade)   . "'" : '';
    $sectionFilter = $section ? " AND `$sectionCol`='" . $conn->real_escape_string($section) . "'" : '';

    $sql = "SELECT id,
                   `$sidCol`  AS student_id,
                   `$nameCol` AS full_name,
                   `$gradeCol`   AS grade,
                   `$sectionCol` AS section
            FROM students
            WHERE (status IS NULL OR status != 'Dropout') $gradeFilter $sectionFilter
            ORDER BY `$nameCol` ASC";

    $result = $conn->query($sql);
    if (!$result) {
        echo json_encode(['error' => 'Query failed: ' . $conn->error, 'columns_found' => $cols]);
        return;
    }
    $rows = [];
    while ($r = $result->fetch_assoc()) $rows[] = $r;
    echo json_encode($rows);
}

// ── GET grades for a subject+quarter (returns per-student rows) ──
function getGrades($conn) {
    $subject = $_GET['subject'] ?? '';
    $quarter = $_GET['quarter'] ?? 'Q1';
    $grade   = $_GET['grade']   ?? '';
    $section = $_GET['section'] ?? '';

    // Auto-detect column names
    $colCheck = $conn->query("SHOW COLUMNS FROM students");
    $cols = [];
    while ($c = $colCheck->fetch_assoc()) $cols[] = $c['Field'];
    $nameCol    = in_array('fullName',  $cols) ? 'fullName'  : (in_array('full_name',   $cols) ? 'full_name'   : 'name');
    $sidCol     = in_array('studentId', $cols) ? 'studentId' : (in_array('student_id',  $cols) ? 'student_id'  : 'id');
    $gradeCol   = in_array('grade',     $cols) ? 'grade'     : 'grade_level';
    $sectionCol = in_array('section',   $cols) ? 'section'   : 'section';

    $where = "WHERE (s.status IS NULL OR s.status != 'Dropout')";
    if ($grade)   $where .= " AND s.`$gradeCol`='"   . $conn->real_escape_string($grade)   . "'";
    if ($section) $where .= " AND s.`$sectionCol`='" . $conn->real_escape_string($section) . "'";

    $subjectEsc = $conn->real_escape_string($subject);
    $quarterEsc = $conn->real_escape_string($quarter);

    $sql = "
        SELECT s.id,
               s.`$sidCol`     AS student_id,
               s.`$nameCol`    AS full_name,
               s.`$gradeCol`   AS grade,
               s.`$sectionCol` AS section,
               g.written_works, g.performance_tasks, g.quarterly_assessment,
               g.attendance, g.final_grade
        FROM students s
        LEFT JOIN grades g ON g.student_id = s.id
                          AND g.subject = '$subjectEsc'
                          AND g.quarter = '$quarterEsc'
        $where
        ORDER BY s.`$nameCol` ASC
    ";
    $result = $conn->query($sql);
    if (!$result) { http_response_code(500); echo json_encode(['error' => $conn->error]); return; }
    $rows = [];
    while ($r = $result->fetch_assoc()) $rows[] = $r;
    echo json_encode($rows);
}

// ── GET subjects (optionally filtered by grade level) ──
function getSubjects($conn) {
    $grade = $_GET['grade'] ?? '';
    if ($grade) {
        $gradeEsc = $conn->real_escape_string($grade);
        $result = $conn->query("
            SELECT s.* FROM subjects s
            INNER JOIN subject_grades sg ON sg.subject_id = s.id
            WHERE sg.grade_level = '$gradeEsc'
            ORDER BY s.name ASC
        ");
    } else {
        $result = $conn->query("SELECT * FROM subjects ORDER BY name ASC");
    }
    $rows = [];
    while ($r = $result->fetch_assoc()) $rows[] = $r;
    echo json_encode($rows);
}

// ── GET weights ──
function getWeights($conn) {
    $result = $conn->query("SELECT * FROM grade_weights");
    $rows = [];
    while ($r = $result->fetch_assoc()) $rows[] = $r;
    echo json_encode($rows);
}

// ── GET GPA scales ──
function getGpaScales($conn) {
    $result = $conn->query("SELECT * FROM gpa_scales ORDER BY sort_order ASC, min_grade DESC");
    $rows = [];
    while ($r = $result->fetch_assoc()) $rows[] = $r;
    echo json_encode($rows);
}

// ── GET summary stats ──
function getSummary($conn) {
    $subject = $_GET['subject'] ?? '';
    $quarter = $_GET['quarter'] ?? 'Q1';
    $grade   = $_GET['grade']   ?? '';
    $section = $_GET['section'] ?? '';
    $subjectEsc = $conn->real_escape_string($subject);
    $quarterEsc = $conn->real_escape_string($quarter);

    // Count total students (with optional filters)
    $studentWhere = "WHERE 1=1";
    if ($grade)   $studentWhere .= " AND grade='"   . $conn->real_escape_string($grade)   . "'";
    if ($section) $studentWhere .= " AND section='" . $conn->real_escape_string($section) . "'";
    $totalRes = $conn->query("SELECT COUNT(*) as cnt FROM students $studentWhere");
    $totalRow = $totalRes->fetch_assoc();
    $totalStudents = (int)$totalRow['cnt'];

    $result = $conn->query("
        SELECT g.final_grade, g.written_works, g.performance_tasks, g.quarterly_assessment
        FROM grades g
        JOIN students s ON s.id = g.student_id
        WHERE g.subject='$subjectEsc' AND g.quarter='$quarterEsc' AND g.final_grade IS NOT NULL
        " . ($grade   ? " AND s.grade='"   . $conn->real_escape_string($grade)   . "'" : '')
          . ($section ? " AND s.section='" . $conn->real_escape_string($section) . "'" : '')
    );
    $rows   = [];
    $grades = [];
    while ($r = $result->fetch_assoc()) {
        $grades[] = (float)$r['final_grade'];
        $rows[]   = $r;
    }

    $total = count($grades);
    $avg   = $total ? array_sum($grades) / $total : 0;
    $max   = $total ? max($grades) : 0;
    $min   = $total ? min($grades) : 0;
    $pass  = count(array_filter($grades, fn($g) => $g >= 75));

    // Component averages
    $wwVals  = array_filter(array_column($rows, 'written_works'),        fn($v) => $v !== null);
    $ptVals  = array_filter(array_column($rows, 'performance_tasks'),    fn($v) => $v !== null);
    $qaVals  = array_filter(array_column($rows, 'quarterly_assessment'), fn($v) => $v !== null);
    $avgWW   = count($wwVals) ? round(array_sum($wwVals) / count($wwVals), 2) : null;
    $avgPT   = count($ptVals) ? round(array_sum($ptVals) / count($ptVals), 2) : null;
    $avgQA   = count($qaVals) ? round(array_sum($qaVals) / count($qaVals), 2) : null;

    // Descriptor distribution using gpa_scales (ordered high to low)
    $scalesResult = $conn->query("SELECT * FROM gpa_scales ORDER BY max_grade DESC");
    $scales = [];
    while ($r = $scalesResult->fetch_assoc()) $scales[] = $r;

    $distrib = [];
    foreach ($scales as $sc) {
        $cnt = count(array_filter($grades, fn($g) => $g >= (float)$sc['min_grade'] && $g <= (float)$sc['max_grade']));
        $distrib[] = [
            'descriptor' => $sc['descriptor'],
            'letter'     => $sc['letter_grade'],
            'min'        => (float)$sc['min_grade'],
            'max'        => (float)$sc['max_grade'],
            'count'      => $cnt,
            'pct'        => $total ? round($cnt / $total * 100, 1) : 0,
        ];
    }

    echo json_encode([
        'total_students' => $totalStudents,
        'graded'  => $total,
        'average' => round($avg, 2),
        'highest' => $max,
        'lowest'  => $min,
        'passing' => $pass,
        'failing' => $total - $pass,
        'distrib' => $distrib,
        'components' => [
            'written_works'        => $avgWW,
            'performance_tasks'    => $avgPT,
            'quarterly_assessment' => $avgQA,
        ],
    ]);
}

// ── GET item_scores for a subject+quarter ──
function getItemScores($conn) {
    $subject = $_GET['subject'] ?? '';
    $quarter = $_GET['quarter'] ?? 'Q1';
    $grade   = $_GET['grade']   ?? '';
    $section = $_GET['section'] ?? '';

    if (!$subject) {
        echo json_encode(['error' => 'Subject required']); return;
    }

    $subjectEsc = $conn->real_escape_string($subject);
    $quarterEsc = $conn->real_escape_string($quarter);

    $studentWhere = "WHERE 1=1";
    if ($grade)   $studentWhere .= " AND grade='"   . $conn->real_escape_string($grade)   . "'";
    if ($section) $studentWhere .= " AND section='" . $conn->real_escape_string($section) . "'";

    $sql = "
        SELECT s.id as student_id, gis.component_key, gis.item_name, gis.item_max_score, gis.score
        FROM students s
        LEFT JOIN grade_item_scores gis ON gis.student_id = s.id AND gis.subject='$subjectEsc' AND gis.quarter='$quarterEsc'
        $studentWhere
        ORDER BY s.full_name ASC, gis.component_key ASC, gis.item_name ASC
    ";

    $result = $conn->query($sql);
    if (!$result) { http_response_code(500); echo json_encode(['error' => $conn->error]); return; }

    $rows = [];
    while ($r = $result->fetch_assoc()) $rows[] = $r;
    echo json_encode($rows);
}

// ── POST save_grades (bulk upsert) ──
function saveGrades($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) { http_response_code(400); echo json_encode(['error' => 'Invalid JSON']); return; }

    $subject = $conn->real_escape_string($data['subject'] ?? '');
    $quarter = $conn->real_escape_string($data['quarter'] ?? 'Q1');
    $records = $data['records'] ?? [];

    $stmt = $conn->prepare("
        INSERT INTO grades (student_id, subject, quarter, written_works, performance_tasks, quarterly_assessment, attendance, final_grade)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            written_works=VALUES(written_works),
            performance_tasks=VALUES(performance_tasks),
            quarterly_assessment=VALUES(quarterly_assessment),
            attendance=VALUES(attendance),
            final_grade=VALUES(final_grade)
    ");

    $saved = 0;
    foreach ($records as $rec) {
        $sid  = (int)$rec['student_id'];
        // Use null for missing/null values (NULL-safe for DECIMAL columns)
        $ww   = ($rec['written_works']          !== null && $rec['written_works']          !== '') ? (float)$rec['written_works']          : null;
        $pt   = ($rec['performance_tasks']       !== null && $rec['performance_tasks']       !== '') ? (float)$rec['performance_tasks']       : null;
        $qa   = ($rec['quarterly_assessment']    !== null && $rec['quarterly_assessment']    !== '') ? (float)$rec['quarterly_assessment']    : null;
        $att  = ($rec['attendance']              !== null && $rec['attendance']              !== '') ? (float)$rec['attendance']              : null;
        $fg   = ($rec['final_grade']             !== null && $rec['final_grade']             !== '') ? (float)$rec['final_grade']             : null;
        $stmt->bind_param('issddddd', $sid, $subject, $quarter, $ww, $pt, $qa, $att, $fg);
        if ($stmt->execute()) $saved++;
    }
    $stmt->close();

    // Save item scores — JS sends: item_scores[compKey][itemId] = score (plain number)
    // or item_scores[compKey][itemId] = { score, maxScore } (object form)
    $itemStmt = $conn->prepare("
        INSERT INTO grade_item_scores (student_id, subject, quarter, component_key, item_name, item_max_score, score)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE score=VALUES(score), item_max_score=VALUES(item_max_score)
    ");
    foreach ($records as $rec) {
        $sid = (int)$rec['student_id'];
        $itemScores = $rec['item_scores'] ?? [];
        if (!is_array($itemScores)) continue;
        foreach ($itemScores as $compKey => $items) {
            if (!is_array($items)) continue;
            $compKeyEsc = $conn->real_escape_string((string)$compKey);
            foreach ($items as $itemId => $scoreData) {
                // Accept both plain number and {score, maxScore} object
                if (is_array($scoreData)) {
                    $score    = isset($scoreData['score'])    ? (float)$scoreData['score']    : null;
                    $maxScore = isset($scoreData['maxScore']) ? (float)$scoreData['maxScore'] : 100.0;
                } elseif (is_numeric($scoreData)) {
                    $score    = (float)$scoreData;
                    $maxScore = 100.0;
                } else {
                    continue; // null or non-numeric — skip
                }
                if ($score === null) continue;
                $itemIdEsc = $conn->real_escape_string((string)$itemId);
                $itemStmt->bind_param('issssdd', $sid, $subject, $quarter, $compKeyEsc, $itemIdEsc, $maxScore, $score);
                $itemStmt->execute();
            }
        }
    }
    $itemStmt->close();

    echo json_encode(['success' => true, 'saved' => $saved]);
}

// ── POST add_subject ──
function addSubject($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    $name = trim($data['name'] ?? '');
    $code = strtoupper(trim($data['code'] ?? ''));
    if (!$name) { http_response_code(400); echo json_encode(['error' => 'Subject name required']); return; }
    $check = $conn->query("SELECT id FROM subjects WHERE name='" . $conn->real_escape_string($name) . "'");
    if ($check->num_rows > 0) { http_response_code(409); echo json_encode(['error' => 'Subject already exists']); return; }
    $stmt = $conn->prepare("INSERT INTO subjects (name, code) VALUES (?, ?)");
    $stmt->bind_param('ss', $name, $code);
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'id' => $conn->insert_id, 'name' => $name, 'code' => $code]);
    } else {
        http_response_code(500); echo json_encode(['error' => $stmt->error]);
    }
    $stmt->close();
}

// ── PUT edit_subject ──
function editSubject($conn) {
    $id   = (int)($_GET['id'] ?? 0);
    $data = json_decode(file_get_contents('php://input'), true);
    $name = trim($data['name'] ?? '');
    $code = strtoupper(trim($data['code'] ?? ''));
    if (!$id || !$name) { http_response_code(400); echo json_encode(['error' => 'ID and name required']); return; }
    $stmt = $conn->prepare("UPDATE subjects SET name=?, code=? WHERE id=?");
    $stmt->bind_param('ssi', $name, $code, $id);
    $stmt->execute();
    echo json_encode(['success' => true]);
    $stmt->close();
}

// ── DELETE delete_subject ──
function deleteSubject($conn) {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'Missing id']); return; }
    $stmt = $conn->prepare("DELETE FROM subjects WHERE id=?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    echo json_encode(['success' => true, 'deleted' => $stmt->affected_rows]);
    $stmt->close();
}

// ── POST save_weights ──
function saveWeights($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    $ww  = (int)($data['written_works_pct'] ?? 30);
    $pt  = (int)($data['performance_tasks_pct'] ?? 50);
    $qa  = (int)($data['quarterly_assessment_pct'] ?? 20);
    if ($ww + $pt + $qa !== 100) { http_response_code(400); echo json_encode(['error' => 'Weights must total 100%']); return; }
    $wtStmt = $conn->prepare("UPDATE grade_weights SET written_works_ppt=?, performance_tasks_ppt=?, quarterly_assessment_ppt=? WHERE subject='__default__'");
    $wtStmt->bind_param('iii', $ww, $pt, $qa);
    $wtStmt->execute();
    echo json_encode(['success' => true]);
    $wtStmt->close();
}

// ── POST save_gpa (replace all scales) ──
function saveGpaScales($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    $scales = $data['scales'] ?? [];
    if (empty($scales)) { http_response_code(400); echo json_encode(['error' => 'No scales provided']); return; }
    $conn->query("DELETE FROM gpa_scales");
    $stmt = $conn->prepare("INSERT INTO gpa_scales (scale_name, min_grade, max_grade, gpa_value, letter_grade, descriptor, sort_order) VALUES (?,?,?,?,?,?,?)");
    $saved = 0;
    foreach ($scales as $i => $sc) {
        $sname = $conn->real_escape_string($sc['scale_name'] ?? 'Custom');
        $min   = (float)$sc['min_grade'];
        $max   = (float)$sc['max_grade'];
        $gpa   = (float)$sc['gpa_value'];
        $ltr   = $conn->real_escape_string($sc['letter_grade'] ?? '');
        $desc  = $conn->real_escape_string($sc['descriptor'] ?? '');
        $ord   = $i + 1;
        $stmt->bind_param('sdddssi', $sname, $min, $max, $gpa, $ltr, $desc, $ord);
        if ($stmt->execute()) $saved++;
    }
    $stmt->close();
    echo json_encode(['success' => true, 'saved' => $saved]);
}

// ── DELETE delete_gpa ──
function deleteGpaScale($conn) {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'Missing id']); return; }
    $stmt = $conn->prepare("DELETE FROM gpa_scales WHERE id=?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    echo json_encode(['success' => true]);
    $stmt->close();
}
// ── PUT toggle_subject ──
function toggleSubject($conn) {
    $id     = (int)($_GET['id'] ?? 0);
    $data   = json_decode(file_get_contents('php://input'), true);
    $active = isset($data['is_active']) ? (int)$data['is_active'] : 0;
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'Missing id']); return; }
    $stmt = $conn->prepare("UPDATE subjects SET is_active=? WHERE id=?");
    $stmt->bind_param('ii', $active, $id);
    $stmt->execute();
    echo json_encode(['success' => true]);
    $stmt->close();
}

// ── GET subject_grades — returns all subject→grade assignments ──
function getSubjectGrades($conn) {
    $result = $conn->query("
        SELECT sg.subject_id, sg.grade_level, s.name, s.code
        FROM subject_grades sg
        JOIN subjects s ON s.id = sg.subject_id
        ORDER BY sg.grade_level ASC, s.name ASC
    ");
    $rows = [];
    while ($r = $result->fetch_assoc()) $rows[] = $r;
    echo json_encode($rows);
}

// ── POST save_subject_grades — replace grade assignments for all subjects ──
// -- GET distinct_grades -- returns only grade levels that have enrolled students --
function getDistinctGrades($conn) {
    $colCheck = $conn->query("SHOW COLUMNS FROM students");
    $cols = [];
    while ($c = $colCheck->fetch_assoc()) $cols[] = $c['Field'];
    $gradeCol = in_array('grade', $cols) ? 'grade' : 'grade_level';
    $result = $conn->query("
        SELECT DISTINCT `$gradeCol` AS grade_level
        FROM students
        WHERE (`$gradeCol` IS NOT NULL AND `$gradeCol` != '')
          AND (status IS NULL OR status != 'Dropout')
        ORDER BY FIELD(`$gradeCol`,
            'Kindergarten',
            'Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6',
            'Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'
        ), `$gradeCol` ASC
    ");
    $rows = [];
    while ($r = $result->fetch_assoc()) $rows[] = $r['grade_level'];
    echo json_encode($rows);
}

function saveSubjectGrades($conn) {
    $data        = json_decode(file_get_contents('php://input'), true);
    $assignments = $data['assignments'] ?? []; // [{subject_id, grade_level}]
    if (!is_array($assignments)) { http_response_code(400); echo json_encode(['error' => 'Invalid data']); return; }

    // Wipe and re-insert
    $conn->query("DELETE FROM subject_grades");
    $stmt = $conn->prepare("INSERT IGNORE INTO subject_grades (subject_id, grade_level) VALUES (?, ?)");
    $saved = 0;
    foreach ($assignments as $a) {
        $sid   = (int)($a['subject_id']  ?? 0);
        $grade = trim($a['grade_level']  ?? '');
        if (!$sid || !$grade) continue;
        $stmt->bind_param('is', $sid, $grade);
        if ($stmt->execute()) $saved++;
    }
    $stmt->close();
    echo json_encode(['success' => true, 'saved' => $saved]);
}