const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

// Configure multer for file uploads
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use("/uploads", express.static(uploadDir));

const API_KEY = "AIzaSyBbXxsQFtrgOuEvFpla3VrUwuKo4zKGMGs";

// Store uploaded file contents in memory (for session)
let uploadedFileContents = [];

app.get("/", (req, res) => {
  res.send("ClassInstruct AI backend is running.");
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// File upload endpoint
app.post("/upload", upload.array("files", 10), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files were uploaded." });
    }

    const fileInfo = [];
    
    for (const file of files) {
      const fileData = {
        filename: file.originalname,
        type: file.mimetype,
        size: file.size
      };
      
      // Only read text-based files
      const textTypes = ['text/plain', 'text/csv', 'text/html', 'text/xml', 'application/json'];
      const isTextFile = textTypes.includes(file.mimetype) || 
                        file.originalname.endsWith('.txt') || 
                        file.originalname.endsWith('.csv');
      
      if (isTextFile) {
        try {
          const content = fs.readFileSync(file.path, 'utf-8');
          fileData.content = content.substring(0, 5000);
        } catch (e) {
          console.log('Could not read file as text:', file.originalname);
        }
      }
      
      uploadedFileContents.push(fileData);
      
      fileInfo.push({
        name: file.originalname,
        size: file.size,
        path: file.path,
        type: file.mimetype
      });
    }

    res.json({ 
      success: true, 
      message: `Successfully uploaded ${files.length} file(s)`,
      files: fileInfo
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to upload files." });
  }
});

// Enhanced chat endpoint with lesson plan support
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).json({ reply: "No message was provided." });
  }

  // Check if user is asking for lesson plan formats
  const isLessonPlanRequest = userMessage.toLowerCase().includes("lesson plan") || 
                               userMessage.toLowerCase().includes("5e") ||
                               userMessage.toLowerCase().includes("4a") ||
                               userMessage.toLowerCase().includes("daily lesson");

  let contextMessage = userMessage;
  
  // If there are uploaded files, include their content in the context
  if (uploadedFileContents.length > 0) {
    const fileContents = uploadedFileContents.map(f => 
      `File: ${f.filename}\nContent: ${f.content}`
    ).join("\n\n");
    
    contextMessage = `Context from uploaded learning materials:\n${fileContents}\n\nUser question: ${userMessage}`;
  }

  // If lesson plan request, enhance the prompt
  if (isLessonPlanRequest) {
    contextMessage = `You are a helpful teaching assistant. The user is asking about lesson plan formats. 

Please provide detailed templates for:
1. **5E Lesson Plan Model**: Engage, Explore, Explain, Elaborate, Evaluate
2. **4A Lesson Plan Model**: Activity, Analysis, Abstraction, Application  
3. **Daily Lesson Plan Format**: Include objectives, materials, procedures, assessment

${uploadedFileContents.length > 0 ? `Based on the uploaded learning materials: ${uploadedFileContents.map(f => f.filename).join(", ")}` : ""}

Please format the response clearly with sections for each lesson plan type.`;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: contextMessage }],
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
