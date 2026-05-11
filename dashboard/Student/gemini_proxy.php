<?php
/**
 * gemini_proxy.php — Secure Gemini Vision AI Proxy
 *
 * Receives a base64 image + prompt from the browser,
 * attaches the secret API key from .env server-side,
 * forwards the request to Google Gemini, and returns
 * the JSON result.
 *
 * The API key is NEVER exposed to the browser.
 *
 * Expected POST body (JSON):
 *   { "imageBase64": "<base64 string>", "mimeType": "image/jpeg", "prompt": "..." }
 *
 * Response:
 *   { "students": [ { lastName, firstName, middleName, studentId, gender, grade, section }, ... ] }
 *   or on error:
 *   { "error": "message" }
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

// ── Only allow POST ────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Read + validate request body ──────────────────────────────────────
$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!$body || empty($body['imageBase64']) || empty($body['mimeType'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing imageBase64 or mimeType']);
    exit;
}

$imageBase64 = $body['imageBase64'];
$mimeType    = $body['mimeType'];
// Accept either a full 'prompt' override or a 'promptSuffix' appended to the default
$promptSuffix = isset($body['promptSuffix']) ? "
" . trim($body['promptSuffix']) : '';
$promptText   = isset($body['prompt']) ? $body['prompt'] : (_defaultPrompt() . $promptSuffix);

// ── Load API key from .env ────────────────────────────────────────────
$apiKey = env('GEMINI_API_KEY');
$model  = env('GEMINI_MODEL', 'gemini-2.5-flash');

if (!$apiKey) {
    http_response_code(500);
    echo json_encode(['error' => 'GEMINI_API_KEY is not set in .env']);
    exit;
}

// ── Build Gemini request ──────────────────────────────────────────────
function buildRequestBody(string $mimeType, string $imageBase64, string $promptText): array {
    return [
        'contents' => [[
            'parts' => [
                [
                    'inline_data' => [
                        'mime_type' => $mimeType,
                        'data'      => $imageBase64,
                    ]
                ],
                ['text' => $promptText]
            ]
        ]],
        'generationConfig' => [
            'temperature'      => 0,
            'maxOutputTokens'  => 65536,
        ]
    ];
}

function callGemini(string $model, string $apiKey, array $requestBody): array {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . urlencode($apiKey);
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode($requestBody),
        CURLOPT_TIMEOUT        => 60,
    ]);
    $response   = curl_exec($ch);
    $httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError  = curl_error($ch);
    curl_close($ch);
    return [$response, $httpStatus, $curlError];
}

// ── Call Gemini — try primary model, fall back to flash-lite on quota error ──
$requestBody = buildRequestBody($mimeType, $imageBase64, $promptText);

// Fallback chain: primary → gemini-2.5-flash-lite
$modelsToTry = array_unique([$model, 'gemini-2.5-flash-lite']);
$response = $httpStatus = $curlError = null;
$usedModel = $model;

foreach ($modelsToTry as $tryModel) {
    [$response, $httpStatus, $curlError] = callGemini($tryModel, $apiKey, $requestBody);
    $usedModel = $tryModel;
    if ($curlError) break; // network error — don't retry
    if ($httpStatus === 200) break; // success
    // On quota/rate-limit (429) or model-gone (404/503), try next model
    $tmpData = json_decode($response, true);
    $tmpMsg  = $tmpData['error']['message'] ?? '';
    $isQuota = ($httpStatus === 429) || stripos($tmpMsg, 'quota') !== false || stripos($tmpMsg, 'deprecated') !== false;
    if (!$isQuota) break; // non-quota error — no point retrying with different model
}

if ($curlError) {
    http_response_code(502);
    echo json_encode(['error' => 'Network error: ' . $curlError]);
    exit;
}

// ── Parse Gemini response ─────────────────────────────────────────────
$geminiData = json_decode($response, true);

if ($httpStatus !== 200) {
    $rawMsg = $geminiData['error']['message'] ?? ('Gemini API error ' . $httpStatus);

    // Condense repeated quota lines into a single clean message
    $isQuotaErr = stripos($rawMsg, 'quota') !== false
               || stripos($rawMsg, 'rate') !== false
               || $httpStatus === 429;
    $isDeprecated = stripos($rawMsg, 'deprecated') !== false
                 || stripos($rawMsg, 'not found') !== false
                 || $httpStatus === 404;

    if ($isDeprecated) {
        $msg = 'The model "' . $usedModel . '" is deprecated or unavailable. Update GEMINI_MODEL in your .env to gemini-2.5-flash.';
    } elseif ($isQuotaErr) {
        preg_match('/retry in ([\d.]+s)/i', $rawMsg, $retryM);
        $retryHint = isset($retryM[1]) ? ' Please retry in ' . $retryM[1] . '.' : '';
        $msg = 'Gemini free-tier quota exceeded (model: ' . $usedModel . ').' . $retryHint;
    } else {
        $msg = $rawMsg;
    }

    http_response_code(502);
    echo json_encode(['error' => $msg]);
    exit;
}

$rawText = '';
foreach ($geminiData['candidates'][0]['content']['parts'] ?? [] as $part) {
    $rawText .= $part['text'] ?? '';
}

if (!$rawText) {
    http_response_code(502);
    echo json_encode(['error' => 'Gemini returned an empty response']);
    exit;
}

// ── Extract JSON from the text — handle multiple response shapes ──────
// Strip markdown code fences if present
$clean = trim(preg_replace('/```json\s*|```\s*/i', '', $rawText));

$students = null;

// Shape 1: bare JSON array  [ {...}, ... ]
// Shape 2: object wrapper   { "students": [ {...}, ... ] }
// Shape 3: other object key { "data": [ {...}, ... ] }

$decoded = json_decode($clean, true);

if (is_array($decoded)) {
    // Shape 1 — top-level array
    if (isset($decoded[0])) {
        $students = $decoded;
    }
    // Shape 2/3 — object with one array value
    else {
        foreach ($decoded as $v) {
            if (is_array($v) && isset($v[0])) { $students = $v; break; }
        }
    }
}

// Fallback: grep for the first [...] block in the raw text
if (!is_array($students)) {
    preg_match('/\[[\s\S]*\]/U', $clean, $matches); // non-greedy first match
    if (!$matches) {
        // Last-resort: greedy match
        preg_match('/\[[\s\S]*\]/', $clean, $matches);
    }
    if ($matches) {
        $students = json_decode($matches[0], true);
    }
}

if (!is_array($students) || count($students) === 0) {
    // ── Truncation recovery: salvage all complete {...} objects ──────────
    // Gemini sometimes cuts off mid-JSON when the list is very long.
    // Extract every complete object using a balanced-brace scan.
    $salvaged = [];
    $len = strlen($clean);
    $i   = 0;
    while ($i < $len) {
        $start = strpos($clean, '{', $i);
        if ($start === false) break;
        $depth = 0;
        $inStr = false;
        $escape = false;
        for ($j = $start; $j < $len; $j++) {
            $c = $clean[$j];
            if ($escape)          { $escape = false; continue; }
            if ($c === '\\')      { $escape = true;  continue; }
            if ($c === '"')       { $inStr = !$inStr; continue; }
            if ($inStr)           continue;
            if ($c === '{')       $depth++;
            elseif ($c === '}') { $depth--; if ($depth === 0) { $end = $j; break; } }
        }
        if (isset($end) && $depth === 0) {
            $obj = json_decode(substr($clean, $start, $end - $start + 1), true);
            if (is_array($obj) && isset($obj['lastName'])) $salvaged[] = $obj;
            $i = $end + 1;
            unset($end);
        } else {
            break; // incomplete object — stop
        }
    }

    if (count($salvaged) > 0) {
        // Return salvaged records with a warning flag
        echo json_encode(['students' => $salvaged, 'truncated' => true]);
        exit;
    }

    // Return the raw Gemini text truncated so the front-end can show it
    $preview = mb_substr($clean, 0, 600);
    http_response_code(502);
    echo json_encode([
        'error'   => 'Could not parse student list from Gemini response',
        'preview' => $preview,
    ]);
    exit;
}

echo json_encode(['students' => $students]);
exit;


// ── Default extraction prompt (Philippine DepEd masterlist) ──────────
function _defaultPrompt(): string {
    return <<<PROMPT
You are extracting student records from a Philippine Department of Education (DepEd) school masterlist image.

The masterlist may use any of these layouts:
1. TWO-COLUMN — MALES on the left and FEMALES on the right (each with LRN + Name)
2. NUMBERED TABLE — columns: No. | Last Name | , | First Name | , | Middle Name
3. SINGLE-NAME TABLE — LRN/Student No. | Full Name (as "LASTNAME, FIRSTNAME MIDDLENAME")
4. GRADE SHEET — Rank | Student No. | Student Name | scores…

STEP 1 — Read the document header/title to determine:
  - GRADE: Look for text like "Grade 7", "Grade 8", "Grade 10", "GRADE 7", "Baitang 7", etc.
            Return as "Grade 7", "Grade 8", etc. (Title Case with "Grade" prefix).
            If not found, return "".
  - SECTION: Look for section/class name in the title such as "CREATIVITY", "HOPE", "SAMPAGUITA",
             "NARRA", "RIZAL", "Mapagmahal", etc. It often appears after a dash or hyphen in
             the title (e.g. "MASTERLISTS OF GRADE 7 – CREATIVITY" → section is "Creativity").
             Return in Title Case. If not found, return "".

STEP 2 — Extract every student visible. Return ONLY a valid JSON array, no explanation, no markdown, no code fences.

Each object must have exactly these keys:
  "lastName"   — family/surname (Title Case)
  "firstName"  — given name only, no middle name (Title Case)
  "middleName" — middle name or initial WITHOUT the dot, or "" if absent (Title Case)
  "studentId"  — LRN or student number (digits only), or "" if not shown
  "gender"     — "Male", "Female", or "" if not determinable
  "grade"      — grade level read from the document header (e.g. "Grade 7"), or "" if not found
  "section"    — section name read from the document header (e.g. "Creativity"), or "" if not found

RULES:
- Names in the image are usually ALL CAPS — convert to Title Case
- Filipino connectors lowercase after first position: de, del, la, ng, ni, mga
  (e.g. "Dela Cruz", "De Leon", "Ng")
- Suffixes (Jr., Sr., II, III) stay in lastName
- If image splits into MALES / FEMALES columns, assign gender accordingly
- Name format is "LASTNAME, FIRSTNAME MIDDLEINITIAL." for example:
    "Agustin, Ezrael Dave U." → lastName="Agustin", firstName="Ezrael Dave", middleName="U"
    "Halad, Reynaldo Jr. E." → lastName="Halad Jr", firstName="Reynaldo", middleName="E"
    "Galarosa, Keith Eman Gabriel H." → lastName="Galarosa", firstName="Keith Eman Gabriel", middleName="H"
    "Hernando, Ashley Sandie May A." → lastName="Hernando", firstName="Ashley Sandie May", middleName="A"
  The LAST single letter (with or without dot) before end of name = middleName initial (strip the dot).
  Everything between the comma and that last initial = firstName (may be multi-word).
- Strip the trailing dot from middle initials (e.g. "U." → "U")
- The grade and section values must be identical for ALL students in the same document/page
- Do NOT include headers, totals, school name, teacher names, or page footers in TOTAL= rows
- Do NOT guess or invent names — only transcribe what is clearly visible
PROMPT;
}