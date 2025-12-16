import express from "express";
import User from "../models/User.js";
import auth  from "../middleware/auth.js";
const router = express.Router();

router.put("/me", requireAuth, async (req, res) => {
  const { username, avatarUrl } = req.body;
  if (username) req.user.username = username;
  if (avatarUrl) req.user.avatarUrl = avatarUrl;
  await req.user.save();
  res.json(req.user);
});

export default router;
 
