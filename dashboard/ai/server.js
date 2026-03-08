const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const API_KEY = "AIzaSyBbXxsQFtrgOuEvFpla3VrUwuKo4zKGMGs";

app.get("/", (req, res) => {
  res.send("ClassInstruct AI backend is running.");
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).json({ reply: "No message was provided." });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: userMessage }],
      },
    ],
  };

  try {
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const text = await response.text();
      let data = {};

      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (response.ok) {
        const reply =
          data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          "⚠️ Gemini did not return a response.";

        return res.json({ reply });
      }

      console.log("Gemini error:", data);
      lastError = { status: response.status, data };

      if (response.status === 503 && attempt < 3) {
        await delay(1500 * attempt);
        continue;
      }

      break;
    }

    return res.status(lastError?.status || 500).json({
      reply:
        lastError?.status === 503
          ? "⚠️ Gemini is busy right now. Please try again."
          : "⚠️ Gemini API request failed.",
    });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({
      reply: "⚠️ Server error. Please try again.",
    });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});