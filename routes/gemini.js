// routes/ai.js
import { Router } from "express";
import OpenAI from "openai";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { systemPrompt } from "./AiPrompt.js"; // make sure this file exports the prompt
import { authenticateJWT } from "../middleware/authentication.js";

const router = Router();

// ────────────────────────────────────────────────
// OpenRouter client (OpenAI-compatible)
// ────────────────────────────────────────────────
const openrouter = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://swiftmeta.vercel.app", // ← change to your real domain
    "X-Title": "SwiftMeta AI",
  },
});

router.post("/", authenticateJWT, async (req, res) => {
  const startTime = Date.now();

  try {
    const { prompt, conversationId } = req.body;

    if (!prompt?.trim()) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // ────────────────────────────────────────────────
    // 1. Find or create conversation
    // ────────────────────────────────────────────────
    let conversation;

    if (conversationId) {
      conversation = await Conversation.findOne({
        _id: conversationId,
        userId: req.user.id,
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
    } else {
      conversation = await Conversation.create({
        userId: req.user.id,
        title: prompt.trim().slice(0, 60) || "New Chat",
      });
    }

    // ────────────────────────────────────────────────
    // 2. Save user message
    // ────────────────────────────────────────────────
    await Message.create({
      conversationId: conversation._id,
      role: "user",
      content: prompt.trim(),
    });

    // ────────────────────────────────────────────────
    // 3. Load recent history (last 20 messages = ~40 turns)
    // ────────────────────────────────────────────────
    const history = await Message.find({
      conversationId: conversation._id,
    })
      .sort({ createdAt: 1 })
      .limit(20);

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    // ────────────────────────────────────────────────
    // 4. Call Kimi model via OpenRouter
    // ────────────────────────────────────────────────
    const completion = await openrouter.chat.completions.create({
      model: "moonshotai/kimi-k2.5",          // ← newest & strongest as of Feb 2026
      // model: "moonshotai/kimi-k2-0905",    // ← fallback if you prefer the Sep 2025 version
      messages,
      temperature: 0.65,
      max_tokens: 4096,
      top_p: 0.95,
      // stream: true,                        // ← uncomment if you want streaming (see note below)
    });

    const reply = completion?.choices?.[0]?.message?.content?.trim() || "";

    if (!reply) {
      throw new Error("Empty or invalid response from AI");
    }

    // ────────────────────────────────────────────────
    // 5. Save assistant message
    // ────────────────────────────────────────────────
    await Message.create({
      conversationId: conversation._id,
      role: "assistant",
      content: reply,
      latencyMs: Date.now() - startTime,
    });

    // ────────────────────────────────────────────────
    // 6. Return response to frontend
    // ────────────────────────────────────────────────
    res.json({
      reply,
      conversationId: conversation._id.toString(),
      latencyMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error("[AI Route Error]", {
      message: error.message,
      stack: error.stack?.slice(0, 300),
      status: error.status,
      code: error.code,
    });

    // Specific OpenRouter / OpenAI-style error handling
    if (error?.status === 401 || error?.code === "invalid_api_key") {
      return res.status(401).json({ error: "Invalid OpenRouter API key" });
    }

    if (error?.status === 429 || error?.code === "rate_limit_exceeded") {
      return res.status(429).json({ error: "Rate limit exceeded – please try again later" });
    }

    if (error?.message?.includes("model")) {
      return res.status(400).json({
        error: "Model not available. Try 'moonshotai/kimi-k2.5' or 'moonshotai/kimi-k2-0905'",
      });
    }

    // Generic fallback
    res.status(500).json({
      error: "AI request failed. Please try again.",
    });
  }
});

export default router;
