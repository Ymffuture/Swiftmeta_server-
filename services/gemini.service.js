import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generateAIResponse = async ({ email, subject, message }) => {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
  });

  const prompt = `
Return ONLY valid JSON. No markdown. No explanation. No extra text.

Allowed categories: Authentication, Billing, Bug, Feature Request, General, Other
Allowed urgency: Low, Medium, High
Allowed sentiment: Calm, Frustrated, Angry

INPUT:
Email: ${email || "not provided"}
Subject: ${subject || "EMPTY"}
Message: ${message}

JSON FORMAT:
{
  "category": "",
  "urgency": "",
  "sentiment": "",
  "suggestedSubject": "",
  "improvedMessage": ""
}
`;

  const result = await model.generateContent(prompt);

  const rawText = result.response.text();

  // ✅ SAFELY extract JSON even if Gemini adds text
  const match = rawText.match(/\{[\s\S]*\}/);

  if (!match) {
    throw new Error("No JSON found in Gemini response");
  }

  try {
    return JSON.parse(match[0]);
  } catch {
    console.error("Invalid JSON:", rawText);
    throw new Error("Failed to parse Gemini JSON");
  }
};
