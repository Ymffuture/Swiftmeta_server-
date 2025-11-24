import mongoose from "mongoose";

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: String,
  createdAt: { type: Date, default: Date.now },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null } // for Facebook-style threaded replies
});

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true }, // canonical phone string
  email: { type: String, required: true, unique: true },
  username: { type: String }, // editable; default = phone
  avatarUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
  // otp fields (short-lived)
  otp: {
    code: String,
    expiresAt: Date
  }
});

export default mongoose.model("User", userSchema);
