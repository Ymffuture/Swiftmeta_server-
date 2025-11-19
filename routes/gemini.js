import { Router } from "express";
import { GoogleGenAI } from "@google/genai";

const router = Router();

const systemPrompt = `
You are the official swiftAI in short swift for SwiftMeta.

Your responsibilities:
- Answer user questions clearly and professionally.
- Provide accurate information related to technology, coding, web development, AI, website build ideas, and SwiftMeta services.
- Keep responses short, useful, and easy to understand.
- Maintain a friendly, respectful tone at all times.
`;

router.post("/", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || prompt.trim() === "") {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Initialize AI client
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const finalPrompt = `${systemPrompt}\nUser: ${prompt}`;

    // Generate content using Gemini 2.5 Flash
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: finalPrompt }],
        },
      ],
    });

    const reply = response?.text;

    if (!reply) {
      return res.status(500).json({ error: "AI returned empty response" });
    }

    res.json({ reply });
  } catch (err) {
    console.error("AI Chat Error:", err);
    res.status(500).json({ error: "AI request failed" });
  }
});

export default router;
