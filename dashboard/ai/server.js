const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Keep your Gemini API key secret here
const API_KEY = "AIzaSyBbXxsQFtrgOuEvFpla3VrUwuKo4zKGMGs";

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userMessage }] }]
        })
      }
    );

    const data = await response.json();

    if (data.candidates && data.candidates.length > 0) {
      res.json({ reply: data.candidates[0].content.parts[0].text });
    } else {
      res.json({ reply: "⚠️ Gemini didn’t return a response.", error: data });
    }
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ reply: "⚠️ Network error. Please try again." });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
