import { analyzeTicketAI } from "../services/gemini.service.js";

export const analyzeTicket = async (req, res) => {
  const { email, subject, message } = req.body;

  if (!email || !message) {
    return res.status(400).json({ error: "Email and message required" });
  }

  try {
    const ai = await analyzeTicketAI({ email, subject, message });

    res.json({
      success: true,
      ai,
    });
  } catch (err) {
    console.error("Gemini AI failed:", err.message);

    res.json({
      success: false,
      ai: null,
    });
  }
};
