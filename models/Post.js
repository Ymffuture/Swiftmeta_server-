// models/Post.js (mongoose)
import mongoose from "mongoose";

const ReplySchema = new mongoose.Schema({
  text: String,                     // rich text (HTML)
  plainText: String,                // plain text for search/mentions
  media: [{ url: String, type: String }], // images, gifs
  mentions: [{ userId: mongoose.Schema.Types.ObjectId, username: String }],
  author: {
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    avatar: String
  },
  likes: [{ type: mongoose.Schema.Types.ObjectId }], // user ids
  createdAt: { type: Date, default: Date.now },
  edited: { type: Boolean, default: false }
});

const CommentSchema = new mongoose.Schema({
  text: String,
  plainText: String,
  media: [{ url: String, type: String }],
  mentions: [{ userId: mongoose.Schema.Types.ObjectId, username: String }],
  author: {
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    avatar: String
  },
  likes: [{ type: mongoose.Schema.Types.ObjectId }],
  edited: { type: Boolean, default: false },
  replies: [ReplySchema]
});

const PostSchema = new mongoose.Schema({
  title: String,
  body: String,
  images: [String],
  author: { _id: mongoose.Schema.Types.ObjectId, name: String, avatar: String },
  likes: [{ type: mongoose.Schema.Types.ObjectId }],
  comments: [CommentSchema],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Post", PostSchema);
