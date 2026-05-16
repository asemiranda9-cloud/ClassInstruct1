const sendBtn = document.querySelector(".send-btn");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.querySelector(".chat-messages");

let isSending = false;
let chatHistory = [];
let pendingLessonPlanMeta = null;
let pendingQuizMeta       = null;

// ── Multi-session storage ──────────────────────────────────
const SESSIONS_KEY    = 'ci_sessions';      // array of session objects
const ACTIVE_KEY      = 'ci_active_session'; // id of current session

function getSessions() {
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY)) || []; }
  catch { return []; }
}

function saveSessions(sessions) {
  try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)); } catch {}
}

function getActiveId() {
  return localStorage.getItem(ACTIVE_KEY) || null;
}

function setActiveId(id) {
  localStorage.setItem(ACTIVE_KEY, id);
}

function generateSessionId() {
  return 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// Save current chatHistory into the active session
function saveChat() {
  const id = getActiveId();
  if (!id || chatHistory.length === 0) return;
  const sessions = getSessions();
  const idx = sessions.findIndex(s => s.id === id);
  const title = chatHistory.find(m => m.role === 'user')?.text || 'New Chat';
  const session = {
    id,
    title: title.length > 55 ? title.substring(0, 55) + '…' : title,
    updatedAt: new Date().toISOString(),
    messages: chatHistory
  };
  if (idx >= 0) sessions[idx] = session;
  else sessions.unshift(session);
  saveSessions(sessions);
  renderHistorySidebar();
}

// Create a brand-new session and activate it
function startNewSession() {
  const id = generateSessionId();
  setActiveId(id);
  chatHistory = [];
  showWelcome();
  renderHistorySidebar();
  chatInput.focus();
}

// Load a session by id into the chat view
function loadSession(id) {
  const sessions = getSessions();
  const session = sessions.find(s => s.id === id);
  if (!session) return;
  setActiveId(id);
  chatHistory = session.messages || [];
  chatMessages.innerHTML = '';
  if (chatHistory.length === 0) { showWelcome(); return; }
  chatHistory.forEach(msg => {
    const div = document.createElement('div');
    if (msg.role === 'user') {
      div.className = 'user-message';
      div.innerHTML = `<div class="message-content">${escapeHtml(msg.text)}</div>`;
    } else {
      div.className = 'ai-message';
      div.innerHTML = `<div class="message-content">${formatMessage(msg.text)}</div>`;
    }
    chatMessages.appendChild(div);
  });
  chatMessages.scrollTop = chatMessages.scrollHeight;
  renderHistorySidebar();
}

function deleteSession(id, e) {
  e.stopPropagation();
  const sessions = getSessions().filter(s => s.id !== id);
  saveSessions(sessions);
  if (getActiveId() === id) {
    if (sessions.length > 0) loadSession(sessions[0].id);
    else startNewSession();
  } else {
    renderHistorySidebar();
  }
}

function showWelcome() {
  chatMessages.innerHTML = `
    <div class="welcome-message">
      <h2>Welcome to ClassInstruct AI</h2>
      <p>Ask me anything about your classes, students, or attendance.</p>
      <div class="quick-prompts">
        <button class="quick-prompt-btn" onclick="useQuickPrompt('Help me create a lesson plan for Grade 5 Math')">Create a lesson plan</button>
        <button class="quick-prompt-btn" onclick="useQuickPrompt('Generate a quiz on the water cycle for Grade 3')">Generate a quiz</button>
        <button class="quick-prompt-btn" onclick="useQuickPrompt('Give me tips for classroom management')">Classroom tips</button>
        <button class="quick-prompt-btn" onclick="useQuickPrompt(\'How do I track student attendance effectively?\')">Track attendance</button>
      </div>
    </div>`;
}

// ── Render the history sidebar panel ─────────────────────
function renderHistorySidebar() {
  let panel = document.getElementById('hist-sidebar');
  if (!panel) return; // not mounted yet
  const sessions = getSessions();
  const activeId = getActiveId();

  if (sessions.length === 0) {
    panel.querySelector('.hist-list').innerHTML =
      `<div class="hist-empty">No conversations yet.<br><span>Start chatting to build your history.</span></div>`;
    return;
  }

  // Group by date
  const groups = {};
  sessions.forEach(s => {
    const d = new Date(s.updatedAt);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    let label;
    if (d.toDateString() === today.toDateString()) label = 'Today';
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
    else label = d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(s);
  });

  let html = '';
  Object.entries(groups).forEach(([label, items]) => {
    html += `<div class="hist-group-label">${label}</div>`;
    items.forEach(s => {
      const active = s.id === activeId ? ' hist-item-active' : '';
      html += `
        <button class="hist-item${active}" onclick="loadSession('${s.id}'); closeMobileHistory()">
          <span class="hist-item-title">${escapeHtml(s.title)}</span>
          <span class="hist-delete" onclick="deleteSession('${s.id}', event)" title="Delete">✕</span>
        </button>`;
    });
  });

  panel.querySelector('.hist-list').innerHTML = html;
}

// ── Mount the history sidebar into the right sidebar (below Quiz button) ────────
function mountHistorySidebar() {
  if (document.getElementById('hist-sidebar')) return;

  const panel = document.createElement('div');
  panel.id = 'hist-sidebar';
  panel.innerHTML = `
    <div class="hist-header">
      <span class="hist-title">History</span>
    </div>
    <div class="hist-list"></div>
    <div class="hist-footer">
      <button class="hist-clear-all" onclick="clearAllSessions()">Clear All</button>
    </div>`;

  // Insert inside .sidebar-actions (the right sidebar panel), after the last icon-button
  const sidebarActions = document.querySelector('.sidebar-actions');
  if (sidebarActions) {
    // Add a thin divider before history
    const divider = document.createElement('div');
    divider.className = 'hist-divider';
    sidebarActions.appendChild(divider);
    sidebarActions.appendChild(panel);
  }

  renderHistorySidebar();
}

function clearAllSessions() {
  if (!confirm('Clear all chat history? This cannot be undone.')) return;
  localStorage.removeItem(SESSIONS_KEY);
  startNewSession();
  showToast('All history cleared.');
}

function closeMobileHistory() {
  // history is now embedded in the right sidebar — nothing to slide close
}

// On page load: always start a fresh session (login = new chat)
document.addEventListener('DOMContentLoaded', () => {
  mountHistorySidebar();
  startNewSession();

  // Inject sidebar styles
  const st = document.createElement('style');
  st.textContent = `
    /* ── History embedded in right sidebar ── */
    .hist-divider {
      width: calc(100% + 20px);
      margin-left: -10px;
      height: 0.5px;
      background: var(--card-border, #e2e8f0);
      margin-top: 6px;
      margin-bottom: 2px;
      flex-shrink: 0;
    }
    #hist-sidebar {
      display: flex;
      flex-direction: column;
      width: 100%;
      flex: 1;
      min-height: 0;
      font-family: 'Plus Jakarta Sans', sans-serif;
      overflow: hidden;
    }
    .hist-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 8px 4px;
      flex-shrink: 0;
    }
    .hist-title {
      font-size: 0.62rem;
      font-weight: 700;
      color: var(--text-muted, #94a3b8);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .hist-list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1px;
      padding: 2px 0 4px;
    }
    .hist-group-label {
      font-size: 0.58rem;
      font-weight: 700;
      color: var(--text-muted, #94a3b8);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 6px 8px 2px;
    }
    .hist-empty {
      text-align: center;
      padding: 14px 8px;
      color: var(--text-muted, #94a3b8);
      font-size: 0.72rem;
      line-height: 1.5;
    }
    .hist-empty span { font-size: 0.65rem; display: block; margin-top: 4px; opacity: 0.7; }
    .hist-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      width: 100%;
      background: none;
      border: none;
      border-radius: 7px;
      padding: 6px 8px;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      transition: background 0.15s;
      color: var(--text-primary, #1e293b);
    }
    .hist-item:hover { background: rgba(108,99,255,0.07); }
    .hist-item-active {
      background: rgba(108,99,255,0.1);
      border-left: 2.5px solid #6c63ff;
      padding-left: 6px;
    }
    .hist-item-title {
      font-size: 0.76rem;
      font-weight: 400;
      color: var(--text-primary, #1e293b);
      line-height: 1.35;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      text-align: left;
    }
    .hist-item-active .hist-item-title { color: #6c63ff; font-weight: 500; }
    .hist-delete {
      font-size: 0.58rem;
      color: var(--text-muted, #94a3b8);
      opacity: 0;
      padding: 2px 5px;
      border-radius: 4px;
      transition: opacity 0.15s, background 0.15s, color 0.15s;
      flex-shrink: 0;
      cursor: pointer;
      line-height: 1;
    }
    .hist-item:hover .hist-delete { opacity: 1; }
    .hist-delete:hover { background: rgba(239,68,68,0.12); color: #ef4444; }
    .hist-footer {
      padding: 6px 4px 2px;
      flex-shrink: 0;
    }
    .hist-clear-all {
      width: 100%;
      padding: 7px 8px;
      border-radius: 8px;
      border: 0.5px solid var(--card-border, #e2e8f0);
      background: none;
      color: var(--text-muted, #94a3b8);
      font-size: 0.68rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
      text-align: center;
    }
    .hist-clear-all:hover { border-color: #fca5a5; color: #ef4444; background: rgba(239,68,68,0.06); }
    /* Scrollbar */
    .hist-list::-webkit-scrollbar { width: 3px; }
    .hist-list::-webkit-scrollbar-track { background: transparent; }
    .hist-list::-webkit-scrollbar-thumb { background: var(--card-border, #e2e8f0); border-radius: 99px; }
    @media (max-width: 900px) {
      #hist-sidebar { display: none; }
      .hist-divider { display: none; }
    }
  `;
  document.head.appendChild(st);
});

// Streams the AI reply chunk-by-chunk into a live message bubble.
// Returns the full accumulated text when done.
async function streamMessageFromGemini(message, onChunk, { imageBase64, imageMimeType, docText, fileUri, fileMimeType } = {}) {
  const controller = new AbortController();
  // Hard timeout: abort if no response at all within 15s
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("api.php?route=chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, imageBase64, imageMimeType, docText, fileUri, fileMimeType }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let data = {};
      try { data = await response.json(); } catch {}
      throw new Error(data.reply || `Server error (${response.status})`);
    }

    if (!response.body) {
      throw new Error("Server did not return a stream. Restart the server with the updated server.js.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    let firstChunkTimer = setTimeout(() => {
      reader.cancel();
      throw new Error("No response from AI after 10 seconds. Check your GEMINI_API_KEY and restart the server.");
    }, 10000);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      clearTimeout(firstChunkTimer);
      firstChunkTimer = null;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;

        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.chunk) {
            fullText += parsed.chunk;
            onChunk(fullText);
          }
        } catch (e) {
          if (e.message !== "Unexpected end of JSON input") throw e;
        }
      }
    }

    return fullText;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") throw new Error("Request timed out. Make sure api.php is accessible on your web server.");
    throw error;
  }
}



function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatMessage(text) {
  // Strip common markdown symbols the AI might still produce
  let cleaned = text
    .replace(/\*\*(.*?)\*\*/g, '$1')         // bold
    .replace(/\*(.*?)\*/g, '$1')              // italic
    .replace(/__(.*?)__/g, '$1')              // bold alt
    .replace(/_(.*?)_/g, '$1')               // italic alt
    .replace(/~~(.*?)~~/g, '$1')             // strikethrough
    .replace(/^#{1,6}\s+/gm, '')             // headings
    .replace(/`{1,3}([\s\S]*?)`{1,3}/g, '$1') // inline/block code
    .replace(/^\s*[-*+]\s+/gm, '')           // unordered list markers
    .replace(/^\s*>\s+/gm, '');              // blockquotes

  let formatted = escapeHtml(cleaned);
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
}

function addUserMessage(text) {
  const messageDiv = document.createElement("div");
  messageDiv.className = "user-message";
  messageDiv.innerHTML = `<div class="message-content">${escapeHtml(text)}</div>`;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  chatHistory.push({ role: 'user', text, timestamp: new Date() });
  saveChat();
}

function addAiMessage(text, isError = false) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `ai-message${isError ? ' error' : ''}`;

  // Check if this is a lesson plan response
  const lpMeta = pendingLessonPlanMeta;
  pendingLessonPlanMeta = null;

  // Check if this is a quiz response
  const qMeta = pendingQuizMeta;
  pendingQuizMeta = null;

  let pdfBtnHTML = '';
  if (lpMeta && !isError) {
    const attrs = `data-text="${escapeAttr(text)}" data-subject="${escapeAttr(lpMeta.subject)}" data-grade="${escapeAttr(lpMeta.grade)}" data-topic="${escapeAttr(lpMeta.topic)}" data-framework="${escapeAttr(lpMeta.frameworkLabel)}" data-duration="${escapeAttr(lpMeta.duration)}"`;
    pdfBtnHTML = `
      <div class="lp-export-bar">
        <span class="pdf-label">Lesson Plan Ready</span>
        <div class="lp-export-btns">
          <button class="lp-export-btn lp-btn-pdf" onclick="downloadLessonPlanPDF(this)" ${attrs} title="Download formatted lesson plan PDF">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Lesson Plan PDF
          </button>
          <button class="lp-export-btn lp-btn-handout" onclick="downloadHandoutPDF(this)" ${attrs} title="Download student handout PDF">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Student Handout
          </button>
          <button class="lp-export-btn lp-btn-text" onclick="copyPlainText(this)" ${attrs} title="Copy plain text to clipboard">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            Copy Text
          </button>
        </div>
      </div>`;
  }

  messageDiv.innerHTML = `<div class="message-content">${formatMessage(text)}</div>${pdfBtnHTML}`;

  // Append quiz export bar if needed
  if (qMeta && !isError) {
    const qAttrs = `data-text="${escapeAttr(text)}" data-topic="${escapeAttr(qMeta.topic)}" data-grade="${escapeAttr(qMeta.grade)}" data-count="${escapeAttr(qMeta.count)}" data-qtype="${escapeAttr(qMeta.type)}" data-diff="${escapeAttr(qMeta.diff)}"`;
    const qBar = document.createElement('div');
    qBar.className = 'quiz-export-bar';
    qBar.innerHTML = buildQuizExportBarHTML(qAttrs);
    messageDiv.appendChild(qBar);
  }
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  if (!isError) { chatHistory.push({ role: 'ai', text, timestamp: new Date() }); saveChat(); }
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}


// ============================================
// FILE ATTACHMENT — images + documents + link review
// ============================================
let attachedImageB64  = null;   // base64 string (images only)
let attachedImageMime = null;   // mime type (images only)
let attachedDocText   = null;   // extracted plain text (PDF / DOCX / TXT)
let attachedFileName  = null;   // filename for display

const fileInput          = document.getElementById('file-input');
const attachBtn          = document.getElementById('attach-btn');
const attachmentPreview  = document.getElementById('attachment-preview');
const attachmentName     = document.getElementById('attachment-name');

// Supported types
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'];
const TEXT_TYPES  = ['text/plain', 'text/csv', 'application/json', 'text/html'];

// ── Read a file and populate the attachment state ──────────
function readAttachedFile(file) {
  return new Promise((resolve) => {
    const isImage = IMAGE_TYPES.includes(file.type);
    const isText  = TEXT_TYPES.includes(file.type)
      || /\.(txt|csv|json|md)$/i.test(file.name);
    const isPDF   = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isDocx  = /\.(docx|doc)$/i.test(file.name);

    const fr = new FileReader();

    if (isImage) {
      const isVideo = file.type.startsWith('video/');
      fr.onload = (e) => {
        // e.target.result = "data:image/png;base64,XXXX"
        const [, data] = e.target.result.split(',');
        attachedImageB64  = data;
        attachedImageMime = file.type;
        attachedDocText   = null;
        if (isVideo) {
          window._pendingVideoUpload = true; // flag: must go through Gemini File API
        }
        showToast(`${isVideo ? 'Video' : 'Image'} attached: ${file.name}`);
        resolve();
      };
      fr.readAsDataURL(file);

    } else if (isText) {
      fr.onload = (e) => {
        attachedDocText   = e.target.result;
        attachedImageB64  = null;
        attachedImageMime = null;
        showToast(`File attached: ${file.name}`);
        resolve();
      };
      fr.readAsText(file);

    } else if (isPDF) {
      // Load pdf.js dynamically then extract text
      loadPdfJs().then(async (pdfjsLib) => {
        try {
          fr.onload = async (e) => {
            const typedArray = new Uint8Array(e.target.result);
            const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
            let text = '';
            for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              text += content.items.map(s => s.str).join(' ') + '\n';
            }
            attachedDocText   = text.trim() || '(Could not extract text from this PDF.)';
            attachedImageB64  = null;
            attachedImageMime = null;
            showToast(`PDF attached: ${file.name} (${pdf.numPages} page${pdf.numPages !== 1 ? 's' : ''})`);
            resolve();
          };
          fr.readAsArrayBuffer(file);
        } catch (err) {
          attachedDocText = `(PDF parse error: ${err.message})`;
          resolve();
        }
      }).catch(() => {
        attachedDocText = `(PDF.js could not be loaded. Make sure you are online.)`;
        resolve();
      });

    } else if (isDocx) {
      // Use mammoth.js to convert .docx → plain text
      loadMammoth().then((mammoth) => {
        fr.onload = async (e) => {
          try {
            const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
            attachedDocText   = result.value.trim() || '(No text found in document.)';
            attachedImageB64  = null;
            attachedImageMime = null;
            showToast(`Document attached: ${file.name}`);
          } catch (err) {
            attachedDocText = `(DOCX parse error: ${err.message})`;
          }
          resolve();
        };
        fr.readAsArrayBuffer(file);
      }).catch(() => {
        attachedDocText = '(mammoth.js could not be loaded. Make sure you are online.)';
        resolve();
      });

    } else {
      // Unsupported — attach name only, send as plain text note
      attachedDocText   = null;
      attachedImageB64  = null;
      attachedImageMime = null;
      showToast(`Attached: ${file.name} (type not fully supported; filename will be noted)`, 'error');
      resolve();
    }
  });
}

// ── Lazy-load PDF.js ──────────────────────────────────────
function loadPdfJs() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ── Lazy-load mammoth.js ──────────────────────────────────
function loadMammoth() {
  return new Promise((resolve, reject) => {
    if (window.mammoth) return resolve(window.mammoth);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
    script.onload = () => resolve(window.mammoth);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ── Wire up file input ────────────────────────────────────
if (attachBtn && fileInput) {
  attachBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    const maxSize = 50 * 1024 * 1024; // 50 MB (videos need more room)
    if (file.size > maxSize) {
      showToast('File too large. Maximum size is 50 MB.', 'error');
      fileInput.value = '';
      return;
    }

    attachedFileName = file.name;
    if (attachmentName)  attachmentName.textContent = file.name;
    if (attachmentPreview) attachmentPreview.style.display = 'flex';
    if (attachBtn) attachBtn.style.color = 'var(--primary-color, #4f46e5)';

    await readAttachedFile(file);
  });
}

function clearAttachment() {
  attachedImageB64  = null;
  attachedImageMime = null;
  attachedDocText   = null;
  attachedFileName  = null;
  if (fileInput)          fileInput.value = '';
  if (attachmentPreview)  attachmentPreview.style.display = 'none';
  if (attachBtn)          attachBtn.style.color = '';
}

// ── URL detector helper ───────────────────────────────────
function extractUrl(text) {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

// ── Extract YouTube video ID from any YT URL format ──────
function extractYouTubeId(url) {
  try {
    const u = new URL(url);
    // youtube.com/watch?v=ID
    if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) {
      return u.searchParams.get('v');
    }
    // youtu.be/ID
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1).split('?')[0];
    }
    // youtube.com/shorts/ID
    if (u.hostname.includes('youtube.com') && u.pathname.startsWith('/shorts/')) {
      return u.pathname.split('/shorts/')[1].split('?')[0];
    }
  } catch {}
  return null;
}

// ── Fetch YouTube video info via the backend ─────────────
async function fetchYouTubeInfo(videoId) {
  const res = await fetch('api.php?route=fetch-youtube', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ── Fetch a generic URL's text via the backend ───────────
async function fetchLinkText(url) {
  const res = await fetch('api.php?route=fetch-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.text || '';
}

// ── Main send handler (file + link aware) ─────────────────
window.handleSendMessageWithFile = async function() {
  if (isSending) return;
  const rawInput = chatInput.value.trim();
  if (!rawInput && !attachedFileName) return;

  isSending = true;
  sendBtn.disabled  = true;
  chatInput.disabled = true;

  // Snapshot and clear attachment state before any async work
  const imageB64  = attachedImageB64;
  const imageMime = attachedImageMime;
  const docText   = attachedDocText;
  const fileName  = attachedFileName;
  const isVideoFile = window._pendingVideoUpload && !!imageB64 && imageMime?.startsWith('video/');
  window._pendingVideoUpload = false;
  clearAttachment();
  chatInput.value = '';

  // Build the user-visible label and actual prompt
  let displayText = rawInput;
  let promptText  = rawInput || (fileName ? `Please review the attached file: ${fileName}` : '');

  // If a file was attached, note it in display
  if (fileName) {
    displayText = rawInput
      ? `[${fileName}] ${rawInput}`
      : `[${fileName}] Please review this file.`;
  }

  // ── Upload video via Gemini File API if needed ────────────
  let fileUri = null;
  let fileMimeType = null;
  if (isVideoFile) {
    const uploadingDiv = document.createElement('div');
    uploadingDiv.className = 'ai-message typing-message';
    uploadingDiv.innerHTML = '<div class="message-content"><span class="typing-dots">● ● ●</span> Uploading video to Gemini...</div>';
    chatMessages.appendChild(uploadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const upRes = await fetch('api.php?route=upload-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoBase64: imageB64, mimeType: imageMime, fileName })
      });
      const upData = await upRes.json();
      uploadingDiv.remove();
      if (upData.error) throw new Error(upData.error);
      fileUri = upData.fileUri;
      fileMimeType = upData.mimeType;
    } catch (err) {
      uploadingDiv.remove();
      showToast('Video upload failed: ' + err.message, 'error');
      isSending = false;
      sendBtn.disabled = false;
      chatInput.disabled = false;
      chatInput.focus();
      return;
    }
  }

  // Detect URLs in the message and fetch their content
  let linkPageText = null;
  const detectedUrl = extractUrl(promptText);
  if (detectedUrl) {
    const fetchingDiv = document.createElement('div');
    fetchingDiv.className = 'ai-message typing-message';
    chatMessages.appendChild(fetchingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const youtubeId = extractYouTubeId(detectedUrl);

    try {
      if (youtubeId) {
        // ── YouTube URL ──────────────────────────────────
        fetchingDiv.innerHTML = '<div class="message-content">Fetching YouTube video info...</div>';
        const yt = await fetchYouTubeInfo(youtubeId);
        fetchingDiv.remove();

        linkPageText =
          `YouTube Video: ${yt.title}\n` +
          `Channel: ${yt.channel}\n` +
          (yt.tags ? `Tags: ${yt.tags}\n` : '') +
          `\nDescription:\n${yt.description}\n` +
          `\nNote: ${yt.captionNote}`;

      } else {
        // ── Generic URL ──────────────────────────────────
        fetchingDiv.innerHTML = '<div class="message-content">Fetching link content...</div>';
        linkPageText = await fetchLinkText(detectedUrl);
        fetchingDiv.remove();
      }
    } catch (err) {
      fetchingDiv.remove();
      showToast(err.message, 'error');
    }
  }

  // If we got link content, inject it into the prompt
  if (linkPageText) {
    promptText = `The teacher shared this link: ${detectedUrl}\n\nHere is the content:\n---\n${linkPageText}\n---\n\nTeacher's request: ${promptText}`;
  }

  // Show the user message bubble
  addUserMessage(displayText);

  // Typing indicator
  const typingDiv = document.createElement('div');
  typingDiv.className = 'ai-message typing-message';
  typingDiv.innerHTML = '<div class="message-content"><span class="typing-dots">● ● ●</span> Thinking...</div>';
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Live AI message bubble
  const messageDiv  = document.createElement('div');
  messageDiv.className = 'ai-message';
  const contentDiv  = document.createElement('div');
  contentDiv.className = 'message-content';
  messageDiv.appendChild(contentDiv);

  let firstChunk = true;

  try {
    const fullText = await streamMessageFromGemini(
      promptText,
      (accumulated) => {
        if (firstChunk) {
          typingDiv.remove();
          chatMessages.appendChild(messageDiv);
          firstChunk = false;
        }
        contentDiv.innerHTML = formatMessage(accumulated);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      },
      { imageBase64: isVideoFile ? null : imageB64, imageMimeType: isVideoFile ? null : imageMime, docText, fileUri, fileMimeType }
    );

    // Attach export buttons if this was a lesson plan
    const lpMeta = pendingLessonPlanMeta;
    pendingLessonPlanMeta = null;
    if (lpMeta && fullText) {
      const attrs = `data-text="${escapeAttr(fullText)}" data-subject="${escapeAttr(lpMeta.subject)}" data-grade="${escapeAttr(lpMeta.grade)}" data-topic="${escapeAttr(lpMeta.topic)}" data-framework="${escapeAttr(lpMeta.frameworkLabel)}" data-duration="${escapeAttr(lpMeta.duration)}"`;
      const exportBar = document.createElement('div');
      exportBar.className = 'lp-export-bar';
      exportBar.innerHTML = `
        <span class="pdf-label">Lesson Plan Ready</span>
        <div class="lp-export-btns">
          <button class="lp-export-btn lp-btn-pdf" onclick="downloadLessonPlanPDF(this)" ${attrs} title="Download formatted lesson plan PDF">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Lesson Plan PDF
          </button>
          <button class="lp-export-btn lp-btn-handout" onclick="downloadHandoutPDF(this)" ${attrs} title="Download student handout PDF">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Student Handout
          </button>
          <button class="lp-export-btn lp-btn-text" onclick="copyPlainText(this)" ${attrs} title="Copy plain text to clipboard">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            Copy Text
          </button>
        </div>`;
      messageDiv.appendChild(exportBar);
    }

    // Attach quiz export bar if this was a quiz
    const qMeta = pendingQuizMeta;
    pendingQuizMeta = null;
    if (qMeta && fullText) {
      const qAttrs = `data-text="${escapeAttr(fullText)}" data-topic="${escapeAttr(qMeta.topic)}" data-grade="${escapeAttr(qMeta.grade)}" data-count="${escapeAttr(qMeta.count)}" data-qtype="${escapeAttr(qMeta.type)}" data-diff="${escapeAttr(qMeta.diff)}"`;
      const qBar = document.createElement('div');
      qBar.className = 'quiz-export-bar';
      qBar.innerHTML = buildQuizExportBarHTML(qAttrs);
      messageDiv.appendChild(qBar);
    }

    if (fullText) {
      chatHistory.push({ role: 'ai', text: fullText, timestamp: new Date() });
      saveChat();
      if (window.CILog) {
        if (fileName) {
          CILog.push('ai_chat', 'File Shared with AI', fileName);
        } else {
          CILog.push('ai_chat', 'AI Chat', promptText.substring(0, 60));
        }
      }
    }

  } catch (error) {
    typingDiv.remove();
    let errorMessage = error.message;
    if (errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
      errorMessage = 'Cannot connect to the PHP backend. Make sure api.php is on your web server.';
    }
    addAiMessage(errorMessage, true);
  } finally {
    isSending = false;
    sendBtn.disabled   = false;
    chatInput.disabled = false;
    chatInput.focus();
  }
};

// Wire send button and Enter key
sendBtn.addEventListener('click', window.handleSendMessageWithFile);
chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    window.handleSendMessageWithFile();
  }
});

// ============================================
// VOICE / MIC (Speech Recognition)
// ============================================
const micBtn = document.getElementById('mic-btn');
let isListening = false;
let recognition = null;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (micBtn) {
  if (!SpeechRecognition) {
    micBtn.title = 'Voice input not supported in this browser';
    micBtn.style.opacity = '0.4';
    micBtn.style.cursor = 'not-allowed';
  } else {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isListening = true;
      micBtn.style.color = '#ef4444';
      micBtn.style.background = '#fef2f2';
      micBtn.title = 'Listening... Click to stop';
      chatInput.placeholder = 'Listening...';
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      chatInput.value = finalTranscript || interimTranscript;
    };

    recognition.onerror = (event) => {
      const messages = {
        'not-allowed': 'Microphone access denied. Please allow microphone access in your browser settings.',
        'no-speech': 'No speech detected. Please try again.',
        'network': 'Network error during voice recognition.',
      };
      showToast(messages[event.error] || `Voice error: ${event.error}`, 'error');
      stopListening();
    };

    recognition.onend = () => {
      stopListening();
      // Auto-send if something was captured
      if (chatInput.value.trim()) {
        setTimeout(() => window.handleSendMessageWithFile(), 300);
      }
    };

    micBtn.addEventListener('click', () => {
      if (isListening) {
        recognition.stop();
      } else {
        try {
          recognition.start();
        } catch (e) {
          showToast('Could not start microphone. Try again.', 'error');
        }
      }
    });

    function stopListening() {
      isListening = false;
      micBtn.style.color = '';
      micBtn.style.background = '';
      micBtn.title = 'Voice input';
      chatInput.placeholder = 'Ask or search for anything...';
    }
  }
}

// ============================================
// SIDEBAR BUTTON FUNCTIONS
// ============================================

// 1. COLLAPSE SIDEBAR
function toggleSidebar() {
  const sidebar = document.querySelector(".right-sidebar");
  if (sidebar) {
    sidebar.classList.toggle("collapsed");
    const btn = document.querySelector('[aria-label="Collapse"]');
    if (btn) {
      const isCollapsed = sidebar.classList.contains("collapsed");
      btn.title = isCollapsed ? "Expand Sidebar" : "Collapse Sidebar";
      btn.setAttribute("aria-label", isCollapsed ? "Expand" : "Collapse");
    }
  }
}

// 2. NEW CHAT
function newChat() {
  startNewSession();
  showToast("New chat started!");
}

function useQuickPrompt(text) {
  chatInput.value = text;
  chatInput.focus();
  window.handleSendMessageWithFile();
}

// 3. LESSON PLAN GENERATOR
const LP_FRAMEWORKS = {
  '5e': {
    label: '5E Model',
    color: '#6366f1',
    bg: '#eef2ff',
    tagline: 'Engage, Explore, Explain, Elaborate, Evaluate',
    description: 'Inquiry-based science/STEM model guiding students through 5 phases of discovery.',
    prompt: (subject, grade, topic, duration) =>
      `Create a detailed ${duration} lesson plan for ${grade} ${subject} on "${topic}" using the 5E Instructional Model. Structure it with these exact 5 phases (include time allocation for each):

1. ENGAGE - Hook activity to spark curiosity and activate prior knowledge
2. EXPLORE - Hands-on investigation or activity where students discover concepts
3. EXPLAIN - Teacher-guided discussion to formalize understanding and vocabulary
4. ELABORATE - Application activity extending learning to new contexts
5. EVALUATE - Assessment strategy to check student understanding

Also include: Learning Objectives, Materials Needed, and Standards Alignment. Format clearly with section headers.`
  },
  '4a': {
    label: '4A Framework',
    color: '#0891b2',
    bg: '#ecfeff',
    tagline: 'Activate, Acquire, Apply, Assess',
    description: 'Simple 4-phase cycle balancing prior knowledge, new content, practice, and feedback.',
    prompt: (subject, grade, topic, duration) =>
      `Create a detailed ${duration} lesson plan for ${grade} ${subject} on "${topic}" using the 4A Lesson Planning Framework. Structure it with these 4 phases (include time allocation for each):

1. ACTIVATE - Warm-up to activate prior knowledge and connect to new learning
2. ACQUIRE - Direct instruction or guided discovery to introduce new content/skills
3. APPLY - Student practice activities applying the new knowledge
4. ASSESS - Formative or summative assessment to evaluate understanding

Also include: Learning Objectives, Materials Needed, and Differentiation Strategies. Format clearly with section headers.`
  },
  'dld': {
    label: 'DLD Model',
    color: '#7c3aed',
    bg: '#f5f3ff',
    tagline: 'Direct, Link, Do',
    description: 'Structured model emphasizing explicit instruction, connection-making, and active practice.',
    prompt: (subject, grade, topic, duration) =>
      `Create a detailed ${duration} lesson plan for ${grade} ${subject} on "${topic}" using the DLD (Direct-Link-Do) Lesson Plan Model. Structure it with these 3 phases (include time allocation for each):

1. DIRECT - Explicit, clear instruction where the teacher models and demonstrates the concept or skill. Include: Learning Objective statement, key vocabulary, and teacher modeling steps.
2. LINK - Guided practice where students connect new learning to prior knowledge through worked examples and collaborative discussion.
3. DO - Independent or group practice where students apply the skill on their own. Include task description and success criteria.

Also include: Materials Needed, Differentiation for struggling and advanced learners, and Assessment strategy. Format clearly with section headers.`
  },
  'pisa': {
    label: 'PISA-Based',
    color: '#059669',
    bg: '#ecfdf5',
    tagline: 'Real-world, Critical Thinking, Problem Solving',
    description: 'Globally-benchmarked tasks using real-world contexts to develop 21st century competencies.',
    prompt: (subject, grade, topic, duration) =>
      `Create a detailed ${duration} lesson plan for ${grade} ${subject} on "${topic}" using a PISA-inspired lesson planning approach. PISA focuses on real-world application, critical thinking, and problem-solving competencies.

Structure the lesson with (include time allocation for each):

1. CONTEXT SETTING - Introduce a real-world scenario or global issue related to the topic that makes the learning relevant and meaningful
2. STIMULUS AND INQUIRY - Present authentic materials (data, text, image, case study) and pose open-ended inquiry questions
3. COLLABORATIVE PROBLEM SOLVING - Group task where students analyze the stimulus and apply subject knowledge to solve a real-world problem
4. CRITICAL REFLECTION - Students present reasoning, evaluate solutions, and reflect on the process
5. ASSESSMENT - PISA-style task with complex, multi-step questions requiring reasoning and justification

Also include: Learning Objectives (21st century skills focus), Materials/Resources, and Cross-curricular Connections. Format clearly with section headers.`
  }
};

function openLessonPlan() {
  closeAllModals();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'lesson-plan-modal';
  modal.innerHTML = `
    <div class="modal-panel modal-panel-wide">
      <div class="modal-header">
        <div>
          <h2 class="modal-title">Lesson Plan Generator</h2>
          <p class="modal-subtitle">Choose a framework and fill in the details</p>
        </div>
        <button class="modal-close-btn" onclick="closeAllModals()" aria-label="Close">X</button>
      </div>
      <div class="modal-body">

        <div class="form-group">
          <label class="form-label">Lesson Plan Framework</label>
          <div class="framework-grid">
            ${Object.entries(LP_FRAMEWORKS).map(([key, fw], i) => `
              <button class="framework-card ${i === 0 ? 'active' : ''}" data-value="${key}" onclick="selectFramework(this)">
                <div class="fw-label" style="color:${fw.color}">${fw.label}</div>
                <div class="fw-tagline">${fw.tagline}</div>
                <div class="fw-desc">${fw.description}</div>
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="lp-framework" value="5e" />
        </div>

        <div class="form-group">
          <label class="form-label">Subject</label>
          <input class="form-input" id="lp-subject" type="text" placeholder="e.g., Mathematics, Science, English, MAPEH..." />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Grade Level</label>
            <select class="form-input" id="lp-grade">
              <option value="">Select grade...</option>
              <option>Kindergarten</option>
              <option>Grade 1</option><option>Grade 2</option><option>Grade 3</option>
              <option>Grade 4</option><option>Grade 5</option><option>Grade 6</option>
              <option>Grade 7</option><option>Grade 8</option><option>Grade 9</option>
              <option>Grade 10</option><option>Grade 11</option><option>Grade 12</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Duration</label>
            <select class="form-input" id="lp-duration">
              <option>30 minutes</option>
              <option selected>1 hour</option>
              <option>1.5 hours</option>
              <option>2 hours</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Topic / Learning Objective</label>
          <input class="form-input" id="lp-topic" type="text" placeholder="e.g., Introduction to fractions, Parts of speech, Photosynthesis..." />
          <div class="resource-upload-row" style="display:flex;align-items:center;gap:10px;margin-top:8px;">
            <input type="file" id="lp-resource-file" accept=".pdf,.doc,.docx,.txt,.csv,.json,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.webm" style="display:none" onchange="parseModalResource(this,'lp-topic','lp-resource-status','lp-subject')" />
            <button type="button" class="resource-upload-btn" onclick="document.getElementById('lp-resource-file').click()" title="Upload a document or media to extract topic">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
              Extract from file
            </button>
            <span id="lp-resource-status" style="font-size:0.78rem;color:var(--modal-subtitle);"></span>
          </div>
        </div>

      </div>
      <div class="modal-footer">
        <button class="modal-cancel-btn" onclick="closeAllModals()">Cancel</button>
        <button class="modal-action-btn" onclick="generateLessonPlan()">
          <span>Generate Lesson Plan</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);
  document.getElementById('lp-subject').focus();
}

function selectFramework(btn) {
  document.querySelectorAll('.framework-card').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('lp-framework').value = btn.dataset.value;
}

function generateLessonPlan() {
  const subject = document.getElementById('lp-subject').value.trim();
  const grade = document.getElementById('lp-grade').value;
  const topic = document.getElementById('lp-topic').value.trim();
  const duration = document.getElementById('lp-duration').value;
  const frameworkKey = document.getElementById('lp-framework').value;

  if (!subject || !grade || !topic) {
    showToast("Please fill in Subject, Grade, and Topic.", "error");
    return;
  }

  const fw = LP_FRAMEWORKS[frameworkKey];
  closeAllModals();

  // Store meta so the AI response can show a PDF download button
  pendingLessonPlanMeta = {
    subject,
    grade,
    topic,
    duration,
    frameworkLabel: fw.label
  };

  const prompt = fw.prompt(subject, grade, topic, duration);
  if (window.CILog) CILog.push('lesson_plan', 'Lesson Plan Generated', `${subject} · ${grade} · ${topic}`);
  chatInput.value = prompt;
  window.handleSendMessageWithFile();
}

// 4. INTERACTIVE QUIZ GENERATOR
function openQuiz() {
  closeAllModals();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'quiz-modal';
  modal.innerHTML = `
    <div class="modal-panel modal-panel-wide">
      <div class="modal-header">
        <div>
          <h2 class="modal-title">Quiz Generator</h2>
          <p class="modal-subtitle">Build engaging quizzes for your students</p>
        </div>
        <button class="modal-close-btn" onclick="closeAllModals()" aria-label="Close">X</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Subject / Topic</label>
            <input class="form-input" id="q-topic" type="text" placeholder="e.g., Water cycle, World War II..." />
            <div class="resource-upload-row" style="display:flex;align-items:center;gap:10px;margin-top:8px;">
              <input type="file" id="q-resource-file" accept=".pdf,.doc,.docx,.txt,.csv,.json,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.webm" style="display:none" onchange="parseModalResource(this,'q-topic','q-resource-status',null)" />
              <button type="button" class="resource-upload-btn" onclick="document.getElementById('q-resource-file').click()" title="Upload a document or media to extract topic">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                Extract from file
              </button>
              <span id="q-resource-status" style="font-size:0.78rem;color:var(--modal-subtitle);"></span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Grade Level</label>
            <select class="form-input" id="q-grade">
              <option value="">Select grade...</option>
              <option>Grade 1</option><option>Grade 2</option><option>Grade 3</option>
              <option>Grade 4</option><option>Grade 5</option><option>Grade 6</option>
              <option>Grade 7</option><option>Grade 8</option><option>Grade 9</option>
              <option>Grade 10</option><option>Grade 11</option><option>Grade 12</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Number of Questions</label>
          <div class="toggle-group">
            <button class="toggle-btn active" data-value="5" onclick="selectToggle(this, 'q-count')">5</button>
            <button class="toggle-btn" data-value="10" onclick="selectToggle(this, 'q-count')">10</button>
            <button class="toggle-btn" data-value="15" onclick="selectToggle(this, 'q-count')">15</button>
            <button class="toggle-btn" data-value="20" onclick="selectToggle(this, 'q-count')">20</button>
          </div>
          <input type="hidden" id="q-count" value="5" />
        </div>
        <div class="form-group">
          <label class="form-label">Question Type</label>
          <div class="toggle-group">
            <button class="toggle-btn active" data-value="multiple choice" onclick="selectToggle(this, 'q-type')">Multiple Choice</button>
            <button class="toggle-btn" data-value="true/false" onclick="selectToggle(this, 'q-type')">True / False</button>
            <button class="toggle-btn" data-value="short answer" onclick="selectToggle(this, 'q-type')">Short Answer</button>
            <button class="toggle-btn" data-value="mixed" onclick="selectToggle(this, 'q-type')">Mixed</button>
          </div>
          <input type="hidden" id="q-type" value="multiple choice" />
        </div>
        <div class="form-group">
          <label class="form-label">Difficulty</label>
          <div class="toggle-group">
            <button class="toggle-btn" data-value="easy" onclick="selectToggle(this, 'q-diff')">Easy</button>
            <button class="toggle-btn active" data-value="medium" onclick="selectToggle(this, 'q-diff')">Medium</button>
            <button class="toggle-btn" data-value="hard" onclick="selectToggle(this, 'q-diff')">Hard</button>
          </div>
          <input type="hidden" id="q-diff" value="medium" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-cancel-btn" onclick="closeAllModals()">Cancel</button>
        <button class="modal-action-btn" onclick="generateQuiz()">
          <span>Generate Quiz</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);
  document.getElementById('q-topic').focus();
}

function generateQuiz() {
  const topic = document.getElementById('q-topic').value.trim();
  const grade = document.getElementById('q-grade').value;
  const count = document.getElementById('q-count').value;
  const type = document.getElementById('q-type').value;
  const diff = document.getElementById('q-diff').value;

  if (!topic || !grade) {
    showToast("Please fill in Topic and Grade.", "error");
    return;
  }

  closeAllModals();

  // Store meta for export buttons
  pendingQuizMeta = { topic, grade, count, type, diff };

  const prompt = `Create a ${diff} difficulty quiz for ${grade} students on the topic: "${topic}". Generate ${count} ${type} questions. For multiple choice, include 4 options (A, B, C, D) and mark the correct answer. Include an answer key at the end. Format clearly and number each question.`;
  if (window.CILog) CILog.push('quiz_generated', 'Quiz Generated', `${topic} · ${grade} · ${count} ${type} questions`);
  chatInput.value = prompt;
  window.handleSendMessageWithFile();
}

// 5. CHAT HISTORY
function openHistory() {
  closeAllModals();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'history-modal';

  let historyHTML = '';
  if (chatHistory.length === 0) {
    historyHTML = `
      <div class="history-empty">
        <p>No conversation history yet.</p>
        <p style="color:var(--text-light);font-size:0.85rem;margin-top:4px">Start chatting to see your messages here.</p>
      </div>
    `;
  } else {
    historyHTML = chatHistory.map((msg, i) => {
      const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const preview = msg.text.length > 120 ? msg.text.substring(0, 120) + '...' : msg.text;
      return `
        <div class="history-item ${msg.role}">
          <div class="history-item-meta">
            <span class="history-role">${msg.role === 'user' ? 'You' : 'AI'}</span>
            <span class="history-time">${time}</span>
          </div>
          <div class="history-text">${escapeHtml(preview)}</div>
        </div>
      `;
    }).join('');
  }

  modal.innerHTML = `
    <div class="modal-panel modal-panel-wide">
      <div class="modal-header">
        <div>
          <h2 class="modal-title">Chat History</h2>
          <p class="modal-subtitle">${chatHistory.length} message${chatHistory.length !== 1 ? 's' : ''} in this session</p>
        </div>
        <button class="modal-close-btn" onclick="closeAllModals()" aria-label="Close">X</button>
      </div>
      <div class="modal-body history-scroll">
        ${historyHTML}
      </div>
      <div class="modal-footer">
        ${chatHistory.length > 0 ? `<button class="modal-cancel-btn danger" onclick="clearHistory()">Clear History</button>` : ''}
        <button class="modal-action-btn" onclick="closeAllModals()">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);
}

function clearHistory() {
  clearAllSessions();
}

// ============================================
// HELPER UTILITIES
// ============================================

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.classList.remove('visible');
    setTimeout(() => m.remove(), 300);
  });
}

function selectToggle(btn, hiddenId) {
  const group = btn.closest('.toggle-group');
  group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(hiddenId).value = btn.dataset.value;
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 10);
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// Close modals on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) closeAllModals();
});

// ESC key closes modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllModals();
});

// ============================================
// PDF DOWNLOAD
// ============================================

function loadJsPDF() {
  return new Promise((resolve, reject) => {
    if (window.jspdf) return resolve(window.jspdf.jsPDF);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => resolve(window.jspdf.jsPDF);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function downloadLessonPlanPDF(btn) {
  const text     = btn.dataset.text;
  const subject  = btn.dataset.subject;
  const grade    = btn.dataset.grade;
  const topic    = btn.dataset.topic;
  const fw       = btn.dataset.framework;
  const duration = btn.dataset.duration;

  const original = btn.innerHTML;
  btn.innerHTML = 'Generating...';
  btn.disabled = true;

  try {
    const jsPDF = await loadJsPDF();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 18;
    const contentW = pageW - margin * 2;
    let y = 0;

    // ── Header Banner ──────────────────────────────────────
    doc.setFillColor(79, 70, 229); // indigo
    doc.rect(0, 0, pageW, 38, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('ClassInstruct AI', margin, 14);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Lesson Plan', margin, 22);

    // Framework badge
    const badgeLabel = fw + ' Framework';
    doc.setFontSize(9);
    doc.setFillColor(255, 255, 255);
    const badgeW = doc.getTextWidth(badgeLabel) + 8;
    doc.roundedRect(pageW - margin - badgeW, 10, badgeW, 8, 2, 2, 'F');
    doc.setTextColor(79, 70, 229);
    doc.setFont('helvetica', 'bold');
    doc.text(badgeLabel, pageW - margin - badgeW + 4, 15.5);

    y = 48;

    // ── Meta Info Box ───────────────────────────────────────
    doc.setFillColor(245, 243, 255);
    doc.roundedRect(margin, y, contentW, 30, 3, 3, 'F');
    doc.setDrawColor(200, 196, 255);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, contentW, 30, 3, 3, 'S');

    const colW = contentW / 4;
    const metaItems = [
      { label: 'Subject', value: subject },
      { label: 'Grade',   value: grade },
      { label: 'Topic',   value: topic.length > 20 ? topic.substring(0, 18) + '…' : topic },
      { label: 'Duration',value: duration },
    ];
    metaItems.forEach((item, i) => {
      const x = margin + colW * i + 4;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 110, 180);
      doc.text(item.label.toUpperCase(), x, y + 10);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(item.value, x, y + 22);
    });

    y += 38;

    // ── Body Content ────────────────────────────────────────
    const lines = text.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) { y += 3; continue; }

      // Detect section headings (ALL CAPS words, numbered headings, or lines ending with :)
      const isHeading = /^(#{1,3}\s|[A-Z][A-Z\s\d:]{4,}$|\d+\.\s+[A-Z])/.test(line) ||
                        (line.endsWith(':') && line.length < 60);

      if (isHeading) {
        // New page check
        if (y + 14 > pageH - 20) { doc.addPage(); y = 20; }

        // Heading accent bar
        doc.setFillColor(79, 70, 229);
        doc.rect(margin, y, 3, 8, 'F');

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        const clean = line.replace(/^#{1,3}\s*/, '');
        doc.text(clean, margin + 6, y + 6.5);
        y += 12;
      } else {
        // Body text — wrap long lines
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);

        const wrapped = doc.splitTextToSize(line, contentW - 4);
        for (const wl of wrapped) {
          if (y + 6 > pageH - 20) { doc.addPage(); y = 20; }
          doc.text(wl, margin + 2, y);
          y += 5.5;
        }
        y += 1;
      }
    }

    // ── Footer on every page ────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFillColor(245, 243, 255);
      doc.rect(0, pageH - 12, pageW, 12, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(`Generated by ClassInstruct AI  •  ${new Date().toLocaleDateString()}`, margin, pageH - 4.5);
      doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 4.5, { align: 'right' });
    }

    // ── Save ────────────────────────────────────────────────
    const filename = `LessonPlan_${grade}_${subject}_${topic}`.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 60) + '.pdf';
    doc.save(filename);
    showToast('PDF downloaded!');
  } catch (err) {
    console.error(err);
    showToast('Failed to generate PDF. Check your connection.', 'error');
  } finally {
    btn.innerHTML = original;
    btn.disabled = false;
  }
}

// ============================================
// MODAL RESOURCE PARSER
// Parses PDF, DOCX, plain text, images (via AI vision), video
// and auto-fills topicFieldId. If subjectFieldId is also provided,
// it tries to fill that too from the extracted content.
// ============================================

/**
 * parseModalResource(inputEl, topicFieldId, statusId, subjectFieldId)
 * Called via onchange on the hidden file input inside each modal.
 */
async function parseModalResource(inputEl, topicFieldId, statusId, subjectFieldId) {
  const file = inputEl.files[0];
  if (!file) return;

  const statusEl = document.getElementById(statusId);
  const topicEl  = document.getElementById(topicFieldId);

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = isError ? '#ef4444' : 'var(--modal-subtitle)';
  }

  setStatus('⏳ Reading file…');

  const isImage = /^image\//.test(file.type);
  const isVideo = /^video\//.test(file.type);
  const isPDF   = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isDocx  = /\.(docx|doc)$/i.test(file.name);
  const isText  = /^text\//.test(file.type) || /\.(txt|csv|json|md)$/i.test(file.name);

  let extractedText = null;
  let imageBase64   = null;
  let imageMime     = null;

  try {
    if (isPDF) {
      // ── PDF: extract text via pdf.js ──────────────────────
      const pdfjsLib = await loadPdfJs();
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
      let text = '';
      for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
        const page    = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(s => s.str).join(' ') + '\n';
      }
      extractedText = text.trim() || null;
      setStatus(`📄 PDF parsed (${pdf.numPages} page${pdf.numPages !== 1 ? 's' : ''})`);

    } else if (isDocx) {
      // ── DOCX: extract text via mammoth.js ────────────────
      const mammoth = await loadMammoth();
      const buf = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buf });
      extractedText = result.value.trim() || null;
      setStatus('📝 Document parsed');

    } else if (isText) {
      // ── Plain text ───────────────────────────────────────
      extractedText = await file.text();
      setStatus('📄 Text file read');

    } else if (isImage) {
      // ── Image: send to AI for description ────────────────
      setStatus('🖼️ Analyzing image with AI…');
      const b64 = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = e => res(e.target.result.split(',')[1]);
        fr.onerror = () => rej(new Error('Could not read image'));
        fr.readAsDataURL(file);
      });
      imageBase64 = b64;
      imageMime   = file.type;

    } else if (isVideo) {
      // ── Video: can't parse inline without File API; give guidance ──
      setStatus('⚠️ Video: upload via chat attach for full analysis', true);
      inputEl.value = '';
      return;

    } else {
      setStatus('⚠️ Unsupported file type', true);
      inputEl.value = '';
      return;
    }

    // ── Ask AI to extract topic (and optionally subject) ──
    setStatus('🤖 Asking AI to extract topic…');

    let aiPrompt;
    if (imageBase64) {
      aiPrompt = subjectFieldId
        ? `Look at this educational resource image. Reply ONLY with a JSON object: {"subject":"...","topic":"..."} where subject is the academic subject (e.g. Mathematics, Science) and topic is a concise learning objective or topic title (10 words max). No explanation, no markdown.`
        : `Look at this educational resource image. Reply ONLY with a JSON object: {"topic":"..."} where topic is a concise learning objective or topic (10 words max). No explanation, no markdown.`;
    } else {
      const excerpt = (extractedText || '').substring(0, 3000);
      aiPrompt = subjectFieldId
        ? `From this educational resource text, extract the main subject and topic. Reply ONLY with a JSON object: {"subject":"...","topic":"..."} where subject is the academic subject (e.g. Mathematics, Science, English) and topic is a concise learning objective or topic title (10 words max). No explanation, no markdown.\n\nText:\n${excerpt}`
        : `From this educational resource text, extract the main subject/topic. Reply ONLY with a JSON object: {"topic":"..."} where topic is a concise learning objective or topic title (10 words max). No explanation, no markdown.\n\nText:\n${excerpt}`;
    }

    const res = await fetch('api.php?route=chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: aiPrompt,
        imageBase64: imageBase64 || null,
        imageMimeType: imageMime || null,
        docText: extractedText || null
      })
    });

    if (!res.ok) throw new Error(`API error ${res.status}`);

    // Collect streamed response
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.chunk) fullText += parsed.chunk;
        } catch {}
      }
    }

    // Parse the JSON reply
    const cleaned = fullText.replace(/```json|```/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); } catch { parsed = {}; }

    if (parsed.topic && topicEl) {
      topicEl.value = parsed.topic;
    }
    if (parsed.subject && subjectFieldId) {
      const subEl = document.getElementById(subjectFieldId);
      if (subEl && !subEl.value) subEl.value = parsed.subject;
    }

    setStatus(parsed.topic ? `✅ Topic extracted from ${file.name}` : '⚠️ Could not extract topic — fill in manually');

  } catch (err) {
    console.error('parseModalResource error:', err);
    setStatus('❌ Error: ' + err.message, true);
  } finally {
    inputEl.value = ''; // reset so same file can be re-selected
  }
}

// ── Inject resource upload button styles once ─────────────
(function injectResourceUploadStyles() {
  if (document.getElementById('resource-upload-styles')) return;
  const style = document.createElement('style');
  style.id = 'resource-upload-styles';
  style.textContent = `
    .resource-upload-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      border: 1.5px dashed rgba(108,99,255,0.45);
      background: rgba(108,99,255,0.06);
      color: #6c63ff;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      white-space: nowrap;
      transition: background 0.15s, border-color 0.15s;
      flex-shrink: 0;
    }
    .resource-upload-btn:hover {
      background: rgba(108,99,255,0.14);
      border-color: #6c63ff;
    }
    .resource-upload-row {
      flex-wrap: wrap;
    }
  `;
  document.head.appendChild(style);
})();

// ============================================
// LESSON PLAN EXPORT — 3 buttons
// ============================================

// ── Shared: inject export bar styles once ──────────────────
(function injectExportBarStyles() {
  if (document.getElementById('lp-export-styles')) return;
  const s = document.createElement('style');
  s.id = 'lp-export-styles';
  s.textContent = `
    .lp-export-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 14px;
      padding: 11px 14px;
      background: var(--pdf-bar-bg, linear-gradient(135deg,#f5f3ff,#ede9fe));
      border: 1.5px solid #c4b5fd;
      border-radius: 12px;
    }
    .lp-export-btns {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .lp-export-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 13px;
      border: none;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.18s;
      white-space: nowrap;
    }
    .lp-export-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none !important; }
    .lp-btn-pdf     { background: #6c63ff; color: #fff; }
    .lp-btn-pdf:hover:not(:disabled) { background: #5548e8; transform: translateY(-1px); }
    .lp-btn-handout { background: #0891b2; color: #fff; }
    .lp-btn-handout:hover:not(:disabled) { background: #0e7490; transform: translateY(-1px); }
    .lp-btn-text    { background: #f1f5f9; color: #475569; border: 1.5px solid #e2e8f0; }
    .lp-btn-text:hover:not(:disabled) { background: #e2e8f0; color: #1e293b; transform: translateY(-1px); }
    [data-theme="dark"] .lp-btn-text { background: #1a1d2e; color: #94a3b8; border-color: #2d3452; }
    [data-theme="dark"] .lp-btn-text:hover:not(:disabled) { background: #2d3452; color: #e2e8f0; }
  `;
  document.head.appendChild(s);
})();

// ── 2. Student Handout PDF ─────────────────────────────────
async function downloadHandoutPDF(btn) {
  const text     = btn.dataset.text;
  const subject  = btn.dataset.subject;
  const grade    = btn.dataset.grade;
  const topic    = btn.dataset.topic;
  const duration = btn.dataset.duration;

  const original = btn.innerHTML;
  btn.innerHTML = 'Generating…';
  btn.disabled = true;

  try {
    const jsPDF = await loadJsPDF();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 18;
    const contentW = pageW - margin * 2;
    let y = 0;

    // ── Header ──────────────────────────────────────────────
    doc.setFillColor(8, 145, 178); // teal
    doc.rect(0, 0, pageW, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.setFont('helvetica', 'bold');
    doc.text('Student Handout', margin, 13);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${subject}  ·  ${grade}  ·  ${duration}`, margin, 22);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const topicLabel = topic.length > 60 ? topic.substring(0, 58) + '…' : topic;
    doc.text(topicLabel, margin, 30);

    y = 44;

    // ── Name / Date / Section fields ─────────────────────────
    doc.setDrawColor(180, 180, 200);
    doc.setLineWidth(0.4);
    const fieldY = y;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);

    const fields = [
      { label: 'Name:', x: margin, w: 65 },
      { label: 'Date:', x: margin + 70, w: 40 },
      { label: 'Section:', x: margin + 116, w: 45 },
    ];
    fields.forEach(f => {
      doc.text(f.label, f.x, fieldY);
      doc.line(f.x + doc.getTextWidth(f.label) + 2, fieldY + 1, f.x + f.w, fieldY + 1);
    });

    y = fieldY + 10;

    // ── Divider ──────────────────────────────────────────────
    doc.setDrawColor(200, 196, 255);
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageW - margin, y);
    y += 7;

    // ── Extract student-facing content from lesson plan ──────
    // Strip lines that are clearly teacher instructions
    const teacherOnlyPatterns = /^(materials needed|teacher|instructor|facilitat|time allocation|differentiat|standards alignment|cross-curricular)/i;
    const lines = text.split('\n');
    let inTeacherBlock = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) { y += 2.5; continue; }

      // Detect teacher-only block headers and skip them
      if (teacherOnlyPatterns.test(line)) { inTeacherBlock = true; }
      // A new major heading resets the teacher block flag
      if (/^#{1,2}\s/.test(line) && !teacherOnlyPatterns.test(line)) inTeacherBlock = false;
      if (inTeacherBlock) continue;

      const isHeading = /^(#{1,3}\s|[A-Z][A-Z\s\d:]{4,}$|\d+\.\s+[A-Z])/.test(line) ||
                        (line.endsWith(':') && line.length < 60 && line === line.toUpperCase());

      if (isHeading) {
        if (y + 14 > pageH - 20) { doc.addPage(); y = 20; }
        doc.setFillColor(8, 145, 178);
        doc.rect(margin, y, 3, 7, 'F');
        doc.setFontSize(10.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(line.replace(/^#{1,3}\s*/, ''), margin + 6, y + 5.5);
        y += 11;
      } else {
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        const wrapped = doc.splitTextToSize(line, contentW - 4);
        for (const wl of wrapped) {
          if (y + 6 > pageH - 20) { doc.addPage(); y = 20; }
          doc.text(wl, margin + 2, y);
          y += 5.5;
        }
        y += 1;
      }
    }

    // ── Reflection box ───────────────────────────────────────
    if (y + 40 > pageH - 20) { doc.addPage(); y = 20; }
    y += 6;
    doc.setFillColor(236, 254, 255);
    doc.setDrawColor(8, 145, 178);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentW, 36, 3, 3, 'FD');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(8, 145, 178);
    doc.text('REFLECTION / NOTES', margin + 4, y + 7);
    doc.setDrawColor(180, 210, 220);
    doc.setLineWidth(0.3);
    for (let li = 0; li < 3; li++) {
      const ly = y + 14 + li * 7;
      doc.line(margin + 4, ly, margin + contentW - 4, ly);
    }

    // ── Footer ───────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFillColor(236, 254, 255);
      doc.rect(0, pageH - 12, pageW, 12, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(`ClassInstruct AI  ·  Student Handout  ·  ${new Date().toLocaleDateString()}`, margin, pageH - 4.5);
      doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 4.5, { align: 'right' });
    }

    const filename = `Handout_${grade}_${subject}_${topic}`.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 60) + '.pdf';
    doc.save(filename);
    showToast('Handout PDF downloaded!');
  } catch (err) {
    console.error(err);
    showToast('Failed to generate handout PDF.', 'error');
  } finally {
    btn.innerHTML = original;
    btn.disabled = false;
  }
}

// ── 3. Copy Plain Text ─────────────────────────────────────
async function copyPlainText(btn) {
  const text    = btn.dataset.text;
  const subject = btn.dataset.subject;
  const grade   = btn.dataset.grade;
  const topic   = btn.dataset.topic;
  const fw      = btn.dataset.framework;
  const duration= btn.dataset.duration;

  const header = `LESSON PLAN\n${'='.repeat(40)}\nSubject:   ${subject}\nGrade:     ${grade}\nTopic:     ${topic}\nFramework: ${fw}\nDuration:  ${duration}\nGenerated: ${new Date().toLocaleString()}\n${'='.repeat(40)}\n\n`;
  const full = header + text;

  const original = btn.innerHTML;
  try {
    await navigator.clipboard.writeText(full);
    btn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Copied!`;
    showToast('Lesson plan copied to clipboard!');
    setTimeout(() => { btn.innerHTML = original; }, 2000);
  } catch (err) {
    // Fallback: create a temporary textarea
    const ta = document.createElement('textarea');
    ta.value = full;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    btn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Copied!`;
    showToast('Lesson plan copied to clipboard!');
    setTimeout(() => { btn.innerHTML = original; }, 2000);
  }
}

// ============================================
// QUIZ EXPORT — PPT + Copy Text
// ============================================

function buildQuizExportBarHTML(attrs) {
  return `
    <span class="pdf-label" style="color:#7c3aed;">Quiz Ready</span>
    <div class="lp-export-btns">
      <button class="lp-export-btn quiz-btn-ppt" onclick="downloadQuizPPT(this)" ${attrs} title="Download interactive quiz PowerPoint">
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
        Quiz PPT
      </button>
      <button class="lp-export-btn lp-btn-text" onclick="copyQuizText(this)" ${attrs} title="Copy quiz plain text">
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
        Copy Text
      </button>
    </div>`;
}

// Inject quiz export bar styles
(function injectQuizExportStyles() {
  if (document.getElementById('quiz-export-styles')) return;
  const s = document.createElement('style');
  s.id = 'quiz-export-styles';
  s.textContent = `
    .quiz-export-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 14px;
      padding: 11px 14px;
      background: linear-gradient(135deg,#f5f3ff,#ede9fe);
      border: 1.5px solid #c4b5fd;
      border-radius: 12px;
    }
    [data-theme="dark"] .quiz-export-bar {
      background: linear-gradient(135deg,#1c1a3a,#251f4a);
    }
    .quiz-btn-ppt {
      background: #7c3aed;
      color: #fff;
    }
    .quiz-btn-ppt:hover:not(:disabled) {
      background: #6d28d9;
      transform: translateY(-1px);
    }
  `;
  document.head.appendChild(s);
})();

// ── Parse quiz text into structured question objects ───────
function parseQuizText(text) {
  const questions = [];
  // Split on numbered question lines: "1." / "1)" at line start
  const blocks = text.split(/\n(?=\s*\d+[\.\)]\s)/);

  for (const block of blocks) {
    const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    // First line = question text (strip leading "1. ")
    const qLine = lines[0].replace(/^\d+[\.\)]\s*/, '').trim();
    if (!qLine) continue;

    const options = [];
    let answer = '';
    let answerLetter = '';
    let isAnswerKey = false;

    for (let i = 1; i < lines.length; i++) {
      const l = lines[i];

      // Multiple choice option: A) / A. / (A)
      const optMatch = l.match(/^([A-D])[\.\)\:]\s*(.+)/i);
      if (optMatch) {
        options.push({ letter: optMatch[1].toUpperCase(), text: optMatch[2].trim() });
        continue;
      }

      // Answer marker: "Answer: B" / "Correct Answer: A" / "✓ B"
      const ansMatch = l.match(/(?:answer|correct)[:\s]+([A-D][\.\)]?\s*.+)/i)
        || l.match(/✓\s*([A-D][\.\)]?\s*.+)/i);
      if (ansMatch) {
        const raw = ansMatch[1].trim();
        answerLetter = raw[0].toUpperCase();
        answer = raw.replace(/^[A-D][\.\)]\s*/i, '').trim() || raw;
        continue;
      }

      // True/False answer
      const tfMatch = l.match(/^(?:answer|correct)[:\s]+(true|false)/i);
      if (tfMatch) {
        answer = tfMatch[1];
        answerLetter = '';
        continue;
      }

      // Skip answer key section header
      if (/answer\s*key/i.test(l)) { isAnswerKey = true; continue; }
    }

    // If no explicit answer found, try to match from answer key section in the full text
    if (!answerLetter && !answer) {
      const qNum = questions.length + 1;
      const akMatch = text.match(new RegExp(`${qNum}[\\.\\)]\\s*([A-D])`, 'i'));
      if (akMatch) answerLetter = akMatch[1].toUpperCase();
    }

    questions.push({ question: qLine, options, answerLetter, answer });
  }

  return questions.filter(q => q.question.length > 3);
}

// ── Load PptxGenJS dynamically ─────────────────────────────
function loadPptxGenJS() {
  return new Promise((resolve, reject) => {
    if (window.PptxGenJS) return resolve(window.PptxGenJS);
    const script = document.createElement('script');
    script.src = 'pptxgen.bundle.js';
    script.onload = () => {
      // v4.x bundle sets window.PptxGenJS as the class
      const PPT = window.PptxGenJS || window.pptxgen || window.PptxGen;
      if (PPT) resolve(PPT);
      else reject(new Error('PptxGenJS bundle loaded but class not found on window'));
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ── Download Interactive Quiz PPT ─────────────────────────
async function downloadQuizPPT(btn) {
  const text  = btn.dataset.text  || '';
  const topic = btn.dataset.topic || 'Quiz';
  const grade = btn.dataset.grade || 'Students';
  const count = btn.dataset.count || '10';
  const qtype = btn.dataset.qtype || 'multiple choice';
  const diff  = btn.dataset.diff  || 'medium';

  const original = btn.innerHTML;
  btn.innerHTML = 'Building PPT…';
  btn.disabled = true;

  try {
    const PptxGenJS = await loadPptxGenJS();
    const prs = new PptxGenJS();

    prs.layout = 'LAYOUT_WIDE'; // 13.33" x 7.5"

    // ── Colour palette ───────────────────────────────────────
    const C = {
      purple:     '7C3AED',
      purpleLight:'EDE9FE',
      purpleMid:  'A78BFA',
      teal:       '0891B2',
      tealLight:  'ECFEFF',
      green:      '059669',
      greenLight: 'D1FAE5',
      red:        'DC2626',
      redLight:   'FEE2E2',
      amber:      'D97706',
      amberLight: 'FEF3C7',
      white:      'FFFFFF',
      dark:       '1E1B4B',
      gray:       '64748B',
      grayLight:  'F1F5F9',
      slate:      '334155',
    };

    const optionColors = [
      { bg: '3B82F6', light: 'DBEAFE', label: 'A' }, // blue
      { bg: '10B981', light: 'D1FAE5', label: 'B' }, // green
      { bg: 'F59E0B', light: 'FEF3C7', label: 'C' }, // amber
      { bg: 'EF4444', light: 'FEE2E2', label: 'D' }, // red
    ];

    const diffColors = { easy: '059669', medium: 'D97706', hard: 'DC2626' };
    const diffColor  = diffColors[diff] || diffColors.medium;

    // ── SLIDE 1: Title ───────────────────────────────────────
    {
      const sl = prs.addSlide();

      // Full purple gradient background
      sl.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: C.dark } });
      sl.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%',
        fill: { color: C.purple, transparency: 30 } });

      // Decorative circles
      sl.addShape('ellipse', { x: -1, y: -1, w: 3.5, h: 3.5,
        fill: { color: C.purpleMid, transparency: 70 }, line: { color: 'FFFFFF', transparency: 100 } });
      sl.addShape('ellipse', { x: 10.5, y: 5.5, w: 4, h: 4,
        fill: { color: C.teal, transparency: 75 }, line: { color: 'FFFFFF', transparency: 100 } });

      // Quiz badge
      sl.addShape('roundRect', { x: 0.5, y: 1.0, w: 2.4, h: 0.45,
        rectRadius: 0.22, fill: { color: C.purpleMid, transparency: 30 }, line: { color: 'FFFFFF', transparency: 100 } });
      sl.addText('INTERACTIVE QUIZ', { x: 0.5, y: 1.0, w: 2.4, h: 0.45,
        fontSize: 9, bold: true, color: C.white, align: 'center', valign: 'middle' });

      // Title
      sl.addText(topic, { x: 0.5, y: 1.7, w: 12.3, h: 1.8,
        fontSize: 40, bold: true, color: C.white, align: 'left', valign: 'middle',
        breakLine: true });

      // Meta pills row
      const pills = [
        { icon: '🎓', label: grade },
        { icon: '❓', label: `${count} Questions` },
        { icon: '📝', label: (qtype || 'quiz').charAt(0).toUpperCase() + (qtype || 'quiz').slice(1) },
        { icon: '⚡', label: (diff || 'medium').charAt(0).toUpperCase() + (diff || 'medium').slice(1) },
      ];
      pills.forEach((p, i) => {
        const px = 0.5 + i * 3.1;
        sl.addShape('roundRect', { x: px, y: 4.0, w: 2.9, h: 0.5,
          rectRadius: 0.25, fill: { color: C.white, transparency: 80 }, line: { color: 'FFFFFF', transparency: 100 } });
        sl.addText(`${p.icon}  ${p.label}`, { x: px, y: 4.0, w: 2.9, h: 0.5,
          fontSize: 11, bold: true, color: C.white, align: 'center', valign: 'middle' });
      });

      // Generated by
      sl.addText(`Generated by ClassInstruct AI  ·  ${new Date().toLocaleDateString()}`,
        { x: 0.5, y: 6.8, w: 12.3, h: 0.4, fontSize: 9, color: C.purpleMid, align: 'left' });
    }

    // ── SLIDE 2: Instructions ────────────────────────────────
    {
      const sl = prs.addSlide();
      sl.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: C.grayLight } });
      sl.addShape('rect', { x: 0, y: 0, w: '100%', h: 1.1, fill: { color: C.purple } });

      sl.addText('How to Play', { x: 0.5, y: 0.15, w: 12.3, h: 0.8,
        fontSize: 28, bold: true, color: C.white, align: 'left', valign: 'middle' });

      const tips = [
        { icon: '👀', text: 'Read each question carefully before answering.' },
        { icon: '⏱️', text: 'Answer each question before revealing the correct answer.' },
        { icon: '✅', text: 'The correct answer will be highlighted in green on the answer slide.' },
        { icon: '🏆', text: 'Keep track of your score — one point per correct answer!' },
        { icon: '🤔', text: 'Discuss your reasoning with classmates after each question.' },
      ];
      tips.forEach((t, i) => {
        const ty = 1.35 + i * 0.98;
        sl.addShape('roundRect', { x: 0.5, y: ty, w: 12.3, h: 0.82,
          rectRadius: 0.12, fill: { color: C.white }, line: { color: 'E2E8F0', pt: 1 } });
        sl.addShape('ellipse', { x: 0.65, y: ty + 0.16, w: 0.5, h: 0.5,
          fill: { color: C.purpleLight }, line: { color: 'FFFFFF', transparency: 100 } });
        sl.addText(t.icon, { x: 0.65, y: ty + 0.16, w: 0.5, h: 0.5,
          fontSize: 16, align: 'center', valign: 'middle' });
        sl.addText(t.text, { x: 1.3, y: ty + 0.1, w: 11.2, h: 0.62,
          fontSize: 13, color: C.slate, valign: 'middle' });
      });

      sl.addText(`Topic: ${topic}  ·  ${grade}  ·  ${diff} difficulty`,
        { x: 0.5, y: 6.9, w: 12.3, h: 0.35, fontSize: 9, color: C.gray, align: 'center' });
    }

    // ── Parse questions ──────────────────────────────────────
    const questions = parseQuizText(text);

    // ── SLIDES 3+: One question slide + one answer slide per Q ─
    questions.forEach((q, qi) => {
      const qNum  = qi + 1;
      const total = questions.length;
      const hasMC = q.options && q.options.length > 0;

      // ── QUESTION SLIDE ───────────────────────────────────
      {
        const sl = prs.addSlide();

        // Background
        sl.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: C.white } });
        sl.addShape('rect', { x: 0, y: 0, w: '100%', h: 1.25, fill: { color: C.purple } });

        // Progress dots
        for (let d = 0; d < total; d++) {
          sl.addShape('ellipse', {
            x: 0.35 + d * 0.3, y: 0.08, w: 0.18, h: 0.18,
            fill: { color: d === qi ? C.white : C.purpleMid, transparency: d === qi ? 0 : 50 },
            line: { color: 'FFFFFF', transparency: 100 }
          });
        }

        // Question counter badge
        sl.addShape('roundRect', { x: 0.35, y: 0.35, w: 1.1, h: 0.55,
          rectRadius: 0.12, fill: { color: C.white, transparency: 20 }, line: { color: 'FFFFFF', transparency: 100 } });
        sl.addText(`${qNum}/${total}`, { x: 0.35, y: 0.35, w: 1.1, h: 0.55,
          fontSize: 16, bold: true, color: C.white, align: 'center', valign: 'middle' });

        // Difficulty badge
        sl.addShape('roundRect', { x: 11.5, y: 0.38, w: 1.48, h: 0.48,
          rectRadius: 0.12, fill: { color: diffColor, transparency: 30 }, line: { color: 'FFFFFF', transparency: 100 } });
        sl.addText(diff.toUpperCase(), { x: 11.5, y: 0.38, w: 1.48, h: 0.48,
          fontSize: 10, bold: true, color: C.white, align: 'center', valign: 'middle' });

        // Question text box
        sl.addShape('roundRect', { x: 0.35, y: 1.4, w: 12.63, h: hasMC ? 1.55 : 2.4,
          rectRadius: 0.18, fill: { color: C.purpleLight }, line: { color: C.purpleMid, pt: 1.5 } });
        sl.addText(`Q${qNum}. ${q.question}`, {
          x: 0.55, y: 1.48, w: 12.23, h: hasMC ? 1.38 : 2.24,
          fontSize: hasMC ? 17 : 20, bold: true, color: C.dark,
          valign: 'middle', breakLine: true
        });

        if (hasMC) {
          // 2×2 option grid
          const grid = [[0,1],[2,3]];
          grid.forEach((pair, row) => {
            pair.forEach((idx, col) => {
              if (idx >= q.options.length) return;
              const opt  = q.options[idx];
              const oc   = optionColors[idx];
              const ox   = 0.35 + col * 6.47;
              const oy   = 3.15 + row * 1.58;

              sl.addShape('roundRect', { x: ox, y: oy, w: 6.25, h: 1.42,
                rectRadius: 0.18,
                fill: { color: oc.light },
                line: { color: oc.bg, pt: 2 }
              });
              // Letter badge
              sl.addShape('ellipse', { x: ox + 0.15, y: oy + 0.33, w: 0.76, h: 0.76,
                fill: { color: oc.bg }, line: { color: 'FFFFFF', transparency: 100 } });
              sl.addText(oc.label, { x: ox + 0.15, y: oy + 0.33, w: 0.76, h: 0.76,
                fontSize: 16, bold: true, color: C.white, align: 'center', valign: 'middle' });
              sl.addText(opt.text, { x: ox + 1.05, y: oy + 0.15, w: 5.0, h: 1.12,
                fontSize: 13, color: C.slate, valign: 'middle', breakLine: true });
            });
          });
        } else {
          // True / False or short answer — show blank lines
          const ansType = qtype === 'true/false' ? 'True / False' : 'Short Answer';
          sl.addShape('roundRect', { x: 0.35, y: 4.05, w: 12.63, h: 1.9,
            rectRadius: 0.18, fill: { color: C.grayLight }, line: { color: 'CBD5E1', pt: 1 } });
          sl.addText(`Your answer (${ansType}):`, { x: 0.6, y: 4.15, w: 12.13, h: 0.4,
            fontSize: 11, bold: true, color: C.gray });

          if (qtype === 'true/false') {
            ['TRUE', 'FALSE'].forEach((lbl, ti) => {
              const tc = ti === 0 ? C.green : C.red;
              sl.addShape('roundRect', { x: 0.6 + ti * 3.8, y: 4.6, w: 3.3, h: 0.9,
                rectRadius: 0.15, fill: { color: tc, transparency: 85 }, line: { color: tc, pt: 2 } });
              sl.addText(lbl, { x: 0.6 + ti * 3.8, y: 4.6, w: 3.3, h: 0.9,
                fontSize: 18, bold: true, color: tc, align: 'center', valign: 'middle' });
            });
          } else {
            for (let li = 0; li < 2; li++) {
              sl.addShape('line', { x: 0.6, y: 4.7 + li * 0.55, w: 12.13, h: 0,
                line: { color: 'CBD5E1', pt: 1 } });
            }
          }
        }

        // "Think before you click!" footer
        sl.addShape('rect', { x: 0, y: 7.1, w: '100%', h: 0.4, fill: { color: C.purpleLight } });
        sl.addText('💡  Think before you click the next slide for the answer!',
          { x: 0.5, y: 7.1, w: 12.3, h: 0.4, fontSize: 10, color: C.purple,
            align: 'center', valign: 'middle', bold: true });
      }

      // ── ANSWER SLIDE ─────────────────────────────────────
      {
        const sl = prs.addSlide();

        // Background
        sl.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: C.white } });
        sl.addShape('rect', { x: 0, y: 0, w: '100%', h: 1.25, fill: { color: C.green } });

        // Header
        sl.addText('✅  ANSWER', { x: 0.35, y: 0.25, w: 6, h: 0.75,
          fontSize: 24, bold: true, color: C.white, valign: 'middle' });
        sl.addText(`Question ${qNum} of ${total}`, { x: 9, y: 0.35, w: 4.0, h: 0.55,
          fontSize: 13, color: C.white, align: 'right', valign: 'middle' });

        // Question recap box
        sl.addShape('roundRect', { x: 0.35, y: 1.4, w: 12.63, h: 1.2,
          rectRadius: 0.14, fill: { color: C.grayLight }, line: { color: 'CBD5E1', pt: 1 } });
        sl.addText(q.question, { x: 0.55, y: 1.48, w: 12.23, h: 1.04,
          fontSize: 14, color: C.slate, valign: 'middle', italic: true, breakLine: true });

        if (hasMC) {
          // Show all options, highlight the correct one
          const grid = [[0,1],[2,3]];
          grid.forEach((pair, row) => {
            pair.forEach((idx, col) => {
              if (idx >= q.options.length) return;
              const opt      = q.options[idx];
              const isCorrect = opt.letter === q.answerLetter;
              const oc       = optionColors[idx];
              const ox = 0.35 + col * 6.47;
              const oy = 2.8 + row * 1.58;

              if (isCorrect) {
                sl.addShape('roundRect', { x: ox, y: oy, w: 6.25, h: 1.42,
                  rectRadius: 0.18, fill: { color: C.greenLight }, line: { color: C.green, pt: 3 } });
                sl.addShape('ellipse', { x: ox + 0.15, y: oy + 0.33, w: 0.76, h: 0.76,
                  fill: { color: C.green }, line: { color: 'FFFFFF', transparency: 100 } });
                sl.addText('✓', { x: ox + 0.15, y: oy + 0.33, w: 0.76, h: 0.76,
                  fontSize: 18, bold: true, color: C.white, align: 'center', valign: 'middle' });
                sl.addText(opt.text, { x: ox + 1.05, y: oy + 0.15, w: 5.0, h: 1.12,
                  fontSize: 14, bold: true, color: C.green, valign: 'middle', breakLine: true });
              } else {
                sl.addShape('roundRect', { x: ox, y: oy, w: 6.25, h: 1.42,
                  rectRadius: 0.18, fill: { color: 'F8F9FA' }, line: { color: 'E2E8F0', pt: 1 } });
                sl.addShape('ellipse', { x: ox + 0.15, y: oy + 0.33, w: 0.76, h: 0.76,
                  fill: { color: 'E2E8F0' }, line: { color: 'FFFFFF', transparency: 100 } });
                sl.addText(oc.label, { x: ox + 0.15, y: oy + 0.33, w: 0.76, h: 0.76,
                  fontSize: 16, bold: true, color: C.gray, align: 'center', valign: 'middle' });
                sl.addText(opt.text, { x: ox + 1.05, y: oy + 0.15, w: 5.0, h: 1.12,
                  fontSize: 13, color: 'CBD5E1', valign: 'middle', breakLine: true });
              }
            });
          });
        } else {
          // True/False or short answer — show the answer prominently
          const ansDisplay = q.answer || q.answerLetter || '(See below)';
          sl.addShape('roundRect', { x: 0.35, y: 2.85, w: 12.63, h: 1.8,
            rectRadius: 0.2, fill: { color: C.greenLight }, line: { color: C.green, pt: 2.5 } });
          sl.addText('Correct Answer:', { x: 0.6, y: 2.95, w: 12.13, h: 0.45,
            fontSize: 11, bold: true, color: C.green });
          sl.addText(ansDisplay, { x: 0.6, y: 3.38, w: 12.13, h: 1.1,
            fontSize: 22, bold: true, color: C.dark, valign: 'middle', breakLine: true });
        }

        // Discussion prompt
        sl.addShape('roundRect', { x: 0.35, y: 6.35, w: 12.63, h: 0.72,
          rectRadius: 0.14, fill: { color: C.amberLight }, line: { color: C.amber, pt: 1 } });
        sl.addText('💬  Discussion: Why is this the correct answer? Can you explain it in your own words?',
          { x: 0.55, y: 6.38, w: 12.23, h: 0.66, fontSize: 11, color: C.amber, valign: 'middle', italic: true });
      }
    });

    // ── Final Slide: Score Tracker ───────────────────────────
    {
      const sl = prs.addSlide();
      sl.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: C.dark } });
      sl.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%',
        fill: { color: C.purple, transparency: 40 } });

      sl.addShape('ellipse', { x: -0.5, y: 5.5, w: 3, h: 3,
        fill: { color: C.purpleMid, transparency: 80 }, line: { color: 'FFFFFF', transparency: 100 } });
      sl.addShape('ellipse', { x: 11.5, y: -0.5, w: 3, h: 3,
        fill: { color: C.teal, transparency: 80 }, line: { color: 'FFFFFF', transparency: 100 } });

      sl.addText('🎉', { x: 4.5, y: 0.6, w: 4.33, h: 1.2,
        fontSize: 52, align: 'center' });
      sl.addText('Quiz Complete!', { x: 0.5, y: 1.75, w: 12.3, h: 1.0,
        fontSize: 36, bold: true, color: C.white, align: 'center' });
      sl.addText(`${topic}  ·  ${grade}`, { x: 0.5, y: 2.7, w: 12.3, h: 0.5,
        fontSize: 14, color: C.purpleMid, align: 'center' });

      // Score box
      sl.addShape('roundRect', { x: 2.5, y: 3.4, w: 8.33, h: 1.8,
        rectRadius: 0.2, fill: { color: C.white, transparency: 15 }, line: { color: 'FFFFFF', transparency: 100 } });
      sl.addText('Your Score', { x: 2.5, y: 3.5, w: 8.33, h: 0.5,
        fontSize: 13, color: C.purpleMid, align: 'center', bold: true });
      sl.addText(`___ / ${questions.length}`, { x: 2.5, y: 3.95, w: 8.33, h: 1.0,
        fontSize: 36, bold: true, color: C.white, align: 'center', valign: 'middle' });

      sl.addText(`Generated by ClassInstruct AI  ·  ${new Date().toLocaleDateString()}`,
        { x: 0.5, y: 7.0, w: 12.3, h: 0.35, fontSize: 9, color: C.purpleMid, align: 'center' });
    }

    const filename = `Quiz_${grade}_${topic}`.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 55) + '.pptx';
    await prs.writeFile({ fileName: filename });
    showToast('Quiz PPT downloaded!');

  } catch (err) {
    console.error(err);
    showToast('Failed to generate PPT: ' + err.message, 'error');
  } finally {
    btn.innerHTML = original;
    btn.disabled = false;
  }
}

// ── Copy Quiz Plain Text ───────────────────────────────────
async function copyQuizText(btn) {
  const text  = btn.dataset.text;
  const topic = btn.dataset.topic;
  const grade = btn.dataset.grade;
  const count = btn.dataset.count;
  const qtype = btn.dataset.qtype;
  const diff  = btn.dataset.diff;

  const header = `QUIZ\n${'='.repeat(40)}\nTopic:      ${topic}\nGrade:      ${grade}\nQuestions:  ${count}\nType:       ${qtype}\nDifficulty: ${diff}\nGenerated:  ${new Date().toLocaleString()}\n${'='.repeat(40)}\n\n`;
  const full = header + text;

  const original = btn.innerHTML;
  try {
    await navigator.clipboard.writeText(full);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = full;
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  btn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Copied!`;
  showToast('Quiz copied to clipboard!');
  setTimeout(() => { btn.innerHTML = original; }, 2000);
}

// Load CSS for modals, toasts, and typing animation
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'app.css';
document.head.appendChild(link);