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

    // ✅ FIXED: correct user reference
    const userId = req.user.id;

    // 1. Get or create conversation
    let conversation = null;

    if (conversationId) {
      conversation = await Conversation.findOne({
        _id: conversationId,
        userId,
      });
    }

    if (!conversation) {
      conversation = await Conversation.create({
        userId,
        title: prompt.slice(0, 40),
      });
    }

    // 2. Save user message
    await Message.create({
      conversationId: conversation._id,
      role: "user",
      content: prompt,
    });

    // 3. Gemini AI call (FIXED)
    const genai = new GoogleGenAI(process.env.GEMINI_API_KEY);

    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${systemPrompt}\n\n${prompt}`,
            },
          ],
        },
      ],
    });

    // ✅ FIXED: proper response extraction
    const reply =
      response?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      console.error("Gemini empty response:", JSON.stringify(response, null, 2));
      throw new Error("Empty AI response from Gemini");
    }

    // 4. Save AI message
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
    res.status(500).json({
      error: "AI request failed",
      details: err.message,
    });
  }
});

export default router;
