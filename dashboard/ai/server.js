const express = require("express");
const cors    = require("cors");
const path    = require("path");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(path.join(__dirname, "..")));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCx3m3Wk_prycmr52P0hMHR54qyp4WOt5o";

const GEMINI_MODELS = [
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.0-flash",
  "gemini-2.5-flash-preview-04-17",
];

function geminiUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
}

app.get("/", (req, res) => res.json({ status: "running", models: GEMINI_MODELS }));

app.get("/test-gemini", async (req, res) => {
  const results = [];
  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(geminiUrl(model), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Say hello in one word." }] }],
        }),
      });
      const data = await response.json();
      results.push({
        model,
        httpStatus:   response.status,
        reply:        data?.candidates?.[0]?.content?.parts?.[0]?.text,
        error:        data?.error || null,
        works:        response.ok && !!data?.candidates?.[0]?.content?.parts?.[0]?.text,
      });
      if (response.ok) break;
    } catch (err) {
      results.push({ model, error: err.message, works: false });
    }
  }
  res.json(results);
});

app.post("/chat", async (req, res) => {
  const msg = req.body.message;
  if (!msg) return res.status(400).json({ reply: "No message." });
  for (const model of GEMINI_MODELS) {
    try {
      const r = await fetch(geminiUrl(model), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: msg }] }] }),
      });
      const d = await r.json();
      if (r.ok) return res.json({ reply: d?.candidates?.[0]?.content?.parts?.[0]?.text || "No response." });
    } catch (e) { /* try next */ }
  }
  return res.status(500).json({ reply: "All models failed." });
});

function extractJsonArray(raw) {
  if (!raw) return null;
  let text = raw.replace(/```[a-zA-Z]*\n?/gi, "").replace(/```/g, "").trim();
  try { const r = JSON.parse(text); if (Array.isArray(r)) return r; } catch {}
  const s = text.indexOf("["), e = text.lastIndexOf("]");
  if (s !== -1 && e > s) {
    const slice = text.slice(s, e + 1);
    try { const r = JSON.parse(slice); if (Array.isArray(r)) return r; } catch {}
    try {
      const fixed = slice.replace(/,\s*([}\]])/g, "$1").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
      const r = JSON.parse(fixed); if (Array.isArray(r)) return r;
    } catch {}
  }
  const objs = [];
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") { if (depth === 0) start = i; depth++; }
    else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        const chunk = text.slice(start, i + 1);
        try { const o = JSON.parse(chunk); if (o && (o.fullName || o.full_name || o.name)) objs.push(o); } catch {
          try { const o = JSON.parse(chunk.replace(/,\s*([}\]])/g, "$1")); if (o && (o.fullName || o.full_name || o.name)) objs.push(o); } catch {}
        }
        start = -1;
      }
    }
  }
  return objs.length ? objs : null;
}

const FIELDS = ["fullName","studentId","gender","grade","section","dob","email","phone","address","fatherName","motherName","guardianName"];

function normalize(arr) {
  return arr.map(s => {
    const o = {};
    const name = (s.fullName || s.full_name || s.name || "").toString().trim();
    FIELDS.forEach(k => { o[k] = (s[k] || "").toString().trim(); });
    o.fullName = name;
    return o;
  }).filter(s => s.fullName);
}

app.post("/analyze-image", async (req, res) => {
  const { imageBase64, imageType, context } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "No image data received." });
  if (!imageType)   return res.status(400).json({ error: "No image type received." });

  console.log("\n========== /analyze-image ==========");
  console.log("imageType   :", imageType);
  console.log("base64 size :", Math.round(imageBase64.length / 1024), "KB");

  let workingModel = null;
  for (const model of GEMINI_MODELS) {
    try {
      const testRes = await fetch(geminiUrl(model), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "hi" }] }] }),
      });
      if (testRes.ok) { workingModel = model; console.log("Using model:", model); break; }
      const err = await testRes.json();
      console.log(`${model} failed:`, err?.error?.message);
    } catch (e) { console.log(`${model} network error:`, e.message); }
  }

  if (!workingModel) {
    return res.status(500).json({ error: "No Gemini model is responding. Open http://localhost:3000/test-gemini to diagnose. Check your API key." });
  }

  async function askGemini(prompt, attempt) {
    console.log(`\n--- Attempt ${attempt} ---`);
    const body = {
      contents: [{ role: "user", parts: [
        { inline_data: { mime_type: imageType, data: imageBase64 } },
        { text: prompt },
      ]}],
      generationConfig: { temperature: 0, maxOutputTokens: 8192 },
    };
    const response = await fetch(geminiUrl(workingModel), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("HTTP:", response.status, "| finish:", data?.candidates?.[0]?.finishReason, "| error:", data?.error?.message || "none");
    console.log("Response preview:", text.substring(0, 200));
    if (!response.ok) throw new Error(data?.error?.message || `HTTP ${response.status}`);
    return text;
  }

  try {
    const ctx = context ? `\nExtra context: ${context}` : "";

    const prompt1 = `You are a JSON API. Output ONLY a valid JSON array. No markdown. No explanation.

Extract every student from this image.

Format:
[{"fullName":"Juan dela Cruz","studentId":"","gender":"Male","grade":"Grade 1","section":"","dob":"","email":"","phone":"","address":"","fatherName":"","motherName":"","guardianName":""}]

- fullName: Title Case, "LASTNAME, FIRSTNAME MI" → "Firstname Lastname"
- gender: "Male" or "Female" from column headers
- grade: from document header (e.g. "GRADE 4" → "Grade 4")
- unknown fields = ""
- Extract ALL students${ctx}

Start response with [ and end with ]`;

    let raw = await askGemini(prompt1, 1);
    let parsed = extractJsonArray(raw);

    if (!parsed || !parsed.length) {
      raw = await askGemini(`Extract student names from this image as JSON array only:
[{"fullName":"Name","gender":"Male","grade":"Grade 1","studentId":"","section":"","dob":"","email":"","phone":"","address":"","fatherName":"","motherName":"","guardianName":""}]
No other text.${ctx}`, 2);
      parsed = extractJsonArray(raw);
    }

    if (!parsed || !parsed.length) {
      raw = await askGemini(`List every student name in this image as JSON: [{"fullName":"Name","gender":"Male"}]`, 3);
      parsed = extractJsonArray(raw);
    }

    console.log("\nTotal parsed:", parsed ? parsed.length : 0);

    if (!parsed || !parsed.length) {
      console.log("ALL ATTEMPTS FAILED. Raw:\n", raw);
      return res.status(500).json({ error: "AI could not read students from this image. Try: better lighting, higher resolution, or type context like 'Grade 3 masterlist' in the context box." });
    }

    const students = normalize(parsed);
    console.log("Normalized:", students.length, "| First:", JSON.stringify(students[0]));
    console.log("=====================================\n");

    if (!students.length) return res.status(422).json({ error: "Students detected but names unreadable. Try a clearer image." });
    return res.json({ students });

  } catch (err) {
    console.error("CRASH:", err.message);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n✅  ClassInstruct → http://localhost:${PORT}`);
  console.log(`    Test API key  → http://localhost:${PORT}/test-gemini`);
  console.log(`    API key       → ${GEMINI_API_KEY.substring(0, 12)}...`);
  console.log(`    Models ready  → ${GEMINI_MODELS.join(", ")}\n`);
});