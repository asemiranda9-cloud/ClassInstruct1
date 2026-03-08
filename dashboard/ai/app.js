const sendBtn = document.querySelector(".send-btn");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.querySelector(".chat-messages");

let isSending = false;

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