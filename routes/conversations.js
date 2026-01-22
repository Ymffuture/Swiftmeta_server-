import { Router } from "express";
import Conversation from "../models/Conversation.js";
import { authenticateJWT } from "../middleware/authocation.js";

const router = Router();

router.get("/", authenticateJWT, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      userId: req.user.id,
    })
      .sort({ lastMessageAt: -1 })
      .select("_id title lastMessageAt");

    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: "Failed to load conversations" });
  }
});

export default router;
