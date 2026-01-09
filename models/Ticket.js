import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },
    message: String,
  },
  { timestamps: true }
);

const TicketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, unique: true },
    email: String,
    subject: String,
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
  { timestamps: true }
);

export default mongoose.model("Ticket", TicketSchema);

