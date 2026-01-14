import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY_2) {
  throw new Error("GEMINI_API_KEY_2 is missing in environment variables");
}

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY_2,
});

export const analyzeTicketAI = async ({ email, subject, message }) => {
  if (!message) {
    throw new Error("Message required");
  }

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
Email: ${email || "UNKNOWN"}
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

  const result = await model.generateContent({ prompt });

  const rawText =
    result?.output?.[0]?.content?.[0]?.text?.trim();

  if (!rawText) {
    throw new Error("Gemini returned empty output");
  }

  /* ----------------------------------
     SAFE JSON EXTRACTION
  ----------------------------------- */
  let jsonText = rawText;

  // Gemini sometimes adds text before/after JSON
  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");

  if (start !== -1 && end !== -1) {
    jsonText = rawText.slice(start, end + 1);
  }

  try {
    return JSON.parse(jsonText);
  } catch (err) {
    console.error("Invalid JSON from Gemini:", rawText);
    throw new Error("Gemini returned invalid JSON");
  }
};
