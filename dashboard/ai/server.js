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
app.use(express.json({ limit: "100mb" }));

const API_KEY = process.env.GEMINI_API_KEY;

app.get("/ping", (req, res) => res.json({ ok: true, streaming: true }));

app.get("/", (req, res) => {
  const hasApiKey = !!API_KEY;
  res.json({
    status: "running",
    hasApiKey,
    message: hasApiKey
      ? "ClassInstruct AI backend is running."
      : "API key not configured. Set GEMINI_API_KEY environment variable."
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

// ============================================================
// LINK FETCH ENDPOINT
// ============================================================
app.post("/fetch-link", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "No URL provided." });

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: "Only http and https URLs are supported." });
    }
  } catch {
    return res.status(400).json({ error: "Invalid URL format." });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ClassInstructAI/1.0)",
        "Accept": "text/html,text/plain;q=0.9,*/*;q=0.8"
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Could not fetch the page (HTTP ${response.status}).` });
    }

    const contentType = response.headers.get("content-type") || "";
    const html = await response.text();

    if (contentType.includes("text/plain")) {
      return res.json({ text: html.substring(0, 12000) });
    }

    // Strip HTML to readable plain text
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return res.json({ text: stripped.substring(0, 12000) });

  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return res.status(504).json({ error: "The page took too long to respond (10 s timeout)." });
    }
    console.error("Link fetch error:", err.message);
    return res.status(502).json({ error: "Failed to retrieve the page. It may be blocking automated access." });
  }
});

// ============================================================
// YOUTUBE ENDPOINT — fetches title, description, captions
// Body: { videoId }
// ============================================================
app.post("/fetch-youtube", async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ error: "No video ID provided." });

  const YT_KEY = process.env.YOUTUBE_API_KEY;
  if (!YT_KEY) return res.status(500).json({ error: "YOUTUBE_API_KEY not set in .env." });

  try {
    // 1. Fetch video metadata (title, description, channel)
    const metaUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YT_KEY}`;
    const metaRes = await fetch(metaUrl, { signal: AbortSignal.timeout(8000) });
    const metaData = await metaRes.json();

    if (!metaData.items || metaData.items.length === 0) {
      return res.status(404).json({ error: "Video not found or is private." });
    }

    const snippet = metaData.items[0].snippet;
    const title       = snippet.title || "";
    const channel     = snippet.channelTitle || "";
    const description = (snippet.description || "").substring(0, 1500);
    const tags        = (snippet.tags || []).slice(0, 20).join(", ");

    // 2. Fetch captions list
    const captionsUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${YT_KEY}`;
    const captionsRes = await fetch(captionsUrl, { signal: AbortSignal.timeout(8000) });
    const captionsData = await captionsRes.json();

    let captionNote = "No captions are publicly available for this video.";
    if (captionsData.items && captionsData.items.length > 0) {
      const available = captionsData.items.map(c => c.snippet.language || c.snippet.trackKind).join(", ");
      captionNote = `Captions available in: ${available}. (Caption text requires OAuth and cannot be fetched with an API key alone.)`;
    }

    return res.json({ title, channel, description, tags, captionNote });

  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return res.status(504).json({ error: "YouTube API request timed out." });
    }
    console.error("YouTube fetch error:", err.message);
    return res.status(502).json({ error: "Failed to fetch YouTube video data." });
  }
});

// ============================================================
// VIDEO UPLOAD ENDPOINT — uploads to Gemini File API
// Body: { videoBase64, mimeType, fileName }
// ============================================================
app.post("/upload-video", async (req, res) => {
  const { videoBase64, mimeType, fileName } = req.body;
  if (!videoBase64 || !mimeType) {
    return res.status(400).json({ error: "Missing videoBase64 or mimeType." });
  }
  if (!API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured." });
  }

  try {
    const videoBuffer = Buffer.from(videoBase64, "base64");
    const numBytes = videoBuffer.length;

    // Step 1: Initiate resumable upload
    const initRes = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=resumable&key=${API_KEY}`,
      {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": numBytes,
          "X-Goog-Upload-Header-Content-Type": mimeType,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ file: { display_name: fileName || "video" } })
      }
    );

    const uploadUrl = initRes.headers.get("x-goog-upload-url");
    if (!uploadUrl) {
      return res.status(502).json({ error: "Failed to initiate Gemini file upload." });
    }

    // Step 2: Upload the actual bytes
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length": numBytes,
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize"
      },
      body: videoBuffer
    });

    const fileData = await uploadRes.json();
    const fileUri = fileData?.file?.uri;
    const fileState = fileData?.file?.state;

    if (!fileUri) {
      return res.status(502).json({ error: "Gemini did not return a file URI." });
    }

    // Step 3: Poll until file is ACTIVE (processing can take a few seconds)
    let state = fileState;
    let attempts = 0;
    while (state === "PROCESSING" && attempts < 20) {
      await new Promise(r => setTimeout(r, 2000));
      const checkRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${fileData.file.name}?key=${API_KEY}`
      );
      const checkData = await checkRes.json();
      state = checkData?.state;
      attempts++;
    }

    if (state !== "ACTIVE") {
      return res.status(502).json({ error: "Video processing timed out or failed on Gemini's end." });
    }

    return res.json({ fileUri, mimeType });

  } catch (err) {
    console.error("Video upload error:", err.message);
    return res.status(502).json({ error: "Video upload failed: " + err.message });
  }
});

// ============================================================
// STREAMING CHAT ENDPOINT
// Body: { message, imageBase64?, imageMimeType?, docText?, fileUri?, fileMimeType? }
// ============================================================
app.post("/chat", async (req, res) => {
  const { message, imageBase64, imageMimeType, docText, fileUri, fileMimeType } = req.body;

  if (!message) {
    return res.status(400).json({ reply: "No message was provided." });
  }
  if (!API_KEY) {
    return res.status(500).json({
      reply: "API key not configured. Please set the GEMINI_API_KEY environment variable and restart the server."
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // Build parts
  const parts = [];

  // Attach image or video
  if (fileUri && fileMimeType) {
    // Video uploaded via Gemini File API — reference by URI
    parts.push({ fileData: { mimeType: fileMimeType, fileUri } });
  } else if (imageBase64 && imageMimeType) {
    // Regular image — send inline
    parts.push({ inlineData: { mimeType: imageMimeType, data: imageBase64 } });
  }

  // Inject document text as context
  let finalMessage = message;
  if (docText) {
    finalMessage = `The teacher has uploaded a document. Here is its text content:\n\n---\n${docText.substring(0, 10000)}\n---\n\nTeacher's request: ${message}`;
  }

  parts.push({ text: finalMessage });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${API_KEY}`;

  const body = {
    contents: [{ role: "user", parts }],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }
  };

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini error:", errText);
      sendEvent({
        error: geminiRes.status === 503
          ? "Gemini is busy right now. Please try again."
          : "Gemini API request failed."
      });
      return res.end();
    }

    const reader = geminiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

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