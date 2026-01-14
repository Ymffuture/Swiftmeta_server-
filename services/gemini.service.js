import { GoogleGenerativeAI } from "@google/genai"; // Use the correct package

const genAI = new GoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function analyzeTicketAI({ email, subject, message }) {
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

  const result = await model.generateContent({ prompt });

  // Adjust based on SDK version
  const text = result.output?.[0]?.content?.[0]?.text?.trim();
  if (!text) throw new Error("AI did not return any text");

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("Failed to parse AI response:", text);
    throw err;
  }
}
