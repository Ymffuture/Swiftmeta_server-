import { Router } from "express";
import OpenAI from "openai";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { systemPrompt } from "./AiPrompt.js";
import { authenticateJWT } from "../middleware/authentication.js";

const router = Router();

// ✅ Initialize Moonshot client (NEW endpoint)
const kimi = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: "https://api.moonshot.ai/v1",
});

router.post("/", authenticateJWT, async (req, res) => {
  const startTime = Date.now();

  try {
    const { prompt, conversationId } = req.body;

    if (!prompt?.trim()) {
      return res.status(400).json({
        error: "Prompt required",
      });
    }

    // Find or create conversation
    let conversation = conversationId
      ? await Conversation.findOne({
          _id: conversationId,
          userId: req.user.id,
        })
      : null;

    if (!conversation) {
      conversation = await Conversation.create({
        userId: req.user.id,
        title: prompt.slice(0, 40),
      });
    }

    // Save user message
    await Message.create({
      conversationId: conversation._id,
      role: "user",
      content: prompt,
    });

    // ✅ Call Moonshot API
    const completion = await kimi.chat.completions.create({
      model: "kimi-k2-0905-preview",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.55,
      max_tokens: 8192,
      top_p: 0.28,
      stream: false, // use true if you want streaming
    });

    // Extract reply
    const reply =
      completion.choices?.[0]?.message?.content ||
      "No response generated";

    // Save AI message
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

  } catch (error) {
    console.error("Moonshot error:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});

export default router;
