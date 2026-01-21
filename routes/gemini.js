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
    const { prompt, conversationId } = req.body;
    if (!prompt?.trim()) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    /* --------------------------------------------------
       1️⃣ Get or create conversation
    -------------------------------------------------- */
    let conversation;

    if (conversationId) {
      conversation = await Conversation.findOne({
        _id: conversationId,
        userId: req.userId,
      });
    }

    if (!conversation) {
      conversation = await Conversation.create({
        userId: req.userId,
        title: prompt.slice(0, 40),
      });
    }

    /* --------------------------------------------------
       2️⃣ Save USER message
    -------------------------------------------------- */
    await Message.create({
      conversationId: conversation._id,
      role: "user",
      content: prompt,
    });

    /* --------------------------------------------------
       3️⃣ Call Gemini
    -------------------------------------------------- */
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\nUser: ${prompt}` }],
        },
      ],
    });

    const reply = response.response.text(); // ✅ FIX

    if (!reply) throw new Error("Empty AI response");

    /* --------------------------------------------------
       4️⃣ Save AI message
    -------------------------------------------------- */
    await Message.create({
      conversationId: conversation._id,
      role: "assistant",
      content: reply,
      latencyMs: Date.now() - startTime,
    });

    res.json({
      reply,
      conversationId: conversation._id,
    });
  } catch (err) {
    console.error("AI Chat Error:", err);
    res.status(500).json({ error: "AI request failed" });
  }
});

export default router;
