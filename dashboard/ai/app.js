const sendBtn = document.querySelector(".send-btn");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.querySelector(".chat-messages");

let isSending = false;

async function sendMessageToGemini(message) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch("http://localhost:3000/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

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
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  }
}

function addMessage(text, className, isHTML = false) {
  const messageDiv = document.createElement("div");
  messageDiv.className = className;
  
  if (isHTML) {
    messageDiv.innerHTML = text;
  } else {
    messageDiv.textContent = text;
  }
  
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addUserMessage(text) {
  const messageDiv = document.createElement("div");
  messageDiv.className = "user-message";
  messageDiv.innerHTML = `
    <div class="message-content">${escapeHtml(text)}</div>
  `;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addAiMessage(text, isError = false) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `ai-message${isError ? ' error' : ''}`;
  messageDiv.innerHTML = `
    <div class="message-content">${formatMessage(text)}</div>
  `;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatMessage(text) {
  // Basic formatting - escape HTML first
  let formatted = escapeHtml(text);
  // Convert line breaks to <br>
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
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

  const typingDiv = document.createElement("div");
  typingDiv.className = "ai-message typing-message";
  typingDiv.innerHTML = '<div class="message-content"><span class="typing-dots">● ● ●</span> Thinking...</div>';
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const aiReply = await sendMessageToGemini(userMessage);
    typingDiv.remove();
    addAiMessage(aiReply);
  } catch (error) {
    typingDiv.remove();
    
    let errorMessage = error.message;
    if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
      errorMessage = "Cannot connect to server. Make sure the server is running on localhost:3000";
    }
    
    addAiMessage(errorMessage, true);
    console.error("Chat error:", error);
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

// Add typing animation CSS
const style = document.createElement('style');
style.textContent = `
  .typing-dots {
    animation: typingBounce 1.4s infinite ease-in-out;
  }
  .typing-dots:nth-child(1) { animation-delay: 0s; }
  .typing-dots:nth-child(2) { animation-delay: 0.2s; }
  .typing-dots:nth-child(3) { animation-delay: 0.4s; }
  
  @keyframes typingBounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-4px); }
  }
  
  .message-content {
    white-space: pre-wrap;
  }
`;
document.head.appendChild(style);
