import { generateAIResponse } from "../services/gemini.service.js";

export const analyzeTicket = async (req, res) => {
  try {
    const { email, subject, message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({
        success: false,
        error: "Message is required",
      });
    }

    const aiResult = await generateAIResponse({
      email,
      subject,
      message,
    });

    res.json({
      success: true,
      data: aiResult, // ✅ ALWAYS wrapped
    });
  } catch (err) {
    console.error("AI controller error:", err.message);

    res.status(500).json({
      success: false,
      error: "AI processing failed",
    });
  }
};
