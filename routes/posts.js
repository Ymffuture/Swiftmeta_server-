import express from "express";
import auth from "../middleware/auth.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ dest: "/tmp/uploads" }); // Replace with Cloudinary/S3 in prod

// Create post
router.post("/", auth, async (req, res) => {
  const { title, body, images = [] } = req.body;
  const post = await Post.create({
    author: req.user._id,
    title,
    body,
    images,
  });
  await post.populate("author", "name avatar phone");
  res.status(201).json(post);
});

// Update post
router.put("/:id", auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ msg: "Post not found" });
  if (!post.author.equals(req.user._id)) return res.status(403).json({ msg: "Forbidden" });

  Object.assign(post, req.body, { updatedAt: Date.now() });
  await post.save();
  await post.populate("author", "name avatar phone");
  res.json(post);
});

// Delete post + cascade comments
router.delete("/:id", auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ msg: "Not found" });
  if (!post.author.equals(req.user._id)) return res.status(403).json({ msg: "Forbidden" });

  await Comment.deleteMany({ post: post._id });
  await post.deleteOne();
  res.json({ msg: "Post deleted" });
});

// Get all posts (latest first)
router.get("/", async (req, res) => {
  const posts = await Post.find()
    .sort({ createdAt: -1 })
    .populate("author", "name avatar phone");
  res.json(posts);
});

// Get single post + comments
router.get("/:id", async (req, res) => {
  const post = await Post.findById(req.params.id).populate("author", "name avatar phone");
  if (!post) return res.status(404).json({ msg: "Not found" });

  const comments = await Comment.find({ post: req.params.id })
    .populate("author", "name avatar phone")
    .sort({ createdAt: 1 });

  res.json({ post, comments });
});

// Toggle like on post
router.post("/:id/toggle-like", auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ msg: "Not found" });

  const idx = post.likes.findIndex((id) => id.equals(req.user._id));
  idx === -1 ? post.likes.push(req.user._id) : post.likes.splice(idx, 1);

  await post.save();
  res.json({ liked: idx === -1, count: post.likes.length });
});

// Add comment
router.post("/:id/comments", auth, async (req, res) => {
  const { text, media = [], mentions = [] } = req.body;
  const comment = await Comment.create({
    post: req.params.id,
    author: req.user._id,
    text,
    media,
    mentions,
  });
  await comment.populate("author", "name avatar phone");
  res.status(201).json(comment);
});

// Toggle comment like
router.post("/:postId/comments/:commentId/like", auth, async (req, res) => {
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) return res.status(404).json({ msg: "Comment not found" });

  const idx = comment.likes.includes(req.user._id) ? comment.likes.indexOf(req.user._id) : -1;
  idx === -1 ? comment.likes.push(req.user._id) : comment.likes.splice(idx, 1);

  await comment.save();
  res.json({ liked: idx === -1, count: comment.likes.length });
});

// Add reply
router.post("/:postId/comments/:commentId/replies", auth, async (req, res) => {
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) return res.status(404).json({ msg: "Comment not found" });

  const reply = {
    text: req.body.text,
    author: req.user._id,
    createdAt: new Date(),
  };
  comment.replies.push(reply);
  await comment.save();

  res.json(comment.replies.at(-1));
});

// Toggle reply like
router.post("/:postId/comments/:commentId/replies/:replyId/like", auth, async (req, res) => {
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) return res.status(404).json({ msg: "Not found" });

  const reply = comment.replies.id(req.params.replyId);
  if (!reply) return res.status(404).json({ msg: "Reply not found" });

  const idx = reply.likes.includes(req.user._id) ? reply.likes.indexOf(req.user._id) : -1;
  idx === -1 ? reply.likes.push(req.user._id) : reply.likes.splice(idx, 1);

  await comment.save();
  res.json({ liked: idx === -1, count: reply.likes.length });
});

// Paginated replies
router.get("/:postId/comments/:commentId/replies", async (req, res) => {
  const { page = 1, pageSize = 10 } = req.query;
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) return res.status(404).json({ msg: "Not found" });

  const start = (page - 1) * pageSize;
  const replies = comment.replies.slice(start, start + +pageSize);

  res.json({
    replies,
    page: +page,
    pageSize: +pageSize,
    total: comment.replies.length,
  });
});

// File upload (replace with Cloudinary/S3)
router.post("/upload", auth, upload.single("file"), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}`, type: req.file.mimetype });
});

export default router;
