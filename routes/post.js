const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Post = require("../models/Post");
const Comment = require("../models/Comment");

// create post
router.post("/", auth, async (req, res) => {
  const { title, body, images = [] } = req.body;
  const post = new Post({ author: req.user._id, title, body, images });
  await post.save();
  res.json({ post });
});

// edit post
router.put("/:id", auth, async (req, res) => {
  const { id } = req.params;
  const post = await Post.findById(id);
  if (!post) return res.status(404).json({ message: "Not found" });
  if (!post.author.equals(req.user._id)) return res.status(403).json({ message: "Forbidden" });
  const { title, body, images } = req.body;
  post.title = title ?? post.title;
  post.body = body ?? post.body;
  post.images = images ?? post.images;
  post.updatedAt = Date.now();
  await post.save();
  res.json({ post });
});

// delete
router.delete("/:id", auth, async (req, res) => {
  const { id } = req.params;
  const post = await Post.findById(id);
  if (!post) return res.status(404).json({ message: "Not found" });
  if (!post.author.equals(req.user._id)) return res.status(403).json({ message: "Forbidden" });
  await post.remove();
  res.json({ message: "Deleted" });
});

// list posts (feed)
router.get("/", async (req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 }).populate("author", "phone name");
  res.json(posts);
});

// get single post with comments
router.get("/:id", async (req, res) => {
  const post = await Post.findById(req.params.id).populate("author", "phone name");
  const comments = await Comment.find({ post: post._id }).populate("author", "phone name").sort({ createdAt: 1 });
  res.json({ post, comments });
});

// like/unlike
router.post("/:id/toggle-like", auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Not found" });
  const idx = post.likes.findIndex(id => id.equals(req.user._id));
  if (idx >= 0) {
    post.likes.splice(idx, 1);
  } else {
    post.likes.push(req.user._id);
  }
  await post.save();
  res.json({ likesCount: post.likes.length, liked: idx < 0 });
});

// comments
router.post("/:id/comments", auth, async (req, res) => {
  const postId = req.params.id;
  const { text } = req.body;
  const comment = new Comment({ post: postId, author: req.user._id, text });
  await comment.save();
  const populated = await comment.populate("author", "phone name");
  res.json(populated);
});

// delete comment (owner of comment or post owner)
router.delete("/comments/:commentId", auth, async (req, res) => {
  const c = await Comment.findById(req.params.commentId);
  if (!c) return res.status(404).json({ message: "Not found" });
  const post = await Post.findById(c.post);
  if (!c.author.equals(req.user._id) && !post.author.equals(req.user._id)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  await c.remove();
  res.json({ message: "Deleted" });
});

module.exports = router;
