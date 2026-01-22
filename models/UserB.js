import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, sparse: true },
    password: { type: String },
    googleId: { type: String },
    name: String,
    avatar: String,
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
