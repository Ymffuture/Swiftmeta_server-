import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function analyzeTicketAI({ email, subject, message }) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return JSON.parse(text);
}
