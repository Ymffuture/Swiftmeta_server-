import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    phone: { type: String, unique: true, sparse: true },
    email: { type: String, unique: true, sparse: true },
    name: { type: String },
    avatar: { type: String },
    emailOtp: {
      code: String,
      expiresAt: Date,
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export default mongoose.model("User", schema);
