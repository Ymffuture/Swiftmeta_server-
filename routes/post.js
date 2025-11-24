import express from "express";
import Post from "../models/Post.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

// Create post
router.post("/", requireAuth, async (req, res) => {
  const { title, body, images } = req.body;
  const post = await Post.create({
    author: req.user._id,
    authorPhoneSnapshot: req.user.phone,
    title,
    body,
    images: images || []
  });
  res.json(post);
});

// Read posts (pagination)
router.get("/", async (req, res) => {
  const page = parseInt(req.query.page || "1");
  const limit = Math.min(50, parseInt(req.query.limit || "10"));
  const skip = (page - 1) * limit;

  const posts = await Post.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate("author", "username avatarUrl phone");
  const total = await Post.countDocuments();
  res.json({ posts, total, page, limit });
});

// Single post
router.get("/:id", async (req, res) => {
  const post = await Post.findById(req.params.id).populate("author", "username avatarUrl phone");
  if (!post) return res.status(404).json({ message: "Not found" });
  res.json(post);
});

// Update post (only author)
router.put("/:id", requireAuth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Not found" });
  if (!post.author.equals(req.user._id)) return res.status(403).json({ message: "Forbidden" });

  const { title, body, images } = req.body;
  post.title = title ?? post.title;
  post.body = body ?? post.body;
  post.images = images ?? post.images;
  post.updatedAt = new Date();
  await post.save();
  res.json(post);
});

// Delete
router.delete("/:id", requireAuth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Not found" });
  if (!post.author.equals(req.user._id)) return res.status(403).json({ message: "Forbidden" });
  await post.remove();
  res.json({ ok: true });
});

// Like / unlike
router.post("/:id/like", requireAuth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Not found" });
  const idx = post.likes.findIndex((id) => id.equals(req.user._id));
  if (idx >= 0) {
    post.likes.splice(idx, 1); // unlike
  } else {
    post.likes.push(req.user._id);
  }
  await post.save();
  res.json({ likesCount: post.likes.length, liked: idx < 0 });
});

// Comments: add comment / reply
router.post("/:id/comments", requireAuth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Not found" });
  const { text, parent } = req.body;
  const comment = { author: req.user._id, nameSnapshot: req.user.username || req.user.phone, text, parent: parent || null };
  post.comments.push(comment);
  await post.save();
  res.json(post.comments[post.comments.length - 1]);
});

export default router;
 
