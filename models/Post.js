import mongoose from "mongoose";

const commentSubschema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  nameSnapshot: String, // username at time of comment
  text: String,
  parent: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null },
  createdAt: { type: Date, default: Date.now }
});

const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  authorPhoneSnapshot: String, // store phone as default display name
  title: { type: String, required: true },
  body: { type: String, required: true },
  images: [String], // cloudinary urls
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  comments: [commentSubschema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
}, { timestamps: true });

export default mongoose.model("Post", postSchema);
