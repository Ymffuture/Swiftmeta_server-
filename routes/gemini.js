import { Router } from "express";
import OpenAI from "openai"; // Kimi uses OpenAI-compatible API
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { systemPrompt } from "./AiPrompt.js";
import { authenticateJWT } from "../middleware/authentication.js";

const router = Router();

router.post("/", authenticateJWT, async (req, res) => {
  const startTime = Date.now();

  try {
    const { prompt, conversationId } = req.body;
    if (!prompt?.trim())
      return res.status(400).json({ error: "Prompt required" });

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

    await Message.create({
      conversationId: conversation._id,
      role: "user",
      content: prompt,
    });

    // Initialize Kimi AI client (OpenAI-compatible)
    const kimi = new OpenAI({
      apiKey: process.env.KIMI_API_KEY,
      baseURL: "https://api.moonshot.cn/v1",
    });

    const response = await kimi.chat.completions.create({
      model: "kimi-k2-5", // or "kimi-k2", "kimi-k1-5", "kimi-k1"
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    const reply = response.choices[0]?.message?.content;

    if (!reply) throw new Error("Empty AI response");

    await Message.create({
      conversationId: conversation._id,
      role: "assistant",
      content: reply,
      latencyMs: Date.now() - startTime,
    });

    res.json({ reply, conversationId: conversation._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
