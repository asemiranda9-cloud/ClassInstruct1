const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");

// Load .env from dashboard/ai directory
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
  exposedHeaders: ["Content-Type"]
}));
app.use(express.json());

// Get API key from environment variable or use a placeholder
const API_KEY = process.env.GEMINI_API_KEY;

app.get("/ping", (req, res) => res.json({ ok: true, streaming: true }));

app.get("/", (req, res) => {
  const hasApiKey = !!API_KEY;
  res.json({ 
    status: "running", 
    hasApiKey: hasApiKey,
    message: hasApiKey ? "ClassInstruct AI backend is running." : "API key not configured. Set GEMINI_API_KEY environment variable."
  });
});

const SYSTEM_PROMPT = `You are ClassInstruct AI, a professional educational assistant designed exclusively for teachers and school administrators.

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
- If a request is unclear, ask a focused clarifying question before proceeding.`;

// Streaming chat endpoint using Server-Sent Events
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).json({ reply: "No message was provided." });
  }

  if (!API_KEY) {
    return res.status(500).json({
      reply: "API key not configured. Please set the GEMINI_API_KEY environment variable and restart the server."
    });
  }

  // Set up SSE headers so the browser receives chunks in real time
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${API_KEY}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }
  };

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini error:", errText);
      const status = geminiRes.status;
      sendEvent({
        error: status === 503
          ? "Gemini is busy right now. Please try again."
          : "Gemini API request failed."
      });
      return res.end();
    }

    // Read the SSE stream from Gemini and forward each chunk to the client
    const reader = geminiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete last line in buffer

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const chunk = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (chunk) sendEvent({ chunk });
        } catch {
          // skip malformed lines
        }
      }
    }

    sendEvent({ done: true });
    res.end();

  } catch (error) {
    console.error("Server error:", error);
    sendEvent({ error: "Server error. Please try again." });
    res.end();
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});