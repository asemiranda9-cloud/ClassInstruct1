const sendBtn = document.querySelector(".send-btn");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.querySelector(".chat-messages");
const voiceBtn = document.getElementById("voice-btn");
const attachBtn = document.getElementById("attach-btn");
const fileInput = document.getElementById("file-input");

let isSending = false;
let uploadedFiles = []; // Store information about uploaded files

// Check if Speech Recognition is supported
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  
  recognition.onstart = function() {
    voiceBtn.classList.add('recording');
    voiceBtn.innerHTML = '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="red" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="red"/></svg>';
    addMessage("🎤 Listening...", "ai-message");
  };
  
  recognition.onend = function() {
    voiceBtn.classList.remove('recording');
    voiceBtn.innerHTML = '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>';
  };
  
  recognition.onresult = function(event) {
    const transcript = Array.from(event.results)
      .map(result => result[0])
      .map(result => result.transcript)
      .join('');
    
    if (event.results[0].isFinal) {
      chatInput.value = transcript;
      // Auto-send the message
      handleSendMessage();
    }
  };
  
  recognition.onerror = function(event) {
    console.error("Speech recognition error:", event.error);
    addMessage("⚠️ Voice recognition error: " + event.error, "ai-message");
  };
}

// Voice button click handler
if (voiceBtn) {
  voiceBtn.addEventListener("click", () => {
    if (recognition) {
      try {
        recognition.start();
      } catch (e) {
        console.error("Recognition start error:", e);
      }
    } else {
      addMessage("⚠️ Voice recognition is not supported in your browser.", "ai-message");
    }
  });
}

// File attachment button click handler
if (attachBtn && fileInput) {
  attachBtn.addEventListener("click", () => {
    fileInput.click();
  });
  
  fileInput.addEventListener("change", async (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      await handleFileUpload(files);
    }
  });
}

async function handleFileUpload(files) {
  const fileNames = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    fileNames.push(file.name);
    uploadedFiles.push({
      name: file.name,
      type: file.type,
      size: file.size
    });
  }
  
  // Add user message about uploaded files
  addMessage("📎 Uploaded: " + fileNames.join(", "), "user-message");
  
  // Show AI response about the files
  const typingDiv = document.createElement("div");
  typingDiv.className = "ai-message typing-message";
  typingDiv.textContent = "Processing your learning materials...";
  chatMessages.appendChild(typingDiv);
  
  try {
    // Send file info to server for processing
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    
    const response = await fetch("http://localhost:3000/upload", {
      method: "POST",
      body: formData
    });
    
    // Check if response is OK
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} - ${errorText}`);
    }
    
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(`Expected JSON but got: ${text.substring(0, 100)}`);
    }
    
    const data = await response.json();
    typingDiv.remove();
    
    if (response.ok) {
      addMessage("✅ I've received your learning materials: " + fileNames.join(", ") + ". You can now ask me about the content or request a lesson plan!", "ai-message");
    } else {
      addMessage("⚠️ " + (data.error || "Failed to process files"), "ai-message");
    }
  } catch (error) {
    typingDiv.remove();
    console.error("Upload error:", error);
    addMessage("⚠️ Error uploading files: " + error.message, "ai-message");
  }
  
  // Reset file input
  fileInput.value = "";
}

// Function to request lesson plan from AI
async function requestLessonPlan() {
  if (isSending) return;
  
  isSending = true;
  sendBtn.disabled = true;
  
  const userMessage = "Please suggest lesson plan formats. I need a 5E lesson plan, 4A lesson plan, and a daily lesson plan format for my learning materials.";
  
  addMessage("📋 Requesting lesson plan formats...", "user-message");
  
  const typingDiv = document.createElement("div");
  typingDiv.className = "ai-message typing-message";
  typingDiv.textContent = "Generating lesson plan formats...";
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  try {
    const aiReply = await sendMessageToGemini(userMessage);
    typingDiv.remove();
    addMessage(aiReply, "ai-message");
  } catch (error) {
    typingDiv.remove();
    addMessage("⚠️ " + error.message, "ai-message");
  } finally {
    isSending = false;
    sendBtn.disabled = false;
  }
}

// Make requestLessonPlan available globally
window.requestLessonPlan = requestLessonPlan;

async function sendMessageToGemini(message) {
  const response = await fetch("http://localhost:3000/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    throw new Error("Server returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(data.reply || "Server error");
  }

  return data.reply;
}

function addMessage(text, className) {
  const messageDiv = document.createElement("div");
  messageDiv.className = className;
  messageDiv.textContent = text;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function handleSendMessage() {
  if (isSending) return;

  const userMessage = chatInput.value.trim();
  if (!userMessage) return;

  isSending = true;
  sendBtn.disabled = true;

  addMessage(userMessage, "user-message");
  chatInput.value = "";

  const typingDiv = document.createElement("div");
  typingDiv.className = "ai-message typing-message";
  typingDiv.textContent = "Typing...";
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const aiReply = await sendMessageToGemini(userMessage);
    typingDiv.remove();
    addMessage(aiReply, "ai-message");
  } catch (error) {
    typingDiv.remove();
    addMessage("⚠️ " + error.message, "ai-message");
    console.error("Chat error:", error);
  } finally {
    isSending = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

sendBtn.addEventListener("click", handleSendMessage);

chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleSendMessage();
  }
});
