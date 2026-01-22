import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
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

    const genai = new GoogleGenAI(process.env.GEMINI_API_KEY);

    const response = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\nUser: ${prompt}` }],
        },
      ],
    });

    const reply =
      response.text ||
      response.candidates?.[0]?.content?.parts?.[0]?.text;

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
