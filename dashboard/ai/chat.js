const API_KEY = "YOUR_GEMINI_API_KEY"; // replace with your actual key
const MODEL = "gemini-1.5-flash";

const sendBtn = document.getElementById("send-btn");
const input = document.getElementById("search-input");
const chatThread = document.getElementById("chat-thread");

function addMessage(text, type) {
  const msg = document.createElement("div");
  msg.classList.add("message", type === "user" ? "user-message" : "ai-message");
  msg.textContent = text;
  chatThread.appendChild(msg);
  chatThread.scrollTop = chatThread.scrollHeight;
}

async function sendMessage() {
  const query = input.value.trim();
  if (!query) return;
  addMessage(query, "user");
  input.value = "";
  
  const thinkingMsg = document.createElement("div");
  thinkingMsg.classList.add("message", "ai-message");
  thinkingMsg.textContent = "Thinking...";
  chatThread.appendChild(thinkingMsg);
  chatThread.scrollTop = chatThread.scrollHeight;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: query }] }]
      })
    });

    const data = await res.json();
    const output = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
    thinkingMsg.textContent = output;
  } catch (err) {
    thinkingMsg.textContent = "Error: " + err.message;
  }
}

document.getElementById('send-btn').addEventListener('click', function() {
  const input = document.getElementById('search-input');
  const message = input.value.trim();
  if (message) {
    const chatThread = document.getElementById('chat-thread');
    const userMessage = document.createElement('div');
    userMessage.className = 'message user-message';
    userMessage.textContent = message;
    chatThread.appendChild(userMessage);
    input.value = ''; // Clear input after sending
    // Here you can add logic to handle AI response
  }
});

input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});
