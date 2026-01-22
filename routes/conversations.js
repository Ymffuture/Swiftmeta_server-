import { Router } from "express";
import Conversation from "../models/Conversation.js";
import { authenticateJWT } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticateJWT, async (req, res) => {
  const conversations = await Conversation.find({ userId: req.user.id })
    .sort({ lastMessageAt: -1 })
    .select("_id title lastMessageAt");

  res.json(conversations);
});

export default router;
