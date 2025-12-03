
import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema({
  text: String,
  author: {
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    avatar: String
  },
  createdAt: { type: Date, default: Date.now }
});

const PostSchema = new mongoose.Schema({
  title: String,
  body: String,
  images: [String],
  author: {
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    avatar: String
  },
  likes: [mongoose.Schema.Types.ObjectId],
  comments: [CommentSchema],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Post", PostSchema);

