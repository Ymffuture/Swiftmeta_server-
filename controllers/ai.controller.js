import { analyzeTicketAI } from "../services/gemini.service.js";

export const analyzeTicket = async (req, res) => {
  const { email, subject, message } = req.body;

  if (!email || !message) {
    return res.status(400).json({ error: "Email and message required" });
  }

  try {
    const ai = await analyzeTicketAI({ email, subject, message });

    // Flatten response for frontend convenience
    res.json({
      success: true,
      category: ai.category,
      urgency: ai.urgency,
      sentiment: ai.sentiment,
      suggestedSubject: ai.suggestedSubject,
      improvedMessage: ai.improvedMessage,
    });
  } catch (err) {
    console.error("Gemini AI failed:", err.message);

    res.status(500).json({
      success: false,
      category: null,
      urgency: null,
      sentiment: null,
      suggestedSubject: null,
      improvedMessage: null,
    });
  }
};
