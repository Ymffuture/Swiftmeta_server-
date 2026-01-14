// services/gemini.service.js
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY_2) {
  throw new Error("GEMINI_API_KEY_2 is missing in environment variables");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_2);

export const analyzeTicketAI = async ({ email, subject, message }) => {
  if (!message) {
    throw new Error("Message required");
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash", // Correct model name (gemini-2.5-flash does not exist yet)
    generationConfig: {
      responseMimeType: "application/json",
      // Strict schema enforcement – Gemini will only output valid JSON matching this structure
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          category: {
            type: SchemaType.STRING,
            enum: ["Authentication", "Billing", "Bug", "Feature Request", "General", "Other"],
          },
          urgency: {
            type: SchemaType.STRING,
            enum: ["Low", "Medium", "High"],
          },
          sentiment: {
            type: SchemaType.STRING,
            enum: ["Calm", "Frustrated", "Angry"],
          },
          suggestedSubject: {
            type: SchemaType.STRING,
          },
          improvedMessage: {
            type: SchemaType.STRING,
          },
        },
        required: [
          "category",
          "urgency",
          "sentiment",
          "suggestedSubject",
          "improvedMessage",
        ],
      },
    },
  });

  const prompt = `
You are an expert support ticket classifier.

Analyze the ticket below and output ONLY the JSON object (no markdown, no explanation, no extra text).

Allowed categories: Authentication, Billing, Bug, Feature Request, General, Other
Allowed urgency: Low, Medium, High
Allowed sentiment: Calm, Frustrated, Angry

Guidelines:
- category: main topic of the issue
- urgency: High if blocking access or critical, Medium if affecting usage, Low if informational
- sentiment: tone of the message
- suggestedSubject: concise, clear subject line summarizing the issue
- improvedMessage: rewritten message for clarity/politeness if needed; otherwise keep original

INPUT:
Email: ${email || "UNKNOWN"}
Subject: ${subject || "EMPTY"}
Message: ${message}
`;

  const result = await model.generateContent(prompt);

  const rawText = result.response.text()?.trim();

  if (!rawText) {
    throw new Error("Gemini returned empty output");
  }

  try {
    // With responseMimeType + responseSchema, this should always be valid JSON
    return JSON.parse(rawText);
  } catch (err) {
    console.error("Invalid JSON from Gemini (unexpected):", rawText);
    throw new Error("Gemini returned invalid JSON");
  }
};
