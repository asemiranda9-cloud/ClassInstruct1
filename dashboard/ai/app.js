const sendBtn = document.querySelector(".send-btn");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.querySelector(".chat-messages");

let isSending = false;
let chatHistory = [];
let pendingLessonPlanMeta = null; // set when a lesson plan is being generated

// Streams the AI reply chunk-by-chunk into a live message bubble.
// Returns the full accumulated text when done.
async function streamMessageFromGemini(message, onChunk) {
  const controller = new AbortController();
  // Hard timeout: abort if no response at all within 15s
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("http://localhost:3000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
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
    if (error.name === "AbortError") throw new Error("Request timed out. Make sure the server is running on localhost:3000.");
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
}

function addAiMessage(text, isError = false) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `ai-message${isError ? ' error' : ''}`;

  // Check if this is a lesson plan response
  const lpMeta = pendingLessonPlanMeta;
  pendingLessonPlanMeta = null;

  let pdfBtnHTML = '';
  if (lpMeta && !isError) {
    pdfBtnHTML = `
      <div class="pdf-download-bar">
        <span class="pdf-label">Lesson Plan Ready</span>
        <button class="pdf-download-btn" onclick="downloadLessonPlanPDF(this)"
          data-text="${escapeAttr(text)}"
          data-subject="${escapeAttr(lpMeta.subject)}"
          data-grade="${escapeAttr(lpMeta.grade)}"
          data-topic="${escapeAttr(lpMeta.topic)}"
          data-framework="${escapeAttr(lpMeta.frameworkLabel)}"
          data-duration="${escapeAttr(lpMeta.duration)}">
          Download PDF
        </button>
      </div>`;
  }

  messageDiv.innerHTML = `<div class="message-content">${formatMessage(text)}</div>${pdfBtnHTML}`;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  if (!isError) chatHistory.push({ role: 'ai', text, timestamp: new Date() });
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function handleSendMessage() {
  if (isSending) return;
  const userMessage = chatInput.value.trim();
  if (!userMessage) return;

  isSending = true;
  sendBtn.disabled = true;
  chatInput.disabled = true;

  addUserMessage(userMessage);
  chatInput.value = "";

  // Show typing indicator while waiting for the first chunk
  const typingDiv = document.createElement("div");
  typingDiv.className = "ai-message typing-message";
  typingDiv.innerHTML = '<div class="message-content"><span class="typing-dots">● ● ●</span> Thinking...</div>';
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Create the live AI message bubble (hidden until first chunk arrives)
  const messageDiv = document.createElement("div");
  messageDiv.className = "ai-message";
  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  messageDiv.appendChild(contentDiv);

  let firstChunk = true;

  try {
    const fullText = await streamMessageFromGemini(userMessage, (accumulated) => {
      if (firstChunk) {
        typingDiv.remove();
        chatMessages.appendChild(messageDiv);
        firstChunk = false;
      }
      contentDiv.innerHTML = formatMessage(accumulated);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    // After streaming is done, attach PDF button if this was a lesson plan
    const lpMeta = pendingLessonPlanMeta;
    pendingLessonPlanMeta = null;
    if (lpMeta && fullText) {
      const pdfBar = document.createElement("div");
      pdfBar.className = "pdf-download-bar";
      pdfBar.innerHTML = `
        <span class="pdf-label">Lesson Plan Ready</span>
        <button class="pdf-download-btn" onclick="downloadLessonPlanPDF(this)"
          data-text="${escapeAttr(fullText)}"
          data-subject="${escapeAttr(lpMeta.subject)}"
          data-grade="${escapeAttr(lpMeta.grade)}"
          data-topic="${escapeAttr(lpMeta.topic)}"
          data-framework="${escapeAttr(lpMeta.frameworkLabel)}"
          data-duration="${escapeAttr(lpMeta.duration)}">
          Download PDF
        </button>`;
      messageDiv.appendChild(pdfBar);
    }

    if (fullText) chatHistory.push({ role: 'ai', text: fullText, timestamp: new Date() });

  } catch (error) {
    typingDiv.remove();
    let errorMessage = error.message;
    if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
      errorMessage = "Cannot connect to server. Make sure the server is running on localhost:3000";
    }
    addAiMessage(errorMessage, true);
  } finally {
    isSending = false;
    sendBtn.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
  }
}

sendBtn.addEventListener("click", handleSendMessage);
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleSendMessage();
  }
});

// ============================================
// FILE ATTACHMENT
// ============================================
let attachedFile = null;
let attachedFileContent = null;

const fileInput = document.getElementById('file-input');
const attachBtn = document.getElementById('attach-btn');
const attachmentPreview = document.getElementById('attachment-preview');
const attachmentName = document.getElementById('attachment-name');

if (attachBtn && fileInput) {
  attachBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      showToast('File too large. Maximum size is 5MB.', 'error');
      fileInput.value = '';
      return;
    }

    attachedFile = file;
    attachmentName.textContent = file.name;
    attachmentPreview.style.display = 'flex';
    attachBtn.style.color = 'var(--primary-color)';

    // Read file content as text (for text-based files)
    const reader = new FileReader();
    const textTypes = ['text/plain', 'application/json', 'text/csv', 'text/html'];
    const isText = textTypes.includes(file.type) || file.name.endsWith('.txt') || file.name.endsWith('.csv') || file.name.endsWith('.json');

    if (isText) {
      reader.onload = (e) => {
        attachedFileContent = e.target.result;
        showToast(`File attached: ${file.name}`);
      };
      reader.readAsText(file);
    } else {
      // For PDFs, Word docs, images — just note the filename and type
      attachedFileContent = null;
      showToast(`File attached: ${file.name} (name will be included in your message)`);
    }
  });
}

function clearAttachment() {
  attachedFile = null;
  attachedFileContent = null;
  if (fileInput) fileInput.value = '';
  if (attachmentPreview) attachmentPreview.style.display = 'none';
  if (attachBtn) attachBtn.style.color = '';
}

// Override handleSendMessage to prepend file content when a file is attached
const _originalHandleSend = handleSendMessage;

// Patch: prepend file info to the user message if a file is attached
const _baseSendMessage = handleSendMessage;
window.handleSendMessageWithFile = async function() {
  if (attachedFile) {
    const fileName = attachedFile.name;
    let prefix = `[Attached file: ${fileName}]\n\n`;
    if (attachedFileContent) {
      const preview = attachedFileContent.length > 3000
        ? attachedFileContent.substring(0, 3000) + '\n... (content truncated)'
        : attachedFileContent;
      prefix += `File contents:\n${preview}\n\n`;
    }
    const currentVal = chatInput.value.trim();
    chatInput.value = prefix + (currentVal || `Please review the attached file: ${fileName}`);
    clearAttachment();
  }
  await handleSendMessage();
};

// Re-wire send button to use file-aware version
sendBtn.removeEventListener("click", handleSendMessage);
sendBtn.addEventListener("click", window.handleSendMessageWithFile);
chatInput.removeEventListener("keydown", handleSendMessage);
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
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
  if (chatMessages.querySelector('.user-message') || chatMessages.querySelector('.ai-message:not(.welcome-ai)')) {
    const confirmed = confirm("Start a new chat? Your current conversation will be cleared.");
    if (!confirmed) return;
  }
  chatHistory = [];
  chatMessages.innerHTML = `
    <div class="welcome-message">
      <h2>Welcome to ClassInstruct AI</h2>
      <p>Ask me anything about your classes, students, or attendance.</p>
      <div class="quick-prompts">
        <button class="quick-prompt-btn" onclick="useQuickPrompt('Help me create a lesson plan for Grade 5 Math')">Create a lesson plan</button>
        <button class="quick-prompt-btn" onclick="useQuickPrompt('Generate a quiz on the water cycle for Grade 3')">Generate a quiz</button>
        <button class="quick-prompt-btn" onclick="useQuickPrompt('Give me tips for classroom management')">Classroom tips</button>
        <button class="quick-prompt-btn" onclick="useQuickPrompt('How do I track student attendance effectively?')">Track attendance</button>
      </div>
    </div>
  `;
  chatInput.focus();
  showToast("New chat started!");
}

function useQuickPrompt(text) {
  chatInput.value = text;
  chatInput.focus();
  handleSendMessage();
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
  chatInput.value = prompt;
  handleSendMessage();
}

// 4. INTERACTIVE QUIZ GENERATOR
function openQuiz() {
  closeAllModals();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'quiz-modal';
  modal.innerHTML = `
    <div class="modal-panel">
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
  const prompt = `Create a ${diff} difficulty quiz for ${grade} students on the topic: "${topic}". Generate ${count} ${type} questions. For multiple choice, include 4 options (A, B, C, D) and mark the correct answer. Include an answer key at the end. Format clearly and number each question.`;
  chatInput.value = prompt;
  handleSendMessage();
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
      const time = msg.timestamp ? msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
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
  if (confirm("Clear all chat history? This cannot be undone.")) {
    chatHistory = [];
    closeAllModals();
    showToast("History cleared.");
  }
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

// Inject CSS for modals, toasts, and typing animation
const style = document.createElement('style');
style.textContent = `
  /* PDF Download Bar */
  .pdf-download-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
    padding: 10px 14px;
    background: linear-gradient(135deg, #f5f3ff, #ede9fe);
    border: 1.5px solid #c4b5fd;
    border-radius: 10px;
    gap: 10px;
  }
  .pdf-label {
    font-size: 0.82rem;
    font-weight: 600;
    color: #5b21b6;
  }
  .pdf-download-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 16px;
    background: #4f46e5;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.83rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .pdf-download-btn:hover { background: #4338ca; transform: translateY(-1px); }
  .pdf-download-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

  /* Typing animation */
  .typing-dots { animation: typingBounce 1.4s infinite ease-in-out; }
  @keyframes typingBounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-4px); }
  }
  .message-content { white-space: pre-wrap; }

  /* Quick prompts in welcome */
  .quick-prompts {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
    margin-top: 20px;
  }
  .quick-prompt-btn {
    padding: 10px 16px;
    border-radius: 20px;
    border: 2px solid var(--primary-light, #e0e7ff);
    background: white;
    color: var(--primary-color, #4f46e5);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  }
  .quick-prompt-btn:hover {
    background: var(--primary-color, #4f46e5);
    color: white;
    border-color: var(--primary-color, #4f46e5);
    transform: translateY(-1px);
  }
  .welcome-icon { font-size: 3rem; margin-bottom: 12px; }

  /* Modal Overlay */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .modal-overlay.visible { opacity: 1; }

  /* Modal Panel */
  .modal-panel {
    background: #fff;
    border-radius: 20px;
    width: 100%;
    max-width: 520px;
    box-shadow: 0 25px 60px rgba(0,0,0,0.2);
    transform: translateY(20px) scale(0.97);
    transition: transform 0.3s ease;
    overflow: hidden;
  }
  .modal-overlay.visible .modal-panel { transform: translateY(0) scale(1); }
  .modal-panel-wide { max-width: 600px; }

  /* Modal Header */
  .modal-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 24px 24px 20px;
    border-bottom: 1px solid #f1f5f9;
  }
  .modal-header-icon { font-size: 2rem; line-height: 1; }
  .modal-title { font-size: 1.2rem; font-weight: 700; color: #1e293b; margin: 0; }
  .modal-subtitle { font-size: 0.82rem; color: #64748b; margin: 2px 0 0; }
  .modal-close-btn {
    margin-left: auto;
    background: #f1f5f9;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 0.85rem;
    color: #64748b;
    transition: all 0.2s;
    display: flex; align-items: center; justify-content: center;
  }
  .modal-close-btn:hover { background: #e2e8f0; color: #1e293b; }

  /* Modal Body */
  .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
  .modal-body.history-scroll { max-height: 380px; overflow-y: auto; }

  /* Form Elements */
  .form-group { display: flex; flex-direction: column; gap: 6px; flex: 1; }
  .form-row { display: flex; gap: 14px; }
  .form-label { font-size: 0.82rem; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; }
  .form-input {
    padding: 10px 14px;
    border-radius: 10px;
    border: 2px solid #e2e8f0;
    font-size: 0.93rem;
    color: #1e293b;
    font-family: inherit;
    transition: border-color 0.2s;
    background: #f8fafc;
    width: 100%;
  }
  .form-input:focus { outline: none; border-color: #4f46e5; background: white; }

  /* Toggle buttons */
  .toggle-group { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
  .toggle-btn {
    padding: 7px 14px;
    border-radius: 20px;
    border: 2px solid #e2e8f0;
    background: white;
    font-size: 0.83rem;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }
  .toggle-btn:hover { border-color: #4f46e5; color: #4f46e5; }
  .toggle-btn.active { background: #4f46e5; border-color: #4f46e5; color: white; }

  /* Modal Footer */
  .modal-footer {
    padding: 16px 24px;
    border-top: 1px solid #f1f5f9;
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }
  .modal-cancel-btn {
    padding: 10px 20px;
    border-radius: 10px;
    border: 2px solid #e2e8f0;
    background: white;
    color: #64748b;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.2s;
  }
  .modal-cancel-btn:hover { border-color: #94a3b8; color: #1e293b; }
  .modal-cancel-btn.danger { color: #ef4444; border-color: #fca5a5; }
  .modal-cancel-btn.danger:hover { background: #fef2f2; }
  .modal-action-btn {
    padding: 10px 22px;
    border-radius: 10px;
    border: none;
    background: #4f46e5;
    color: white;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.2s;
    display: flex; align-items: center; gap: 6px;
  }
  .modal-action-btn:hover { background: #4338ca; transform: translateY(-1px); }

  /* History Items */
  .history-empty { text-align: center; padding: 40px 20px; color: #475569; }
  .history-item {
    padding: 12px 14px;
    border-radius: 10px;
    margin-bottom: 8px;
  }
  .history-item.user { background: #ede9fe; }
  .history-item.ai { background: #f1f5f9; }
  .history-item-meta { display: flex; justify-content: space-between; margin-bottom: 4px; }
  .history-role { font-size: 0.78rem; font-weight: 700; color: #4f46e5; }
  .history-time { font-size: 0.75rem; color: #94a3b8; }
  .history-text { font-size: 0.88rem; color: #334155; line-height: 1.5; }

  /* Framework Cards */
  .framework-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 4px;
  }
  .framework-card {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 2px solid #e2e8f0;
    background: white;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
  }
  .framework-card:hover {
    border-color: #94a3b8;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  }
  .framework-card.active {
    border-color: #4f46e5;
    background: #f5f3ff;
    box-shadow: 0 0 0 3px rgba(79,70,229,0.12);
  }
  .fw-emoji { font-size: 1.5rem; line-height: 1; margin-bottom: 2px; }
  .fw-label { font-size: 0.9rem; font-weight: 700; }
  .fw-tagline { font-size: 0.72rem; color: #64748b; font-style: italic; line-height: 1.3; margin-top: 1px; }
  .fw-desc { font-size: 0.75rem; color: #94a3b8; line-height: 1.4; margin-top: 4px; }
  .framework-card.active .fw-tagline { color: #4f46e5; }
  .framework-card.active .fw-desc { color: #6366f1; }

  /* Toast */
  .toast {
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: #1e293b;
    color: white;
    padding: 12px 24px;
    border-radius: 30px;
    font-size: 0.88rem;
    font-weight: 500;
    z-index: 2000;
    opacity: 0;
    transition: all 0.3s ease;
    pointer-events: none;
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  }
  .toast.toast-error { background: #ef4444; }
  .toast.visible { opacity: 1; transform: translateX(-50%) translateY(0); }
`;
document.head.appendChild(style);