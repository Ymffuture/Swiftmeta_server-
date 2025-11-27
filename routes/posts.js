import express from "express";
import auth from "../middleware/auth.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";

const router = express.Router();

router.post("/", auth, async (req, res) => {
  const { title, body, images = [] } = req.body;
  const post = new Post({ author: req.user._id, title, body, images });
  await post.save();
  res.json({ post });
});

router.put("/:id", auth, async (req, res) => {
  const p = await Post.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });
  if (!p.author.equals(req.user._id)) return res.status(403).json({ message: "Forbidden" });

  Object.assign(p, req.body, { updatedAt: Date.now() });
  await p.save();
  res.json({ post: p });
});

router.delete("/:id", auth, async (req, res) => {
  const p = await Post.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Not found" });
  if (!p.author.equals(req.user._id)) return res.status(403).json({ message: "Forbidden" });

  await p.deleteOne();
  res.json({ message: "Deleted" });
});

router.get("/", async (_, res) => {
  const list = await Post.find().sort({ createdAt: -1 }).populate("author", "phone name avatar");
  res.json(list);
});

router.get("/:id", async (req, res) => {
  const p = await Post.findById(req.params.id).populate("author", "phone name avatar");
  const c = await Comment.find({ post: p._id }).populate("author", "phone name avatar").sort({ createdAt: 1 });
  res.json({ post: p, comments: c });
});

router.post("/:id/toggle-like", auth, async (req, res) => {
  const p = await Post.findById(req.params.id);
  const idx = p.likes.findIndex((id) => id.equals(req.user._id));

  idx >= 0 ? p.likes.splice(idx, 1) : p.likes.push(req.user._id);
  await p.save();
  res.json({ liked: idx < 0, count: p.likes.length });
});

router.post("/:id/comments", auth, async (req, res) => {
  const { text } = req.body;
  const c = new Comment({ post: req.params.id, author: req.user._id, text });
  await c.save();
  res.json(await c.populate("author", "phone name avatar"));
});

export default router;
