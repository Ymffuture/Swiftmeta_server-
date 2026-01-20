import { Router } from "express";
import Conversation from "../models/Conversation.js";
import { authenticateSupabase } from "../middleware/supabaseAuth.js";

const router = Router();

/**
 * GET /api/conversations
 * Returns all conversations for logged-in user
 */
router.get("/", authenticateSupabase, async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({ userId })
      .sort({ lastMessageAt: -1 })
      .select("_id title lastMessageAt");

    res.json(conversations);
  } catch (err) {
    console.error("Fetch conversations error:", err);
    res.status(500).json({ error: "Failed to load conversations" });
  }
});

export default router;
