// controllers/ai.controller.js
import { generateAIResponse } from "../services/gemini.service.js";

export const analyzeTicket = async (req, res) => {
  try {
    const { email, subject, message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const aiResult = await generateAIResponse({ email, subject, message });

    res.json({
      success: true,
      ...aiResult
    });
  } catch (err) {
    console.error("AI controller error:", err.message);
    res.status(500).json({
      success: false,
      error: "AI processing failed",
      details: err.message.includes("JSON") ? "Invalid response format" : "Service error"
    });
  }
};
