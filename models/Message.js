import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: { type: String, required: true },
    model: { type: String },
    tokens: { type: Number },
    latencyMs: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);
