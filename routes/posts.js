import express from "express";
import auth from "../middleware/auth.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import multer from "multer";
import mongoose from "mongoose";

const router = express.Router();
const upload = multer({ dest: "/tmp/uploads" }); // Replace with Cloudinary/S3 in prod

// Create post
router.post("/", auth, async (req, res) => {
  try {
    const { title, body, images = [] } = req.body;
    const post = await Post.create({
      author: req.user._id,
      title,
      body,
      images,
    });
    await post.populate("author", "name avatar phone");
    res.status(201).json(post);
  } catch (err) {
    console.error("CREATE POST ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// Update post
router.put("/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ msg: "Post not found" });
    if (!post.author.equals(req.user._id)) return res.status(403).json({ msg: "Forbidden" });

    Object.assign(post, req.body, { updatedAt: Date.now() });
    await post.save();
    await post.populate("author", "name avatar phone");
    res.json(post);
  } catch (err) {
    console.error("UPDATE POST ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// Delete post + cascade comments
router.delete("/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ msg: "Not found" });
    if (!post.author.equals(req.user._id)) return res.status(403).json({ msg: "Forbidden" });

    await Comment.deleteMany({ post: post._id });
    await post.deleteOne();
    res.json({ msg: "Post deleted" });
  } catch (err) {
    console.error("DELETE POST ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// Get all posts (latest first)
router.get("/", async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("author", "name avatar phone");
    res.json(posts);
  } catch (err) {
    console.error("GET POSTS ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// Get single post + comments (returns post object augmented with comments array)
router.get("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate("author", "name avatar phone");
    if (!post) return res.status(404).json({ msg: "Not found" });

    const comments = await Comment.find({ post: req.params.id })
      .populate("author", "name avatar phone")
      .sort({ createdAt: 1 });

    const postObj = post.toObject();
    postObj.comments = comments;
    res.json(postObj);
  } catch (err) {
    console.error("GET POST ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// Toggle like on post
router.post("/:id/toggle-like", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ msg: "Not found" });

    const idx = post.likes.findIndex((id) => id.equals(req.user._id));
    if (idx === -1) post.likes.push(req.user._id);
    else post.likes.splice(idx, 1);

    await post.save();
    res.json({ liked: idx === -1, likesCount: post.likes.length });
  } catch (err) {
    console.error("POST TOGGLE LIKE ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// Add comment
router.post("/:id/comments", auth, async (req, res) => {
  try {
    const { text, media = [], mentions = [] } = req.body;
    const comment = await Comment.create({
      post: req.params.id,
      author: req.user._id,
      text,
      media,
      mentions,
      replies: [],
      likes: [],
    });
    await comment.populate("author", "name avatar phone");
    res.status(201).json(comment);
  } catch (err) {
    console.error("ADD COMMENT ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// Toggle comment like (existing route kept)
router.post("/:postId/comments/:commentId/like", auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ msg: "Comment not found" });

    const idx = comment.likes.findIndex((id) => id.equals(req.user._id));
    if (idx === -1) comment.likes.push(req.user._id);
    else comment.likes.splice(idx, 1);

    await comment.save();
    res.json({ liked: idx === -1, likesCount: comment.likes.length });
  } catch (err) {
    console.error("COMMENT LIKE ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// Alias route: frontend uses "toggle-like" naming — support that as well
router.post("/:postId/comments/:commentId/toggle-like", auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ msg: "Comment not found" });

    const idx = comment.likes.findIndex((id) => id.equals(req.user._id));
    if (idx === -1) comment.likes.push(req.user._id);
    else comment.likes.splice(idx, 1);

    await comment.save();
    res.json({ liked: idx === -1, likesCount: comment.likes.length });
  } catch (err) {
    console.error("COMMENT TOGGLE LIKE ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// Add reply (push into comment.replies)
router.post("/:postId/comments/:commentId/replies", auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ msg: "Comment not found" });

    const reply = {
      _id: new mongoose.Types.ObjectId(),
      text: req.body.text,
      author: req.user._id,
      likes: [],
      createdAt: new Date(),
    };

    comment.replies.push(reply);
    await comment.save();

    // Populate the newly created reply's author info
    await comment.populate({
      path: "replies.author",
      select: "name avatar phone",
    });

    const createdReply = comment.replies.id(reply._id);
    res.status(201).json(createdReply);
  } catch (err) {
    console.error("ADD REPLY ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// Toggle reply like (existing naming)
router.post("/:postId/comments/:commentId/replies/:replyId/like", auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ msg: "Not found" });

    const reply = comment.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ msg: "Reply not found" });

    const idx = reply.likes.findIndex((id) => id.equals(req.user._id));
    if (idx === -1) reply.likes.push(req.user._id);
    else reply.likes.splice(idx, 1);

    await comment.save();
    res.json({ liked: idx === -1, likesCount: reply.likes.length });
  } catch (err) {
    console.error("REPLY LIKE ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// Alias for frontend naming
router.post("/:postId/comments/:commentId/replies/:replyId/toggle-like", auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ msg: "Not found" });

    const reply = comment.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ msg: "Reply not found" });

    const idx = reply.likes.findIndex((id) => id.equals(req.user._id));
    if (idx === -1) reply.likes.push(req.user._id);
    else reply.likes.splice(idx, 1);

    await comment.save();
    res.json({ liked: idx === -1, likesCount: reply.likes.length });
  } catch (err) {
    console.error("REPLY TOGGLE LIKE ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// Paginated replies
router.get("/:postId/comments/:commentId/replies", async (req, res) => {
  try {
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
  } catch (err) {
    console.error("PAGINATED REPLIES ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// DELETE comment (only comment author or post author can delete)
router.delete("/:postId/comments/:commentId", auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ msg: "Comment not found" });

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ msg: "Post not found" });

    const isCommentAuthor = comment.author.equals(req.user._id);
    const isPostAuthor = post.author.equals(req.user._id);

    if (!isCommentAuthor && !isPostAuthor) return res.status(403).json({ msg: "Forbidden" });

    await comment.deleteOne();
    res.json({ msg: "Comment deleted" });
  } catch (err) {
    console.error("DELETE COMMENT ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// DELETE reply (reply author or comment author or post author)
router.delete("/:postId/comments/:commentId/replies/:replyId", auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ msg: "Comment not found" });

    const reply = comment.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ msg: "Reply not found" });

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ msg: "Post not found" });

    const isReplyAuthor = reply.author.equals(req.user._id);
    const isCommentAuthor = comment.author.equals(req.user._id);
    const isPostAuthor = post.author.equals(req.user._id);

    if (!isReplyAuthor && !isCommentAuthor && !isPostAuthor) return res.status(403).json({ msg: "Forbidden" });

    reply.remove();
    await comment.save();

    res.json({ msg: "Reply deleted" });
  } catch (err) {
    console.error("DELETE REPLY ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// File upload (replace with Cloudinary/S3)
router.post("/upload", auth, upload.single("file"), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}`, type: req.file.mimetype });
});

export default router;
