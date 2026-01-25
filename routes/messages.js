import { Router } from "express";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { authenticateJWT } from "../middleware/authentication.js";

const router = Router();

/**
 * GET messages for a conversation
 */
router.get("/:conversationId", authenticateJWT, async (req, res) => {
  const { conversationId } = req.params;

  // Ensure conversation belongs to user (SECURITY)
  const convo = await Conversation.findOne({
    _id: conversationId,
    userId: req.user.id,
  });

  if (!convo) {
    return res.status(403).json({ error: "Unauthorized access" });
  }

  const messages = await Message.find({ conversationId })
    .sort({ createdAt: 1 })
    .lean();

  res.json(messages);
});

export default router;
