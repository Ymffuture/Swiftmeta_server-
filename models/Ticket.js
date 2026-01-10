import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const TicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      unique: true,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      default: "No subject",
    },
    status: {
      type: String,
      enum: ["open", "pending", "closed"],
      default: "open",
    },
    lastReplyBy: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    messages: [MessageSchema],
  },
  {
    timestamps: true, // ✅ REQUIRED
  }
);

export default mongoose.model("Ticket", TicketSchema);
