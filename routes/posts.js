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

// ---------- Delete a reply ----------
router.delete("/posts/:postId/comments/:commentId/replies/:replyId", async (req, res) => {
  const { postId, commentId, replyId } = req.params;
  const post = await Post.findById(postId);
  if (!post) return res.status(404).send({ error: "Not found" });

  const comment = post.comments.id(commentId);
  if (!comment) return res.status(404).send({ error: "Comment not found" });

  const reply = comment.replies.id(replyId);
  if (!reply) return res.status(404).send({ error: "Reply not found" });

  // only author or post owner can delete (adjust policy as needed)
  if (String(reply.author._id) !== String(req.user._id) && String(post.author._id) !== String(req.user._id)) {
    return res.status(403).send({ error: "Not allowed" });
  }

  reply.remove();
  await post.save();
  res.json({ success: true });
});

// ---------- Like / Unlike comment ----------
router.post("/posts/:postId/comments/:commentId/like", async (req, res) => {
  const { postId, commentId } = req.params;
  const post = await Post.findById(postId);
  const comment = post.comments.id(commentId);
  const uid = req.user._id;

  const idx = comment.likes.findIndex(x => String(x) === String(uid));
  let liked = false;
  if (idx === -1) {
    comment.likes.push(uid);
    liked = true;
  } else {
    comment.likes.splice(idx, 1);
    liked = false;
  }

  await post.save();
  res.json({ liked, likesCount: comment.likes.length });
});

// ---------- Like / Unlike reply ----------
router.post("/posts/:postId/comments/:commentId/replies/:replyId/like", async (req, res) => {
  const { postId, commentId, replyId } = req.params;
  const post = await Post.findById(postId);
  const comment = post.comments.id(commentId);
  const reply = comment.replies.id(replyId);
  const uid = req.user._id;

  const idx = reply.likes.findIndex(x => String(x) === String(uid));
  let liked = false;
  if (idx === -1) { reply.likes.push(uid); liked = true; } 
  else { reply.likes.splice(idx, 1); liked = false; }

  await post.save();
  res.json({ liked, likesCount: reply.likes.length });
});

// ---------- Paginated replies (threaded infinite replies) ----------
router.get("/posts/:postId/comments/:commentId/replies", async (req, res) => {
  // ?page=1&pageSize=5
  const { postId, commentId } = req.params;
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const pageSize = Math.min(50, parseInt(req.query.pageSize || "5", 10));
  const post = await Post.findById(postId).lean();
  const comment = post.comments.find(c => String(c._id) === String(commentId));
  if (!comment) return res.status(404).send({ error: "Not found" });

  const total = comment.replies.length;
  const start = (page - 1) * pageSize;
  const paged = comment.replies.slice(start, start + pageSize);

  res.json({ replies: paged, page, pageSize, total });
});

// ---------- Edit comment ----------
router.put("/posts/:postId/comments/:commentId", async (req, res) => {
  const { text, plainText } = req.body;
  const post = await Post.findById(req.params.postId);
  const comment = post.comments.id(req.params.commentId);
  if (!comment) return res.status(404).send({ error: "Not found" });

  if (String(comment.author._id) !== String(req.user._id)) return res.status(403).send({ error: "Not allowed" });

  comment.text = text;
  comment.plainText = plainText || stripHtml(text);
  comment.edited = true;
  await post.save();
  res.json(comment);
});

// ---------- Edit reply (already shown earlier) ----------
router.put("/posts/:postId/comments/:commentId/replies/:replyId", async (req, res) => {
  // similar logic: validate owner, update text/plainText, mark edited
});

// ---------- Add comment with media/mentions ----------
router.post("/posts/:postId/comments", async (req, res) => {
  // body: { text, plainText, mentions:[{userId,username}], media: [{url,type}] }
  const post = await Post.findById(req.params.postId);
  const comment = {
    text: req.body.text,
    plainText: req.body.plainText,
    mentions: req.body.mentions || [],
    media: req.body.media || [],
    author: { _id: req.user._id, name: req.user.name, avatar: req.user.avatar }
  };
  post.comments.push(comment);
  await post.save();
  const saved = post.comments[post.comments.length - 1];
  // Optionally send notifications to mentions...
  res.json(saved);
});

// ---------- Upload endpoint (image/gif) ----------
import multer from "multer";
const upload = multer({ dest: "/tmp/uploads" });
// If using Cloudinary, handle upload and return hosted URL
router.post("/upload", upload.single("file"), async (req, res) => {
  // Example: upload to Cloudinary and return URL
  // const result = await cloudinary.uploader.upload(req.file.path, { folder: "comments" });
  // return res.json({ url: result.secure_url, public_id: result.public_id });
  // For now, return a mock URL or implement file store
  res.json({ url: `/uploads/${req.file.filename}`, type: req.file.mimetype });
});


export default router;
