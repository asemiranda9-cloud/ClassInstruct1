<?php
/**
 * ClassInstruct AI — PHP Backend
 * Replaces server.js (Node/Express)
 * Requires: PHP 8.0+, allow_url_fopen = On (or cURL)
 */

// ── CORS ─────────────────────────────────────────────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Load config ──────────────────────────────────────────
$envPath = __DIR__ . '/.env';
$env = [];
if (file_exists($envPath)) {
    foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            [$k, $v] = explode('=', $line, 2);
            $env[trim($k)] = trim($v);
        }
    }
}

$GEMINI_API_KEY = $env['GEMINI_API_KEY'] ?? getenv('GEMINI_API_KEY') ?? '';
$YOUTUBE_API_KEY = $env['YOUTUBE_API_KEY'] ?? getenv('YOUTUBE_API_KEY') ?? '';

// ── Router (query string: api.php?route=chat) ────────────
$method = $_SERVER['REQUEST_METHOD'];
$route  = $_GET['route'] ?? '';
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

if ($method === 'GET' && $route === '') {
    header('Content-Type: application/json');
    echo json_encode([
        'status'    => 'running',
        'hasApiKey' => !empty($GEMINI_API_KEY),
        'message'   => !empty($GEMINI_API_KEY)
            ? 'ClassInstruct AI backend is running.'
            : 'API key not configured. Set GEMINI_API_KEY in .env'
    ]);
    exit;
}

if ($method === 'GET' && $route === 'ping') {
    header('Content-Type: application/json');
    echo json_encode(['ok' => true, 'streaming' => true]);
    exit;
}

if ($method === 'POST' && $route === 'fetch-link') {
    handleFetchLink($body);
    exit;
}

if ($method === 'POST' && $route === 'fetch-youtube') {
    handleFetchYoutube($body, $YOUTUBE_API_KEY);
    exit;
}

if ($method === 'POST' && $route === 'upload-video') {
    handleUploadVideo($body, $GEMINI_API_KEY);
    exit;
}

if ($method === 'POST' && $route === 'chat') {
    handleChat($body, $GEMINI_API_KEY);
    exit;
}

http_response_code(404);
header('Content-Type: application/json');
echo json_encode(['error' => 'Not found. Use ?route=chat, ?route=fetch-link, etc.']);
exit;


// ════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ════════════════════════════════════════════════════════
function getSystemPrompt(): string {
    return 'You are ClassInstruct AI, a professional educational assistant designed exclusively for teachers and school administrators.

TONE AND LANGUAGE:
- Use formal, clear, and precise academic language at all times.
- Never use emojis, emoticons, or any decorative symbols.
- Never use special characters such as asterisks (*), hashtags (#), tildes (~), underscores (_), or any markdown syntax.
- Do not use exclamation marks. Maintain a calm, authoritative, and professional tone throughout.
- Avoid filler phrases such as "Absolutely!", "Great question!", "Of course!", or "Sure!". Begin responses directly and substantively.

STRUCTURE AND FORMATTING:
- Use plain text only. Do not apply any markdown formatting.
- When listing items, use numbered lists (1. 2. 3.) or write them as clear prose.
- Use section labels followed by a colon and a line break to organize longer responses (e.g., "Learning Objectives:" on its own line).
- Keep responses concise and well-organized. Avoid unnecessary repetition or padding.

CONTENT STANDARDS:
- Provide accurate, curriculum-appropriate guidance suitable for professional educators.
- When generating lesson plans, quizzes, rubrics, or instructional materials, follow sound pedagogical principles.
- Always tailor advice to the specific grade level and subject matter provided by the teacher.
- If a request is unclear, ask a focused clarifying question before proceeding.';
}


// ════════════════════════════════════════════════════════
// HELPER: cURL GET/POST
// ════════════════════════════════════════════════════════
function curlGet(string $url, int $timeout = 10): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; ClassInstructAI/1.0)',
        CURLOPT_HTTPHEADER     => ['Accept: text/html,text/plain;q=0.9,*/*;q=0.8'],
    ]);
    $body   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $ctype  = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $err    = curl_error($ch);

    return ['body' => $body, 'status' => $status, 'ctype' => $ctype, 'error' => $err];
}

function curlPost(string $url, array $headers, string $payload, int $timeout = 30): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => $timeout,
    ]);
    $body   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err    = curl_error($ch);

    return ['body' => $body, 'status' => $status, 'error' => $err];
}

function jsonError(int $code, string $msg): void {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode(['error' => $msg]);
}


// ════════════════════════════════════════════════════════
// /fetch-link
// ════════════════════════════════════════════════════════
function handleFetchLink(array $body): void {
    $url = trim($body['url'] ?? '');
    if (!$url) { jsonError(400, 'No URL provided.'); return; }

    $parsed = parse_url($url);
    if (!$parsed || !in_array($parsed['scheme'] ?? '', ['http', 'https'])) {
        jsonError(400, 'Only http and https URLs are supported.');
        return;
    }

    $r = curlGet($url, 10);
    if ($r['error']) { jsonError(502, 'Failed to retrieve the page. It may be blocking automated access.'); return; }
    if ($r['status'] !== 200) { jsonError(502, "Could not fetch the page (HTTP {$r['status']})."); return; }

    $html = $r['body'];

    // Plain text short-circuit
    if (str_contains((string)$r['ctype'], 'text/plain')) {
        header('Content-Type: application/json');
        echo json_encode(['text' => mb_substr($html, 0, 12000)]);
        return;
    }

    // Strip HTML to readable text
    $stripped = preg_replace([
        '/<script[\s\S]*?<\/script>/i',
        '/<style[\s\S]*?<\/style>/i',
        '/<nav[\s\S]*?<\/nav>/i',
        '/<footer[\s\S]*?<\/footer>/i',
        '/<header[\s\S]*?<\/header>/i',
        '/<[^>]+>/',
        '/\s{2,}/',
        '/\n{3,}/',
    ], [' ', ' ', ' ', ' ', ' ', ' ', ' ', "\n\n"], $html);

    $stripped = html_entity_decode(trim($stripped), ENT_QUOTES | ENT_HTML5, 'UTF-8');

    header('Content-Type: application/json');
    echo json_encode(['text' => mb_substr($stripped, 0, 12000)]);
}


// ════════════════════════════════════════════════════════
// /fetch-youtube
// ════════════════════════════════════════════════════════
function handleFetchYoutube(array $body, string $ytKey): void {
    $videoId = trim($body['videoId'] ?? '');
    if (!$videoId) { jsonError(400, 'No video ID provided.'); return; }
    if (!$ytKey)   { jsonError(500, 'YOUTUBE_API_KEY not set in .env.'); return; }

    // Metadata
    $metaUrl = "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" . urlencode($videoId) . "&key=" . urlencode($ytKey);
    $mr = curlGet($metaUrl, 8);
    if ($mr['error']) { jsonError(502, 'YouTube API request failed.'); return; }

    $meta = json_decode($mr['body'], true);
    if (empty($meta['items'])) { jsonError(404, 'Video not found or is private.'); return; }

    $snippet     = $meta['items'][0]['snippet'];
    $title       = $snippet['title'] ?? '';
    $channel     = $snippet['channelTitle'] ?? '';
    $description = mb_substr($snippet['description'] ?? '', 0, 1500);
    $tags        = implode(', ', array_slice($snippet['tags'] ?? [], 0, 20));

    // Captions list
    $capUrl = "https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=" . urlencode($videoId) . "&key=" . urlencode($ytKey);
    $cr = curlGet($capUrl, 8);
    $captionNote = 'No captions are publicly available for this video.';
    if (!$cr['error']) {
        $capData = json_decode($cr['body'], true);
        if (!empty($capData['items'])) {
            $langs = array_map(fn($c) => $c['snippet']['language'] ?? $c['snippet']['trackKind'], $capData['items']);
            $captionNote = 'Captions available in: ' . implode(', ', $langs) . '. (Caption text requires OAuth and cannot be fetched with an API key alone.)';
        }
    }

    header('Content-Type: application/json');
    echo json_encode(compact('title', 'channel', 'description', 'tags', 'captionNote'));
}


// ════════════════════════════════════════════════════════
// /upload-video  — Gemini File API resumable upload
// ════════════════════════════════════════════════════════
function handleUploadVideo(array $body, string $apiKey): void {
    $videoBase64 = $body['videoBase64'] ?? '';
    $mimeType    = $body['mimeType']    ?? '';
    $fileName    = $body['fileName']    ?? 'video';

    if (!$videoBase64 || !$mimeType) { jsonError(400, 'Missing videoBase64 or mimeType.'); return; }
    if (!$apiKey) { jsonError(500, 'GEMINI_API_KEY not configured.'); return; }

    $videoBytes = base64_decode($videoBase64);
    $numBytes   = strlen($videoBytes);

    // Step 1: Initiate resumable upload
    $initUrl = "https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=resumable&key=" . urlencode($apiKey);
    $initPayload = json_encode(['file' => ['display_name' => $fileName]]);

    $ch = curl_init($initUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $initPayload,
        CURLOPT_HEADER         => true,
        CURLOPT_HTTPHEADER     => [
            'X-Goog-Upload-Protocol: resumable',
            'X-Goog-Upload-Command: start',
            'X-Goog-Upload-Header-Content-Length: ' . $numBytes,
            'X-Goog-Upload-Header-Content-Type: ' . $mimeType,
            'Content-Type: application/json',
        ],
        CURLOPT_TIMEOUT => 30,
    ]);
    $initResp   = curl_exec($ch);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);


    $rawHeaders = substr($initResp, 0, $headerSize);
    $uploadUrl  = '';
    foreach (explode("\r\n", $rawHeaders) as $line) {
        if (stripos($line, 'x-goog-upload-url:') === 0) {
            $uploadUrl = trim(substr($line, strlen('x-goog-upload-url:')));
            break;
        }
    }
    if (!$uploadUrl) { jsonError(502, 'Failed to initiate Gemini file upload.'); return; }

    // Step 2: Upload bytes
    $ch2 = curl_init($uploadUrl);
    curl_setopt_array($ch2, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $videoBytes,
        CURLOPT_HTTPHEADER     => [
            'Content-Length: ' . $numBytes,
            'X-Goog-Upload-Offset: 0',
            'X-Goog-Upload-Command: upload, finalize',
        ],
        CURLOPT_TIMEOUT => 120,
    ]);
    $uploadBody = curl_exec($ch2);


    $fileData = json_decode($uploadBody, true);
    $fileUri  = $fileData['file']['uri']   ?? '';
    $fileName2 = $fileData['file']['name'] ?? '';
    $state    = $fileData['file']['state'] ?? '';

    if (!$fileUri) { jsonError(502, 'Gemini did not return a file URI.'); return; }

    // Step 3: Poll until ACTIVE
    $attempts = 0;
    while ($state === 'PROCESSING' && $attempts < 20) {
        sleep(2);
        $pollR = curlGet("https://generativelanguage.googleapis.com/v1beta/{$fileName2}?key=" . urlencode($apiKey), 10);
        $pollData = json_decode($pollR['body'], true);
        $state = $pollData['state'] ?? '';
        $attempts++;
    }

    if ($state !== 'ACTIVE') { jsonError(502, 'Video processing timed out or failed on Gemini\'s end.'); return; }

    header('Content-Type: application/json');
    echo json_encode(['fileUri' => $fileUri, 'mimeType' => $mimeType]);
}


// ════════════════════════════════════════════════════════
// /chat  — SSE streaming via Gemini
// ════════════════════════════════════════════════════════
function handleChat(array $body, string $apiKey): void {
    $message      = $body['message']      ?? '';
    $imageBase64  = $body['imageBase64']  ?? '';
    $imageMimeType= $body['imageMimeType']?? '';
    $docText      = $body['docText']      ?? '';
    $fileUri      = $body['fileUri']      ?? '';
    $fileMimeType = $body['fileMimeType'] ?? '';

    if (!$message) {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['reply' => 'No message was provided.']);
        return;
    }
    if (!$apiKey) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['reply' => 'API key not configured. Please set GEMINI_API_KEY in .env and restart the server.']);
        return;
    }

    // SSE headers
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no'); // nginx: disable proxy buffering
    if (ob_get_level()) ob_end_clean();

    $sendEvent = function(array $data): void {
        echo 'data: ' . json_encode($data) . "\n\n";
        flush();
    };

    // Build parts
    $parts = [];
    if ($fileUri && $fileMimeType) {
        $parts[] = ['fileData' => ['mimeType' => $fileMimeType, 'fileUri' => $fileUri]];
    } elseif ($imageBase64 && $imageMimeType) {
        $parts[] = ['inlineData' => ['mimeType' => $imageMimeType, 'data' => $imageBase64]];
    }

    $finalMessage = $message;
    if ($docText) {
        $finalMessage = "The teacher has uploaded a document. Here is its text content:\n\n---\n" . mb_substr($docText, 0, 10000) . "\n---\n\nTeacher's request: {$message}";
    }
    $parts[] = ['text' => $finalMessage];

    $payload = json_encode([
        'contents'          => [['role' => 'user', 'parts' => $parts]],
        'systemInstruction' => ['parts' => [['text' => getSystemPrompt()]]],
    ]);

    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=" . urlencode($apiKey);

    // Stream via cURL write callback
    $buffer = '';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 120,
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_WRITEFUNCTION  => function($ch, $chunk) use (&$buffer, $sendEvent): int {
            $buffer .= $chunk;
            $lines   = explode("\n", $buffer);
            $buffer  = array_pop($lines); // keep incomplete line

            foreach ($lines as $line) {
                $line = rtrim($line);
                if (!str_starts_with($line, 'data:')) continue;
                $jsonStr = trim(substr($line, 5));
                if (!$jsonStr || $jsonStr === '[DONE]') continue;

                $parsed = json_decode($jsonStr, true);
                if (!$parsed) continue;

                $text = $parsed['candidates'][0]['content']['parts'][0]['text'] ?? null;
                if ($text !== null) {
                    $sendEvent(['chunk' => $text]);
                }
            }
            return strlen($chunk);
        },
    ]);

    $ok     = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err    = curl_error($ch);


    if (!$ok || $err) {
        $sendEvent(['error' => 'Server error. Please try again.']);
    } elseif ($status === 503) {
        $sendEvent(['error' => 'Gemini is busy right now. Please try again.']);
    } elseif ($status >= 400) {
        $sendEvent(['error' => 'Gemini API request failed.']);
    }

    $sendEvent(['done' => true]);
}