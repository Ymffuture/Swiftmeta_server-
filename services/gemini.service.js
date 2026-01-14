import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const analyzeTicketAI = async (req, res) => {
  const { email, subject, message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  const model = genAI.getModel("gemini-2.5-flash");

  const prompt = `
Analyze this support ticket and respond ONLY with valid JSON.

Rules:
- No markdown
- No explanation
- No extra text

Allowed categories:
Authentication, Billing, Bug, Feature Request, General, Other

Allowed urgency:
Low, Medium, High

Allowed sentiment:
Calm, Frustrated, Angry

INPUT:
Email: ${email}
Subject: ${subject || "EMPTY"}
Message: ${message}

OUTPUT FORMAT:
{
  "category": "",
  "urgency": "",
  "sentiment": "",
  "suggestedSubject": "",
  "improvedMessage": ""
}
`;

  try {
    const result = await model.generateContent({ prompt });
    const text = result.output?.[0]?.content?.[0]?.text?.trim();

    if (!text) return res.status(500).json({ error: "AI did not return text" });

    const json = JSON.parse(text);
    res.json(json);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI failed to process ticket" });
  }
};
