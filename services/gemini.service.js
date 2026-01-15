// services/gemini.service.js
import { GoogleGenerativeAI } from "@google/generative-ai";   // ← correct package

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generateAIResponse = async ({ email, subject, message }) => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",           // or gemini-1.5-pro, gemini-2.0-flash etc
    });

    const prompt = `Analyze this support ticket and respond **ONLY** with valid JSON. No markdown, no explanation, no extra text.

Allowed categories: Authentication, Billing, Bug, Feature Request, General, Other
Allowed urgency: Low, Medium, High
Allowed sentiment: Calm, Frustrated, Angry

INPUT:
Email: ${email || "not provided"}
Subject: ${subject || "EMPTY"}
Message: ${message}

OUTPUT FORMAT (must be valid JSON):
{
  "category": "",
  "urgency": "",
  "sentiment": "",
  "suggestedSubject": "",
  "improvedMessage": ""
}`;

    const result = await model.generateContent(prompt);

    const responseText = result.response.text().trim();

    try {
      const json = JSON.parse(responseText);
      return json;
    } catch (parseErr) {
      console.error("AI returned invalid JSON:", responseText);
      throw new Error("Invalid JSON from Gemini");
    }
  } catch (err) {
    console.error("Gemini error:", err);
    throw err;
  }
};
