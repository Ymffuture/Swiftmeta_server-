import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { systemPrompt } from "./AiPrompt.js";
import { authenticateSupabase } from "../middleware/supabaseAuth.js";

const router = Router();

router.post("/", authenticateSupabase, async (req, res) => {
  const startTime = Date.now();
  try {
    const { prompt } = req.body;
    if (!prompt?.trim()) return res.status(400).json({ error: "Prompt is required" });

    // 1️⃣ Get or create conversation for this Supabase user
    let conversation = await Conversation.findOne({ userId: req.userId });
    if (!conversation) {
      conversation = await Conversation.create({
        userId: req.userId,
        title: prompt.slice(0, 40),
      });
    }

    // 2️⃣ Save user message
    await Message.create({
      conversationId: conversation._id,
      role: "user",
      content: prompt,
      model: "gemini-2.5-flash",
    });

    // 3️⃣ Call Gemini AI
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const finalPrompt = `${systemPrompt}\nUser: ${prompt}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
    });

    const reply = response?.text;
    if (!reply) throw new Error("Empty AI response");

    const latency = Date.now() - startTime;

    // 4️⃣ Save AI reply
    await Message.create({
      conversationId: conversation._id,
      role: "assistant",
      content: reply,
      model: "gemini-2.5-flash",
      latencyMs: latency,
    });

    res.json({ reply, conversationId: conversation._id });
  } catch (err) {
    console.error("AI Chat Error:", err);
    res.status(500).json({ error: "AI request failed" });
  }
});

export default router;
