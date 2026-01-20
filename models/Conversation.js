import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sessionId: { type: String, index: true },
    title: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Conversation", conversationSchema);
