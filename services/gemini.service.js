import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generateAIResponse = async ({ email, subject, message }) => {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
  });

  const prompt = `
You are an AI assistant for a support ticket system.

STRICT RULES:
- Generate EXACTLY ONE suggestion
- No alternatives
- No lists
- No explanations
- No markdown
- One improved message only

Input ticket:
Email: ${email || "N/A"}
Subject: ${subject || "N/A"}
Message: ${message}

Return ONLY valid JSON in this format:

{
  "improvedMessage": ""
}
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // 🔒 Extract JSON safely
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON returned");

  return JSON.parse(match[0]);
};
