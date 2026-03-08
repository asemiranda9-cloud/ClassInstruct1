// ================================
// Frontend code to talk to backend
// ================================

async function sendMessageToGemini(message) {
  const response = await fetch("http://localhost:3000/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  });

  const data = await response.json();
  return data.reply;
}

// Hook up the send button
document.querySelector(".send-btn").addEventListener("click", async () => {
  const input = document.getElementById("chat-input");
  const userMessage = input.value.trim();
  if (!userMessage) return;

  const chatMessages = document.querySelector(".chat-messages");
  chatMessages.innerHTML += `<div class="user-message">${userMessage}</div>`;

  const aiReply = await sendMessageToGemini(userMessage);
  chatMessages.innerHTML += `<div class="ai-message">${aiReply}</div>`;

  input.value = "";
});
